from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from db import db, uid, now_iso, today_str, insert, clean, clean_list, next_no, audit
from auth import get_current_user, require_roles
from inventory import to_base, base_to_unit, post_txn, stock_rows, get_unit

router = APIRouter(prefix='/procurement', tags=['procurement'])


class ReceiptItemIn(BaseModel):
    item_id: str
    ordered_qty: float
    received_qty: float
    unit: str
    rate: float
    tax: float = 0
    batch_number: str = ''
    mfg_date: str = ''
    expiry_date: str = ''
    remarks: str = ''


class ReceiptIn(BaseModel):
    supplier_id: str
    invoice_number: str
    invoice_date: str
    receipt_date: str
    store_location_id: str = ''
    remarks: str = ''
    attachment: str = ''
    attachment_name: str = ''
    items: list[ReceiptItemIn]


@router.post('/receipts')
async def create_receipt(body: ReceiptIn, user=Depends(require_roles('admin', 'store_keeper'))):
    if not body.attachment:
        raise HTTPException(400, 'Invoice photo/PDF upload is mandatory')
    if not body.items:
        raise HTTPException(400, 'Add at least one item')
    supplier = await db.suppliers.find_one({'id': body.supplier_id}, {'_id': 0})
    if not supplier:
        raise HTTPException(400, 'Invalid supplier')
    if not body.store_location_id:
        store = await db.kitchens.find_one({'type': 'store'}, {'_id': 0})
        if not store:
            raise HTTPException(400, 'No store location configured')
        store_location_id = store['id']
    else:
        store_location_id = body.store_location_id
    items = []
    for it in body.items:
        if it.received_qty < 0 or it.ordered_qty < 0:
            raise HTTPException(400, 'Quantities cannot be negative')
        if it.expiry_date and body.receipt_date and it.expiry_date < body.receipt_date:
            raise HTTPException(400, 'Expiry date cannot be before receipt date')
        item = await db.items.find_one({'id': it.item_id}, {'_id': 0})
        if not item or not item.get('active'):
            raise HTTPException(400, 'Invalid or inactive item')
        qb, _ = await to_base(it.received_qty, it.unit)
        line_total = round(it.received_qty * it.rate + it.tax, 2)
        items.append({
            'item_id': it.item_id, 'item_name': item['name'], 'item_code': item['code'],
            'ordered_qty': it.ordered_qty, 'received_qty': it.received_qty, 'unit': it.unit,
            'received_base': qb, 'rate': it.rate, 'tax': it.tax, 'total': line_total,
            'batch_number': it.batch_number, 'mfg_date': it.mfg_date, 'expiry_date': it.expiry_date,
            'remarks': it.remarks, 'approved_qty': 0, 'approved_base': 0, 'line_status': 'pending',
        })
    receipt_no = await next_no('receipt', 'PRC')
    doc = await insert('procurement_receipts', {
        'id': uid(), 'receipt_no': receipt_no,
        'supplier_id': supplier['id'], 'supplier_name': supplier['name'],
        'invoice_number': body.invoice_number, 'invoice_date': body.invoice_date,
        'receipt_date': body.receipt_date, 'store_location_id': store_location_id,
        'remarks': body.remarks, 'attachment': body.attachment, 'attachment_name': body.attachment_name,
        'items': items, 'status': 'pending',
        'grand_total': round(sum(i['total'] for i in items), 2),
        'created_by': user['name'], 'created_by_id': user['id'], 'created_at': now_iso(),
        'approved_by': None, 'approved_at': None, 'approval_remarks': '',
    })
    doc.pop('attachment', None)
    await audit(user, 'Created purchase receipt', f"{receipt_no} invoice={body.invoice_number}", receipt_no)
    return doc


@router.get('/receipts')
async def list_receipts(status: str = '', supplier_id: str = '', user=Depends(get_current_user)):
    q = {}
    if status:
        q['status'] = status
    if supplier_id:
        q['supplier_id'] = supplier_id
    docs = await db.procurement_receipts.find(q, {'_id': 0, 'attachment': 0}).sort('created_at', -1).to_list(1000)
    return docs


@router.get('/receipts/{rid}')
async def get_receipt(rid: str, user=Depends(get_current_user)):
    doc = await db.procurement_receipts.find_one({'id': rid}, {'_id': 0})
    if not doc:
        raise HTTPException(404, 'Receipt not found')
    return doc


class ApprovalLine(BaseModel):
    index: int
    approved_qty: float


class ApprovalIn(BaseModel):
    action: str
    items: list[ApprovalLine] = []
    remarks: str = ''


