from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from db import db, uid, now_iso, today_str, insert, clean, clean_list, next_no, audit
from auth import get_current_user, require_roles
from inventory import to_base, base_to_unit, post_txn, stock_base, source_location

router = APIRouter(prefix='/kitchen', tags=['kitchen'])

WASTAGE_REASONS = ['Preparation Loss', 'Cooking Loss', 'Spoilage', 'Expired', 'Overproduction', 'Damage', 'Customer Return', 'Other']


# ---------- Kitchen Intents ----------
class IntentItemIn(BaseModel):
    item_id: str
    qty: float
    unit: str
    purpose: str = ''


class IntentIn(BaseModel):
    date: str = ''
    brand_id: str = ''
    kitchen_id: str
    issue_type: str
    priority: str = 'normal'
    remarks: str = ''
    items: list[IntentItemIn]


@router.post('/intents')
async def create_intent(body: IntentIn, user=Depends(require_roles('admin', 'chef'))):
    if body.issue_type not in ('base_kitchen', 'normal_kitchen', 'rd'):
        raise HTTPException(400, 'Issue type must be base_kitchen, normal_kitchen or rd')
    if not body.items:
        raise HTTPException(400, 'Add at least one item')
    kitchen = await db.kitchens.find_one({'id': body.kitchen_id, 'deleted': {'$ne': True}}, {'_id': 0})
    if not kitchen:
        raise HTTPException(400, 'Invalid kitchen')
    if not kitchen.get('active', True):
        raise HTTPException(400, 'Selected location is inactive')
    src = await source_location(body.kitchen_id)
    if not src:
        raise HTTPException(400, 'No supply source configured for this kitchen. Set a Main Store in Masters → Kitchens.')
    items = []
    for it in body.items:
        if it.qty <= 0:
            raise HTTPException(400, 'Quantities must be positive')
        item = await db.items.find_one({'id': it.item_id}, {'_id': 0})
        if not item or not item.get('active'):
            raise HTTPException(400, 'Invalid or inactive item')
        qb, _ = await to_base(it.qty, it.unit)
        items.append({'item_id': it.item_id, 'item_name': item['name'], 'qty': it.qty, 'unit': it.unit,
                      'qty_base': qb, 'purpose': it.purpose, 'issued_base': 0})
    intent_no = await next_no('intent', 'INT')
    doc = await insert('kitchen_intents', {
        'id': uid(), 'intent_no': intent_no, 'date': body.date or today_str(),
        'brand_id': body.brand_id or None, 'kitchen_id': body.kitchen_id, 'kitchen_name': kitchen['name'],
        'issue_type': body.issue_type, 'priority': body.priority, 'remarks': body.remarks,
        'source_location_id': src['id'], 'source_location_name': src['name'],
        'items': items, 'status': 'pending',
        'requested_by': user['name'], 'requested_by_id': user['id'], 'created_at': now_iso(),
    })
    await audit(user, 'Created kitchen intent', f"{intent_no} -> {kitchen['name']}", intent_no)
    return doc


@router.get('/intents')
async def list_intents(status: str = '', user=Depends(get_current_user)):
    q = {'archived': {'$ne': True}}
    if status:
        q['status'] = status
    docs = clean_list(await db.kitchen_intents.find(q).sort('created_at', -1).to_list(1000))
    brands = {b['id']: b['name'] for b in await db.brands.find({}, {'_id': 0}).to_list(1000)}
    src_cache = {}
    for d in docs:
        d['brand_name'] = brands.get(d.get('brand_id'), 'Shared')
        kid = d['kitchen_id']
        if kid not in src_cache:
            src_cache[kid] = await source_location(kid)
        src = src_cache[kid]
        d['source_location_name'] = (src or {}).get('name', d.get('source_location_name', ''))
        for it in d['items']:
            item = await db.items.find_one({'id': it['item_id']}, {'_id': 0})
            if src and item:
                avail_base = await stock_base(it['item_id'], src['id'])
                it['available'] = round(await base_to_unit(avail_base, item['consumption_unit']), 3)
                it['issued'] = round(await base_to_unit(it['issued_base'], item['consumption_unit']), 3)
                it['balance'] = round(it['qty'] - it['issued'], 3)
    return docs


class IssueLine(BaseModel):
    index: int
    qty: float


class IssueIn(BaseModel):
    items: list[IssueLine]
    remarks: str = ''


