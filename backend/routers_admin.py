from fastapi import APIRouter, Depends, HTTPException
from db import db, clean_list, now_iso, audit
from auth import require_roles

router = APIRouter(prefix='/admin', tags=['admin'])

# collection -> (label, id field, references to check, hard-deletable statuses)
TXN_SPECS = {
    'sales': {'coll': 'daily_sales', 'label': 'Sales entry', 'no': 'sale_no',
              'hard_when': lambda d: d.get('status') != 'posted'},
    'receipts': {'coll': 'procurement_receipts', 'label': 'Purchase receipt', 'no': 'receipt_no',
                 'hard_when': lambda d: d.get('status') == 'pending'},
    'intents': {'coll': 'kitchen_intents', 'label': 'Kitchen intent', 'no': 'intent_no',
                'hard_when': lambda d: d.get('status') in ('pending', 'rejected')},
    'wastage': {'coll': 'wastage', 'label': 'Wastage entry', 'no': 'wastage_no',
                'hard_when': lambda d: False},
    'productions': {'coll': 'production_batches', 'label': 'Production batch', 'no': 'batch_no',
                    'hard_when': lambda d: False},
}


@router.get('/records/{kind}')
async def list_records(kind: str, user=Depends(require_roles('admin'))):
    spec = TXN_SPECS.get(kind)
    if not spec:
        raise HTTPException(404, 'Unknown record type')
    docs = clean_list(await db[spec['coll']].find({'archived': {'$ne': True}}, {'_id': 0, 'attachment': 0, 'photo': 0})
                      .sort('created_at', -1).to_list(500))
    locs = {l['id']: l['name'] for l in await db.kitchens.find({}, {'_id': 0}).to_list(1000)}
    for d in docs:
        d['ref_no'] = d.get(spec['no'], d['id'][:8])
        d['location_name'] = locs.get(d.get('kitchen_id') or d.get('to_location_id'), '')
    return docs


@router.delete('/records/{kind}/{rid}')
async def delete_record(kind: str, rid: str, user=Depends(require_roles('admin'))):
    spec = TXN_SPECS.get(kind)
    if not spec:
        raise HTTPException(404, 'Unknown record type')
    doc = await db[spec['coll']].find_one({'id': rid}, {'_id': 0, 'attachment': 0})
    if not doc:
        raise HTTPException(404, f"{spec['label']} not found")
    ref = doc.get(spec['no'], rid)
    if spec['hard_when'](doc):
        await db[spec['coll']].delete_one({'id': rid})
        await audit(user, f"Deleted {spec['label'].lower()}", f"{ref} (no inventory impact)", ref)
        return {'ok': True, 'archived': False,
                'message': f"{spec['label']} {ref} deleted permanently"}
    await db[spec['coll']].update_one({'id': rid}, {'$set': {
        'archived': True, 'archived_by': user['name'], 'archived_at': now_iso()}})
    await audit(user, f"Archived {spec['label'].lower()}",
                f"{ref} had posted inventory impact, archived instead of deleted", ref)
    return {'ok': True, 'archived': True,
            'message': f"{spec['label']} {ref} has posted inventory movements — archived (hidden) instead of deleted so stock history stays intact"}


@router.delete('/users/{user_id}')
async def delete_user(user_id: str, user=Depends(require_roles('admin'))):
    target = await db.users.find_one({'id': user_id}, {'_id': 0})
    if not target:
        raise HTTPException(404, 'User not found')
    if target['id'] == user['id']:
        raise HTTPException(400, 'You cannot delete your own account')
    if target['role'] == 'admin' and await db.users.count_documents({'role': 'admin', 'active': True}) <= 1:
        raise HTTPException(400, 'Cannot delete the last active admin account')
    refs = await db.audit_logs.count_documents({'user_id': user_id})
    if refs:
        await db.users.update_one({'id': user_id}, {'$set': {
            'active': False, 'archived': True, 'archived_at': now_iso()}})
        await audit(user, 'Archived user', f"{target['email']} has {refs} audit records — deactivated & archived", user_id)
        return {'ok': True, 'archived': True,
                'message': f"{target['email']} has activity history — account deactivated and archived instead of deleted"}
    await db.users.delete_one({'id': user_id})
    await audit(user, 'Deleted user', target['email'], user_id)
    return {'ok': True, 'archived': False, 'message': f"User {target['email']} deleted"}


