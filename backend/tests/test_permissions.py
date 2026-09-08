"""Role-based permission tests for admin delete + bulk upload."""
import os
import io
import pytest
import requests
from openpyxl import Workbook

BASE = os.environ.get('REACT_APP_BACKEND_URL', 'https://recipe-stock-sync-2.preview.emergentagent.com').rstrip('/') + '/api'


def _login(email, pw):
    r = requests.post(f'{BASE}/auth/login', json={'email': email, 'password': pw}, timeout=15)
    assert r.status_code == 200, f'login {email} -> {r.status_code} {r.text}'
    return r.json()['token']


@pytest.fixture(scope='module')
def tokens():
    return {
        'admin': _login('chennakeshavaediga@gmail.com', 'admin123'),
        'chef': _login('chef@kitchen.com', 'demo123'),
        'manager': _login('manager@kitchen.com', 'demo123'),
        'keeper': _login('keeper@kitchen.com', 'demo123'),
    }


def h(t):
    return {'Authorization': f'Bearer {t}'}


class TestAdminOnlyEndpoints:
    def test_admin_records_list_forbidden_for_non_admin(self, tokens):
        for role in ('chef', 'manager', 'keeper'):
            r = requests.get(f'{BASE}/admin/records/sales', headers=h(tokens[role]), timeout=15)
            assert r.status_code == 403, f'{role} got {r.status_code}'

    def test_admin_records_delete_forbidden_for_non_admin(self, tokens):
        r = requests.delete(f'{BASE}/admin/records/sales/nonexistent-id', headers=h(tokens['chef']), timeout=15)
        assert r.status_code == 403

    def test_admin_user_delete_forbidden_for_non_admin(self, tokens):
        r = requests.delete(f'{BASE}/admin/users/nonexistent', headers=h(tokens['manager']), timeout=15)
        assert r.status_code == 403

    def test_admin_records_list_works_for_admin(self, tokens):
        r = requests.get(f'{BASE}/admin/records/sales', headers=h(tokens['admin']), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestMasterDeletePermissions:
    def test_delete_item_forbidden_for_chef(self, tokens):
        # Try to delete something (any id) as chef -> must be 403
        r = requests.delete(f'{BASE}/items/nonexistent', headers=h(tokens['chef']), timeout=15)
        assert r.status_code == 403

    def test_delete_kitchen_forbidden_for_manager(self, tokens):
        r = requests.delete(f'{BASE}/kitchens/nonexistent', headers=h(tokens['manager']), timeout=15)
        assert r.status_code == 403


def _xlsx(sheet, header_len, rows):
    wb = Workbook(); ws = wb.active; ws.title = sheet
    ws.append(['h'] * header_len)
    for r in rows:
        ws.append(r)
    b = io.BytesIO(); wb.save(b); b.seek(0)
    return b.getvalue()


class TestBulkUploadPermissions:
    def test_chef_can_validate_subrecipe(self, tokens):
        f = _xlsx('SubRecipes', 9, [['SR-PERM','Perm','', 'ITM-GRAVY',1,'KG','ITM-ONION',0.5,'KG']])
        r = requests.post(f'{BASE}/bulk/subrecipe/validate', headers=h(tokens['chef']),
                          files={'file': ('t.xlsx', f, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}, timeout=30)
        assert r.status_code == 200, r.text

    def test_chef_can_validate_recipe(self, tokens):
        f = _xlsx('Recipes', 12, [['RCP-PERM','Perm','TB1','Main','1','P',10,'2026-01-01','ITEM','ITM-CHICKEN',50,'GM']])
        r = requests.post(f'{BASE}/bulk/recipe/validate', headers=h(tokens['chef']),
                          files={'file': ('t.xlsx', f, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}, timeout=30)
        assert r.status_code == 200, r.text

    def test_manager_can_validate_sales(self, tokens):
        f = _xlsx('Sales', 7, [['2026-06-05','TB1','NORMK','RCP-BC',1,0,0]])
        r = requests.post(f'{BASE}/bulk/sales/validate', headers=h(tokens['manager']),
                          files={'file': ('t.xlsx', f, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}, timeout=30)
        assert r.status_code == 200, r.text
