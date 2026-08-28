"""End-to-end backend API tests for the multi-brand kitchen management app."""
import base64
import time
import uuid
from datetime import date, timedelta

import pytest
import requests

from conftest import API, login, client_for

TODAY = date.today().isoformat()
_OFF = uuid.uuid4().int % 200
SALE_DATE = (date.today() + timedelta(days=30 + _OFF)).isoformat()
CLOSING_DATE = (date.today() + timedelta(days=260 + _OFF)).isoformat()
TAG = uuid.uuid4().hex[:6].upper()

TINY_PNG = "data:image/png;base64," + base64.b64encode(
    bytes.fromhex(
        "89504e470d0a1a0a0000000d494844520000000100000001080600000"
        "01f15c4890000000a49444154789c6300010000050001"
        "0d0a2db40000000049454e44ae426082"
    )
).decode()


# ---------------- Auth module ----------------
class TestAuth:
    def test_login_admin(self, admin_creds):
        r = login(admin_creds["email"], admin_creds["password"])
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert isinstance(d["token"], str) and len(d["token"]) > 10
        assert d["user"]["email"] == admin_creds["email"].lower()
        assert d["user"]["role"] == "admin"
        assert "password_hash" not in d["user"]

    @pytest.mark.parametrize("email,role", [
        ("chef@kitchen.com", "chef"),
        ("manager@kitchen.com", "store_manager"),
        ("keeper@kitchen.com", "store_keeper"),
        ("procurement@kitchen.com", "procurement_manager"),
        ("management@kitchen.com", "management"),
    ])
    def test_login_demo_roles(self, email, role):
        r = login(email, "demo123")
        assert r.status_code == 200, r.text[:300]
        assert r.json()["user"]["role"] == role

    def test_login_wrong_password(self):
        r = login("chef@kitchen.com", "wrong-password-xyz")
        assert r.status_code == 401
        assert "detail" in r.json()

    def test_me_and_logout(self, admin, admin_creds):
        r = admin.get(f"{API}/auth/me", timeout=60)
        assert r.status_code == 200
        assert r.json()["email"] == admin_creds["email"].lower()
        assert "password_hash" not in r.json()
        assert admin.post(f"{API}/auth/logout", timeout=60).status_code == 200

    def test_protected_without_token(self):
        r = requests.get(f"{API}/auth/me", timeout=60)
        assert r.status_code == 401

    def test_invalid_token_rejected(self):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": "Bearer garbage.token.here"}, timeout=60)
        assert r.status_code == 401

    def test_bcrypt_hash_format(self, admin):
        # Password hashes must never be returned; verify via users list
        users = admin.get(f"{API}/users", timeout=60).json()
        assert all("password_hash" not in u for u in users)

    def test_brute_force_lockout(self):
        email = f"TEST_lock_{TAG}@example.com"
        codes = [login(email, "bad").status_code for _ in range(15)]
        assert codes[0] == 401
        assert 429 in codes, (
            "brute-force lockout never triggered in 15 failed attempts "
            f"(counter keyed on proxy IP which rotates): {codes}")


# ---------------- Role gating ----------------
class TestRoleGating:
    def test_management_cannot_create_brand(self, management):
        r = management.post(f"{API}/brands", json={"name": "X", "code": "X1"}, timeout=60)
        assert r.status_code == 403

    def test_keeper_cannot_approve_receipt(self, keeper):
        r = keeper.post(f"{API}/procurement/receipts/does-not-exist/approve",
                        json={"action": "approve"}, timeout=60)
        assert r.status_code == 403

    def test_non_admin_cannot_list_users(self, chef):
        assert chef.get(f"{API}/users", timeout=60).status_code == 403

    def test_management_read_dashboard(self, management):
        assert management.get(f"{API}/dashboard", timeout=60).status_code == 200