# ---------------- Archive & Restore ----------------
# flag: 'deleted' for masters (soft delete), 'archived' for transactions/users
ARCHIVE_SPECS = {
    'items': {'coll': 'items', 'label': 'Item', 'flag': 'deleted', 'name': 'name', 'code': 'code', 'master': True},
    'brands': {'coll': 'brands', 'label': 'Brand', 'flag': 'deleted', 'name': 'name', 'code': 'code', 'master': True},
    'units': {'coll': 'units', 'label': 'Unit', 'flag': 'deleted', 'name': 'name', 'code': 'code', 'master': True},
    'suppliers': {'coll': 'suppliers', 'label': 'Supplier', 'flag': 'deleted', 'name': 'name', 'code': '', 'master': True},
    'categories': {'coll': 'categories', 'label': 'Category', 'flag': 'deleted', 'name': 'name', 'code': '', 'master': True},
    'kitchens': {'coll': 'kitchens', 'label': 'Location', 'flag': 'deleted', 'name': 'name', 'code': 'code', 'master': True},
    'users': {'coll': 'users', 'label': 'User', 'flag': 'archived', 'name': 'name', 'code': 'email', 'master': False},
    'sales': {'coll': 'daily_sales', 'label': 'Sales entry', 'flag': 'archived', 'name': '', 'code': 'sale_no', 'master': False},
    'receipts': {'coll': 'procurement_receipts', 'label': 'Purchase receipt', 'flag': 'archived', 'name': '', 'code': 'receipt_no', 'master': False},
    'intents': {'coll': 'kitchen_intents', 'label': 'Kitchen intent', 'flag': 'archived', 'name': '', 'code': 'intent_no', 'master': False},
    'wastage': {'coll': 'wastage', 'label': 'Wastage entry', 'flag': 'archived', 'name': '', 'code': 'wastage_no', 'master': False},
    'productions': {'coll': 'production_batches', 'label': 'Production batch', 'flag': 'archived', 'name': '', 'code': 'batch_no', 'master': False},
}


@router.get('/archived')
async def list_archived(user=Depends(require_roles('admin'))):
    out = []
    for kind, spec in ARCHIVE_SPECS.items():
        docs = await db[spec['coll']].find({spec['flag']: True}, {'_id': 0, 'attachment': 0, 'photo': 0, 'photos': 0}).to_list(1000)
        for d in docs:
            code = d.get(spec['code']) if spec['code'] else ''
            name = d.get(spec['name']) if spec['name'] else ''
            out.append({
                'kind': kind, 'id': d['id'], 'type_label': spec['label'],
                'ref': code or d['id'][:8], 'name': name or code or d['id'][:8],
                'archived_at': d.get('archived_at', ''),
                'archived_by': d.get('archived_by', ''),
            })
    out.sort(key=lambda r: r.get('archived_at') or '', reverse=True)
    return out


@router.post('/archived/{kind}/{rid}/restore')
async def restore_archived(kind: str, rid: str, user=Depends(require_roles('admin'))):
    spec = ARCHIVE_SPECS.get(kind)
    if not spec:
        raise HTTPException(404, 'Unknown record type')
    doc = await db[spec['coll']].find_one({'id': rid}, {'_id': 0, 'attachment': 0})
    if not doc:
        raise HTTPException(404, f"{spec['label']} not found")
    if not doc.get(spec['flag']):
        raise HTTPException(400, f"{spec['label']} is not archived")
    set_doc = {spec['flag']: False}
    if spec['master']:
        set_doc['active'] = True
        if 'status' in doc:
            set_doc['status'] = 'active'
    elif kind == 'users':
        set_doc['active'] = True
    unset = {'archived_at': '', 'archived_by': ''}
    await db[spec['coll']].update_one({'id': rid}, {'$set': set_doc, '$unset': unset})
    ref = (doc.get(spec['code']) if spec['code'] else '') or rid[:8]
    await audit(user, f"Restored {spec['label'].lower()}", f"{ref} brought back from archive", ref)
    return {'ok': True, 'message': f"{spec['label']} {ref} restored"}
