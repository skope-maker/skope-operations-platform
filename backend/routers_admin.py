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
