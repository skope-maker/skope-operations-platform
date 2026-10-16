import uuid
import jwt
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Header, Query
from fastapi.responses import Response

from db import db, uid, now_iso
from auth import get_current_user, jwt_secret, JWT_ALGORITHM
from storage import put_object, get_object, APP_NAME

router = APIRouter(prefix='/files', tags=['files'])

MIME_TYPES = {
    'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'gif': 'image/gif',
    'webp': 'image/webp', 'pdf': 'application/pdf', 'csv': 'text/csv', 'txt': 'text/plain',
}
MAX_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post('/upload')
async def upload_file(file: UploadFile = File(...), user=Depends(get_current_user)):
    data = await file.read()
    if not data:
        raise HTTPException(400, 'Uploaded file is empty')
    if len(data) > MAX_SIZE:
        raise HTTPException(400, 'File exceeds the 10MB limit')
    ext = file.filename.rsplit('.', 1)[-1].lower() if file.filename and '.' in file.filename else 'bin'
    content_type = file.content_type or MIME_TYPES.get(ext, 'application/octet-stream')
    path = f"{APP_NAME}/uploads/{user['id']}/{uuid.uuid4()}.{ext}"
    try:
        result = await put_object(path, data, content_type)
    except Exception as e:
        raise HTTPException(502, f'Storage upload failed: {e}')
    fid = uid()
    await db.files.insert_one({
        'id': fid, 'storage_path': result['path'], 'original_filename': file.filename or f'file.{ext}',
        'content_type': content_type, 'size': result.get('size', len(data)),
        'is_deleted': False, 'uploaded_by': user['id'], 'created_at': now_iso(),
    })
    return {'id': fid, 'path': result['path'], 'name': file.filename or f'file.{ext}',
            'content_type': content_type, 'size': result.get('size', len(data))}


async def _authorize(authorization: str, auth_q: str):
    token = authorization[7:] if authorization and authorization.startswith('Bearer ') else (auth_q or None)
    if not token:
        raise HTTPException(401, 'Not authenticated')
    try:
        payload = jwt.decode(token, jwt_secret(), algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(401, 'Invalid token')
    u = await db.users.find_one({'id': payload['sub']}, {'_id': 0})
    if not u or not u.get('active', True):
        raise HTTPException(401, 'User not found or inactive')
    return u


@router.get('/{path:path}')
async def download_file(path: str, authorization: str = Header(None), auth: str = Query(None)):
    await _authorize(authorization, auth)
    record = await db.files.find_one({'storage_path': path, 'is_deleted': False}, {'_id': 0})
    if not record:
        raise HTTPException(404, 'File not found')
    try:
        data, content_type = await get_object(path)
    except Exception:
        raise HTTPException(404, 'File not found in storage')
    return Response(content=data, media_type=record.get('content_type') or content_type,
                    headers={'Content-Disposition': f'inline; filename="{record.get("original_filename", "file")}"'})