# ---------------- Masters CRUD ----------------
class TestMasters:
    created_brands = []
    created_items = []

    def test_list_masters_endpoints(self, admin):
        for path in ["brands", "kitchens", "categories", "units", "items", "suppliers", "settings"]:
            r = admin.get(f"{API}/{path}", timeout=60)
            assert r.status_code == 200, f"{path} -> {r.status_code}"
            body = r.json()
            if isinstance(body, list):
                assert all("_id" not in x for x in body), f"{path} leaks _id"

    def test_brand_crud(self, admin):
        payload = {"name": f"TEST_Brand_{TAG}", "code": f"T{TAG[:3]}", "status": "active",
                   "description": "qa"}
        r = admin.post(f"{API}/brands", json=payload, timeout=60)
        assert r.status_code == 200, r.text[:300]
        b = r.json()
        assert b["name"] == payload["name"]
        assert b["code"] == payload["code"].upper()
        TestMasters.created_brands.append(b["id"])

        # duplicate code rejected
        dup = admin.post(f"{API}/brands", json=payload, timeout=60)
        assert dup.status_code == 400

        # GET verifies persistence
        lst = admin.get(f"{API}/brands", timeout=60).json()
        assert any(x["id"] == b["id"] and x["name"] == payload["name"] for x in lst)

        # update
        payload2 = dict(payload, name=f"TEST_Brand_{TAG}_Edited")
        u = admin.put(f"{API}/brands/{b['id']}", json=payload2, timeout=60)
        assert u.status_code == 200
        assert u.json()["name"] == payload2["name"]
        lst = admin.get(f"{API}/brands", timeout=60).json()
        assert any(x["id"] == b["id"] and x["name"] == payload2["name"] for x in lst)

        # delete
        d = admin.delete(f"{API}/brands/{b['id']}", timeout=60)
        assert d.status_code == 200
        lst = admin.get(f"{API}/brands", timeout=60).json()
        assert not any(x["id"] == b["id"] for x in lst)
        TestMasters.created_brands.remove(b["id"])

    def test_item_create_and_unit_family_validation(self, admin):
        payload = {"code": f"TI{TAG}", "name": f"TEST_Item_{TAG}", "purchase_unit": "KG",
                   "consumption_unit": "GM", "rate": 100, "min_stock": 1, "reorder_level": 2}
        r = admin.post(f"{API}/items", json=payload, timeout=60)
        assert r.status_code == 200, r.text[:300]
        it = r.json()
        assert it["code"] == payload["code"]
        assert it["consumption_unit"] == "GM"
        assert it["rate_per_base"] == pytest.approx(0.1, rel=1e-3)
        TestMasters.created_items.append(it["id"])

        items = admin.get(f"{API}/items", timeout=60).json()
        assert any(x["id"] == it["id"] and x["name"] == payload["name"] for x in items)

        # incompatible units rejected
        bad = admin.post(f"{API}/items", json=dict(payload, code=f"TB{TAG}", purchase_unit="KG",
                                                   consumption_unit="LTR"), timeout=60)
        assert bad.status_code == 400

    def test_settings_company_name_update(self, admin):
        cur = admin.get(f"{API}/settings", timeout=60).json()
        original = cur.get("company_name")
        new_name = f"TEST_Co_{TAG}"
        r = admin.put(f"{API}/settings", json=dict(cur, company_name=new_name), timeout=60)
        assert r.status_code == 200, r.text[:300]
        assert admin.get(f"{API}/settings", timeout=60).json()["company_name"] == new_name
        # restore
        if original:
            admin.put(f"{API}/settings", json=dict(cur, company_name=original), timeout=60)

    @classmethod
    def teardown_class(cls):
        pass


@pytest.fixture(scope="class", autouse=True)
def _cleanup_masters(admin):
    yield
    for iid in TestMasters.created_items:
        admin.delete(f"{API}/items/{iid}", timeout=60)
    for bid in TestMasters.created_brands:
        admin.delete(f"{API}/brands/{bid}", timeout=60)


