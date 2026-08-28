import os
import uuid
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReturnDocument

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

ROLES = ['admin', 'procurement_manager', 'store_keeper', 'store_manager', 'chef', 'management']
ROLE_LABELS = {
    'admin': 'Admin',
    'procurement_manager': 'Procurement Manager',
    'store_keeper': 'Store Keeper',
    'store_manager': 'Store Manager',
    'chef': 'Chef / Kitchen Manager',
    'management': 'Management',
}


def uid():
    return str(uuid.uuid4())


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def today_str():
    return datetime.now(timezone.utc).date().isoformat()


def clean(doc):
    if doc is None:
        return None
    d = dict(doc)
    d.pop('_id', None)
    return d


def clean_list(docs):
    return [clean(d) for d in docs]


async def insert(coll, doc):
    d = dict(doc)
    await db[coll].insert_one(d)
    d.pop('_id', None)
    return d


async def next_no(name, prefix):
    r = await db.counters.find_one_and_update(
        {'id': name}, {'$inc': {'seq': 1}}, upsert=True, return_document=ReturnDocument.AFTER
    )
    return f"{prefix}-{r['seq']:05d}"


async def audit(user, action, details='', reference=''):
    await db.audit_logs.insert_one({
        'id': uid(),
        'date': now_iso(),
        'user_id': user.get('id') if user else None,
        'user_name': user.get('name') if user else 'system',
        'user_role': user.get('role') if user else 'system',
        'action': action,
        'details': details,
        'reference': reference,
    })
