# PRD — Multi-Brand Kitchen Sales, Recipe & Inventory Management

## Original Problem Statement (summary)
Production-ready multi-brand food business system covering: Masters (brands/companies, kitchens/locations, items, categories, units, suppliers) → Procurement (receipt with mandatory invoice upload, approval, only approved qty enters stock) → Store Inventory → Kitchen Intents (Base/Normal/R&D) → Store Issues → Sub-Recipe Production with yields → Recipe Master (versioned, nested sub-recipes) → Daily Sales (draft → post) → automatic recursive raw-material consumption → Daily Closing (expected vs physical, variance, day lock) → Wastage → R&D trials → Dashboard, Reports, Audit Logs. Full spec in user message (sections 1–50).

## User Choices
- DB: MongoDB with immutable inventory transaction ledger (stock always computed from ledger)
- Auth: JWT username/password + RBAC (6 roles)
- Scope: full end-to-end chain first (covers the 28-step acceptance test)
- Seed: Brand A/B/C, Raw Chicken/Salt/Oil/Marinated Chicken items, Marinated Chicken sub-recipe (10KG raw → 8KG, 79.2%), Tawa Grill Chicken recipe (250 GM marinated + 10 ML oil + 2 GM salt, ₹250), demo users per role
- Admin: chennakeshavaediga@gmail.com / admin123; demo roles demo123 (see test_credentials.md)
- Company (brand) names fully editable/addable/removable from Masters

## Architecture
- Backend: FastAPI modular routers (/app/backend: db.py, auth.py, inventory.py [central engine: post_txn, stock from ledger, negative-stock guard, day-lock guard], recipes_engine.py [recursive sub-recipe/yield expansion], routers_{masters,procurement,kitchen,recipes,sales,closing,reports}.py, seed.py)
- Frontend: React + shadcn + Tailwind + recharts; Layout w/ role-filtered sidebar; pages: Dashboard, Sales, Procurement, Inventory, Kitchen, Recipes, RnD, Wastage, Masters, Reports, Admin
- Units: family-based conversion (weight→GM, volume→ML, count→PCS); stock stored in base units, displayed in item consumption unit

## Implemented (2026-08-28)
- JWT auth + 6-role RBAC, brute-force lockout, user admin
- All masters CRUD (brands/kitchens/categories/units/items/suppliers) + settings (company name, variance tolerance)
- Procurement: receipt + mandatory invoice (base64), approve/partial/reject, approved-only stock entry, rate updates
- Inventory: per-location stock (Store/Base/Normal/R&D), immutable ledger, transfers, adjustments, FIFO/FEFO batches with expiry
- Kitchen: intents (3 issue types), full/partial issue with store availability, sub-recipe production (consume raws, produce output, auto cost), daily closing (expected/physical/variance/tolerance breach, approve→lock, admin reopen w/ audit)
- Recipes: version-controlled recipes, sub-recipes with auto yield %, recursive raw expansion, costing + food cost %
- Sales: draft→post, sold/cancelled/complimentary, duplicate prevention, shortage dialog + admin/manager override (audited), theoretical consumption view
- Wastage (8 reasons, ledger txn), R&D trials (separate rd_consumption)
- Dashboard: live KPIs, sales trend, brand-wise sales/food-cost, alerts (pending approvals/intents/closings, low stock, expiring, high variance)
- Reports: sales, inventory day-sheet, item ledger, brand consumption, recipe consumption, variance, wastage, procurement, R&D, food cost — all CSV exportable
- Audit logs for all key actions incl. overrides and day reopening

## Verification
- 28-step acceptance test passed via API (100KG→approve→40KG issue→32KG production→100 sales→7KG left→31.25KG theoretical raw→variance→lock)
- Testing agent iteration_1: backend 79/79 pytest; frontend ~95% — all reported issues fixed (override no-op for chef, settings validation, reopen approver cleanup, toaster overlap, issueFull balance, login_attempts cleanup)

## Backlog / Next
- P1: CSV/Excel sales import; PDF export; brand-wise stock buckets (currently brand tracked on txns, availability checked at location level)
- P2: Swiggy/Zomato/POS integrations; opening-stock onboarding screen; invoice file storage via object storage
- P3: Recipe effective-date UI picker, per-brand inventory value report, Excel exports