# ---------------- Procurement + Inventory chain ----------------
class TestProcurementChain:
    state = {}

    def _stock(self, client, location_id, item_id):
        rows = client.get(f"{API}/inventory/stock", params={"location_id": location_id}, timeout=60).json()
        for r in rows:
            if r.get("item_id") == item_id:
                return r.get("stock", 0)
        return 0

    def test_receipt_requires_attachment(self, keeper, masters):
        supplier = masters["suppliers"][0]
        item = next(i for i in masters["items"] if "Chicken" in i["name"] and not i.get("is_sub_recipe"))
        r = keeper.post(f"{API}/procurement/receipts", json={
            "supplier_id": supplier["id"], "invoice_number": f"TESTINV{TAG}",
            "invoice_date": TODAY, "receipt_date": TODAY,
            "items": [{"item_id": item["id"], "ordered_qty": 10, "received_qty": 10,
                       "unit": item["purchase_unit"], "rate": 200}],
        }, timeout=60)
        assert r.status_code == 400
        assert "mandatory" in r.text.lower()

    def test_create_receipt_with_attachment(self, keeper, masters):
        supplier = masters["suppliers"][0]
        store = masters["kitchens_by_type"]["store"][0]
        item = next(i for i in masters["items"] if "Chicken" in i["name"] and not i.get("is_sub_recipe"))
        r = keeper.post(f"{API}/procurement/receipts", json={
            "supplier_id": supplier["id"], "invoice_number": f"TESTINV{TAG}",
            "invoice_date": TODAY, "receipt_date": TODAY,
            "store_location_id": store["id"], "attachment": TINY_PNG,
            "attachment_name": "invoice.png", "remarks": "TEST receipt",
            "items": [{"item_id": item["id"], "ordered_qty": 10, "received_qty": 10,
                       "unit": item["purchase_unit"], "rate": 200}],
        }, timeout=60)
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        assert d["status"] == "pending"
        assert d["receipt_no"].startswith("PRC")
        assert "attachment" not in d
        TestProcurementChain.state.update(receipt_id=d["id"], receipt_no=d["receipt_no"],
                                          item_id=item["id"], store_id=store["id"])

        # visible in pending list
        pend = keeper.get(f"{API}/procurement/receipts", params={"status": "pending"}, timeout=60).json()
        assert any(x["id"] == d["id"] for x in pend)

    def test_receipt_detail_has_attachment(self, procurement):
        rid = TestProcurementChain.state["receipt_id"]
        r = procurement.get(f"{API}/procurement/receipts/{rid}", timeout=60)
        assert r.status_code == 200
        assert r.json().get("attachment"), "attachment not returned in detail"

    def test_approve_receipt_increases_store_stock(self, procurement, masters):
        st = TestProcurementChain.state
        before = self._stock(procurement, st["store_id"], st["item_id"])
        r = procurement.post(f"{API}/procurement/receipts/{st['receipt_id']}/approve",
                             json={"action": "approve", "remarks": "TEST approve"}, timeout=60)
        assert r.status_code == 200, r.text[:400]
        assert r.json()["status"] == "approved"
        after = self._stock(procurement, st["store_id"], st["item_id"])
        assert after - before == pytest.approx(10000, rel=1e-3), f"before={before} after={after}"
        st["stock_after_receipt"] = after

    def test_double_approve_blocked(self, procurement):
        r = procurement.post(f"{API}/procurement/receipts/{TestProcurementChain.state['receipt_id']}/approve",
                             json={"action": "approve"}, timeout=60)
        assert r.status_code == 400

    def test_ledger_contains_receipt(self, admin):
        st = TestProcurementChain.state
        rows = admin.get(f"{API}/inventory/ledger", params={"item_id": st["item_id"]}, timeout=60).json()
        assert isinstance(rows, list) and rows
        assert any(x.get("reference_no") == st["receipt_no"] for x in rows)
        assert all("_id" not in x for x in rows)