@router.post('/intents/{intent_id}/issue')
async def issue_intent(intent_id: str, body: IssueIn, user=Depends(require_roles('admin', 'store_manager', 'store_keeper', 'procurement_manager', 'management'))):
    intent = await db.kitchen_intents.find_one({'id': intent_id})
    if not intent:
        raise HTTPException(404, 'Intent not found')
    if intent['status'] in ('issued', 'rejected'):
        raise HTTPException(400, f"Intent already {intent['status']}")
    store = await source_location(intent['kitchen_id'])
    if not store:
        raise HTTPException(400, 'No supply source configured for this kitchen')
    issue_no = await next_no('issue', 'ISSUE')
    issue_lines = []
    for il in body.items:
        line = intent['items'][il.index]
        item = await db.items.find_one({'id': line['item_id']}, {'_id': 0})
        u_factor = (await to_base(1, line['unit']))[0]
        qb = il.qty * u_factor
        remaining = line['qty_base'] - line['issued_base']
        if qb <= 0 or qb > remaining + 1e-6:
            raise HTTPException(400, f"Issue qty for {line['item_name']} must be between 0 and balance {round(await base_to_unit(remaining, line['unit']), 3)} {line['unit']}")
        await post_txn(line['item_id'], qb, 'store_issue', from_location_id=store['id'],
                       to_location_id=intent['kitchen_id'], brand_id=intent.get('brand_id'),
                       reference_id=intent['id'], reference_no=issue_no, user=user,
                       remarks=body.remarks or f"Intent {intent['intent_no']}",
                       qty=il.qty, unit=line['unit'], date=intent['date'],
                       rate_per_base=item.get('rate_per_base') or 0)
        line['issued_base'] += qb
        issue_lines.append({'item_id': line['item_id'], 'item_name': line['item_name'], 'qty': il.qty, 'unit': line['unit']})
    if not issue_lines:
        raise HTTPException(400, 'Nothing to issue')
    all_done = all(l['issued_base'] >= l['qty_base'] - 1e-6 for l in intent['items'])
    await db.kitchen_intents.update_one({'id': intent_id}, {'$set': {
        'items': intent['items'], 'status': 'issued' if all_done else 'partial'}})
    doc = await insert('stock_issues', {
        'id': uid(), 'issue_no': issue_no, 'intent_id': intent_id, 'intent_no': intent['intent_no'],
        'date': intent['date'], 'from_location_id': store['id'], 'to_location_id': intent['kitchen_id'],
        'brand_id': intent.get('brand_id'), 'items': issue_lines,
        'issued_by': user['name'], 'created_at': now_iso(), 'remarks': body.remarks,
    })
    await audit(user, 'Issued stock', f"{issue_no} for {intent['intent_no']}: {len(issue_lines)} items", issue_no)
    return doc


@router.post('/intents/{intent_id}/reject')
async def reject_intent(intent_id: str, user=Depends(require_roles('admin', 'store_manager', 'store_keeper', 'procurement_manager', 'management'))):
    await db.kitchen_intents.update_one({'id': intent_id}, {'$set': {'status': 'rejected'}})
    await audit(user, 'Rejected kitchen intent', intent_id)
    return {'ok': True}


@router.get('/issues')
async def list_issues(user=Depends(get_current_user)):
    docs = clean_list(await db.stock_issues.find({'archived': {'$ne': True}}).sort('created_at', -1).to_list(1000))
    locs = {l['id']: l['name'] for l in await db.kitchens.find({}, {'_id': 0}).to_list(1000)}
    for d in docs:
        d['from_location'] = locs.get(d['from_location_id'], '')
        d['to_location'] = locs.get(d['to_location_id'], '')
    return docs


# ---------- Sub-Recipe Production ----------
class ProductionIn(BaseModel):
    sub_recipe_id: str
    brand_id: str = ''
    kitchen_id: str
    produced_qty: float
    unit: str
    date: str = ''
    remarks: str = ''


