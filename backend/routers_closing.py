from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from db import db, uid, now_iso, insert, clean, clean_list, audit
from auth import get_current_user, require_roles
from inventory import base_to_unit, to_base, is_locked

router = APIRouter(prefix='/closing', tags=['closing'])


async def compute_day_sheet(date: str, location_id: str):
    items = await db.items.find({'active': True}, {'_id': 0}).to_list(5000)
    txns = await db.inventory_transactions.find({
        '$or': [{'from_location_id': location_id}, {'to_location_id': location_id}]}, {'_id': 0}).to_list(100000)
    per_item = {}
    def bucket(item_id):
        if item_id not in per_item:
            per_item[item_id] = {'opening': 0, 'receipts': 0, 'transfers_in': 0, 'production': 0,
                                 'issues': 0, 'consumption': 0, 'wastage': 0, 'adjustments': 0}
        return per_item[item_id]
    for t in txns:
        b = bucket(t['item_id'])
        q = t['qty_base']
        before = t['date'] < date
        during = t['date'] == date
        if t['to_location_id'] == location_id:
            if before:
                b['opening'] += q
            elif during:
                if t['txn_type'] == 'purchase_receipt':
                    b['receipts'] += q
                elif t['txn_type'] == 'production_output':
                    b['production'] += q
                elif t['txn_type'] == 'adjustment':
                    b['adjustments'] += q
                else:
                    b['transfers_in'] += q
        if t['from_location_id'] == location_id:
            if before:
                b['opening'] -= q
            elif during:
                if t['txn_type'] in ('store_issue', 'transfer'):
                    b['issues'] += q
                elif t['txn_type'] in ('recipe_consumption', 'production_consume', 'rd_consumption'):
                    b['consumption'] += q
                elif t['txn_type'] == 'wastage':
                    b['wastage'] += q
                elif t['txn_type'] == 'adjustment':
                    b['adjustments'] -= q
    rows = []
    for it in items:
        b = per_item.get(it['id'])
        if not b or all(abs(v) < 1e-9 for v in b.values()):
            continue
        expected = b['opening'] + b['receipts'] + b['transfers_in'] + b['production'] + b['adjustments'] - b['issues'] - b['consumption'] - b['wastage']
        unit = it['consumption_unit']
        async def d(v):
            return round(await base_to_unit(v, unit), 3)
        rows.append({
            'item_id': it['id'], 'item_code': it['code'], 'item_name': it['name'], 'unit': unit,
            'opening': await d(b['opening']), 'receipts': await d(b['receipts']),
            'transfers_in': await d(b['transfers_in']), 'production': await d(b['production']),
            'issues': await d(b['issues']), 'consumption': await d(b['consumption']),
            'wastage': await d(b['wastage']), 'adjustments': await d(b['adjustments']),
            'expected': await d(expected), 'expected_base': expected,
        })
    rows.sort(key=lambda r: r['item_name'])
    return rows


@router.get('/preview')
async def closing_preview(date: str, location_id: str, user=Depends(get_current_user)):
    rows = await compute_day_sheet(date, location_id)
    locked = await is_locked(date, location_id)
    existing = clean(await db.daily_closing.find_one({'date': date, 'location_id': location_id}))
    return {'date': date, 'location_id': location_id, 'locked': locked, 'rows': rows,
            'closing_status': existing['status'] if existing else None, 'closing_id': existing['id'] if existing else None}


class ClosingItemIn(BaseModel):
    item_id: str
    physical_qty: float


class ClosingIn(BaseModel):
    date: str
    location_id: str
    items: list[ClosingItemIn]