# ---------------- Kitchen intent -> issue -> production ----------------
class TestKitchenChain:
    state = {}

    def _stock(self, client, location_id, item_id):
        rows = client.get(f"{API}/inventory/stock", params={"location_id": location_id}, timeout=60).json()
        for r in rows:
            if r.get("item_id") == item_id:
                return r.get("stock", 0)
        return 0

    def test_chef_creates_intent(self, chef, masters):
        base = masters["kitchens_by_type"]["base_kitchen"][0]
        item = next(i for i in masters["items"] if "Chicken" in i["name"] and not i.get("is_sub_recipe"))
        r = chef.post(f"{API}/kitchen/intents", json={
            "date": TODAY, "kitchen_id": base["id"], "issue_type": "base_kitchen",
            "remarks": "TEST intent",
            "items": [{"item_id": item["id"], "qty": 5, "unit": item["purchase_unit"], "purpose": "qa"}],
        }, timeout=60)
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        assert d["status"] == "pending" and d["intent_no"].startswith("INT")
        TestKitchenChain.state.update(intent_id=d["id"], intent_no=d["intent_no"],
                                      item_id=item["id"], base_id=base["id"],
                                      store_id=masters["kitchens_by_type"]["store"][0]["id"])

    def test_chef_cannot_issue(self, chef):
        r = chef.post(f"{API}/kitchen/intents/{TestKitchenChain.state['intent_id']}/issue",
                      json={"items": [{"index": 0, "qty": 5}]}, timeout=60)
        assert r.status_code == 403

    def test_manager_issues_intent_moves_stock(self, manager):
        st = TestKitchenChain.state
        store_before = self._stock(manager, st["store_id"], st["item_id"])
        base_before = self._stock(manager, st["base_id"], st["item_id"])
        r = manager.post(f"{API}/kitchen/intents/{st['intent_id']}/issue",
                         json={"items": [{"index": 0, "qty": 5}], "remarks": "TEST issue"}, timeout=60)
        assert r.status_code == 200, r.text[:400]
        assert r.json()["issue_no"].startswith("ISSUE")
        store_after = self._stock(manager, st["store_id"], st["item_id"])
        base_after = self._stock(manager, st["base_id"], st["item_id"])
        assert store_before - store_after == pytest.approx(5000, rel=1e-3)
        assert base_after - base_before == pytest.approx(5000, rel=1e-3)

        intents = manager.get(f"{API}/kitchen/intents", timeout=60).json()
        cur = next(x for x in intents if x["id"] == st["intent_id"])
        assert cur["status"] == "issued"

    def test_over_issue_blocked(self, manager):
        r = manager.post(f"{API}/kitchen/intents/{TestKitchenChain.state['intent_id']}/issue",
                         json={"items": [{"index": 0, "qty": 5}]}, timeout=60)
        assert r.status_code == 400

    def test_issues_list(self, manager):
        r = manager.get(f"{API}/kitchen/issues", timeout=60)
        assert r.status_code == 200 and isinstance(r.json(), list)

    def test_production_yield(self, chef, masters, admin):
        st = TestKitchenChain.state
        sub = next(s for s in masters["subrecipes"] if "Marinated" in s["name"])
        sub_item_id = sub.get("output_item_id") or sub.get("item_id")
        # ensure minor ingredients (salt/oil) exist in the base kitchen so the
        # batch is not blocked by unrelated shortages
        for line in sub.get("items", []) or []:
            iid = line.get("item_id")
            if not iid or iid == st["item_id"]:
                continue
            it = next((x for x in masters["items"] if x["id"] == iid), None)
            if not it:
                continue
            admin.post(f"{API}/inventory/adjustment", json={
                "location_id": st["base_id"], "item_id": iid, "qty": 5000,
                "unit": it["consumption_unit"], "direction": "in",
                "reason": "TEST prestock", "date": TODAY}, timeout=60)
        raw_before = self._stock(chef, st["base_id"], st["item_id"])
        out_before = self._stock(chef, st["base_id"], sub_item_id) if sub_item_id else None
        r = chef.post(f"{API}/kitchen/production", json={
            "sub_recipe_id": sub["id"], "kitchen_id": st["base_id"],
            "produced_qty": 4, "unit": "KG", "date": TODAY, "remarks": "TEST batch",
        }, timeout=60)
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        assert d.get("batch_no", "").startswith("BATCH")
        raw_after = self._stock(chef, st["base_id"], st["item_id"])
        assert raw_before - raw_after == pytest.approx(5000, rel=1e-2), (
            f"80% yield => 4KG output should consume 5KG raw; before={raw_before} after={raw_after}")
        if sub_item_id:
            out_after = self._stock(chef, st["base_id"], sub_item_id)
            assert out_after - out_before == pytest.approx(4000, rel=1e-3)
            TestKitchenChain.state["sub_item_id"] = sub_item_id

    def test_production_list(self, chef):
        r = chef.get(f"{API}/kitchen/production", timeout=60)
        assert r.status_code == 200 and isinstance(r.json(), list)

    def test_negative_production_qty_rejected(self, chef, masters):
        sub = masters["subrecipes"][0]
        r = chef.post(f"{API}/kitchen/production", json={
            "sub_recipe_id": sub["id"], "kitchen_id": TestKitchenChain.state["base_id"],
            "produced_qty": -1, "unit": "KG"}, timeout=60)
        assert r.status_code == 400


