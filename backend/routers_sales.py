from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from db import db, uid, now_iso, today_str, insert, clean, clean_list, next_no, audit
from auth import get_current_user, require_roles
from inventory import to_base, base_to_unit, post_txn, stock_base, is_locked
from recipes_engine import get_active_version, physical_consumption, expand_to_raw

router = APIRouter(prefix='/sales', tags=['sales'])


class SaleItemIn(BaseModel):
    recipe_id: str
    qty_sold: float
    cancelled: float = 0
    complimentary: float = 0


class SaleIn(BaseModel):
    date: str
    brand_id: str
    kitchen_id: str
    source: str = 'manual'
    items: list[SaleItemIn]


@router.post('')
async def create_sale(body: SaleIn, user=Depends(require_roles('admin', 'chef', 'store_manager'))):
    if not body.items:
        raise HTTPException(400, 'Add at least one product')
    if await is_locked(body.date, body.kitchen_id) and user['role'] != 'admin':
        raise HTTPException(400, f'Day {body.date} is locked for this location')
    dup = await db.daily_sales.find_one({'date': body.date, 'brand_id': body.brand_id,
                                         'kitchen_id': body.kitchen_id, 'source': body.source,
                                         'status': {'$in': ['draft', 'posted']}})
    if dup:
        raise HTTPException(400, f"Sales for {body.date} already exist for this brand/kitchen (ref {dup['sale_no']}, status {dup['status']})")
    brand = await db.brands.find_one({'id': body.brand_id}, {'_id': 0})
    if not brand:
        raise HTTPException(400, 'Invalid brand')
    lines = []
    for it in body.items:
        recipe = await db.recipes.find_one({'id': it.recipe_id}, {'_id': 0})
        if not recipe or not recipe.get('active'):
            raise HTTPException(400, 'Invalid or inactive recipe')
        if it.qty_sold < 0 or it.cancelled < 0 or it.complimentary < 0:
            raise HTTPException(400, 'Quantities cannot be negative')
        net = it.qty_sold - it.cancelled
        billable = net - it.complimentary
        if net < 0 or billable < 0:
            raise HTTPException(400, 'Cancelled/complimentary cannot exceed sold quantity')
        lines.append({
            'recipe_id': recipe['id'], 'recipe_name': recipe['name'], 'recipe_code': recipe['code'],
            'qty_sold': it.qty_sold, 'cancelled': it.cancelled, 'complimentary': it.complimentary,
            'net_qty': net, 'billable_qty': billable,
            'selling_price': recipe.get('selling_price', 0),
            'amount': round(billable * recipe.get('selling_price', 0), 2),
        })
    sale_no = await next_no('sale', 'SALE')
    doc = await insert('daily_sales', {
        'id': uid(), 'sale_no': sale_no, 'date': body.date, 'brand_id': body.brand_id,
        'brand_name': brand['name'], 'kitchen_id': body.kitchen_id, 'source': body.source,
        'items': lines, 'status': 'draft', 'total_amount': round(sum(l['amount'] for l in lines), 2),
        'created_by': user['name'], 'created_by_id': user['id'], 'created_at': now_iso(),
        'posted_by': None, 'posted_at': None,
    })
    await audit(user, 'Created draft sales', f"{sale_no} {body.date} amount={doc['total_amount']}", sale_no)
    return doc


@router.get('')
async def list_sales(date: str = '', brand_id: str = '', status: str = '', user=Depends(get_current_user)):
    q = {}
    if date:
        q['date'] = date
    if brand_id:
        q['brand_id'] = brand_id
    if status:
        q['status'] = status
    return clean_list(await db.daily_sales.find(q).sort('created_at', -1).to_list(1000))


@router.get('/{sale_id}')
async def get_sale(sale_id: str, user=Depends(get_current_user)):
    sale = clean(await db.daily_sales.find_one({'id': sale_id}))
    if not sale:
        raise HTTPException(404, 'Sale not found')
    consumption = clean_list(await db.sales_consumption.find({'sales_id': sale_id}).to_list(1000))
    for c in consumption:
        item = await db.items.find_one({'id': c['item_id']}, {'_id': 0})
        if item:
            c['item_name'] = item['name']
            c['qty'] = round(await base_to_unit(c['qty_base'], item['consumption_unit']), 3)
            c['unit'] = item['consumption_unit']
    sale['consumption'] = consumption
    return sale


class PostIn(BaseModel):
    override: bool = False
    override_reason: str = ''


