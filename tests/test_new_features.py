"""End-to-end check of masters + bulk upload + intent/issue flows."""
import io
import os
import requests
from openpyxl import Workbook

BASE = os.environ.get('TEST_BASE', 'http://localhost:8001') + '/api'
S = requests.Session()


def login(email, pw):
    r = S.post(f'{BASE}/auth/login', json={'email': email, 'password': pw})
    r.raise_for_status()
    return r.json()['token']


TOKEN = login('chennakeshavaediga@gmail.com', 'admin123')
H = {'Authorization': f'Bearer {TOKEN}'}


def post(path, body):
    r = S.post(f'{BASE}{path}', json=body, headers=H)
    if r.status_code >= 400:
        raise SystemExit(f'POST {path} -> {r.status_code} {r.text[:300]}')
    return r.json()


def get(path):
    r = S.get(f'{BASE}{path}', headers=H)
    r.raise_for_status()
    return r.json()


def ensure(path, body, key='code'):
    existing = {d.get(key): d for d in get(path)}
    if body.get(key) in existing:
        return existing[body[key]]
    return post(path, body)


print('units:', [u['code'] for u in get('/units')])
locs = get('/kitchens')
print('locations:', [(l['name'], l['type'], l.get('parent_name')) for l in locs])

brand = ensure('/brands', {'name': 'Test Brand', 'code': 'TB1', 'status': 'active'})
cat = None
cats = get('/categories')
cat = cats[0] if cats else post('/categories', {'name': 'Groceries', 'subcategories': ['Dry']})

items = {}
for code, name, pu, cu, rate in [('ITM-ONION', 'Onion', 'KG', 'GM', 40), ('ITM-OIL', 'Oil', 'LTR', 'ML', 120),
                                 ('ITM-CHICKEN', 'Chicken', 'KG', 'GM', 260), ('ITM-GRAVY', 'Gravy Base', 'KG', 'GM', 0)]:
    items[code] = ensure('/items', {'code': code, 'name': name, 'category_id': cat['id'], 'purchase_unit': pu,
                                    'consumption_unit': cu, 'rate': rate, 'active': True,
                                    'is_sub_recipe': code == 'ITM-GRAVY'})
print('items ok:', list(items))


def upload(kind, rows, headers_len):
    wb = Workbook()
    ws = wb.active
    ws.title = {'subrecipe': 'SubRecipes', 'recipe': 'Recipes', 'sales': 'Sales'}[kind]
    ws.append(['h'] * headers_len)
    for r in rows:
        ws.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    r = S.post(f'{BASE}/bulk/{kind}/validate', headers=H,
               files={'file': (f'{kind}.xlsx', buf.getvalue(),
                               'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')})
    if r.status_code >= 400:
        raise SystemExit(f'validate {kind} -> {r.status_code} {r.text[:300]}')
    return r.json()


# --- templates download
for kind in ('subrecipe', 'recipe', 'sales'):
    r = S.get(f'{BASE}/bulk/template/{kind}', headers=H)
    assert r.status_code == 200 and len(r.content) > 3000, (kind, r.status_code, len(r.content))
print('templates OK')

# --- valid sub-recipe
sub_rows = [
    ['SR-GRAVY', 'Gravy Base', '', 'ITM-GRAVY', 10, 'KG', 'ITM-ONION', 6, 'KG'],
    ['SR-GRAVY', 'Gravy Base', '', 'ITM-GRAVY', 10, 'KG', 'ITM-OIL', 500, 'ML'],
    ['SR-BAD', 'Bad Sub', '', 'NOPE', 0, 'XX', 'NOPE2', -1, 'YY'],
]
res = upload('subrecipe', sub_rows, 9)
print('subrecipe validate:', res['total_rows'], 'valid groups', res['valid_groups'], 'failed', res['failed_groups'])
assert res['valid_groups'] == 1 and res['failed_groups'] == 1
imp = S.post(f'{BASE}/bulk/subrecipe/import', json={'groups': res['groups']}, headers=H).json()
print('subrecipe import:', imp['imported_groups'], imp['failed_groups'], imp.get('imported'))

# duplicate re-upload should be blocked
res2 = upload('subrecipe', sub_rows[:2], 9)
assert res2['valid_groups'] == 0, res2['errors']
print('duplicate sub-recipe blocked OK')

