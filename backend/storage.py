"""File storage for uploads (invoice attachments, photos, ...).

Two interchangeable backends behind the same async API:

* local  - files are written under ``UPLOAD_DIR`` (default: ``backend/uploads``).
           This is used whenever ``EMERGENT_LLM_KEY`` is not set, so the app has no
           dependency on a third-party service.
* remote - the legacy hosted object store, used only when ``EMERGENT_LLM_KEY`` is set
           (kept so existing deployments keep working unchanged).

Set ``STORAGE_BACKEND=local`` or ``STORAGE_BACKEND=remote`` to force one.
"""
import mimetypes
import os
from pathlib import Path

import requests
from fastapi.concurrency import run_in_threadpool

APP_NAME = 'skope-kitchen'

EMERGENT_KEY = os.environ.get('EMERGENT_LLM_KEY')
_forced = (os.environ.get('STORAGE_BACKEND') or '').strip().lower()
BACKEND = _forced if _forced in ('local', 'remote') else ('remote' if EMERGENT_KEY else 'local')

# ---------------------------------------------------------------- local backend
UPLOAD_DIR = Path(os.environ.get('UPLOAD_DIR') or Path(__file__).parent / 'uploads').resolve()


def _local_path(path: str) -> Path:
    target = (UPLOAD_DIR / path).resolve()
    if UPLOAD_DIR != target and UPLOAD_DIR not in target.parents:
        raise ValueError('Invalid storage path')
    return target


def _local_put(path: str, data: bytes, content_type: str) -> dict:
    target = _local_path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return {'path': path, 'size': len(data), 'content_type': content_type}


def _local_get(path: str):
    target = _local_path(path)
    if not target.is_file():
        raise FileNotFoundError(path)
    content_type = mimetypes.guess_type(path)[0] or 'application/octet-stream'
    return target.read_bytes(), content_type


# --------------------------------------------------------------- remote backend
STORAGE_BASE = (os.environ.get('INTEGRATION_PROXY_URL') or '').strip() or 'https://integrations.emergentagent.com'
STORAGE_URL = STORAGE_BASE.rstrip('/') + '/objstore/api/v1/storage'

_storage_key = None


def _init(force: bool = False):
    global _storage_key
    if BACKEND == 'local':
        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        return None
    if _storage_key and not force:
        return _storage_key
    resp = requests.post(f'{STORAGE_URL}/init', json={'emergent_key': EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()['storage_key']
    return _storage_key


def _put(path: str, data: bytes, content_type: str) -> dict:
    if BACKEND == 'local':
        return _local_put(path, data, content_type)
    key = _init()
    url = f'{STORAGE_URL}/objects/{path}'
    resp = requests.put(url, headers={'X-Storage-Key': key, 'Content-Type': content_type}, data=data, timeout=120)
    if resp.status_code == 404:
        key = _init(force=True)
        resp = requests.put(url, headers={'X-Storage-Key': key, 'Content-Type': content_type}, data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()


def _get(path: str):
    if BACKEND == 'local':
        return _local_get(path)
    key = _init()
    url = f'{STORAGE_URL}/objects/{path}'
    resp = requests.get(url, headers={'X-Storage-Key': key}, timeout=60)
    if resp.status_code == 404:
        key = _init(force=True)
        resp = requests.get(url, headers={'X-Storage-Key': key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get('Content-Type', 'application/octet-stream')


async def init_storage():
    return await run_in_threadpool(_init)


async def put_object(path: str, data: bytes, content_type: str) -> dict:
    return await run_in_threadpool(_put, path, data, content_type)


async def get_object(path: str):
    return await run_in_threadpool(_get, path)
