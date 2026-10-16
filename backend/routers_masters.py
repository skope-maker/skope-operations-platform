from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from db import db, uid, now_iso, insert, clean, clean_list, audit
from auth import get_current_user, require_roles
from inventory import get_unit, to_base, stock_map, base_to_unit, source_location

router = APIRouter(tags=['masters'])

LIVE = {'deleted': {'$ne': True}}


async def soft_or_hard_delete(coll: str, doc_id: str, refs: int, label: str, user):
    """Hard delete when unreferenced, archive (soft delete) when other records point to it."""
    if refs:
        await db[coll].update_one({'id': doc_id}, {'$set': {'deleted': True, 'active': False,
                                                           'status': 'inactive', 'archived_at': now_iso()}})
        await audit(user, f'Archived {label}', f'{doc_id} is referenced by {refs} record(s), archived instead of deleted', doc_id)
        return {'ok': True, 'archived': True,
                'message': f'{label} is used by {refs} existing record(s), so it has been archived and hidden from lists, history stays intact'}
    await db[coll].delete_one({'id': doc_id})
    await audit(user, f'Deleted {label}', doc_id, doc_id)
    return {'ok': True, 'archived': False, 'message': f'{label} deleted'}


# ---------- Brands ----------
class BrandIn(BaseModel):
    name: str
    code: str
    logo_url: str = ''
    kitchen_location: str = ''
    status: str = 'active'
    description: str = ''


@router.get('/brands')
async def list_brands(user=Depends(get_current_user)):
    return clean_list(await db.brands.find(LIVE).to_list(1000))


@router.post('/brands')
async def create_brand(body: BrandIn, user=Depends(require_roles('admin'))):
    if await db.brands.find_one({'code': body.code.strip().upper()}):
        raise HTTPException(400, 'Brand code already exists')
    doc = await insert('brands', {
        'id': uid(), 'name': body.name.strip(), 'code': body.code.strip().upper(),
        'logo_url': body.logo_url, 'kitchen_location': body.kitchen_location,
        'status': body.status, 'description': body.description, 'created_at': now_iso(),
    })
    await audit(user, 'Created brand', doc['name'], doc['code'])
    return doc


@router.put('/brands/{brand_id}')
async def update_brand(brand_id: str, body: BrandIn, user=Depends(require_roles('admin'))):
    existing = await db.brands.find_one({'id': brand_id})
    if not existing:
        raise HTTPException(404, 'Brand not found')
    dup = await db.brands.find_one({'code': body.code.strip().upper(), 'id': {'$ne': brand_id}})
    if dup:
        raise HTTPException(400, 'Brand code already exists')
    await db.brands.update_one({'id': brand_id}, {'$set': body.model_dump()})
    await audit(user, 'Updated brand', body.name, body.code)
    return clean(await db.brands.find_one({'id': brand_id}))


@router.delete('/brands/{brand_id}')
async def delete_brand(brand_id: str, user=Depends(require_roles('admin'))):
    refs = await db.daily_sales.count_documents({'brand_id': brand_id}) + await db.recipes.count_documents({'brand_id': brand_id})
    return await soft_or_hard_delete('brands', brand_id, refs, 'Brand', user)


# ---------- Kitchens / Locations ----------
class KitchenIn(BaseModel):
    name: str
    code: str
    type: str
    parent_id: str = ''
    active: bool = True


