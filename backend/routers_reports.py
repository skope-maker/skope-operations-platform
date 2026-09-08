from fastapi import APIRouter, Depends
from datetime import datetime, timezone, timedelta
from db import db, today_str, clean_list
from auth import get_current_user, require_roles
from inventory import stock_rows, stock_map, base_to_unit
from recipes_engine import expand_to_raw, get_active_version, recipe_cost
from routers_closing import compute_day_sheet

router = APIRouter(tags=['reports'])


@router.get('/dashboard')
async def dashboard(user=Depends(get_current_user)):
    today = today_str()
    month_start = today[:8] + '01'
    sales_today = await db.daily_sales.find({'date': today, 'status': 'posted'}, {'_id': 0}).to_list(1000)
    sales_mtd = await db.daily_sales.find({'date': {'$gte': month_start}, 'status': 'posted'}, {'_id': 0}).to_list(5000)
    today_sales_val = sum(s['total_amount'] for s in sales_today)
    today_orders = sum(sum(l['net_qty'] for l in s['items']) for s in sales_today)
    mtd_sales_val = sum(s['total_amount'] for s in sales_mtd)
    locations = await db.kitchens.find({}, {'_id': 0}).to_list(1000)
    items = {i['id']: i for i in await db.items.find({}, {'_id': 0}).to_list(5000)}
    store_value = 0.0
    kitchen_value = 0.0
    inv_by_location = []
    for loc in locations:
        smap = await stock_map(loc['id'])
        val = sum(q * (items.get(iid, {}).get('rate_per_base') or 0) for iid, q in smap.items())
        inv_by_location.append({'location': loc['name'], 'type': loc['type'], 'value': round(val, 2)})
        if loc['type'] == 'store':
            store_value += val
        else:
            kitchen_value += val
    total_value = store_value + kitchen_value
    consumption_txns = await db.inventory_transactions.find(
        {'date': today, 'txn_type': {'$in': ['recipe_consumption']}}, {'_id': 0}).to_list(10000)
    consumption_value = sum(t.get('value', 0) for t in consumption_txns)
    wastage_today = await db.wastage.find({'date': today}, {'_id': 0, 'photo': 0}).to_list(1000)
    wastage_value = sum(w.get('value', 0) for w in wastage_today)
    food_cost_pct = round(consumption_value / today_sales_val * 100, 2) if today_sales_val else 0
    latest_closing = await db.daily_closing.find({}, {'_id': 0}).sort('date', -1).to_list(1)
    variance_pct = 0
    high_variance_items = []
    if latest_closing:
        c = latest_closing[0]
        pcts = [abs(i['variance_pct']) for i in c['items'] if i.get('variance_pct') is not None]
        variance_pct = round(sum(pcts) / len(pcts), 2) if pcts else 0
        high_variance_items = [{'item': i['item_name'], 'variance_pct': i['variance_pct'], 'variance': i['variance'], 'unit': i['unit']}
                               for i in c['items'] if i.get('breach')]
    low_stock = []
    for loc in locations:
        rows = await stock_rows(loc['id'])
        for r in rows:
            if r['status'] in ('low', 'warning') and (r['min_stock'] or r['reorder_level']):
                low_stock.append({**r, 'location': loc['name']})
    pending_receipts = await db.procurement_receipts.count_documents({'status': 'pending'})
    pending_intents = await db.kitchen_intents.count_documents({'status': {'$in': ['pending', 'partial']}})
    pending_closing = await db.daily_closing.count_documents({'status': 'submitted'})
    expiring = []
    seven_days = (datetime.now(timezone.utc) + timedelta(days=7)).date().isoformat()
    receipts_txns = await db.inventory_transactions.find(
        {'txn_type': 'purchase_receipt', 'expiry_date': {'$ne': None, '$lte': seven_days}}, {'_id': 0}).to_list(1000)
    for t in receipts_txns:
        item = items.get(t['item_id'])
        if item and item.get('expiry_tracking'):
            expiring.append({'item': item['name'], 'batch': t.get('batch_number'), 'expiry': t['expiry_date']})
    trend = []
    for i in range(13, -1, -1):
        d = (datetime.now(timezone.utc) - timedelta(days=i)).date().isoformat()
        day_sales = await db.daily_sales.find({'date': d, 'status': 'posted'}, {'_id': 0}).to_list(1000)
        trend.append({'date': d[5:], 'sales': round(sum(s['total_amount'] for s in day_sales), 2)})
    brand_sales = {}
    brand_consumption = {}
    for s in sales_mtd:
        brand_sales[s['brand_name']] = brand_sales.get(s['brand_name'], 0) + s['total_amount']
        cons = await db.inventory_transactions.find(
            {'reference_id': s['id'], 'txn_type': 'recipe_consumption'}, {'_id': 0}).to_list(10000)
        brand_consumption[s['brand_name']] = brand_consumption.get(s['brand_name'], 0) + sum(c.get('value', 0) for c in cons)
    brand_wise = [{'brand': k, 'sales': round(v, 2),
                   'food_cost_pct': round(brand_consumption.get(k, 0) / v * 100, 2) if v else 0}
                  for k, v in brand_sales.items()]
    wastage_trend = []
    for i in range(13, -1, -1):
        d = (datetime.now(timezone.utc) - timedelta(days=i)).date().isoformat()
        wl = await db.wastage.find({'date': d}, {'_id': 0}).to_list(1000)
        wastage_trend.append({'date': d[5:], 'value': round(sum(w.get('value', 0) for w in wl), 2)})
    top_products = {}
    for s in sales_mtd:
        for l in s['items']:
            top_products[l['recipe_name']] = top_products.get(l['recipe_name'], 0) + l['net_qty']
    top_products = sorted([{'product': k, 'qty': v} for k, v in top_products.items()], key=lambda x: -x['qty'])[:8]
    return {
        'today_sales': round(today_sales_val, 2), 'today_orders': today_orders,
        'mtd_sales': round(mtd_sales_val, 2), 'inventory_value': round(total_value, 2),
        'store_value': round(store_value, 2), 'kitchen_value': round(kitchen_value, 2),
        'today_consumption': round(consumption_value, 2), 'today_wastage': round(wastage_value, 2),
        'food_cost_pct': food_cost_pct, 'variance_pct': variance_pct,
        'low_stock': low_stock[:10], 'low_stock_count': len(low_stock),
        'inv_by_location': inv_by_location,
        'alerts': {
            'pending_procurement': pending_receipts, 'pending_intents': pending_intents,
            'pending_closing': pending_closing, 'expiring_items': expiring[:10],
            'high_variance_items': high_variance_items[:10],
        },
        'sales_trend': trend, 'brand_wise': brand_wise, 'wastage_trend': wastage_trend,
        'top_products': top_products,
    }