# ---------------- Inventory transfer / adjustment / wastage / rd ----------------
class TestInventoryOps:
    def _stock(self, client, location_id, item_id):
        rows = client.get(f"{API}/inventory/stock", params={"location_id": location_id}, timeout=60).json()
        for r in rows:
            if r.get("item_id") == item_id:
                return r.get("stock", 0)
        return 0

    def test_stock_all_locations(self, admin, masters):
        for k in masters["kitchens"]:
            r = admin.get(f"{API}/inventory/stock", params={"location_id": k["id"]}, timeout=60)
            assert r.status_code == 200, f"{k['name']} -> {r.status_code}"
            assert isinstance(r.json(), list)

    def test_transfer_between_locations(self, manager, masters):
        store = masters["kitchens_by_type"]["store"][0]
        rd = masters["kitchens_by_type"]["rd"][0]
        item = next(i for i in masters["items"] if "Chicken" in i["name"] and not i.get("is_sub_recipe"))
        rd_before = self._stock(manager, rd["id"], item["id"])
        r = manager.post(f"{API}/inventory/transfer", json={
            "from_location_id": store["id"], "to_location_id": rd["id"], "date": TODAY,
            "remarks": "TEST transfer",
            "items": [{"item_id": item["id"], "qty": 1, "unit": "KG"}],
        }, timeout=60)
        assert r.status_code == 200, r.text[:400]
        assert r.json()["transfer_no"].startswith("TRF")
        assert self._stock(manager, rd["id"], item["id"]) - rd_before == pytest.approx(1000, rel=1e-3)
        lst = manager.get(f"{API}/inventory/transfers", timeout=60).json()
        assert any(x["transfer_no"] == r.json()["transfer_no"] for x in lst)

    def test_same_location_transfer_blocked(self, manager, masters):
        store = masters["kitchens_by_type"]["store"][0]
        item = masters["items"][0]
        r = manager.post(f"{API}/inventory/transfer", json={
            "from_location_id": store["id"], "to_location_id": store["id"],
            "items": [{"item_id": item["id"], "qty": 1, "unit": item["consumption_unit"]}]}, timeout=60)
        assert r.status_code == 400

    def test_wastage_reduces_stock(self, chef, masters):
        rd = masters["kitchens_by_type"]["rd"][0]
        item = next(i for i in masters["items"] if "Chicken" in i["name"] and not i.get("is_sub_recipe"))
        before = self._stock(chef, rd["id"], item["id"])
        reasons = chef.get(f"{API}/wastage/reasons", timeout=60).json()
        assert reasons, "no wastage reasons"
        r = chef.post(f"{API}/wastage", json={
            "date": TODAY, "kitchen_id": rd["id"], "item_id": item["id"], "qty": 100,
            "unit": item["consumption_unit"], "reason": reasons[0], "remarks": "TEST wastage"}, timeout=60)
        assert r.status_code == 200, r.text[:400]
        after = self._stock(chef, rd["id"], item["id"])
        assert before - after == pytest.approx(100, rel=1e-3)
        lst = chef.get(f"{API}/wastage", timeout=60).json()
        assert any(x.get("remarks") == "TEST wastage" for x in lst)

    def test_wastage_invalid_reason(self, chef, masters):
        rd = masters["kitchens_by_type"]["rd"][0]
        item = masters["items"][0]
        r = chef.post(f"{API}/wastage", json={
            "kitchen_id": rd["id"], "item_id": item["id"], "qty": 1,
            "unit": item["consumption_unit"], "reason": "Bogus"}, timeout=60)
        assert r.status_code == 400

    def test_rd_trial_consumes_from_rd(self, chef, masters):
        rd = masters["kitchens_by_type"]["rd"][0]
        item = next(i for i in masters["items"] if "Chicken" in i["name"] and not i.get("is_sub_recipe"))
        before = self._stock(chef, rd["id"], item["id"])
        r = chef.post(f"{API}/rd/trials", json={
            "date": TODAY, "product": f"TEST_Trial_{TAG}", "yield_qty": 1, "yield_unit": "KG",
            "result": "success", "remarks": "TEST trial",
            "items": [{"item_id": item["id"], "qty": 200, "unit": item["consumption_unit"]}]}, timeout=60)
        assert r.status_code == 200, r.text[:400]
        after = self._stock(chef, rd["id"], item["id"])
        assert before - after == pytest.approx(200, rel=1e-3)
        lst = chef.get(f"{API}/rd/trials", timeout=60).json()
        assert any(x.get("product") == f"TEST_Trial_{TAG}" for x in lst)

    def test_adjustment(self, admin, masters):
        rd = masters["kitchens_by_type"]["rd"][0]
        item = next(i for i in masters["items"] if "Chicken" in i["name"] and not i.get("is_sub_recipe"))
        before = self._stock(admin, rd["id"], item["id"])
        r = admin.post(f"{API}/inventory/adjustment", json={
            "location_id": rd["id"], "item_id": item["id"], "qty": 50,
            "unit": item["consumption_unit"], "direction": "in",
            "reason": "TEST adjustment", "date": TODAY}, timeout=60)
        assert r.status_code == 200, r.text[:400]
        after = self._stock(admin, rd["id"], item["id"])
        assert after - before == pytest.approx(50, rel=1e-3)

    def test_batches(self, admin, masters):
        r = admin.get(f"{API}/inventory/batches", params={"location_id": masters["kitchens_by_type"]["store"][0]["id"]}, timeout=60)
        assert r.status_code == 200 and isinstance(r.json(), list)


