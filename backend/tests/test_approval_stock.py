"""Verify approval of a receipt posts stock into the store location (iteration 3)."""
import os
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values(Path(__file__).resolve().parents[2] / "frontend" / ".env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env["REACT_APP_BACKEND_URL"]).rstrip("/")


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": "procurement@kitchen.com", "password": "demo123"})
    if r.status_code != 200:
        pytest.fail(f"login failed: {r.status_code} {r.text[:200]}")
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s


def test_qa_receipt_approved_and_ledger_posted(client):
    r = client.get(f"{BASE_URL}/api/procurement/receipts")
    assert r.status_code == 200
    docs = [d for d in r.json() if d.get("invoice_number") == "TEST_QA_IMG_001"]
    if not docs:
        pytest.skip("QA receipt TEST_QA_IMG_001 not present")
    rec = docs[0]
    assert rec["status"] == "approved", f"status={rec['status']}"
    assert rec.get("approved_by")

    led = client.get(f"{BASE_URL}/api/inventory/ledger", params={"location_id": rec["store_location_id"]})
    assert led.status_code == 200, led.text[:200]
    rows = [x for x in led.json() if x.get("reference_no") == rec["receipt_no"]]
    assert rows, f"no ledger txn for {rec['receipt_no']}"
    assert any(x.get("txn_type") == "purchase_receipt" for x in rows)
    assert sum(float(x.get("qty", 0)) for x in rows) > 0

    stock = client.get(f"{BASE_URL}/api/inventory/stock", params={"location_id": rec["store_location_id"]})
    assert stock.status_code == 200
    item_ids = {rec["items"][0]["item_id"]}
    assert any(s.get("item_id") in item_ids for s in stock.json()), "approved item missing from store stock"
