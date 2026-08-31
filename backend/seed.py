import os
from db import db, uid, now_iso
from auth import hash_password, verify_password


async def seed():
    await db.users.create_index('email', unique=True)
    await db.inventory_transactions.create_index([('item_id', 1), ('date', 1)])
    await db.inventory_transactions.create_index([('from_location_id', 1)])
    await db.inventory_transactions.create_index([('to_location_id', 1)])
    await db.daily_sales.create_index([('date', 1), ('brand_id', 1)])

    admin_email = os.environ.get('ADMIN_EMAIL', 'admin@example.com').lower()
    admin_password = os.environ.get('ADMIN_PASSWORD', 'admin123')
    existing = await db.users.find_one({'email': admin_email})
    if not existing:
        await db.users.insert_one({'id': uid(), 'name': 'Admin', 'email': admin_email,
                                   'password_hash': hash_password(admin_password), 'role': 'admin',
                                   'active': True, 'created_at': now_iso()})
    elif not verify_password(admin_password, existing['password_hash']):
        await db.users.update_one({'email': admin_email}, {'$set': {'password_hash': hash_password(admin_password)}})