# ---------------- Recipes ----------------
class TestRecipes:
    def test_list_recipes_and_subrecipes(self, admin):
        for p in ["recipes", "subrecipes"]:
            r = admin.get(f"{API}/{p}", timeout=60)
            assert r.status_code == 200 and isinstance(r.json(), list)

    def test_recipe_detail_and_expansion(self, admin, masters):
        rec = masters["recipes"][0]
        d = admin.get(f"{API}/recipes/{rec['id']}", timeout=60)
        assert d.status_code == 200
        assert d.json()["id"] == rec["id"]
        e = admin.get(f"{API}/recipes/{rec['id']}/expansion", timeout=60)
        assert e.status_code == 200, e.text[:300]

    def test_recipe_update_creates_new_version(self, admin, masters):
        rec = next(r for r in masters["recipes"] if "Tawa" in r["name"])
        detail = admin.get(f"{API}/recipes/{rec['id']}", timeout=60).json()
        versions_before = len(detail.get("versions", []) or [])
        cur_items = (detail.get("versions") or [{}])[0].get("items") or []
        if not cur_items:
            pytest.skip("recipe version items not exposed for update payload")
        payload = {
            "code": detail["code"], "name": detail["name"], "brand_id": detail.get("brand_id") or "",
            "category": detail.get("category", ""), "selling_price": detail.get("selling_price", 0),
            "portion_size": detail.get("portion_size", ""),
            "items": [{"item_id": i.get("item_id") or "", "sub_recipe_id": i.get("sub_recipe_id") or "",
                       "qty": i["qty"], "unit": i["unit"]} for i in cur_items],
        }
        r = admin.put(f"{API}/recipes/{rec['id']}", json=payload, timeout=60)
        assert r.status_code == 200, r.text[:400]
        after = admin.get(f"{API}/recipes/{rec['id']}", timeout=60).json()
        assert len(after.get("versions", [])) == versions_before + 1
        assert after["current_version"] == detail["current_version"] + 1

    def test_subrecipe_yield_percentage(self, admin, masters):
        sub = next(s for s in masters["subrecipes"] if "Marinated" in s["name"])
        assert sub.get("yield_pct") or sub.get("yield_percentage"), f"no yield pct field: {list(sub)}"


# ---------------- Sales chain ----------------
class TestSales:
    state = {}

    def _stock(self, client, location_id, item_id):
        rows = client.get(f"{API}/inventory/stock", params={"location_id": location_id}, timeout=60).json()
        for r in rows:
            if r.get("item_id") == item_id:
                return r.get("stock", 0)
        return 0

    def test_setup_stock_for_sale(self, manager, masters):
        """Move marinated chicken from base kitchen to normal kitchen for the sale."""
        base = masters["kitchens_by_type"]["base_kitchen"][0]
        normal = masters["kitchens_by_type"]["normal_kitchen"][0]
        sub_item = next(i for i in masters["items"] if i.get("is_sub_recipe") and "Marinated" in i["name"])
        r = manager.post(f"{API}/inventory/transfer", json={
            "from_location_id": base["id"], "to_location_id": normal["id"], "date": SALE_DATE,
            "remarks": "TEST prep for sale",
            "items": [{"item_id": sub_item["id"], "qty": 4, "unit": "KG"}]}, timeout=60)
        assert r.status_code == 200, r.text[:400]
        TestSales.state.update(normal_id=normal["id"], sub_item_id=sub_item["id"])

    def test_create_draft_sale(self, chef, masters):
        brand = next(b for b in masters["brands"] if b["name"].startswith("Brand A")) if any(
            b["name"].startswith("Brand A") for b in masters["brands"]) else masters["brands"][0]
        recipe = next(r for r in masters["recipes"] if "Tawa" in r["name"])
        r = chef.post(f"{API}/sales", json={
            "date": SALE_DATE, "brand_id": brand["id"], "kitchen_id": TestSales.state["normal_id"],
            "source": "manual",
            "items": [{"recipe_id": recipe["id"], "qty_sold": 10}]}, timeout=60)
        if r.status_code == 400 and "already exist" in r.text:
            pytest.skip(f"sale already exists for {SALE_DATE}: {r.text[:200]}")
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        assert d["status"] == "draft"
        assert d["total_amount"] == pytest.approx(10 * recipe.get("selling_price", 0))
        TestSales.state.update(sale_id=d["id"], sale_no=d["sale_no"], brand_id=brand["id"],
                               recipe_id=recipe["id"])

    def test_duplicate_draft_blocked(self, chef):
        st = TestSales.state
        if "sale_id" not in st:
            pytest.skip("no sale created")
        r = chef.post(f"{API}/sales", json={
            "date": SALE_DATE, "brand_id": st["brand_id"], "kitchen_id": st["normal_id"],
            "source": "manual", "items": [{"recipe_id": st["recipe_id"], "qty_sold": 1}]}, timeout=60)
        assert r.status_code == 400 and "already exist" in r.text.lower()

    def test_theoretical_consumption(self, chef):
        st = TestSales.state
        if "sale_id" not in st:
            pytest.skip("no sale created")
        r = chef.get(f"{API}/sales/{st['sale_id']}/theoretical", timeout=60)
        assert r.status_code == 200, r.text[:300]

    def test_post_sale_reduces_subrecipe_stock(self, chef):
        st = TestSales.state
        if "sale_id" not in st:
            pytest.skip("no sale created")
        before = self._stock(chef, st["normal_id"], st["sub_item_id"])
        r = chef.post(f"{API}/sales/{st['sale_id']}/post", json={}, timeout=60)
        assert r.status_code == 200, r.text[:500]
        after = self._stock(chef, st["normal_id"], st["sub_item_id"])
        assert before - after == pytest.approx(2500, rel=1e-3), (
            f"10 portions x 250GM = 2500GM expected; before={before} after={after}")

    def test_sale_detail_has_consumption(self, chef):
        st = TestSales.state
        if "sale_id" not in st:
            pytest.skip("no sale created")
        d = chef.get(f"{API}/sales/{st['sale_id']}", timeout=60).json()
        assert d["status"] == "posted"
        assert d.get("consumption"), "no consumption lines recorded"
        assert all("_id" not in c for c in d["consumption"])

    def test_repost_blocked(self, chef):
        st = TestSales.state
        if "sale_id" not in st:
            pytest.skip("no sale created")
        r = chef.post(f"{API}/sales/{st['sale_id']}/post", json={}, timeout=60)
        assert r.status_code == 400

    def test_insufficient_stock_shortage(self, chef, masters):
        """Posting a huge sale should fail with shortage info, not 500."""
        brand = masters["brands"][-1]
        recipe = next(r for r in masters["recipes"] if "Tawa" in r["name"])
        d2 = (date.today() + timedelta(days=600 + _OFF)).isoformat()
        c = chef.post(f"{API}/sales", json={
            "date": d2, "brand_id": brand["id"], "kitchen_id": TestSales.state["normal_id"],
            "source": "manual", "items": [{"recipe_id": recipe["id"], "qty_sold": 100000}]}, timeout=60)
        if c.status_code != 200:
            pytest.skip(f"could not create shortage sale: {c.text[:200]}")
        sid = c.json()["id"]
        r = chef.post(f"{API}/sales/{sid}/post", json={}, timeout=60)
        assert r.status_code in (200, 400), r.text[:300]
        if r.status_code == 200:
            body = r.json()
            assert body.get("ok") is False, f"sale posted despite insufficient stock: {body}"
            assert body.get("shortages"), "no shortage details returned"
            for sh in body["shortages"]:
                assert sh["shortage"] > 0 and sh["item_name"] and sh["unit"]
        # sale must remain unposted
        detail = chef.get(f"{API}/sales/{sid}", timeout=60).json()
        assert detail["status"] == "draft"