@router.post('/receipts/{rid}/approve')
async def approve_receipt(rid: str, body: ApprovalIn, user=Depends(require_roles('admin', 'procurement_manager'))):
    r = await db.procurement_receipts.find_one({'id': rid})
    if not r:
        raise HTTPException(404, 'Receipt not found')
    if r['status'] != 'pending':
        raise HTTPException(400, 'Receipt already processed')
    if body.action not in ('approve', 'reject', 'partial'):
        raise HTTPException(400, 'Invalid action')
    approved_map = {a.index: a.approved_qty for a in body.items}
    any_approved = False
    any_rejected = False
    for idx, line in enumerate(r['items']):
        if body.action == 'approve':
            aq = line['received_qty']
        elif body.action == 'reject':
            aq = 0
        else:
            aq = approved_map.get(idx, 0)
        if aq < 0 or aq > line['received_qty']:
            raise HTTPException(400, f"Approved qty for {line['item_name']} must be between 0 and received qty ({line['received_qty']})")
        line['approved_qty'] = aq
        u = await get_unit(line['unit'])
        line['approved_base'] = aq * u['factor']
        line['line_status'] = 'approved' if aq == line['received_qty'] and aq > 0 else ('rejected' if aq == 0 else 'partial')
        any_approved = any_approved or aq > 0
        any_rejected = any_rejected or aq < line['received_qty']
    status = 'approved' if not any_rejected else ('rejected' if not any_approved else 'partial')
    for line in r['items']:
        if line['approved_base'] > 0:
            item = await db.items.find_one({'id': line['item_id']}, {'_id': 0})
            u = await get_unit(line['unit'])
            rate_per_base = line['rate'] / u['factor'] if u['factor'] else 0
            await post_txn(
                line['item_id'], line['approved_base'], 'purchase_receipt',
                to_location_id=r['store_location_id'],
                reference_id=r['id'], reference_no=r['receipt_no'], user=user,
                remarks=f"Invoice {r['invoice_number']}", qty=line['approved_qty'], unit=line['unit'],
                date=r['receipt_date'], rate_per_base=rate_per_base,
                batch_number=line.get('batch_number') or None, expiry_date=line.get('expiry_date') or None,
            )
            await db.items.update_one({'id': line['item_id']}, {'$set': {
                'rate': line['rate'], 'rate_per_base': rate_per_base,
            }})
    await db.procurement_receipts.update_one({'id': rid}, {'$set': {
        'items': r['items'], 'status': status, 'approved_by': user['name'],
        'approved_at': now_iso(), 'approval_remarks': body.remarks,
    }})
    await audit(user, f'Procurement {status}', f"{r['receipt_no']} remarks={body.remarks}", r['receipt_no'])
    return clean(await db.procurement_receipts.find_one({'id': rid}, {'attachment': 0}))


# ---------- Inventory stock / ledger / transfer / adjustment ----------
inv_router = APIRouter(prefix='/inventory', tags=['inventory'])


@inv_router.get('/stock')
async def get_stock(location_id: str, user=Depends(get_current_user)):
    return await stock_rows(location_id)


@inv_router.get('/ledger')
async def get_ledger(item_id: str = '', location_id: str = '', date_from: str = '', date_to: str = '', user=Depends(get_current_user)):
    q = {}
    if item_id:
        q['item_id'] = item_id
    if location_id:
        q['$or'] = [{'from_location_id': location_id}, {'to_location_id': location_id}]
    if date_from:
        q['date'] = {'$gte': date_from}
    if date_to:
        q.setdefault('date', {})['$lte'] = date_to
    txns = await db.inventory_transactions.find(q, {'_id': 0}).sort('created_at', -1).to_list(5000)
    item_ids = list({t['item_id'] for t in txns})
    loc_ids = list({x for t in txns for x in (t['from_location_id'], t['to_location_id']) if x})
    items = {i['id']: i for i in await db.items.find({'id': {'$in': item_ids}}, {'_id': 0}).to_list(5000)}
    locs = {l['id']: l for l in await db.kitchens.find({'id': {'$in': loc_ids}}, {'_id': 0}).to_list(1000)}
    brands = {b['id']: b for b in await db.brands.find({}, {'_id': 0}).to_list(1000)}
    out = []
    for t in txns:
        item = items.get(t['item_id'], {})
        out.append({
            **t,
            'item_name': item.get('name', ''), 'item_code': item.get('code', ''),
            'display_qty': round(await base_to_unit(t['qty_base'], item.get('consumption_unit', 'GM')), 3) if item else t['qty_base'],
            'display_unit': item.get('consumption_unit', ''),
            'from_location': (locs.get(t['from_location_id']) or {}).get('name', '') if t['from_location_id'] else '',
            'to_location': (locs.get(t['to_location_id']) or {}).get('name', '') if t['to_location_id'] else '',
            'brand_name': (brands.get(t.get('brand_id')) or {}).get('name', 'Shared') if t.get('brand_id') else 'Shared',
        })
    return out


class TransferItem(BaseModel):
    item_id: str
    qty: float
    unit: str


class TransferIn(BaseModel):
    from_location_id: str
    to_location_id: str
    brand_id: str = ''
    date: str = ''
    remarks: str = ''
    items: list[TransferItem]