@router.get('/reports/reorder')
async def report_reorder(location_id: str = '', user=Depends(get_current_user)):
    """Daily reorder / low-stock list per kitchen: items at or below reorder/min level with suggested top-up qty."""
    locations = await db.kitchens.find({'deleted': {'$ne': True}, 'active': True}, {'_id': 0}).to_list(1000)
    if location_id:
        locations = [l for l in locations if l['id'] == location_id]
    rows = []
    for loc in locations:
        for r in await stock_rows(loc['id']):
            if r['status'] in ('low', 'warning') and (r['min_stock'] or r['reorder_level']):
                target = r['max_stock'] or r['reorder_level'] or r['min_stock'] or 0
                rows.append({
                    'location': loc['name'], 'location_id': loc['id'],
                    'item_code': r['item_code'], 'item_name': r['item_name'], 'category': r['category'],
                    'unit': r['unit'], 'stock': r['stock'], 'min_stock': r['min_stock'],
                    'reorder_level': r['reorder_level'], 'max_stock': r['max_stock'],
                    'suggested_order_qty': round(max(target - r['stock'], 0), 3),
                    'status': r['status'],
                })
    rows.sort(key=lambda r: (r['location'], 0 if r['status'] == 'low' else 1, r['item_name']))
    return rows


@router.get('/reports/sales')
async def report_sales(date_from: str = '', date_to: str = '', brand_id: str = '', user=Depends(get_current_user)):
    q = {}
    if date_from:
        q['date'] = {'$gte': date_from}
    if date_to:
        q.setdefault('date', {})['$lte'] = date_to
    if brand_id:
        q['brand_id'] = brand_id
    sales = clean_list(await db.daily_sales.find(q).sort('date', -1).to_list(5000))
    rows = []
    for s in sales:
        for l in s['items']:
            rows.append({'sale_no': s['sale_no'], 'date': s['date'], 'brand': s['brand_name'],
                         'product': l['recipe_name'], 'qty_sold': l['qty_sold'], 'cancelled': l['cancelled'],
                         'complimentary': l['complimentary'], 'net_qty': l['net_qty'],
                         'price': l['selling_price'], 'amount': l['amount'], 'status': s['status']})
    return rows