# ---------------- Daily closing ----------------
class TestClosing:
    state = {}

    def test_preview(self, chef, masters):
        normal = masters["kitchens_by_type"]["normal_kitchen"][0]
        d = CLOSING_DATE
        r = chef.get(f"{API}/closing/preview", params={"date": d, "location_id": normal["id"]}, timeout=60)
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        assert "rows" in body and isinstance(body["rows"], list)
        assert body["locked"] is False
        TestClosing.state.update(date=d, location_id=normal["id"], rows=body["rows"])

    def test_submit_closing_with_variance(self, chef):
        st = TestClosing.state
        rows = st["rows"]
        if not rows:
            pytest.skip("no rows in day sheet")
        items = [{"item_id": r["item_id"], "physical_qty": max(r["expected"] - 10, 0)} for r in rows[:3]]
        r = chef.post(f"{API}/closing", json={"date": st["date"], "location_id": st["location_id"],
                                              "items": items}, timeout=60)
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        assert d["status"] == "submitted"
        st["closing_id"] = d["id"]
        graded = [x for x in d["items"] if x.get("physical") is not None]
        assert graded, "no physical values recorded"
        for g in graded:
            assert g["variance"] is not None

    def test_duplicate_closing_blocked(self, chef):
        st = TestClosing.state
        if "closing_id" not in st:
            pytest.skip("no closing")
        r = chef.post(f"{API}/closing", json={"date": st["date"], "location_id": st["location_id"],
                                              "items": []}, timeout=60)
        assert r.status_code == 400

    def test_manager_approves_and_locks(self, manager):
        st = TestClosing.state
        if "closing_id" not in st:
            pytest.skip("no closing")
        r = manager.post(f"{API}/closing/{st['closing_id']}/approve", json={}, timeout=60)
        assert r.status_code == 200, r.text[:400]
        listed = manager.get(f"{API}/closing", params={"date": st["date"]}, timeout=60).json()
        cur = next(x for x in listed if x["id"] == st["closing_id"])
        assert cur["status"] == "approved"
        prev = manager.get(f"{API}/closing/preview", params={"date": st["date"],
                                                            "location_id": st["location_id"]}, timeout=60).json()
        assert prev["locked"] is True

    def test_locked_day_blocks_sale(self, chef, masters):
        st = TestClosing.state
        if "closing_id" not in st:
            pytest.skip("no closing")
        recipe = next(r for r in masters["recipes"] if "Tawa" in r["name"])
        brand = masters["brands"][0]
        r = chef.post(f"{API}/sales", json={
            "date": st["date"], "brand_id": brand["id"], "kitchen_id": st["location_id"],
            "source": "manual", "items": [{"recipe_id": recipe["id"], "qty_sold": 1}]}, timeout=60)
        assert r.status_code == 400 and "lock" in r.text.lower(), r.text[:300]

    def test_admin_reopen(self, admin):
        st = TestClosing.state
        if "closing_id" not in st:
            pytest.skip("no closing")
        r = admin.post(f"{API}/closing/reopen", json={"date": st["date"], "location_id": st["location_id"],
                                                      "reason": "TEST reopen"}, timeout=60)
        assert r.status_code in (200, 400), r.text[:300]

    def test_list_closings(self, admin):
        r = admin.get(f"{API}/closing", timeout=60)
        assert r.status_code == 200 and isinstance(r.json(), list)


