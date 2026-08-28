import os
from db import db, uid, now_iso
from auth import hash_password, verify_password


async def seed():
    await db.users.create_index('email', unique=True)
    await db.inventory_transactions.create_index([('item_id', 1), ('date', 1)])
    await db.inventory_transactions.create_index([('from_location_id', 1)])
    await db.inventory_transactions.create_index([('to_location_id', 1)])
    await db.daily_sales.create_index([('date', 1), ('brand_id', 1)])

    if not await db.settings.find_one({'id': 'global'}):
        await db.settings.insert_one({'id': 'global', 'company_name': 'Chennai Kitchen Co.', 'variance_tolerance_pct': 2})

    admin_email = os.environ.get('ADMIN_EMAIL', 'admin@example.com').lower()
    admin_password = os.environ.get('ADMIN_PASSWORD', 'admin123')
    existing = await db.users.find_one({'email': admin_email})
    if not existing:
        await db.users.insert_one({'id': uid(), 'name': 'Admin', 'email': admin_email,
                                   'password_hash': hash_password(admin_password), 'role': 'admin',
                                   'active': True, 'created_at': now_iso()})
    elif not verify_password(admin_password, existing['password_hash']):
        await db.users.update_one({'email': admin_email}, {'$set': {'password_hash': hash_password(admin_password)}})

    demo_users = [
        ('procurement@kitchen.com', 'Priya Procurement', 'procurement_manager'),
        ('keeper@kitchen.com', 'Kiran StoreKeeper', 'store_keeper'),
        ('manager@kitchen.com', 'Manoj StoreManager', 'store_manager'),
        ('chef@kitchen.com', 'Chef Chandru', 'chef'),
        ('management@kitchen.com', 'Meena Management', 'management'),
    ]
    for email, name, role in demo_users:
        if not await db.users.find_one({'email': email}):
            await db.users.insert_one({'id': uid(), 'name': name, 'email': email,
                                       'password_hash': hash_password('demo123'), 'role': role,
                                       'active': True, 'created_at': now_iso()})

    if await db.units.count_documents({}) == 0:
        for name, code, family, factor in [
            ('Kilogram', 'KG', 'weight', 1000), ('Gram', 'GM', 'weight', 1),
            ('Litre', 'LTR', 'volume', 1000), ('Millilitre', 'ML', 'volume', 1),
            ('Piece', 'PCS', 'count', 1), ('Packet', 'PKT', 'count', 1),
            ('Box', 'BOX', 'count', 1), ('Bottle', 'BTL', 'count', 1)]:
            await db.units.insert_one({'id': uid(), 'name': name, 'code': code, 'family': family,
                                       'factor': factor, 'created_at': now_iso()})

    if await db.categories.count_documents({}) == 0:
        for name, subs in [('Raw Materials', ['Meat', 'Seafood', 'Vegetables', 'Grains']),
                           ('Dry Store', ['Spices', 'Oils', 'Essentials']),
                           ('Packaging', ['Boxes', 'Containers', 'Cutlery']),
                           ('Prepared', ['Sub-Recipes'])]:
            await db.categories.insert_one({'id': uid(), 'name': name, 'subcategories': subs, 'created_at': now_iso()})

    if await db.kitchens.count_documents({}) == 0:
        for name, code, typ in [('Main Store', 'STORE', 'store'), ('Base Kitchen', 'BASE', 'base_kitchen'),
                                ('Normal Kitchen', 'NK', 'normal_kitchen'), ('R&D Lab', 'RD', 'rd')]:
            await db.kitchens.insert_one({'id': uid(), 'name': name, 'code': code, 'type': typ,
                                          'active': True, 'created_at': now_iso()})

    if await db.brands.count_documents({}) == 0:
        for name, code in [('Brand A', 'BA'), ('Brand B', 'BB'), ('Brand C', 'BC')]:
            await db.brands.insert_one({'id': uid(), 'name': name, 'code': code, 'logo_url': '',
                                        'kitchen_location': 'Normal Kitchen', 'status': 'active',
                                        'description': f'{name} demo brand', 'created_at': now_iso()})

    if await db.suppliers.count_documents({}) == 0:
        await db.suppliers.insert_one({'id': uid(), 'name': 'Fresh Farms Suppliers', 'contact_person': 'Ravi',
                                       'phone': '9876543210', 'email': 'ravi@freshfarms.com',
                                       'address': 'Wholesale Market, Chennai', 'gst_number': '33ABCDE1234F1Z5',
                                       'payment_terms': 'Net 15', 'active': True, 'created_at': now_iso()})

    if await db.items.count_documents({}) == 0:
        cat_raw = await db.categories.find_one({'name': 'Raw Materials'})
        cat_dry = await db.categories.find_one({'name': 'Dry Store'})
        cat_prep = await db.categories.find_one({'name': 'Prepared'})
        supplier = await db.suppliers.find_one({})
        items = [
            {'code': 'RM-001', 'name': 'Raw Chicken', 'category_id': cat_raw['id'], 'category_name': 'Raw Materials',
             'subcategory': 'Meat', 'purchase_unit': 'KG', 'consumption_unit': 'GM', 'rate': 220,
             'min_stock': 10, 'reorder_level': 20, 'batch_tracking': True, 'expiry_tracking': True},
            {'code': 'DS-001', 'name': 'Salt', 'category_id': cat_dry['id'], 'category_name': 'Dry Store',
             'subcategory': 'Essentials', 'purchase_unit': 'KG', 'consumption_unit': 'GM', 'rate': 30,
             'min_stock': 2, 'reorder_level': 5},
            {'code': 'DS-002', 'name': 'Oil', 'category_id': cat_dry['id'], 'category_name': 'Dry Store',
             'subcategory': 'Oils', 'purchase_unit': 'LTR', 'consumption_unit': 'ML', 'rate': 160,
             'min_stock': 5, 'reorder_level': 10},
            {'code': 'PR-001', 'name': 'Marinated Chicken', 'category_id': cat_prep['id'], 'category_name': 'Prepared',
             'subcategory': 'Sub-Recipes', 'purchase_unit': 'KG', 'consumption_unit': 'GM', 'rate': 0,
             'min_stock': 2, 'reorder_level': 5, 'is_sub_recipe': True},
        ]
        for it in items:
            unit_factor = 1000 if it['purchase_unit'] in ('KG', 'LTR') else 1
            cu_factor = 1
            await db.items.insert_one({
                'id': uid(), 'code': it['code'], 'name': it['name'], 'category_id': it['category_id'],
                'category_name': it['category_name'], 'subcategory': it['subcategory'],
                'purchase_unit': it['purchase_unit'], 'consumption_unit': it['consumption_unit'],
                'conversion_factor': 1, 'min_stock': it['min_stock'], 'reorder_level': it['reorder_level'],
                'max_stock': 0, 'min_stock_base': it['min_stock'] * 1000, 'reorder_level_base': it['reorder_level'] * 1000,
                'supplier_id': supplier['id'], 'storage_location': 'Main Store',
                'batch_tracking': it.get('batch_tracking', False), 'expiry_tracking': it.get('expiry_tracking', False),
                'active': True, 'is_sub_recipe': it.get('is_sub_recipe', False),
                'rate': it['rate'], 'rate_per_base': it['rate'] / unit_factor, 'created_at': now_iso()})

    if await db.sub_recipes.count_documents({}) == 0:
        brand_a = await db.brands.find_one({'code': 'BA'})
        chicken = await db.items.find_one({'code': 'RM-001'})
        oil = await db.items.find_one({'code': 'DS-002'})
        salt = await db.items.find_one({'code': 'DS-001'})
        marinated = await db.items.find_one({'code': 'PR-001'})
        batch_cost = 10000 * chicken['rate_per_base'] + 500 * oil['rate_per_base'] + 100 * salt['rate_per_base']
        await db.sub_recipes.insert_one({
            'id': uid(), 'name': 'Marinated Chicken', 'code': 'SUB-001', 'brand_id': brand_a['id'],
            'output_item_id': marinated['id'], 'output_item_name': 'Marinated Chicken',
            'yield_qty': 8, 'yield_unit': 'KG', 'yield_base': 8000, 'yield_pct': 79.21,
            'items': [
                {'item_id': chicken['id'], 'item_name': 'Raw Chicken', 'qty': 10, 'unit': 'KG', 'qty_base': 10000},
                {'item_id': oil['id'], 'item_name': 'Oil', 'qty': 500, 'unit': 'ML', 'qty_base': 500},
                {'item_id': salt['id'], 'item_name': 'Salt', 'qty': 100, 'unit': 'GM', 'qty_base': 100},
            ],
            'batch_cost': round(batch_cost, 4), 'cost_per_base': round(batch_cost / 8000, 6),
            'active': True, 'created_at': now_iso()})

    if await db.recipes.count_documents({}) == 0:
        brand_a = await db.brands.find_one({'code': 'BA'})
        sub = await db.sub_recipes.find_one({'code': 'SUB-001'})
        oil = await db.items.find_one({'code': 'DS-002'})
        salt = await db.items.find_one({'code': 'DS-001'})
        recipe_id = uid()
        await db.recipes.insert_one({
            'id': recipe_id, 'name': 'Tawa Grill Chicken', 'code': 'RCP-001', 'brand_id': brand_a['id'],
            'category': 'Grill', 'portion_size': '1 Plate', 'selling_unit': 'Portion',
            'selling_price': 250, 'current_version': 1, 'active': True, 'created_at': now_iso()})
        await db.recipe_versions.insert_one({
            'id': uid(), 'recipe_id': recipe_id, 'version': 1, 'effective_date': '2000-01-01',
            'items': [
                {'item_id': None, 'sub_recipe_id': sub['id'], 'name': 'Marinated Chicken', 'qty': 250, 'unit': 'GM', 'qty_base': 250},
                {'item_id': oil['id'], 'sub_recipe_id': None, 'name': 'Oil', 'qty': 10, 'unit': 'ML', 'qty_base': 10},
                {'item_id': salt['id'], 'sub_recipe_id': None, 'name': 'Salt', 'qty': 2, 'unit': 'GM', 'qty_base': 2},
            ],
            'notes': 'Initial version', 'created_by': 'system', 'created_at': now_iso()})
