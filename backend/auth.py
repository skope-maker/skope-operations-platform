import os
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from db import db, uid, now_iso, insert, clean, clean_list, ROLES, audit

JWT_ALGORITHM = 'HS256'


def jwt_secret():
    return os.environ['JWT_SECRET']


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False


def create_access_token(user) -> str:
    payload = {
        'sub': user['id'],
        'email': user['email'],
        'role': user['role'],
        'exp': datetime.now(timezone.utc) + timedelta(hours=12),
        'type': 'access',
    }
    return jwt.encode(payload, jwt_secret(), algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    token = None
    header = request.headers.get('Authorization', '')
    if header.startswith('Bearer '):
        token = header[7:]
    if not token:
        token = request.cookies.get('access_token')
    if not token:
        raise HTTPException(status_code=401, detail='Not authenticated')
    try:
        payload = jwt.decode(token, jwt_secret(), algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail='Token expired')
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail='Invalid token')
    user = await db.users.find_one({'id': payload['sub']}, {'_id': 0})
    if not user or not user.get('active', True):
        raise HTTPException(status_code=401, detail='User not found or inactive')
    user.pop('password_hash', None)
    return user


def require_roles(*roles):
    async def dep(user=Depends(get_current_user)):
        if user['role'] not in roles:
            raise HTTPException(status_code=403, detail='Insufficient permissions for your role')
        return user
    return dep


router = APIRouter(prefix='/auth', tags=['auth'])


class LoginIn(BaseModel):
    email: str
    password: str


@router.post('/login')
async def login(body: LoginIn, request: Request):
    email = body.email.strip().lower()
    identifier = email
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=15)).isoformat()
    await db.login_attempts.delete_many({'last': {'$lt': cutoff}})
    attempt = await db.login_attempts.find_one({'identifier': identifier})
    if attempt and attempt.get('count', 0) >= 5:
        locked_at = datetime.fromisoformat(attempt['last'])
        if (datetime.now(timezone.utc) - locked_at) < timedelta(minutes=15):
            raise HTTPException(status_code=429, detail='Too many failed attempts. Try again in 15 minutes.')
    user = await db.users.find_one({'email': email})
    if not user or not verify_password(body.password, user.get('password_hash', '')):
        await db.login_attempts.update_one(
            {'identifier': identifier},
            {'$inc': {'count': 1}, '$set': {'last': now_iso()}},
            upsert=True,
        )
        raise HTTPException(status_code=401, detail='Invalid email or password')
    if not user.get('active', True):
        raise HTTPException(status_code=403, detail='Account is deactivated')
    await db.login_attempts.delete_one({'identifier': identifier})
    token = create_access_token(user)
    user = clean(user)
    user.pop('password_hash', None)
    return {'token': token, 'user': user}


@router.get('/me')
async def me(user=Depends(get_current_user)):
    return user


@router.post('/logout')
async def logout(user=Depends(get_current_user)):
    return {'ok': True}


users_router = APIRouter(prefix='/users', tags=['users'])


class UserIn(BaseModel):
    name: str
    email: str
    password: str
    role: str


class UserUpdate(BaseModel):
    name: str | None = None
    role: str | None = None
    active: bool | None = None
    password: str | None = None


@users_router.get('')
async def list_users(user=Depends(require_roles('admin'))):
    users = await db.users.find({'archived': {'$ne': True}}, {'_id': 0, 'password_hash': 0}).to_list(1000)
    return users


@users_router.post('')
async def create_user(body: UserIn, user=Depends(require_roles('admin'))):
    email = body.email.strip().lower()
    if body.role not in ROLES:
        raise HTTPException(400, 'Invalid role')
    if len(body.password) < 6:
        raise HTTPException(400, 'Password must be at least 6 characters')
    if await db.users.find_one({'email': email}):
        raise HTTPException(400, 'Email already exists')
    doc = await insert('users', {
        'id': uid(),
        'name': body.name.strip(),
        'email': email,
        'password_hash': hash_password(body.password),
        'role': body.role,
        'active': True,
        'created_at': now_iso(),
    })
    doc.pop('password_hash', None)
    await audit(user, 'Created user', f"{doc['name']} ({doc['email']}) role={doc['role']}", doc['id'])
    return doc


@users_router.put('/{user_id}')
async def update_user(user_id: str, body: UserUpdate, user=Depends(require_roles('admin'))):
    target = await db.users.find_one({'id': user_id})
    if not target:
        raise HTTPException(404, 'User not found')
    updates = {}
    if body.name is not None:
        updates['name'] = body.name.strip()
    if body.role is not None:
        if body.role not in ROLES:
            raise HTTPException(400, 'Invalid role')
        updates['role'] = body.role
    if body.active is not None:
        updates['active'] = body.active
    if body.password:
        if len(body.password) < 6:
            raise HTTPException(400, 'Password must be at least 6 characters')
        updates['password_hash'] = hash_password(body.password)
    if updates:
        await db.users.update_one({'id': user_id}, {'$set': updates})
        await audit(user, 'Updated user', f"{target['email']}: {list(updates.keys())}", user_id)
    updated = await db.users.find_one({'id': user_id}, {'_id': 0, 'password_hash': 0})
    return updated