@router.post('/production')
async def create_production(body: ProductionIn, user=Depends(require_roles('admin', 'chef'))):
    sub = await db.sub_recipes.find_one({'id': body.sub_recipe_id}, {'_id': 0})
    if not sub or not sub.get('active'):
        raise HTTPException(400, 'Invalid or inactive sub-recipe')
    if body.produced_qty <= 0:
        raise HTTPException(400, 'Produced quantity must be positive')
    produced_base, _ = await to_base(body.produced_qty, body.unit)
    scale = produced_base / sub['yield_base']
    date = body.date or today_str()
    batch_no = await next_no('production', 'BATCH')
    consumed = []
    total_cost = 0.0
    for ing in sub['items']:
        need_base = ing['qty_base'] * scale
        item = await db.items.find_one({'id': ing['item_id']}, {'_id': 0})
        rate = (item or {}).get('rate_per_base') or 0
        total_cost += need_base * rate
        await post_txn(ing['item_id'], need_base, 'production_consume', from_location_id=body.kitchen_id,
                       brand_id=body.brand_id or None, reference_no=batch_no, user=user,
                       remarks=f"Production {sub['name']}", date=date,
                       qty=round(await base_to_unit(need_base, ing['unit']), 4), unit=ing['unit'],
                       rate_per_base=rate)
        consumed.append({'item_id': ing['item_id'], 'item_name': ing['item_name'],
                         'qty': round(await base_to_unit(need_base, ing['unit']), 4), 'unit': ing['unit']})
    out_item = await db.items.find_one({'id': sub['output_item_id']}, {'_id': 0})
    rate_per_base = total_cost / produced_base if produced_base else 0
    await post_txn(sub['output_item_id'], produced_base, 'production_output', to_location_id=body.kitchen_id,
                   brand_id=body.brand_id or None, reference_no=batch_no, user=user,
                   remarks=f"Produced {sub['name']}", qty=body.produced_qty, unit=body.unit, date=date,
                   rate_per_base=rate_per_base)
    await db.items.update_one({'id': sub['output_item_id']}, {'$set': {'rate_per_base': rate_per_base,
        'rate': rate_per_base * (await to_base(1, out_item['purchase_unit']))[0] if out_item else 0}})
    yield_pct = round(produced_base / (sub['yield_base'] / (sub['yield_pct'] / 100)) * 100, 2) if sub.get('yield_pct') else sub.get('yield_pct')
    doc = await insert('production_batches', {
        'id': uid(), 'batch_no': batch_no, 'date': date, 'sub_recipe_id': sub['id'],
        'sub_recipe_name': sub['name'], 'brand_id': body.brand_id or None, 'kitchen_id': body.kitchen_id,
        'produced_qty': body.produced_qty, 'produced_base': produced_base, 'unit': body.unit,
        'consumed': consumed, 'cost': round(total_cost, 2), 'yield_pct': sub.get('yield_pct'),
        'chef': user['name'], 'remarks': body.remarks, 'created_at': now_iso(),
    })
    await audit(user, 'Sub-recipe production', f"{batch_no}: {body.produced_qty} {body.unit} {sub['name']}", batch_no)
    return doc


@router.get('/production')
async def list_production(user=Depends(get_current_user)):
    docs = clean_list(await db.production_batches.find({'archived': {'$ne': True}}).sort('created_at', -1).to_list(1000))
    locs = {l['id']: l['name'] for l in await db.kitchens.find({}, {'_id': 0}).to_list(1000)}
    for d in docs:
        d['kitchen_name'] = locs.get(d['kitchen_id'], '')
    return docs


# ---------- Wastage ----------
wastage_router = APIRouter(prefix='/wastage', tags=['wastage'])


class WastageIn(BaseModel):
    date: str = ''
    brand_id: str = ''
    kitchen_id: str
    item_id: str
    qty: float
    unit: str
    reason: str
    photo: str = ''
    remarks: str = ''


@wastage_router.post('')
async def create_wastage(body: WastageIn, user=Depends(require_roles('admin', 'chef', 'store_manager'))):
    if body.reason not in WASTAGE_REASONS:
        raise HTTPException(400, 'Invalid reason')
    if body.qty <= 0:
        raise HTTPException(400, 'Quantity must be positive')
    item = await db.items.find_one({'id': body.item_id}, {'_id': 0})
    if not item:
        raise HTTPException(400, 'Invalid item')
    qb, _ = await to_base(body.qty, body.unit)
    ref = await next_no('wastage', 'WST')
    date = body.date or today_str()
    await post_txn(body.item_id, qb, 'wastage', from_location_id=body.kitchen_id,
                   brand_id=body.brand_id or None, reference_no=ref, user=user,
                   remarks=f"{body.reason}: {body.remarks}", qty=body.qty, unit=body.unit,
                   date=date, rate_per_base=item.get('rate_per_base') or 0)
    doc = await insert('wastage', {
        'id': uid(), 'wastage_no': ref, 'date': date, 'brand_id': body.brand_id or None,
        'kitchen_id': body.kitchen_id, 'item_id': body.item_id, 'item_name': item['name'],
        'qty': body.qty, 'unit': body.unit, 'qty_base': qb, 'reason': body.reason,
        'photo': body.photo, 'remarks': body.remarks,
        'value': round(qb * (item.get('rate_per_base') or 0), 2),
        'created_by': user['name'], 'created_at': now_iso(),
    })
    doc.pop('photo', None)
    await audit(user, 'Recorded wastage', f"{ref}: {item['name']} {body.qty} {body.unit} ({body.reason})", ref)
    return doc