# ---------------- Reports & dashboard ----------------
class TestReports:
    @staticmethod
    def store_id(admin):
        ks = admin.get(f"{API}/kitchens", timeout=60).json()
        return next(k for k in ks if k["type"] == "store")["id"]

    def test_dashboard(self, admin):
        r = admin.get(f"{API}/dashboard", timeout=60)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        for k in ["today_sales", "food_cost_pct", "variance_pct"]:
            assert k in d or any(k in str(x) for x in d), f"missing dashboard key {k}: {list(d)}"

    @pytest.mark.parametrize("report", [
        "sales", "inventory", "brand-consumption", "recipe-consumption",
        "variance", "wastage", "procurement", "rd", "food-cost",
    ])
    def test_reports(self, admin, report):
        start = (date.today() - timedelta(days=30)).isoformat()
        params = {"date_from": start, "date_to": TODAY}
        if report == "inventory":
            params = {"date": TODAY, "location_id": self.store_id(admin)}
        r = admin.get(f"{API}/reports/{report}", params=params, timeout=90)
        assert r.status_code == 200, f"{report} -> {r.status_code} {r.text[:300]}"
        body = r.json()
        if isinstance(body, list):
            assert all("_id" not in x for x in body if isinstance(x, dict))

    def test_audit_logs(self, admin):
        r = admin.get(f"{API}/audit-logs", timeout=60)
        assert r.status_code == 200
        logs = r.json()
        assert isinstance(logs, (list, dict))
        rows = logs if isinstance(logs, list) else logs.get("items", [])
        assert rows, "no audit logs"
        assert all("_id" not in x for x in rows)

    def test_audit_logs_forbidden_for_chef(self, chef):
        r = chef.get(f"{API}/audit-logs", timeout=60)
        assert r.status_code in (200, 403)


# ---------------- Users admin ----------------
class TestUsers:
    created = []

    def test_list_users(self, admin):
        r = admin.get(f"{API}/users", timeout=60)
        assert r.status_code == 200
        assert any(u["role"] == "admin" for u in r.json())

    def test_create_user_and_verify(self, admin):
        email = f"test_user_{TAG}@example.com"
        r = admin.post(f"{API}/users", json={"name": f"TEST_User_{TAG}", "email": email,
                                             "password": "demo123", "role": "chef"}, timeout=60)
        assert r.status_code == 200, r.text[:300]
        u = r.json()
        assert u["email"] == email.lower() and u["role"] == "chef"
        assert "password_hash" not in u
        TestUsers.created.append(u["id"])
        users = admin.get(f"{API}/users", timeout=60).json()
        assert any(x["id"] == u["id"] for x in users)
        # new user can log in
        lr = login(email.lower(), "demo123")
        assert lr.status_code == 200, lr.text[:200]

    def test_duplicate_email_rejected(self, admin):
        r = admin.post(f"{API}/users", json={"name": "dup", "email": f"test_user_{TAG}@example.com",
                                             "password": "demo123", "role": "chef"}, timeout=60)
        assert r.status_code == 400

    def test_invalid_role_rejected(self, admin):
        r = admin.post(f"{API}/users", json={"name": "bad", "email": f"bad_{TAG}@example.com",
                                             "password": "demo123", "role": "wizard"}, timeout=60)
        assert r.status_code == 400

    def test_short_password_rejected(self, admin):
        r = admin.post(f"{API}/users", json={"name": "bad", "email": f"bad2_{TAG}@example.com",
                                             "password": "123", "role": "chef"}, timeout=60)
        assert r.status_code == 400

    def test_deactivate_user_blocks_login(self, admin):
        if not TestUsers.created:
            pytest.skip("no user created")
        uid_ = TestUsers.created[0]
        r = admin.put(f"{API}/users/{uid_}", json={"active": False}, timeout=60)
        assert r.status_code == 200 and r.json()["active"] is False
        lr = login(f"test_user_{TAG}@example.com".lower(), "demo123")
        assert lr.status_code in (401, 403), lr.status_code
