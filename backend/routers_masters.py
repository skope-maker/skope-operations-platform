from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from db import db, uid, now_iso, insert, clean, clean_list, audit
from auth import get_current_user, require_roles
from inventory import get_unit, to_base

router = APIRouter(tags=['masters'])


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
    return clean_list(await db.brands.find({}).to_list(1000))


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
    if refs:
        raise HTTPException(400, 'Brand has linked sales/recipes. Set it inactive instead.')
    await db.brands.delete_one({'id': brand_id})
    await audit(user, 'Deleted brand', brand_id)
    return {'ok': True}


# ---------- Kitchens / Locations ----------
class KitchenIn(BaseModel):
    name: str
    code: str
    type: str
    active: bool = True


@router.get('/kitchens')
async def list_kitchens(user=Depends(get_current_user)):
    return clean_list(await db.kitchens.find({}).to_list(1000))


@router.post('/kitchens')
async def create_kitchen(body: KitchenIn, user=Depends(require_roles('admin'))):
    if body.type not in ('store', 'base_kitchen', 'normal_kitchen', 'rd'):
        raise HTTPException(400, 'Invalid location type')
    doc = await insert('kitchens', {'id': uid(), **body.model_dump(), 'created_at': now_iso()})
    await audit(user, 'Created location', doc['name'], doc['code'])
    return doc


@router.put('/kitchens/{kid}')
async def update_kitchen(kid: str, body: KitchenIn, user=Depends(require_roles('admin'))):
    await db.kitchens.update_one({'id': kid}, {'$set': body.model_dump()})
    return clean(await db.kitchens.find_one({'id': kid}))


@router.delete('/kitchens/{kid}')
async def delete_kitchen(kid: str, user=Depends(require_roles('admin'))):
    refs = await db.inventory_transactions.count_documents({'$or': [{'from_location_id': kid}, {'to_location_id': kid}]})
    if refs:
        raise HTTPException(400, 'Location has transactions. Deactivate it instead.')
    await db.kitchens.delete_one({'id': kid})
    return {'ok': True}


# ---------- Categories ----------
class CategoryIn(BaseModel):
    name: str
    subcategories: list[str] = []


@router.get('/categories')
async def list_categories(user=Depends(get_current_user)):
    return clean_list(await db.categories.find({}).to_list(1000))


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
    await db.categories.delete_one({'id': cid})
    return {'ok': True}


# ---------- Units ----------
class UnitIn(BaseModel):
    name: str
    code: str
    family: str
    factor: float


@router.get('/units')
async def list_units(user=Depends(get_current_user)):
    return clean_list(await db.units.find({}).to_list(1000))


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
    await db.units.delete_one({'id': unit_id})
    return {'ok': True}


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
    return clean_list(await db.items.find({}).to_list(5000))


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
    if refs:
        raise HTTPException(400, 'Item has transactions. Set it inactive instead.')
    await db.items.delete_one({'id': item_id})
    return {'ok': True}


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
    return clean_list(await db.suppliers.find({}).to_list(1000))


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
    if refs:
        raise HTTPException(400, 'Supplier has receipts. Deactivate instead.')
    await db.suppliers.delete_one({'id': sid})
    return {'ok': True}


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
