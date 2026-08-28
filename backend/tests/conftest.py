import os
import re
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
_base = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not _base:
    raise RuntimeError("REACT_APP_BACKEND_URL is missing")
BASE_URL = _base.rstrip("/")
API = f"{BASE_URL}/api"

CREDS_FILE = Path("/app/memory/test_credentials.md")


def _creds():
    content = CREDS_FILE.read_text(encoding="utf-8") if CREDS_FILE.exists() else ""
    email = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?Email(?:\*\*)?\s*:\s*`?([^`\s]+)', content)
    pwd = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?Password(?:\*\*)?\s*:\s*`?([^`\s]+)', content)
    if not email or not pwd:
        pytest.skip("No admin credentials in test_credentials.md")
    return {"email": email.group(1), "password": pwd.group(1)}


def login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=60)
    return r


def client_for(email, password):
    r = login(email, password)
    if r.status_code != 200:
        pytest.fail(f"Login failed for {email}: {r.status_code} {r.text[:300]}")
    token = r.json().get("token")
    assert token, "no token in login response"
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="session")
def admin_creds():
    return _creds()


@pytest.fixture(scope="session")
def admin(admin_creds):
    return client_for(admin_creds["email"], admin_creds["password"])


@pytest.fixture(scope="session")
def chef():
    return client_for("chef@kitchen.com", "demo123")


@pytest.fixture(scope="session")
def keeper():
    return client_for("keeper@kitchen.com", "demo123")


@pytest.fixture(scope="session")
def procurement():
    return client_for("procurement@kitchen.com", "demo123")


@pytest.fixture(scope="session")
def manager():
    return client_for("manager@kitchen.com", "demo123")


@pytest.fixture(scope="session")
def management():
    return client_for("management@kitchen.com", "demo123")


@pytest.fixture(scope="session")
def masters(admin):
    """Cached masters data used across tests."""
    brands = admin.get(f"{API}/brands", timeout=60).json()
    kitchens = admin.get(f"{API}/kitchens", timeout=60).json()
    items = admin.get(f"{API}/items", timeout=60).json()
    suppliers = admin.get(f"{API}/suppliers", timeout=60).json()
    recipes = admin.get(f"{API}/recipes", timeout=60).json()
    subs = admin.get(f"{API}/subrecipes", timeout=60).json()
    by_type = {}
    for k in kitchens:
        by_type.setdefault(k.get("type"), []).append(k)
    return {
        "brands": brands, "kitchens": kitchens, "items": items,
        "suppliers": suppliers, "recipes": recipes, "subrecipes": subs,
        "kitchens_by_type": by_type,
    }