@inv_router.post('/transfer')
async def create_transfer(body: TransferIn, user=Depends(require_roles('admin', 'store_manager'))):
    if body.from_location_id == body.to_location_id:
        raise HTTPException(400, 'From and To locations must differ')
    if not body.items:
        raise HTTPException(400, 'Add at least one item')
    transfer_no = await next_no('transfer', 'TRF')
    date = body.date or today_str()
    lines = []
    for it in body.items:
        item = await db.items.find_one({'id': it.item_id}, {'_id': 0})
        if not item:
            raise HTTPException(400, 'Invalid item')
        qb, _ = await to_base(it.qty, it.unit)
        await post_txn(it.item_id, qb, 'transfer', from_location_id=body.from_location_id,
                       to_location_id=body.to_location_id, brand_id=body.brand_id or None,
                       reference_no=transfer_no, user=user, remarks=body.remarks,
                       qty=it.qty, unit=it.unit, date=date,
                       rate_per_base=item.get('rate_per_base') or 0)
        lines.append({'item_id': it.item_id, 'item_name': item['name'], 'qty': it.qty, 'unit': it.unit})
    doc = await insert('stock_transfers', {
        'id': uid(), 'transfer_no': transfer_no, 'date': date,
        'from_location_id': body.from_location_id, 'to_location_id': body.to_location_id,
        'brand_id': body.brand_id or None, 'items': lines, 'remarks': body.remarks,
        'created_by': user['name'], 'created_at': now_iso(),
    })
    await audit(user, 'Stock transfer', f"{transfer_no}: {len(lines)} items", transfer_no)
    return doc


@inv_router.get('/transfers')
async def list_transfers(user=Depends(get_current_user)):
    docs = clean_list(await db.stock_transfers.find({}, {'_id': 0}).sort('created_at', -1).to_list(1000))
    locs = {l['id']: l['name'] for l in await db.kitchens.find({}, {'_id': 0}).to_list(1000)}
    for d in docs:
        d['from_location'] = locs.get(d['from_location_id'], '')
        d['to_location'] = locs.get(d['to_location_id'], '')
    return docs


class AdjustmentIn(BaseModel):
    location_id: str
    item_id: str
    qty: float
    unit: str
    direction: str
    reason: str
    date: str = ''


@inv_router.post('/adjustment')
async def create_adjustment(body: AdjustmentIn, user=Depends(require_roles('admin', 'store_manager'))):
    if body.direction not in ('in', 'out'):
        raise HTTPException(400, 'Direction must be in or out')
    if body.qty <= 0:
        raise HTTPException(400, 'Quantity must be positive')
    if not body.reason.strip():
        raise HTTPException(400, 'Reason is required')
    item = await db.items.find_one({'id': body.item_id}, {'_id': 0})
    if not item:
        raise HTTPException(400, 'Invalid item')
    qb, _ = await to_base(body.qty, body.unit)
    ref = await next_no('adjustment', 'ADJ')
    await post_txn(body.item_id, qb, 'adjustment',
                   from_location_id=body.location_id if body.direction == 'out' else None,
                   to_location_id=body.location_id if body.direction == 'in' else None,
                   reference_no=ref, user=user, remarks=body.reason,
                   qty=body.qty, unit=body.unit, date=body.date or today_str(),
                   rate_per_base=item.get('rate_per_base') or 0)
    await audit(user, 'Stock adjustment', f"{ref}: {item['name']} {body.direction} {body.qty} {body.unit} - {body.reason}", ref)
    return {'ok': True, 'reference': ref}


@inv_router.get('/batches')
async def list_batches(location_id: str, user=Depends(get_current_user)):
    receipts = await db.inventory_transactions.find(
        {'to_location_id': location_id, 'txn_type': 'purchase_receipt', 'batch_number': {'$ne': None}},
        {'_id': 0}).sort('date', 1).to_list(5000)
    out_txns = await db.inventory_transactions.find(
        {'from_location_id': location_id}, {'_id': 0}).sort('created_at', 1).to_list(50000)
    out_by_item = {}
    for t in out_txns:
        out_by_item.setdefault(t['item_id'], 0)
        out_by_item[t['item_id']] += t['qty_base']
    items = {i['id']: i for i in await db.items.find({}, {'_id': 0}).to_list(5000)}
    batches = []
    remaining_out = dict(out_by_item)
    for r in receipts:
        item = items.get(r['item_id'])
        if not item or not item.get('batch_tracking'):
            continue
        consumed = min(remaining_out.get(r['item_id'], 0), r['qty_base'])
        remaining_out[r['item_id']] = remaining_out.get(r['item_id'], 0) - consumed
        remaining = r['qty_base'] - consumed
        if remaining <= 0:
            continue
        batches.append({
            'item_id': r['item_id'], 'item_name': item['name'], 'batch_number': r['batch_number'],
            'received_date': r['date'], 'expiry_date': r.get('expiry_date'),
            'remaining': round(await base_to_unit(remaining, item['consumption_unit']), 3),
            'unit': item['consumption_unit'],
        })
    return batches