@router.get('/reports/inventory')
async def report_inventory(date: str, location_id: str, user=Depends(get_current_user)):
    return await compute_day_sheet(date, location_id)


@router.get('/reports/brand-consumption')
async def report_brand_consumption(date_from: str = '', date_to: str = '', user=Depends(get_current_user)):
    q = {'status': 'posted'}
    if date_from:
        q['date'] = {'$gte': date_from}
    if date_to:
        q.setdefault('date', {})['$lte'] = date_to
    sales = clean_list(await db.daily_sales.find(q).to_list(5000))
    agg = {}
    for s in sales:
        for line in s['items']:
            if line['net_qty'] <= 0:
                continue
            version = await get_active_version(line['recipe_id'], s['date'])
            if not version:
                continue
            raws = await expand_to_raw(version['items'], line['net_qty'])
            for item_id, qb in raws.items():
                key = (s['brand_name'], item_id)
                agg[key] = agg.get(key, 0) + qb
    rows = []
    for (brand, item_id), qb in agg.items():
        item = await db.items.find_one({'id': item_id}, {'_id': 0})
        if item:
            rows.append({'brand': brand, 'item': item['name'],
                         'qty': round(await base_to_unit(qb, item['consumption_unit']), 3),
                         'unit': item['consumption_unit'],
                         'value': round(qb * (item.get('rate_per_base') or 0), 2)})
    rows.sort(key=lambda r: (r['brand'], r['item']))
    return rows


@router.get('/reports/recipe-consumption')
async def report_recipe_consumption(date_from: str = '', date_to: str = '', user=Depends(get_current_user)):
    q = {'status': 'posted'}
    if date_from:
        q['date'] = {'$gte': date_from}
    if date_to:
        q.setdefault('date', {})['$lte'] = date_to
    sales = clean_list(await db.daily_sales.find(q).to_list(5000))
    agg = {}
    for s in sales:
        for line in s['items']:
            if line['net_qty'] <= 0:
                continue
            version = await get_active_version(line['recipe_id'], s['date'])
            if not version:
                continue
            raws = await expand_to_raw(version['items'], line['net_qty'])
            for item_id, qb in raws.items():
                key = (line['recipe_name'], item_id)
                if key not in agg:
                    agg[key] = {'sales': 0, 'qty_base': 0}
                agg[key]['sales'] += line['net_qty']
                agg[key]['qty_base'] += qb
    rows = []
    for (product, item_id), v in agg.items():
        item = await db.items.find_one({'id': item_id}, {'_id': 0})
        if item:
            rows.append({'product': product, 'sales': v['sales'], 'ingredient': item['name'],
                         'theoretical': round(await base_to_unit(v['qty_base'], item['consumption_unit']), 3),
                         'unit': item['consumption_unit']})
    rows.sort(key=lambda r: (r['product'], r['ingredient']))
    return rows


@router.get('/reports/variance')
async def report_variance(date_from: str = '', date_to: str = '', user=Depends(get_current_user)):
    q = {}
    if date_from:
        q['date'] = {'$gte': date_from}
    if date_to:
        q.setdefault('date', {})['$lte'] = date_to
    closings = clean_list(await db.daily_closing.find(q).sort('date', -1).to_list(500))
    locs = {l['id']: l['name'] for l in await db.kitchens.find({}, {'_id': 0}).to_list(1000)}
    rows = []
    for c in closings:
        for i in c['items']:
            if i.get('variance') is not None:
                rows.append({'date': c['date'], 'location': locs.get(c['location_id'], ''),
                             'item': i['item_name'], 'expected': i['expected'], 'physical': i['physical'],
                             'variance': i['variance'], 'variance_pct': i['variance_pct'],
                             'unit': i['unit'], 'breach': i.get('breach', False), 'status': c['status']})
    return rows