async def kitchen_payload(body: KitchenIn, kid: str = ''):
    if body.type not in ('store', 'base_kitchen', 'normal_kitchen', 'rd'):
        raise HTTPException(400, 'Invalid location type')
    parent_id = body.parent_id or None
    if parent_id:
        if parent_id == kid:
            raise HTTPException(400, 'A location cannot be its own supply source')
        parent = await db.kitchens.find_one({'id': parent_id, 'deleted': {'$ne': True}}, {'_id': 0})
        if not parent:
            raise HTTPException(400, 'Invalid supply source location')
        chain, cursor = 0, parent
        while cursor and cursor.get('parent_id') and chain < 10:
            if cursor['parent_id'] == kid:
                raise HTTPException(400, 'This supply source would create a circular chain')
            cursor = await db.kitchens.find_one({'id': cursor['parent_id']}, {'_id': 0})
            chain += 1
    elif body.type != 'store':
        store = await db.kitchens.find_one({'type': 'store', 'deleted': {'$ne': True}}, {'_id': 0})
        parent_id = store['id'] if store else None
    return {'name': body.name.strip(), 'code': body.code.strip().upper(), 'type': body.type,
            'parent_id': parent_id, 'active': body.active}


@router.get('/kitchens')
async def list_kitchens(user=Depends(get_current_user)):
    docs = clean_list(await db.kitchens.find(LIVE).to_list(1000))
    names = {d['id']: d['name'] for d in docs}
    for d in docs:
        d['parent_name'] = names.get(d.get('parent_id'), '')
    return docs


@router.post('/kitchens')
async def create_kitchen(body: KitchenIn, user=Depends(require_roles('admin'))):
    if await db.kitchens.find_one({'code': body.code.strip().upper(), **LIVE}):
        raise HTTPException(400, 'Location code already exists')
    doc = await insert('kitchens', {'id': uid(), **await kitchen_payload(body), 'created_at': now_iso()})
    await audit(user, 'Created location', doc['name'], doc['code'])
    return doc


@router.put('/kitchens/{kid}')
async def update_kitchen(kid: str, body: KitchenIn, user=Depends(require_roles('admin'))):
    if not await db.kitchens.find_one({'id': kid}):
        raise HTTPException(404, 'Location not found')
    await db.kitchens.update_one({'id': kid}, {'$set': await kitchen_payload(body, kid)})
    await audit(user, 'Updated location', body.name, body.code)
    return clean(await db.kitchens.find_one({'id': kid}))


@router.delete('/kitchens/{kid}')
async def delete_kitchen(kid: str, user=Depends(require_roles('admin'))):
    refs = await db.inventory_transactions.count_documents({'$or': [{'from_location_id': kid}, {'to_location_id': kid}]})
    refs += await db.kitchens.count_documents({'parent_id': kid, **LIVE})
    return await soft_or_hard_delete('kitchens', kid, refs, 'Location', user)


# ---------- Categories ----------
class CategoryIn(BaseModel):
    name: str
    subcategories: list[str] = []


@router.get('/categories')
async def list_categories(user=Depends(get_current_user)):
    return clean_list(await db.categories.find(LIVE).to_list(1000))


@router.post('/categories')
async def create_category(body: CategoryIn, user=Depends(require_roles('admin'))):
    doc = await insert('categories', {'id': uid(), **body.model_dump(), 'created_at': now_iso()})
    return doc


@router.put('/categories/{cid}')
async def update_category(cid: str, body: CategoryIn, user=Depends(require_roles('admin'))):
    await db.categories.update_one({'id': cid}, {'$set': body.model_dump()})
    return clean(await db.categories.find_one({'id': cid}))


@router.delete('/categories/{cid}')
async def delete_category(cid: str, user=Depends(require_roles('admin'))):
    refs = await db.items.count_documents({'category_id': cid, **LIVE})
    return await soft_or_hard_delete('categories', cid, refs, 'Category', user)


# ---------- Units ----------
class UnitIn(BaseModel):
    name: str
    code: str
    family: str
    factor: float


@router.get('/units')
async def list_units(user=Depends(get_current_user)):
    return clean_list(await db.units.find(LIVE).to_list(1000))


@router.post('/units')
async def create_unit(body: UnitIn, user=Depends(require_roles('admin'))):
    if body.factor <= 0:
        raise HTTPException(400, 'Conversion factor must be positive')
    if await db.units.find_one({'code': body.code.strip().upper()}):
        raise HTTPException(400, 'Unit code exists')
    doc = await insert('units', {'id': uid(), 'name': body.name.strip(), 'code': body.code.strip().upper(),
                                 'family': body.family, 'factor': body.factor, 'created_at': now_iso()})
    return doc


