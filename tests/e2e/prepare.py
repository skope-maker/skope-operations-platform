"""Create the master data and demo users the browser tests expect. Safe to re-run.

    E2E_API=http://localhost:8011 python tests/e2e/prepare.py

For a live copy set E2E_API to its address plus E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD (the admin login) and
E2E_DEMO_PASSWORD (the password of the five role accounts).
Use a throwaway database (DB_NAME=skope_e2e) for the backend: the business-flow test
asserts exact stock numbers, so it must start from a database without transactions.
"""
import json
import os
import sys
import urllib.error
import urllib.request

API = os.environ.get('E2E_API', 'http://localhost:8001').rstrip('/') + '/api'
ADMIN = (os.environ.get('E2E_ADMIN_EMAIL', 'chennakeshavaediga@gmail.com'), os.environ.get('E2E_ADMIN_PASSWORD', 'admin123'))
DEMO_PASSWORD = os.environ.get('E2E_DEMO_PASSWORD', 'demo123')  # set this when preparing a shared/live copy
DEMO_USERS = [
    ('procurement@kitchen.com', 'procurement_manager'), ('keeper@kitchen.com', 'store_keeper'),
    ('manager@kitchen.com', 'store_manager'), ('chef@kitchen.com', 'chef'), ('management@kitchen.com', 'management'),
]


def call(method, path, body=None, token=None):
    req = urllib.request.Request(
        API + path, method=method, data=json.dumps(body).encode() if body is not None else None,
        headers={'Content-Type': 'application/json', **({'Authorization': f'Bearer {token}'} if token else {})})
    try:
        with urllib.request.urlopen(req) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f'{method} {path} -> {e.code} {e.read()[:300].decode()}')


def ensure(token, path, body, key='code'):
    existing = {d.get(key): d for d in call('GET', path, token=token)}
    return existing.get(body[key]) or call('POST', path, body, token)


token = call('POST', '/auth/login', {'email': ADMIN[0], 'password': ADMIN[1]})['token']

existing_users = {u['email'] for u in call('GET', '/users', token=token)}
for email, role in DEMO_USERS:
    if email not in existing_users:
        call('POST', '/users', {'name': role, 'email': email, 'password': DEMO_PASSWORD, 'role': role}, token)
print('demo users ready:', ', '.join(r for _, r in DEMO_USERS))

brand = ensure(token, '/brands', {'name': 'Test Brand', 'code': 'TB1', 'status': 'active'})
cats = call('GET', '/categories', token=token)
cat = cats[0] if cats else call('POST', '/categories', {'name': 'Groceries', 'subcategories': ['Dry']}, token)
ensure(token, '/suppliers', {'name': 'Test Supplier', 'active': True}, key='name')

items = {}
for code, name, purchase_unit, consumption_unit, rate in [
        ('ITM-ONION', 'Onion', 'KG', 'GM', 40), ('ITM-OIL', 'Oil', 'LTR', 'ML', 120),
        ('ITM-CHICKEN', 'Chicken', 'KG', 'GM', 260), ('ITM-GRAVY', 'Gravy Base', 'KG', 'GM', 0)]:
    items[code] = ensure(token, '/items', {
        'code': code, 'name': name, 'category_id': cat['id'], 'purchase_unit': purchase_unit,
        'consumption_unit': consumption_unit, 'rate': rate, 'active': True, 'is_sub_recipe': code == 'ITM-GRAVY'})

# 6 KG onion + 500 ML oil -> 10 KG gravy base
sub = ensure(token, '/subrecipes', {
    'name': 'Gravy Base', 'code': 'SR-GRAVY', 'output_item_id': items['ITM-GRAVY']['id'], 'yield_qty': 10, 'yield_unit': 'KG',
    'items': [{'item_id': items['ITM-ONION']['id'], 'qty': 6, 'unit': 'KG'}, {'item_id': items['ITM-OIL']['id'], 'qty': 500, 'unit': 'ML'}]})

# one portion = 200 GM gravy base + 180 GM chicken, sold at 380
ensure(token, '/recipes', {
    'name': 'Butter Chicken', 'code': 'RCP-BC', 'brand_id': brand['id'], 'selling_price': 380,
    'items': [{'sub_recipe_id': sub['id'], 'qty': 200, 'unit': 'GM'}, {'item_id': items['ITM-CHICKEN']['id'], 'qty': 180, 'unit': 'GM'}]})
print('master data ready: brand TB1, supplier, 4 items, SR-GRAVY, RCP-BC')