@router.post('/{sale_id}/post')
async def post_sale(sale_id: str, body: PostIn, user=Depends(require_roles('admin', 'store_manager', 'chef'))):
    sale = await db.daily_sales.find_one({'id': sale_id})
    if not sale:
        raise HTTPException(404, 'Sale not found')
    if sale['status'] == 'posted':
        raise HTTPException(400, 'Sales already posted')
    dup = await db.daily_sales.find_one({'date': sale['date'], 'brand_id': sale['brand_id'],
                                         'kitchen_id': sale['kitchen_id'], 'source': sale['source'],
                                         'status': 'posted', 'id': {'$ne': sale_id}})
    if dup:
        raise HTTPException(400, f"Posted sales already exist for this date/brand (ref {dup['sale_no']})")
    if await is_locked(sale['date'], sale['kitchen_id']) and user['role'] != 'admin':
        raise HTTPException(400, f"Day {sale['date']} is locked for this location")
    consumption = []
    for line in sale['items']:
        if line['net_qty'] <= 0:
            continue
        recipe = await db.recipes.find_one({'id': line['recipe_id']}, {'_id': 0})
        version = await get_active_version(line['recipe_id'], sale['date'])
        if not version:
            raise HTTPException(400, f"No recipe version for {line['recipe_name']}")
        for cl in await physical_consumption(version['items'], line['net_qty']):
            cl['recipe_id'] = line['recipe_id']
            cl['recipe_name'] = line['recipe_name']
            cl['recipe_version'] = version['version']
            consumption.append(cl)
    aggregated = {}
    for cl in consumption:
        aggregated[cl['item_id']] = aggregated.get(cl['item_id'], 0) + cl['qty_base']
    shortages = []
    for item_id, qb in aggregated.items():
        avail = await stock_base(item_id, sale['kitchen_id'])
        if avail + 1e-6 < qb:
            item = await db.items.find_one({'id': item_id}, {'_id': 0})
            shortages.append({
                'item_id': item_id, 'item_name': item['name'] if item else item_id,
                'available': round(await base_to_unit(avail, item['consumption_unit']), 3),
                'required': round(await base_to_unit(qb, item['consumption_unit']), 3),
                'shortage': round(await base_to_unit(qb - avail, item['consumption_unit']), 3),
                'unit': item['consumption_unit'],
            })
    if shortages:
        can_override = user['role'] in ('admin', 'store_manager')
        if not (body.override and can_override):
            return {'ok': False, 'shortages': shortages, 'needs_override': can_override}
        if not body.override_reason.strip():
            raise HTTPException(400, 'Override reason is required')
        await audit(user, 'Negative stock override', f"{sale['sale_no']}: {body.override_reason}. Shortages: "
                    + ', '.join(f"{s['item_name']} short {s['shortage']} {s['unit']}" for s in shortages), sale['sale_no'])
    allow_neg = body.override and user['role'] in ('admin', 'store_manager')
    for cl in consumption:
        item = await db.items.find_one({'id': cl['item_id']}, {'_id': 0})
        await post_txn(cl['item_id'], cl['qty_base'], 'recipe_consumption',
                       from_location_id=sale['kitchen_id'], brand_id=sale['brand_id'],
                       reference_id=sale_id, reference_no=sale['sale_no'], user=user,
                       remarks=f"Sales {sale['sale_no']} - {cl['recipe_name']} v{cl['recipe_version']}",
                       date=sale['date'], rate_per_base=(item or {}).get('rate_per_base') or 0,
                       allow_negative=allow_neg,
                       qty=round(await base_to_unit(cl['qty_base'], (item or {}).get('consumption_unit', 'GM')), 4),
                       unit=(item or {}).get('consumption_unit', ''))
        await insert('sales_consumption', {
            'id': uid(), 'sales_id': sale_id, 'sale_no': sale['sale_no'], 'date': sale['date'],
            'brand_id': sale['brand_id'], 'recipe_id': cl['recipe_id'], 'recipe_name': cl['recipe_name'],
            'recipe_version': cl['recipe_version'], 'item_id': cl['item_id'], 'kind': cl['kind'],
            'qty_base': cl['qty_base'],
        })
    await db.daily_sales.update_one({'id': sale_id}, {'$set': {
        'status': 'posted', 'posted_by': user['name'], 'posted_at': now_iso()}})
    await audit(user, 'Posted sales', f"{sale['sale_no']} {sale['date']} amount={sale['total_amount']}", sale['sale_no'])
    return {'ok': True, 'sale_no': sale['sale_no']}


@router.get('/{sale_id}/theoretical')
async def sale_theoretical(sale_id: str, user=Depends(get_current_user)):
    sale = await db.daily_sales.find_one({'id': sale_id})
    if not sale:
        raise HTTPException(404, 'Sale not found')
    rows = []
    for line in sale['items']:
        if line['net_qty'] <= 0:
            continue
        version = await get_active_version(line['recipe_id'], sale['date'])
        if not version:
            continue
        raws = await expand_to_raw(version['items'], line['net_qty'])
        for item_id, qb in raws.items():
            item = await db.items.find_one({'id': item_id}, {'_id': 0})
            if item:
                rows.append({
                    'product': line['recipe_name'], 'sales_qty': line['net_qty'],
                    'ingredient': item['name'],
                    'theoretical_qty': round(await base_to_unit(qb, item['consumption_unit']), 3),
                    'unit': item['consumption_unit'],
                })
    return rows
