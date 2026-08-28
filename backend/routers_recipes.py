from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from db import db, uid, now_iso, insert, clean, clean_list, next_no, audit
from auth import get_current_user, require_roles
from inventory import to_base, base_to_unit
from recipes_engine import recipe_cost, sub_cost_per_base, expand_to_raw, get_active_version

router = APIRouter(tags=['recipes'])


class SubRecipeItemIn(BaseModel):
    item_id: str
    qty: float
    unit: str


class SubRecipeIn(BaseModel):
    name: str
    code: str
    brand_id: str = ''
    output_item_id: str
    yield_qty: float
    yield_unit: str
    items: list[SubRecipeItemIn]
    active: bool = True


async def build_sub_recipe(body: SubRecipeIn):
    if body.yield_qty <= 0:
        raise HTTPException(400, 'Yield must be greater than zero')
    if not body.items:
        raise HTTPException(400, 'Add at least one ingredient')
    out_item = await db.items.find_one({'id': body.output_item_id}, {'_id': 0})
    if not out_item:
        raise HTTPException(400, 'Invalid output item')
    yield_base, _ = await to_base(body.yield_qty, body.yield_unit)
    items = []
    total_cost = 0.0
    raw_same_family = 0.0
    out_family = (await to_base(1, body.yield_unit))[1]
    for ing in body.items:
        if ing.qty <= 0:
            raise HTTPException(400, 'Ingredient quantity must be greater than zero')
        item = await db.items.find_one({'id': ing.item_id}, {'_id': 0})
        if not item:
            raise HTTPException(400, 'Invalid ingredient item')
        qb, fam = await to_base(ing.qty, ing.unit)
        if fam == out_family:
            raw_same_family += qb
        total_cost += qb * (item.get('rate_per_base') or 0)
        items.append({'item_id': ing.item_id, 'item_name': item['name'], 'qty': ing.qty, 'unit': ing.unit, 'qty_base': qb})
    yield_pct = round(yield_base / raw_same_family * 100, 2) if raw_same_family else 0
    return {
        'name': body.name.strip(), 'code': body.code.strip().upper(), 'brand_id': body.brand_id or None,
        'output_item_id': body.output_item_id, 'output_item_name': out_item['name'],
        'yield_qty': body.yield_qty, 'yield_unit': body.yield_unit, 'yield_base': yield_base,
        'yield_pct': yield_pct, 'items': items, 'batch_cost': round(total_cost, 4),
        'cost_per_base': round(total_cost / yield_base, 6) if yield_base else 0,
        'active': body.active,
    }


@router.get('/subrecipes')
async def list_subrecipes(user=Depends(get_current_user)):
    return clean_list(await db.sub_recipes.find({}).to_list(1000))


@router.post('/subrecipes')
async def create_subrecipe(body: SubRecipeIn, user=Depends(require_roles('admin', 'chef'))):
    if await db.sub_recipes.find_one({'code': body.code.strip().upper()}):
        raise HTTPException(400, 'Sub-recipe code exists')
    doc = await build_sub_recipe(body)
    doc['id'] = uid()
    doc['created_at'] = now_iso()
    await insert('sub_recipes', doc)
    await audit(user, 'Created sub-recipe', doc['name'], doc['code'])
    return doc


@router.put('/subrecipes/{sid}')
async def update_subrecipe(sid: str, body: SubRecipeIn, user=Depends(require_roles('admin', 'chef'))):
    existing = await db.sub_recipes.find_one({'id': sid})
    if not existing:
        raise HTTPException(404, 'Sub-recipe not found')
    doc = await build_sub_recipe(body)
    await db.sub_recipes.update_one({'id': sid}, {'$set': doc})
    await audit(user, 'Updated sub-recipe', body.name, body.code)
    return clean(await db.sub_recipes.find_one({'id': sid}))


class RecipeItemIn(BaseModel):
    item_id: str = ''
    sub_recipe_id: str = ''
    qty: float
    unit: str


class RecipeIn(BaseModel):
    name: str
    code: str
    brand_id: str
    category: str = ''
    portion_size: str = ''
    selling_unit: str = 'Portion'
    selling_price: float = 0
    effective_date: str = ''
    items: list[RecipeItemIn]
    notes: str = ''
    active: bool = True


async def build_version_items(items: list[RecipeItemIn]):
    lines = []
    for li in items:
        if li.qty <= 0:
            raise HTTPException(400, 'Recipe ingredient quantity must be greater than zero')
        if not li.item_id and not li.sub_recipe_id:
            raise HTTPException(400, 'Each line needs an item or sub-recipe')
        qb, _ = await to_base(li.qty, li.unit)
        name = ''
        if li.sub_recipe_id:
            sub = await db.sub_recipes.find_one({'id': li.sub_recipe_id}, {'_id': 0})
            if not sub or not sub.get('active'):
                raise HTTPException(400, 'Invalid or inactive sub-recipe')
            name = sub['name']
        else:
            item = await db.items.find_one({'id': li.item_id}, {'_id': 0})
            if not item or not item.get('active'):
                raise HTTPException(400, f'Invalid or inactive item in recipe')
            name = item['name']
        lines.append({'item_id': li.item_id or None, 'sub_recipe_id': li.sub_recipe_id or None,
                      'name': name, 'qty': li.qty, 'unit': li.unit, 'qty_base': qb})
    return lines


