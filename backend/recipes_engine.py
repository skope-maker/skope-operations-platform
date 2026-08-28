from db import db


async def get_active_version(recipe_id: str, date: str):
    versions = await db.recipe_versions.find({'recipe_id': recipe_id}, {'_id': 0}).sort('version', -1).to_list(200)
    if not versions:
        return None
    eligible = [v for v in versions if v.get('effective_date', '0000-00-00') <= date]
    return eligible[0] if eligible else versions[-1]


async def sub_by_output(item_id: str):
    return await db.sub_recipes.find_one({'output_item_id': item_id, 'active': True}, {'_id': 0})


async def _expand_sub(sub, scale, result, depth):
    if depth > 5:
        return
    for ing in sub.get('items', []):
        need = ing['qty_base'] * scale
        sub2 = await sub_by_output(ing['item_id'])
        if sub2 and sub2.get('yield_base'):
            await _expand_sub(sub2, need / sub2['yield_base'], result, depth + 1)
        else:
            result[ing['item_id']] = result.get(ing['item_id'], 0) + need


async def expand_to_raw(version_items, portions: float):
    result = {}
    for line in version_items:
        if line.get('sub_recipe_id'):
            sub = await db.sub_recipes.find_one({'id': line['sub_recipe_id'], 'active': True}, {'_id': 0})
            if not sub or not sub.get('yield_base'):
                continue
            required_out = line['qty_base'] * portions
            await _expand_sub(sub, required_out / sub['yield_base'], result, 0)
        elif line.get('item_id'):
            sub = await sub_by_output(line['item_id'])
            need = line['qty_base'] * portions
            if sub and sub.get('yield_base'):
                await _expand_sub(sub, need / sub['yield_base'], result, 0)
            else:
                result[line['item_id']] = result.get(line['item_id'], 0) + need
    return result


async def physical_consumption(version_items, portions: float):
    lines = []
    for line in version_items:
        if line.get('sub_recipe_id'):
            sub = await db.sub_recipes.find_one({'id': line['sub_recipe_id']}, {'_id': 0})
            if not sub:
                continue
            lines.append({
                'kind': 'sub_recipe_output',
                'item_id': sub['output_item_id'],
                'sub_recipe_id': sub['id'],
                'sub_recipe_name': sub['name'],
                'qty_base': line['qty_base'] * portions,
            })
        elif line.get('item_id'):
            lines.append({
                'kind': 'raw',
                'item_id': line['item_id'],
                'qty_base': line['qty_base'] * portions,
            })
    return lines


async def recipe_cost(version_items) -> float:
    total = 0.0
    for line in version_items:
        if line.get('sub_recipe_id'):
            sub = await db.sub_recipes.find_one({'id': line['sub_recipe_id']}, {'_id': 0})
            if not sub:
                continue
            item = await db.items.find_one({'id': sub['output_item_id']}, {'_id': 0})
            rate = (item or {}).get('rate_per_base') or sub_cost_per_base(sub)
            total += line['qty_base'] * rate
        elif line.get('item_id'):
            item = await db.items.find_one({'id': line['item_id']}, {'_id': 0})
            total += line['qty_base'] * ((item or {}).get('rate_per_base') or 0)
    return total


def sub_cost_per_base(sub) -> float:
    if sub.get('yield_base'):
        return (sub.get('batch_cost') or 0) / sub['yield_base']
    return 0.0