# --- recipe
rec_rows = [
    ['RCP-BC', 'Butter Chicken', 'TB1', 'Main', '250 GM', 'Portion', 380, '2026-01-01', 'SUBRECIPE', 'SR-GRAVY', 200, 'GM'],
    ['RCP-BC', 'Butter Chicken', 'TB1', 'Main', '250 GM', 'Portion', 380, '2026-01-01', 'ITEM', 'ITM-CHICKEN', 180, 'GM'],
    ['RCP-X', 'Bad Recipe', 'NOBRAND', '', '', '', '', '', 'WRONG', 'ITM-CHICKEN', 0, 'GM'],
]
res = upload('recipe', rec_rows, 12)
print('recipe validate: valid', res['valid_groups'], 'failed', res['failed_groups'])
assert res['valid_groups'] == 1 and res['failed_groups'] == 1
imp = S.post(f'{BASE}/bulk/recipe/import', json={'groups': res['groups']}, headers=H).json()
print('recipe import:', imp['imported_groups'], imp['failed_groups'])

# --- sales
kitchen_code = next(l['code'] for l in locs if l['type'] == 'normal_kitchen')
sales_rows = [
    ['2026-06-01', 'TB1', kitchen_code, 'RCP-BC', 10, 1, 0],
    ['2026-06-02', 'TB1', kitchen_code, 'RCP-BC', 5, 0, 0],
    ['2026-06-02', 'TB1', 'BADK', 'RCP-BC', 5, 0, 0],
    ['', 'TB1', kitchen_code, 'RCP-BC', -3, 9, 0],
]
res = upload('sales', sales_rows, 7)
print('sales validate: groups', res['total_groups'], 'valid', res['valid_groups'], 'failed', res['failed_groups'])
assert res['valid_groups'] == 2
imp = S.post(f'{BASE}/bulk/sales/import', json={'groups': res['groups']}, headers=H).json()
print('sales import:', imp['imported_groups'], imp['failed_groups'], [i['ref'] for i in imp['imported']])

# duplicate sales upload blocked
res2 = upload('sales', sales_rows[:1], 7)
assert res2['valid_groups'] == 0, res2['errors']
print('duplicate sales blocked OK:', res2['errors'][0]['reason'][:80])

# --- item search
print('search onion:', [i['code'] for i in get('/items/search?q=onion')])
print('search by code:', [i['code'] for i in get('/items/search?q=ITM-CHI')])
print('search no result:', get('/items/search?q=zzzznothing'))

# --- intent to normal kitchen (parent = main store)
nk = next(l for l in locs if l['type'] == 'normal_kitchen')
store = next(l for l in locs if l['type'] == 'store')
intent = post('/kitchen/intents', {'kitchen_id': nk['id'], 'issue_type': 'normal_kitchen', 'brand_id': brand['id'],
                                   'items': [{'item_id': items['ITM-ONION']['id'], 'qty': 2, 'unit': 'KG'}]})
print('intent created:', intent['intent_no'], 'source', intent['source_location_name'])
assert intent['source_location_name'] == store['name']
listed = [i for i in get('/kitchen/intents') if i['id'] == intent['id']][0]
print('availability row:', listed['items'][0])

# receive stock into store so issue can happen
sup = ensure('/suppliers', {'name': 'Test Supplier', 'active': True}, key='name')
rc = post('/procurement/receipts', {'supplier_id': sup['id'], 'invoice_number': 'INV-T1',
                                    'invoice_date': '2026-06-01', 'receipt_date': '2026-06-01',
                                    'attachment': 'data:image/png;base64,iVBORw0KGgo=', 'attachment_name': 'inv.png',
                                    'items': [{'item_id': items['ITM-ONION']['id'], 'ordered_qty': 10,
                                               'received_qty': 10, 'unit': 'KG', 'rate': 40, 'tax': 0}]})
post(f"/procurement/receipts/{rc['id']}/approve", {'action': 'approve', 'items': [{'index': 0, 'approved_qty': 10}]})
issue = post(f"/kitchen/intents/{intent['id']}/issue", {'items': [{'index': 0, 'qty': 2}]})
print('issued:', issue['issue_no'], 'from', issue['from_location_id'] == store['id'])

# --- admin deletes
sales = get('/sales')
draft = next((s for s in sales if s['status'] == 'draft'), None)
if draft:
    r = S.delete(f"{BASE}/admin/records/sales/{draft['id']}", headers=H)
    print('delete draft sale:', r.status_code, r.json().get('message'))
recs = get('/admin/records/intents')
print('admin intents listing:', len(recs))
r = S.delete(f"{BASE}/admin/records/intents/{intent['id']}", headers=H)
print('delete issued intent (should archive):', r.json())

print('\nALL BACKEND CHECKS PASSED')