@router.put('/units/{unit_id}')
async def update_unit(unit_id: str, body: UnitIn, user=Depends(require_roles('admin'))):
    await db.units.update_one({'id': unit_id}, {'$set': {'name': body.name, 'family': body.family, 'factor': body.factor, 'code': body.code.upper()}})
    return clean(await db.units.find_one({'id': unit_id}))


@router.delete('/units/{unit_id}')
async def delete_unit(unit_id: str, user=Depends(require_roles('admin'))):
    unit = await db.units.find_one({'id': unit_id}, {'_id': 0})
    if not unit:
        raise HTTPException(404, 'Unit not found')
    refs = await db.items.count_documents({'$or': [{'purchase_unit': unit['code']}, {'consumption_unit': unit['code']}], **LIVE})
    refs += await db.inventory_transactions.count_documents({'unit': unit['code']})
    return await soft_or_hard_delete('units', unit_id, refs, 'Unit', user)


# ---------- Items ----------
class ItemIn(BaseModel):
    code: str
    name: str
    category_id: str = ''
    subcategory: str = ''
    purchase_unit: str
    consumption_unit: str
    conversion_factor: float = 1
    min_stock: float = 0
    reorder_level: float = 0
    max_stock: float = 0
    supplier_id: str = ''
    storage_location: str = ''
    batch_tracking: bool = False
    expiry_tracking: bool = False
    active: bool = True
    is_sub_recipe: bool = False
    rate: float = 0


async def item_doc(body: ItemIn):
    pu = await get_unit(body.purchase_unit)
    cu = await get_unit(body.consumption_unit)
    if pu['family'] != cu['family']:
        raise HTTPException(400, f"Purchase unit ({pu['family']}) and consumption unit ({cu['family']}) are not convertible")
    cat = await db.categories.find_one({'id': body.category_id}, {'_id': 0}) if body.category_id else None
    rate_per_base = body.rate / pu['factor'] if body.rate else 0
    return {
        'code': body.code.strip().upper(), 'name': body.name.strip(),
        'category_id': body.category_id, 'category_name': cat['name'] if cat else '',
        'subcategory': body.subcategory, 'purchase_unit': pu['code'], 'consumption_unit': cu['code'],
        'conversion_factor': body.conversion_factor,
        'min_stock': body.min_stock, 'reorder_level': body.reorder_level, 'max_stock': body.max_stock,
        'min_stock_base': body.min_stock * cu['factor'], 'reorder_level_base': body.reorder_level * cu['factor'],
        'supplier_id': body.supplier_id, 'storage_location': body.storage_location,
        'batch_tracking': body.batch_tracking, 'expiry_tracking': body.expiry_tracking,
        'active': body.active, 'is_sub_recipe': body.is_sub_recipe,
        'rate': body.rate, 'rate_per_base': rate_per_base,
    }


@router.get('/items')
async def list_items(user=Depends(get_current_user)):
    return clean_list(await db.items.find(LIVE).to_list(5000))


@router.get('/items/search')
async def search_items(q: str = '', location_id: str = '', limit: int = 25, active_only: bool = True,
                       user=Depends(get_current_user)):
    """Fast server-side item lookup by name, code/SKU or category. Optionally shows live stock at a location."""
    query = dict(LIVE)
    if active_only:
        query['active'] = True
    term = q.strip()
    if term:
        rx = {'$regex': term.replace('\\', ''), '$options': 'i'}
        query['$or'] = [{'name': rx}, {'code': rx}, {'category_name': rx}, {'subcategory': rx}]
    limit = max(1, min(limit, 100))
    docs = clean_list(await db.items.find(query, {'_id': 0}).sort('name', 1).to_list(limit))
    if location_id:
        smap = await stock_map(location_id)
        for d in docs:
            d['stock'] = round(await base_to_unit(smap.get(d['id'], 0), d['consumption_unit']), 3)
            d['stock_unit'] = d['consumption_unit']
    return docs


