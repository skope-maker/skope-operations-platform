"""Focused tests for invoice attachment visibility fix (iteration 3)."""
import os

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")


@pytest.fixture(scope="module")
def proc_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": "procurement@kitchen.com", "password": "demo123"})
    if r.status_code != 200:
        pytest.fail(f"procurement login failed {r.status_code}: {r.text[:300]}")
    token = r.json().get("token")
    assert token
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def keeper_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": "keeper@kitchen.com", "password": "demo123"})
    if r.status_code != 200:
        pytest.fail(f"keeper login failed {r.status_code}: {r.text[:300]}")
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s


@pytest.fixture(scope="module")
def receipts(proc_client):
    r = proc_client.get(f"{BASE_URL}/api/procurement/receipts")
    assert r.status_code == 200, r.text[:300]
    return r.json()


# --- list endpoint must exclude heavy attachment payload ---
def test_list_receipts_excludes_attachment(receipts):
    assert isinstance(receipts, list) and len(receipts) > 0
    for doc in receipts:
        assert "attachment" not in doc, f"list leaks attachment for {doc.get('receipt_no')}"
        assert "_id" not in doc


# --- detail endpoint must return full attachment data url ---
@pytest.mark.parametrize("receipt_no", ["PRC-00014", "PRC-00013"])
def test_detail_returns_attachment(proc_client, receipts, receipt_no):
    match = [d for d in receipts if d.get("receipt_no") == receipt_no]
    if not match:
        pytest.skip(f"{receipt_no} not present")
    rid = match[0]["id"]
    r = proc_client.get(f"{BASE_URL}/api/procurement/receipts/{rid}")
    assert r.status_code == 200, r.text[:300]
    doc = r.json()
    assert "_id" not in doc
    att = doc.get("attachment", "")
    assert att.startswith("data:image"), f"{receipt_no} attachment prefix: {att[:40]!r}"
    assert len(att) > 10000, f"{receipt_no} attachment too small: {len(att)}"
    assert doc.get("attachment_name")


def test_detail_404_for_unknown(proc_client):
    r = proc_client.get(f"{BASE_URL}/api/procurement/receipts/does-not-exist")
    assert r.status_code == 404


# --- mandatory attachment validation on create ---
def test_create_receipt_without_attachment_rejected(keeper_client, receipts):
    proc_client = keeper_client
    src = receipts[0]
    payload = {
        "supplier_id": src["supplier_id"],
        "store_location_id": src.get("store_location_id", ""),
        "invoice_number": "TEST_NOATT_001",
        "invoice_date": src["invoice_date"],
        "receipt_date": src["receipt_date"],
        "remarks": "TEST_ no attachment",
        "attachment": "",
        "attachment_name": "",
        "items": src["items"],
    }
    r = proc_client.post(f"{BASE_URL}/api/procurement/receipts", json=payload)
    assert r.status_code in (400, 422), f"expected rejection, got {r.status_code}: {r.text[:300]}"