@router.get('/reports/wastage')
async def report_wastage(date_from: str = '', date_to: str = '', user=Depends(get_current_user)):
    q = {}
    if date_from:
        q['date'] = {'$gte': date_from}
    if date_to:
        q.setdefault('date', {})['$lte'] = date_to
    docs = clean_list(await db.wastage.find(q, {'photo': 0}).sort('date', -1).to_list(5000))
    locs = {l['id']: l['name'] for l in await db.kitchens.find({}, {'_id': 0}).to_list(1000)}
    brands = {b['id']: b['name'] for b in await db.brands.find({}, {'_id': 0}).to_list(1000)}
    return [{'date': d['date'], 'brand': brands.get(d.get('brand_id'), 'Shared'),
             'kitchen': locs.get(d['kitchen_id'], ''), 'item': d['item_name'], 'qty': d['qty'],
             'unit': d['unit'], 'reason': d['reason'], 'value': d['value'], 'by': d['created_by']} for d in docs]


@router.get('/reports/procurement')
async def report_procurement(date_from: str = '', date_to: str = '', user=Depends(get_current_user)):
    q = {}
    if date_from:
        q['receipt_date'] = {'$gte': date_from}
    if date_to:
        q.setdefault('receipt_date', {})['$lte'] = date_to
    docs = clean_list(await db.procurement_receipts.find(q, {'attachment': 0}).sort('receipt_date', -1).to_list(5000))
    rows = []
    for d in docs:
        for i in d['items']:
            rows.append({'receipt_no': d['receipt_no'], 'date': d['receipt_date'], 'supplier': d['supplier_name'],
                         'invoice': d['invoice_number'], 'item': i['item_name'], 'ordered': i['ordered_qty'],
                         'received': i['received_qty'], 'approved': i['approved_qty'], 'unit': i['unit'],
                         'rate': i['rate'], 'total': i['total'], 'status': d['status']})
    return rows


@router.get('/reports/rd')
async def report_rd(user=Depends(get_current_user)):
    docs = clean_list(await db.rd_trials.find({}, {'photos': 0}).sort('date', -1).to_list(1000))
    brands = {b['id']: b['name'] for b in await db.brands.find({}, {'_id': 0}).to_list(1000)}
    return [{'trial_no': d['trial_no'], 'date': d['date'], 'brand': brands.get(d.get('brand_id'), 'Shared'),
             'product': d['product'], 'cost': d['cost'], 'yield_qty': d['yield_qty'], 'yield_unit': d['yield_unit'],
             'result': d['result'], 'chef': d['chef'], 'items': d['items']} for d in docs]


@router.get('/reports/food-cost')
async def report_food_cost(user=Depends(get_current_user)):
    recipes = clean_list(await db.recipes.find({'active': True}).to_list(1000))
    brands = {b['id']: b['name'] for b in await db.brands.find({}, {'_id': 0}).to_list(1000)}
    rows = []
    for r in recipes:
        version = await db.recipe_versions.find_one({'recipe_id': r['id'], 'version': r.get('current_version', 1)}, {'_id': 0})
        cost = await recipe_cost(version['items']) if version else 0
        price = r.get('selling_price', 0)
        rows.append({'recipe': r['name'], 'code': r['code'], 'brand': brands.get(r.get('brand_id'), ''),
                     'version': r.get('current_version', 1), 'cost': round(cost, 2), 'price': price,
                     'food_cost_pct': round(cost / price * 100, 2) if price else 0})
    return rows


@router.get('/audit-logs')
async def audit_logs(user=Depends(require_roles('admin', 'management'))):
    return clean_list(await db.audit_logs.find({}, {'_id': 0}).sort('date', -1).to_list(2000))