@router.post('')
async def submit_closing(body: ClosingIn, user=Depends(require_roles('admin', 'chef'))):
    if await is_locked(body.date, body.location_id) and user['role'] != 'admin':
        raise HTTPException(400, 'Day already locked for this location')
    existing = await db.daily_closing.find_one({'date': body.date, 'location_id': body.location_id,
                                                'status': {'$in': ['submitted', 'approved']}})
    if existing:
        raise HTTPException(400, 'Closing already submitted for this date/location')
    rows = await compute_day_sheet(body.date, body.location_id)
    settings = await db.settings.find_one({'id': 'global'}) or {}
    tolerance = settings.get('variance_tolerance_pct', 2)
    physical_map = {i.item_id: i.physical_qty for i in body.items}
    final_rows = []
    for r in rows:
        item = await db.items.find_one({'id': r['item_id']}, {'_id': 0})
        physical = physical_map.get(r['item_id'])
        entry = {k: v for k, v in r.items() if k != 'expected_base'}
        if physical is not None:
            pb, _ = await to_base(physical, r['unit'])
            variance_base = pb - r['expected_base']
            variance = await base_to_unit(variance_base, r['unit'])
            vpct = round(variance_base / r['expected_base'] * 100, 2) if abs(r['expected_base']) > 1e-9 else (0 if abs(variance_base) < 1e-9 else 100)
            entry.update({'physical': physical, 'variance': round(variance, 3), 'variance_pct': vpct,
                          'breach': abs(vpct) > tolerance})
        else:
            entry.update({'physical': None, 'variance': None, 'variance_pct': None, 'breach': False})
        final_rows.append(entry)
    doc = await insert('daily_closing', {
        'id': uid(), 'date': body.date, 'location_id': body.location_id,
        'items': final_rows, 'status': 'submitted', 'tolerance_pct': tolerance,
        'created_by': user['name'], 'created_at': now_iso(), 'approved_by': None, 'approved_at': None,
    })
    await audit(user, 'Submitted daily closing', f"{body.date} location={body.location_id} rows={len(final_rows)}")
    return doc


@router.get('')
async def list_closings(date: str = '', location_id: str = '', user=Depends(get_current_user)):
    q = {}
    if date:
        q['date'] = date
    if location_id:
        q['location_id'] = location_id
    docs = clean_list(await db.daily_closing.find(q).sort('created_at', -1).to_list(500))
    locs = {l['id']: l['name'] for l in await db.kitchens.find({}, {'_id': 0}).to_list(1000)}
    for d in docs:
        d['location_name'] = locs.get(d['location_id'], '')
    return docs


@router.post('/{cid}/approve')
async def approve_closing(cid: str, user=Depends(require_roles('admin', 'store_manager'))):
    c = await db.daily_closing.find_one({'id': cid})
    if not c:
        raise HTTPException(404, 'Closing not found')
    if c['status'] == 'approved':
        raise HTTPException(400, 'Already approved')
    await db.daily_closing.update_one({'id': cid}, {'$set': {
        'status': 'approved', 'approved_by': user['name'], 'approved_at': now_iso()}})
    await db.day_locks.update_one(
        {'date': c['date'], 'location_id': c['location_id']},
        {'$set': {'id': uid(), 'date': c['date'], 'location_id': c['location_id'], 'locked': True,
                  'locked_by': user['name'], 'locked_at': now_iso()}},
        upsert=True)
    await audit(user, 'Approved & locked day', f"{c['date']} location={c['location_id']}")
    return {'ok': True}


class ReopenIn(BaseModel):
    date: str
    location_id: str
    reason: str


@router.post('/reopen')
async def reopen_day(body: ReopenIn, user=Depends(require_roles('admin'))):
    if not body.reason.strip():
        raise HTTPException(400, 'Reason is required')
    await db.day_locks.update_one({'date': body.date, 'location_id': body.location_id},
                                  {'$set': {'locked': False, 'reopened_by': user['name'],
                                            'reopened_at': now_iso(), 'reopen_reason': body.reason}})
    await db.daily_closing.update_one({'date': body.date, 'location_id': body.location_id},
                                      {'$set': {'status': 'submitted', 'approved_by': None, 'approved_at': None}})
    await audit(user, 'Reopened day', f"{body.date} location={body.location_id}: {body.reason}")
    return {'ok': True}