@wastage_router.get('')
async def list_wastage(user=Depends(get_current_user)):
    docs = clean_list(await db.wastage.find({'archived': {'$ne': True}}, {'photo': 0}).sort('created_at', -1).to_list(1000))
    locs = {l['id']: l['name'] for l in await db.kitchens.find({}, {'_id': 0}).to_list(1000)}
    brands = {b['id']: b['name'] for b in await db.brands.find({}, {'_id': 0}).to_list(1000)}
    for d in docs:
        d['kitchen_name'] = locs.get(d['kitchen_id'], '')
        d['brand_name'] = brands.get(d.get('brand_id'), 'Shared')
    return docs


@wastage_router.get('/reasons')
async def wastage_reasons(user=Depends(get_current_user)):
    return WASTAGE_REASONS


# ---------- R&D Trials ----------
rd_router = APIRouter(prefix='/rd', tags=['rd'])


class TrialItemIn(BaseModel):
    item_id: str
    qty: float
    unit: str


class TrialIn(BaseModel):
    date: str = ''
    brand_id: str = ''
    product: str
    yield_qty: float = 0
    yield_unit: str = ''
    result: str = ''
    remarks: str = ''
    photos: list[str] = []
    items: list[TrialItemIn]


@rd_router.post('/trials')
async def create_trial(body: TrialIn, user=Depends(require_roles('admin', 'chef'))):
    if not body.items:
        raise HTTPException(400, 'Add at least one ingredient')
    rd_loc = await db.kitchens.find_one({'type': 'rd'}, {'_id': 0})
    if not rd_loc:
        raise HTTPException(400, 'No R&D location configured')
    trial_no = await next_no('trial', 'RND')
    date = body.date or today_str()
    total_cost = 0.0
    lines = []
    for it in body.items:
        if it.qty <= 0:
            raise HTTPException(400, 'Quantities must be positive')
        item = await db.items.find_one({'id': it.item_id}, {'_id': 0})
        if not item:
            raise HTTPException(400, 'Invalid item')
        qb, _ = await to_base(it.qty, it.unit)
        rate = item.get('rate_per_base') or 0
        total_cost += qb * rate
        await post_txn(it.item_id, qb, 'rd_consumption', from_location_id=rd_loc['id'],
                       brand_id=body.brand_id or None, reference_no=trial_no, user=user,
                       remarks=f"R&D trial: {body.product}", qty=it.qty, unit=it.unit, date=date,
                       rate_per_base=rate)
        lines.append({'item_id': it.item_id, 'item_name': item['name'], 'qty': it.qty, 'unit': it.unit})
    doc = await insert('rd_trials', {
        'id': uid(), 'trial_no': trial_no, 'date': date, 'brand_id': body.brand_id or None,
        'product': body.product, 'items': lines, 'cost': round(total_cost, 2),
        'yield_qty': body.yield_qty, 'yield_unit': body.yield_unit, 'result': body.result,
        'remarks': body.remarks, 'photos': body.photos, 'chef': user['name'], 'created_at': now_iso(),
    })
    doc.pop('photos', None)
    await audit(user, 'R&D trial', f"{trial_no}: {body.product} cost={round(total_cost, 2)}", trial_no)
    return doc


@rd_router.get('/trials')
async def list_trials(user=Depends(get_current_user)):
    docs = clean_list(await db.rd_trials.find({}, {'photos': 0}).sort('created_at', -1).to_list(1000))
    brands = {b['id']: b['name'] for b in await db.brands.find({}, {'_id': 0}).to_list(1000)}
    for d in docs:
        d['brand_name'] = brands.get(d.get('brand_id'), 'Shared')
    return docs
