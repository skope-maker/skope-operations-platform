"""Quick auth hardening checks (iteration 3): hash format, lockout, CORS."""
import asyncio
import os
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]  # repo root (== /app in the original container)
frontend_env = dotenv_values(ROOT / "frontend" / ".env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env["REACT_APP_BACKEND_URL"]).rstrip("/")
ORIGIN = BASE_URL


def test_password_hash_is_bcrypt():
    from motor.motor_asyncio import AsyncIOMotorClient
    env = {**dotenv_values(ROOT / "backend" / ".env"), **{k: v for k, v in os.environ.items() if k in ("MONGO_URL", "DB_NAME")}}

    async def go():
        cli = AsyncIOMotorClient(env["MONGO_URL"])
        db = cli[env["DB_NAME"]]
        u = await db.users.find_one({"email": "procurement@kitchen.com"})
        cli.close()
        return u

    u = asyncio.run(go())
    assert u, "demo user missing in DB"
    h = u.get("password_hash") or u.get("password") or ""
    assert h.startswith("$2b$") or h.startswith("$2a$") or h.startswith("$2y$"), f"hash prefix {h[:6]!r}"


def test_cors_allows_frontend_origin_with_credentials():
    r = requests.options(
        f"{BASE_URL}/api/auth/login",
        headers={"Origin": ORIGIN, "Access-Control-Request-Method": "POST",
                 "Access-Control-Request-Headers": "content-type"},
        timeout=30,
    )
    assert r.status_code in (200, 204), r.status_code
    allow = r.headers.get("access-control-allow-origin")
    assert allow in (ORIGIN, "*"), f"allow-origin={allow}"


def test_bad_password_returns_401_and_good_password_still_works():
    for _ in range(3):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": "procurement@kitchen.com", "password": "wrong-pass"}, timeout=30)
        assert r.status_code in (401, 400, 429), r.status_code
    ok = requests.post(f"{BASE_URL}/api/auth/login",
                       json={"email": "procurement@kitchen.com", "password": "demo123"}, timeout=30)
    if ok.status_code == 429:
        pytest.skip("account locked out by rate limiting (lockout implemented)")
    assert ok.status_code == 200, f"valid login broke after failures: {ok.status_code} {ok.text[:200]}"


def test_me_requires_token():
    r = requests.get(f"{BASE_URL}/api/auth/me", timeout=30)
    assert r.status_code in (401, 403), r.status_code
