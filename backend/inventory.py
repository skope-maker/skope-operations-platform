from fastapi import HTTPException
from db import db, uid, now_iso, today_str, insert, next_no

TXN_TYPES = [
    'opening', 'purchase_receipt', 'store_issue', 'transfer', 'production_consume',
    'production_output', 'recipe_consumption', 'wastage', 'rd_consumption',
    'stock_return', 'adjustment',
]


async def get_unit(code):
    u = await db.units.find_one({'code': code}, {'_id': 0})
    if not u:
        u = await db.units.find_one({'name': code}, {'_id': 0})
    if not u:
        raise HTTPException(400, f'Unknown unit: {code}')
    return u


async def to_base(qty: float, unit_code: str):
    u = await get_unit(unit_code)
    return qty * u['factor'], u['family']


async def base_to_unit(qty_base: float, unit_code: str) -> float:
    u = await get_unit(unit_code)
    return qty_base / u['factor']


async def source_location(location_id: str):
    """Supply source for a kitchen: its parent in the store→base→normal chain, else the main store."""
    loc = await db.kitchens.find_one({'id': location_id}, {'_id': 0})
    if loc and loc.get('parent_id'):
        parent = await db.kitchens.find_one({'id': loc['parent_id'], 'deleted': {'$ne': True}}, {'_id': 0})
        if parent:
            return parent
    if loc and loc.get('type') == 'store':
        return loc
    return await db.kitchens.find_one({'type': 'store', 'deleted': {'$ne': True}}, {'_id': 0})


async def stock_base(item_id: str, location_id: str) -> float:
    ins = await db.inventory_transactions.aggregate([
        {'$match': {'item_id': item_id, 'to_location_id': location_id}},
        {'$group': {'_id': None, 'q': {'$sum': '$qty_base'}}},
    ]).to_list(1)
    outs = await db.inventory_transactions.aggregate([
        {'$match': {'item_id': item_id, 'from_location_id': location_id}},
        {'$group': {'_id': None, 'q': {'$sum': '$qty_base'}}},
    ]).to_list(1)
    return (ins[0]['q'] if ins else 0) - (outs[0]['q'] if outs else 0)


async def stock_map(location_id: str):
    result = {}
    ins = await db.inventory_transactions.aggregate([
        {'$match': {'to_location_id': location_id}},
        {'$group': {'_id': '$item_id', 'q': {'$sum': '$qty_base'}}},
    ]).to_list(10000)
    outs = await db.inventory_transactions.aggregate([
        {'$match': {'from_location_id': location_id}},
        {'$group': {'_id': '$item_id', 'q': {'$sum': '$qty_base'}}},
    ]).to_list(10000)
    for r in ins:
        result[r['_id']] = result.get(r['_id'], 0) + r['q']
    for r in outs:
        result[r['_id']] = result.get(r['_id'], 0) - r['q']
    return result


async def is_locked(date: str, location_id: str) -> bool:
    lock = await db.day_locks.find_one({'date': date, 'location_id': location_id, 'locked': True})
    return lock is not None


async def post_txn(item_id, qty_base, txn_type, *, from_location_id=None, to_location_id=None,
                   brand_id=None, reference_id=None, reference_no=None, user=None, remarks='',
                   qty=None, unit=None, date=None, rate_per_base=0, allow_negative=False,
                   batch_number=None, expiry_date=None):
    date = date or today_str()
    if qty_base <= 0:
        raise HTTPException(400, 'Quantity must be greater than zero')
    for loc in (from_location_id, to_location_id):
        if loc and await is_locked(date, loc) and (not user or user.get('role') != 'admin'):
            raise HTTPException(400, f'Day {date} is locked for this location. Only admin can reopen it.')
    if from_location_id and not allow_negative:
        avail = await stock_base(item_id, from_location_id)
        if avail + 1e-6 < qty_base:
            item = await db.items.find_one({'id': item_id}, {'_id': 0})
            name = item['name'] if item else item_id
            raise HTTPException(400, f'Insufficient stock for {name}. Available: {round(avail, 3)} base, required: {round(qty_base, 3)} base.')
    txn_no = await next_no('txn', 'TXN')
    doc = await insert('inventory_transactions', {
        'id': uid(),
        'txn_no': txn_no,
        'date': date,
        'created_at': now_iso(),
        'item_id': item_id,
        'qty_base': qty_base,
        'qty': qty if qty is not None else qty_base,
        'unit': unit or 'base',
        'from_location_id': from_location_id,
        'to_location_id': to_location_id,
        'brand_id': brand_id,
        'txn_type': txn_type,
        'reference_id': reference_id,
        'reference_no': reference_no,
        'created_by': user.get('name') if user else 'system',
        'created_by_id': user.get('id') if user else None,
        'remarks': remarks,
        'rate_per_base': rate_per_base,
        'value': round(qty_base * (rate_per_base or 0), 4),
        'batch_number': batch_number,
        'expiry_date': expiry_date,
    })
    return doc


async def item_rate_per_base(item) -> float:
    return item.get('rate_per_base') or 0


async def stock_rows(location_id: str, brand_id=None):
    items = await db.items.find({'active': True}, {'_id': 0}).to_list(5000)
    smap = await stock_map(location_id)
    rows = []
    for it in items:
        qb = smap.get(it['id'], 0)
        disp = await base_to_unit(qb, it['consumption_unit'])
        min_base = it.get('min_stock_base') or 0
        reorder_base = it.get('reorder_level_base') or 0
        if qb <= min_base and min_base > 0:
            status = 'low'
        elif qb <= reorder_base and reorder_base > 0:
            status = 'warning'
        else:
            status = 'ok'
        rows.append({
            'item_id': it['id'],
            'item_code': it['code'],
            'item_name': it['name'],
            'category': it.get('category_name', ''),
            'unit': it['consumption_unit'],
            'stock': round(disp, 3),
            'stock_base': round(qb, 3),
            'min_stock': it.get('min_stock', 0),
            'reorder_level': it.get('reorder_level', 0),
            'status': status,
            'value': round(qb * (it.get('rate_per_base') or 0), 2),
            'is_sub_recipe': it.get('is_sub_recipe', False),
        })
    rows.sort(key=lambda r: r['item_name'])
    return rows
