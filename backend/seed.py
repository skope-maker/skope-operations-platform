import os
import logging
from db import db, uid, now_iso
from auth import hash_password, verify_password

# Created on startup only when SEED_DEMO_USERS=true and DEMO_PASSWORD is set (team testing).
DEMO_USERS = [
    ('procurement@kitchen.com', 'Procurement Manager', 'procurement_manager'),
    ('keeper@kitchen.com', 'Store Keeper', 'store_keeper'),
    ('manager@kitchen.com', 'Store Manager', 'store_manager'),
    ('chef@kitchen.com', 'Chef', 'chef'),
    ('management@kitchen.com', 'Management', 'management'),
]

BASE_UNITS = [
    {'name': 'Kilogram', 'code': 'KG', 'family': 'weight', 'factor': 1000},
    {'name': 'Gram', 'code': 'GM', 'family': 'weight', 'factor': 1},
    {'name': 'Litre', 'code': 'LTR', 'family': 'volume', 'factor': 1000},
    {'name': 'Millilitre', 'code': 'ML', 'family': 'volume', 'factor': 1},
    {'name': 'Pieces', 'code': 'PCS', 'family': 'count', 'factor': 1},
    {'name': 'Packet', 'code': 'PKT', 'family': 'count', 'factor': 1},
    {'name': 'Box', 'code': 'BOX', 'family': 'count', 'factor': 1},
    {'name': 'Bottle', 'code': 'BTL', 'family': 'count', 'factor': 1},
]

BASE_LOCATIONS = [
    {'name': 'Main Store', 'code': 'STORE', 'type': 'store'},
    {'name': 'Base Kitchen', 'code': 'BASEK', 'type': 'base_kitchen'},
    {'name': 'Normal Kitchen', 'code': 'NORMK', 'type': 'normal_kitchen'},
    {'name': 'R&D Kitchen', 'code': 'RND', 'type': 'rd'},
]


async def seed():
    await db.users.create_index('email', unique=True)
    await db.inventory_transactions.create_index([('item_id', 1), ('date', 1)])
    await db.inventory_transactions.create_index([('from_location_id', 1)])
    await db.inventory_transactions.create_index([('to_location_id', 1)])
    await db.daily_sales.create_index([('date', 1), ('brand_id', 1)])
    await db.items.create_index([('name', 1)])

    admin_email = os.environ.get('ADMIN_EMAIL', 'admin@example.com').lower()
    admin_password = os.environ.get('ADMIN_PASSWORD', 'admin123')
    existing = await db.users.find_one({'email': admin_email})
    if not existing:
        await db.users.insert_one({'id': uid(), 'name': 'Admin', 'email': admin_email,
                                   'password_hash': hash_password(admin_password), 'role': 'admin',
                                   'active': True, 'created_at': now_iso()})
    elif not verify_password(admin_password, existing['password_hash']):
        await db.users.update_one({'email': admin_email}, {'$set': {'password_hash': hash_password(admin_password)}})

    if os.environ.get('SEED_DEMO_USERS', '').strip().lower() == 'true':
        demo_password = os.environ.get('DEMO_PASSWORD', '')
        if len(demo_password) < 6:
            logging.getLogger(__name__).warning('SEED_DEMO_USERS is true but DEMO_PASSWORD is missing or shorter than 6 characters; demo users not created')
        else:
            for email, name, role in DEMO_USERS:
                if not await db.users.find_one({'email': email}):
                    await db.users.insert_one({'id': uid(), 'name': name, 'email': email,
                                               'password_hash': hash_password(demo_password), 'role': role,
                                               'active': True, 'created_at': now_iso()})

    if await db.units.count_documents({}) == 0:
        await db.units.insert_many([{'id': uid(), **u, 'created_at': now_iso()} for u in BASE_UNITS])

    if await db.kitchens.count_documents({}) == 0:
        store_id = uid()
        docs = []
        for loc in BASE_LOCATIONS:
            docs.append({'id': store_id if loc['type'] == 'store' else uid(), **loc, 'active': True,
                         'parent_id': None if loc['type'] == 'store' else store_id,
                         'created_at': now_iso()})
        await db.kitchens.insert_many(docs)