@router.post('/items')
async def create_item(body: ItemIn, user=Depends(require_roles('admin'))):
    if await db.items.find_one({'code': body.code.strip().upper()}):
        raise HTTPException(400, 'Item code already exists')
    doc = await item_doc(body)
    doc['id'] = uid()
    doc['created_at'] = now_iso()
    await insert('items', doc)
    await audit(user, 'Created item', doc['name'], doc['code'])
    return doc


@router.put('/items/{item_id}')
async def update_item(item_id: str, body: ItemIn, user=Depends(require_roles('admin'))):
    existing = await db.items.find_one({'id': item_id})
    if not existing:
        raise HTTPException(404, 'Item not found')
    doc = await item_doc(body)
    if not body.rate and existing.get('rate'):
        doc['rate'] = existing['rate']
        doc['rate_per_base'] = existing.get('rate_per_base', 0)
    await db.items.update_one({'id': item_id}, {'$set': doc})
    await audit(user, 'Updated item', body.name, body.code)
    return clean(await db.items.find_one({'id': item_id}))


@router.delete('/items/{item_id}')
async def delete_item(item_id: str, user=Depends(require_roles('admin'))):
    refs = await db.inventory_transactions.count_documents({'item_id': item_id})
    refs += await db.sub_recipes.count_documents({'items.item_id': item_id})
    refs += await db.recipe_versions.count_documents({'items.item_id': item_id})
    return await soft_or_hard_delete('items', item_id, refs, 'Item', user)


# ---------- Suppliers ----------
class SupplierIn(BaseModel):
    name: str
    contact_person: str = ''
    phone: str = ''
    email: str = ''
    address: str = ''
    gst_number: str = ''
    payment_terms: str = ''
    active: bool = True


@router.get('/suppliers')
async def list_suppliers(user=Depends(get_current_user)):
    return clean_list(await db.suppliers.find(LIVE).to_list(1000))


@router.post('/suppliers')
async def create_supplier(body: SupplierIn, user=Depends(require_roles('admin', 'store_keeper'))):
    doc = await insert('suppliers', {'id': uid(), **body.model_dump(), 'created_at': now_iso()})
    await audit(user, 'Created supplier', doc['name'])
    return doc


@router.put('/suppliers/{sid}')
async def update_supplier(sid: str, body: SupplierIn, user=Depends(require_roles('admin', 'store_keeper'))):
    await db.suppliers.update_one({'id': sid}, {'$set': body.model_dump()})
    return clean(await db.suppliers.find_one({'id': sid}))


@router.delete('/suppliers/{sid}')
async def delete_supplier(sid: str, user=Depends(require_roles('admin'))):
    refs = await db.procurement_receipts.count_documents({'supplier_id': sid})
    return await soft_or_hard_delete('suppliers', sid, refs, 'Supplier', user)


# ---------- Settings ----------
@router.get('/settings')
async def get_settings(user=Depends(get_current_user)):
    s = await db.settings.find_one({'id': 'global'}, {'_id': 0})
    return s or {'id': 'global', 'company_name': 'My Food Business', 'variance_tolerance_pct': 2}


class SettingsIn(BaseModel):
    company_name: str
    variance_tolerance_pct: float = 2


@router.put('/settings')
async def update_settings(body: SettingsIn, user=Depends(require_roles('admin'))):
    if not body.company_name.strip():
        raise HTTPException(400, 'Company name cannot be empty')
    body.company_name = body.company_name.strip()
    await db.settings.update_one({'id': 'global'}, {'$set': body.model_dump()}, upsert=True)
    await audit(user, 'Updated settings', f"company={body.company_name}, tolerance={body.variance_tolerance_pct}%")
    return await get_settings(user)