@router.get('/recipes')
async def list_recipes(user=Depends(get_current_user)):
    recipes = clean_list(await db.recipes.find({}).to_list(1000))
    brands = {b['id']: b['name'] for b in await db.brands.find({}, {'_id': 0}).to_list(1000)}
    for r in recipes:
        r['brand_name'] = brands.get(r.get('brand_id'), '')
        version = await db.recipe_versions.find_one({'recipe_id': r['id'], 'version': r.get('current_version', 1)}, {'_id': 0})
        if version:
            r['items'] = version.get('items', [])
            r['cost'] = round(await recipe_cost(version.get('items', [])), 2)
            r['food_cost_pct'] = round(r['cost'] / r['selling_price'] * 100, 2) if r.get('selling_price') else 0
    return recipes


@router.get('/recipes/{rid}')
async def get_recipe(rid: str, user=Depends(get_current_user)):
    r = clean(await db.recipes.find_one({'id': rid}))
    if not r:
        raise HTTPException(404, 'Recipe not found')
    versions = clean_list(await db.recipe_versions.find({'recipe_id': rid}).sort('version', -1).to_list(100))
    for v in versions:
        v['cost'] = round(await recipe_cost(v.get('items', [])), 2)
    r['versions'] = versions
    return r


@router.post('/recipes')
async def create_recipe(body: RecipeIn, user=Depends(require_roles('admin', 'chef'))):
    if await db.recipes.find_one({'code': body.code.strip().upper()}):
        raise HTTPException(400, 'Recipe code exists')
    if not body.items:
        raise HTTPException(400, 'Add at least one ingredient')
    lines = await build_version_items(body.items)
    recipe_id = uid()
    doc = await insert('recipes', {
        'id': recipe_id, 'name': body.name.strip(), 'code': body.code.strip().upper(),
        'brand_id': body.brand_id, 'category': body.category, 'portion_size': body.portion_size,
        'selling_unit': body.selling_unit, 'selling_price': body.selling_price,
        'current_version': 1, 'active': body.active, 'created_at': now_iso(),
    })
    v = await insert('recipe_versions', {
        'id': uid(), 'recipe_id': recipe_id, 'version': 1,
        'effective_date': body.effective_date or '2000-01-01', 'items': lines,
        'notes': body.notes, 'created_by': user['name'], 'created_at': now_iso(),
    })
    await audit(user, 'Created recipe', f"{doc['name']} v1", doc['code'])
    return doc


@router.put('/recipes/{rid}')
async def update_recipe(rid: str, body: RecipeIn, user=Depends(require_roles('admin', 'chef'))):
    r = await db.recipes.find_one({'id': rid})
    if not r:
        raise HTTPException(404, 'Recipe not found')
    if not body.items:
        raise HTTPException(400, 'Add at least one ingredient')
    lines = await build_version_items(body.items)
    new_version = r.get('current_version', 1) + 1
    await db.recipes.update_one({'id': rid}, {'$set': {
        'name': body.name.strip(), 'brand_id': body.brand_id, 'category': body.category,
        'portion_size': body.portion_size, 'selling_unit': body.selling_unit,
        'selling_price': body.selling_price, 'active': body.active, 'current_version': new_version,
    }})
    await insert('recipe_versions', {
        'id': uid(), 'recipe_id': rid, 'version': new_version,
        'effective_date': body.effective_date or now_iso()[:10], 'items': lines,
        'notes': body.notes, 'created_by': user['name'], 'created_at': now_iso(),
    })
    await audit(user, 'Updated recipe', f"{body.name} -> v{new_version}", body.code)
    return clean(await db.recipes.find_one({'id': rid}))


@router.get('/recipes/{rid}/expansion')
async def recipe_expansion(rid: str, portions: float = 1, user=Depends(get_current_user)):
    r = await db.recipes.find_one({'id': rid}, {'_id': 0})
    if not r:
        raise HTTPException(404, 'Recipe not found')
    version = await get_active_version(rid, now_iso()[:10])
    if not version:
        raise HTTPException(400, 'No recipe version')
    raws = await expand_to_raw(version['items'], portions)
    out = []
    for item_id, qb in raws.items():
        item = await db.items.find_one({'id': item_id}, {'_id': 0})
        if item:
            out.append({'item_id': item_id, 'item_name': item['name'],
                        'qty': round(await base_to_unit(qb, item['consumption_unit']), 3),
                        'unit': item['consumption_unit'], 'qty_base': round(qb, 3)})
    return {'recipe': r['name'], 'portions': portions, 'raw_materials': out}
