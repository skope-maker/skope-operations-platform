# Browser end-to-end tests

Playwright scripts that drive the real UI in Chromium, once per role, and check the
resulting stock numbers through the API. They cover every screen, every role, the full
purchase-to-sales business chain and the phone layout.

| Script | What it checks |
|---|---|
| `smoke.mjs` | Login/logout, all 11 routes render, sidebar navigation, deep-link reload (22 checks). |
| `roles.mjs` | For all 6 roles: nav shows exactly that role's sections, every permitted screen loads without errors, every forbidden URL redirects home (78 checks; `phone` arg uses the drawer menu). |
| `business-flow.mjs` | The whole chain, each step performed by the correct role in the UI, with exact stock assertions after every step (91 checks, see below). |
| `admin-and-edge-flows.mjs` | User administration (create, log in as the new user, deactivate, delete), receipt rejection and partial approval, intent rejection, recipe creation, bulk upload, every report type, reopening a closed day (49 checks). |
| `data-entry.mjs` | Create/delete a master record through dialogs, tabs, file upload/download round trip. |
| `mobile-layout.mjs` | Horizontal overflow, small tap targets and dialog fit on every screen at a given viewport. |

## The business chain (`business-flow.mjs`)

1. **store_keeper** records a purchase receipt with an invoice attachment (Onion 20 KG, Oil 5 L, Chicken 10 KG, total 4,000).
2. **procurement_manager** approves it, so stock enters the main store.
3. **chef** raises two kitchen intents (base kitchen and normal kitchen).
4. **store_keeper** issues both, so stock moves store to kitchens.
5. **chef** records a production batch (8 KG gravy base, consuming onion and oil).
6. **store_manager** transfers gravy base from the base kitchen to the normal kitchen.
7. **chef** records 5 portions of Butter Chicken (1,900) and posts the sale, so ingredients are consumed.
8. **store_manager** records wastage.
9. **chef** submits the daily closing, **store_manager** approves it.
10. **chef** records an R&D trial.
11. **management** views the dashboard and every report (read-only).
12. Twelve wrong-role API calls are all refused with 403, and **admin** sees the audit trail.

## Running

Use a **throwaway database**: `business-flow.mjs` asserts exact stock numbers, so it must
start from a database with no transactions.

```bash
# 1. backend on a fresh database (short UPLOAD_DIR: Windows limits paths to 260 characters)
cd backend
DB_NAME=skope_e2e STORAGE_BACKEND=local UPLOAD_DIR=/tmp/skope-uploads python -m uvicorn server:app --port 8011

# 2. frontend dev server pointing at that backend
cd frontend
VITE_BACKEND_URL= VITE_DEV_PROXY_TARGET=http://localhost:8011 npx vite --port 5199

# 3. test data (demo users, brand, supplier, items, sub-recipe, recipe); safe to re-run
E2E_API=http://localhost:8011 python tests/e2e/prepare.py

# 4. tests
cd tests/e2e && npm install && npx playwright install chromium
node roles.mjs         http://localhost:5199 desktop      # or: phone
node business-flow.mjs http://localhost:5199 ./out desktop
node admin-and-edge-flows.mjs http://localhost:5199 ./out desktop
node smoke.mjs         http://localhost:5199 ./out
node data-entry.mjs    http://localhost:5199 ./out
node mobile-layout.mjs http://localhost:5199 ./out 375 812
```

On PowerShell set the variables first, for example `$env:DB_NAME='skope_e2e'`.

**Against the single-address build.** The same scripts also work against the app served by the backend alone
(the setup used for hosting, see `DEPLOY.md`): build the frontend with `VITE_SHOW_DEMO_LOGINS=false VITE_BACKEND_URL=`,
start the backend with `SEED_DEMO_USERS=true` and `DEMO_PASSWORD=demo123`, run `prepare.py` against it, and pass the
backend's own address (for example `http://localhost:8013`) as the first argument. Skip step 2 (no Vite dev server needed).

Run `business-flow.mjs` before `admin-and-edge-flows.mjs` (the second one reopens the day
the first one closed). To run `business-flow.mjs` again, drop the database and restart
the backend. Override the admin login with `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`.

Each script exits non-zero on any failure, prints one PASS/FAIL line per check and saves
a screenshot named `FAIL-*.png` for any step that errored.
