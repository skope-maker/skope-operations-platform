# SKOPE Kitchen — Product Requirements & Status

## Problem Statement (original)
Production-oriented multi-brand kitchen operations app covering the connected flow:
Procurement → Store Inventory → Kitchen Intent/Issue → Sub-Recipe Production/Yield → Recipe →
Sales Posting → Consumption → Daily Closing/Variance.

Stack: React + FastAPI + MongoDB (UUID relational-style refs, immutable inventory ledger),
JWT username/password auth with role-based access, configurable masters, responsive kitchen SaaS UI.
Company name: **SKOPE Kitchen** (logo at `frontend/public/skope-logo.png`).

## Roles
admin, procurement_manager, store_keeper, store_manager, chef, management

## Architecture
- Backend modules: `db.py`, `auth.py`, `inventory.py` (ledger + `source_location()`), `recipes_engine.py`,
  routers: masters, procurement, kitchen, recipes, sales, closing, reports, **bulk**, **admin**; `seed.py`.
- Frontend: pages (Dashboard, Sales, Procurement, Inventory, Kitchen, Recipes, RnD, Wastage, Masters, Reports, Admin),
  components (`DataTable`, **`BulkUpload`**, **`ItemPicker`**, **`ConfirmDialog`**), `lib/api.js`, `context/AuthContext`.
- All backend routes prefixed `/api`; frontend uses `REACT_APP_BACKEND_URL`.

## Implemented

### Earlier phases
- Full operational chain: masters, procurement + invoice attachment + approvals, store inventory,
  kitchen intents/issues, transfers, sub-recipes/recipes with versioning & yields, production batches,
  daily sales draft→post with consumption, closing/variance + day locks, reports, R&D, wastage,
  admin users/settings/audit logs, role-aware navigation.
- Branded split-screen login with tap-to-fill role logins; editable company settings.

### June 2026 — Bulk uploads, kitchen hierarchy, item search, admin deletes
- **Foundation seed** (`seed.py`): 8 standard Units (KG/GM/LTR/ML/PCS/PKT/BOX/BTL) and 4 Locations
  (Main Store, Base Kitchen, Normal Kitchen, R&D) created when those collections are empty.
- **Store ⇄ Kitchen hierarchy**: `kitchens.parent_id` ("Supply Source") editable in Masters, with
  self/circular-parent validation. `inventory.source_location()` resolves the supply source
  (Main Store → Base Kitchen → Normal Kitchens); intents show availability from and issue stock from
  that source instead of always the main store.
- **Intent & Issue fix**: Issue Type now populates its locations correctly (incl. Normal Kitchen and
  Main Store), shows "issued from <source>" hints and a clear message when no location of that type exists.
- **Excel bulk upload** (`/api/bulk/...`) for Sub-Recipes, Main Recipes and Daily Sales:
  template download (data sheet + Instructions sheet, mandatory columns marked `*`), upload → validate →
  row-wise preview with errors → confirm import → summary + downloadable CSV error report
  (Excel row, field, reason, original value). One row per ingredient/product line grouped by code,
  Line Type ITEM/SUBRECIPE for recipes. Duplicate codes and duplicate Date+Brand+Kitchen sales are blocked.
- **Item search**: `GET /api/items/search?q=&location_id=` (name, code/SKU, category, subcategory, capped results,
  optional live stock) powering the `ItemPicker` used in Procurement receipts and Kitchen intents.
- **Admin delete**: confirmation dialog everywhere; masters and users hard-delete when unreferenced and
  archive (soft delete) when referenced; new Administration → **Delete Entries** tab for sales, receipts,
  intents, productions and wastage (hard delete when no inventory impact, archive otherwise).
  All list endpoints exclude `deleted`/`archived` records. All deletes are admin-only and audit-logged.

## Verification
- `/app/tests/test_new_features.py` — end-to-end backend pass (templates, validate/import for all 3 kinds,
  duplicate blocking, item search, intent→issue through the hierarchy, admin delete/archive).
- Testing agent iteration 4 (`/app/test_reports/iteration_4.json`): backend 9/9 permission tests +
  all UI flows pass, no functional defects. Only optional cosmetic notes.

## Backlog
- P1: Bulk upload for Items master and opening stock.
- P1: Restore/unarchive screen for archived records.
- P2: Pagination/streaming for very large (10k+ row) imports.
- P2: Center invoice preview image; add DialogDescription to silence a11y warnings.
- P2: Log a warning when a location's supply source is missing and the main-store fallback is used.
