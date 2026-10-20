# Changelog

Every change made to this project in this work, newest first. Work up to 2026-10-16 is committed
(commit e789ce1) and on GitHub; the 2026-10-18 section is committed locally and needs `git push`.
File paths are relative to the repository root.

## 2026-10-20: Rista Sales screen (sales, cancelled orders, menu from Rista downloads) and search on two more screens

Built the parts of the next phase that do not wait for the team's answers or the DotPe API. Brand filters for client logins,
roles, catalog editing and production tracking still wait for answers (see `docs/open-questions.md`).

**Search box on Sales and Production (decision "Item search on more screens").**
- `frontend/src/components/SearchSelect.jsx` (new): the one search-as-you-type look, now shared. `SearchSelect` is the base;
  `OptionPicker` searches a list already loaded on the screen (by name or code).
- `frontend/src/components/ItemPicker.jsx`: rebuilt on `SearchSelect`; same behaviour and test ids.
- `frontend/src/pages/Sales.jsx`: the dish on each sales line is picked with a search box (name or code, price shown).
  Changing the brand clears dishes of another brand.
- `frontend/src/pages/Kitchen.jsx`: the sub-recipe on a production batch is picked with a search box (name or code, yield
  shown); choosing it still sets the yield unit.

**Rista Sales (requests R3 sales reports and the Rista part of R5, from files until the API is ready).**
- `backend/routers_rista.py` (new), registered in `backend/server.py` (indexes created at startup):
  - `POST /api/rista/import/{sales|cancelled|menu}` (admin): loads Rista's "Sales Items By Transaction", "Cancelled
    Transactions" and "Export Items" downloads, CSV or Excel. A wrong file is refused with the report it expected. Only listed
    columns are kept: customer names, phone numbers, ids, tax ids, notes and staff names on sales lines are never stored.
    Sales and cancelled files replace what was stored for the same branch and business day, so reloading or overlapping
    files never double count. The menu file replaces the stored menu, with every branch and channel price per dish.
  - `GET /api/rista/sales/summary`: totals (orders, net, gross, discounts, taxes, charges, dishes sold, average order,
    orders a day) and breakdowns by day, brand, source, channel and branch, plus the top 50 dishes. Filters: dates,
    branch, brand, channel, source, and `brand_field` = `business_brand` (brand ordered from) or `account_name` (brand that
    owns the dish), so the report works whichever answer the team gives to Q15.
  - `GET /api/rista/sales/export` and `/api/rista/cancelled/export`: filtered lines as Excel or CSV.
  - `GET /api/rista/cancelled`, `/api/rista/menu`, `/api/rista/menu/{sku}`, `/api/rista/menu/checks` (dishes sold but not in
    the menu file; dishes sold without a recipe in this app, linked when recipe code = Rista SKU), `/api/rista/imports`.
  - Viewing: admin and management (as the existing Reports screen for management). Loading files: admin only.
- `frontend/src/pages/RistaSales.jsx` (new) at `/rista`, "Rista Sales" in the menu (`App.jsx`, `Layout.jsx`,
  `lib/permissions.js`): tabs Sales report (filters, figures, daily chart, tables by source, branch, brand, channel, top dishes,
  Excel/CSV download), Cancelled orders (figures, reasons, list, download), Menu (search, brand, status, price range, sold
  quantity, recipe link, prices per branch and channel), Upload files (where to find each report in Rista, load, result,
  history).
- Corrected where "Export Items" is in Rista (Business Settings > Items > three dots), as given by Youvraj.
- Menu tab on the live site showed "No records found" for the ~4 seconds the list took to load. It now shows
  "Loading menu…", and `GET /api/rista/menu` returns only the listed columns (details and prices come from `/menu/{sku}`).
- Checked with the real files on a local test database: 13,829 lines, 6,520 orders, net Rs 20,35,097.62, 31 days, source
  shares 44.4 / 39.6 / 8.3 / 7.6 %, 77 cancellations (Rs 27,830.34), 1,507 dishes and 224 price columns, all equal to the
  analysis of the files. Loading the month takes about 4 seconds; the summary 0.2 seconds; a month's Excel download about
  5 seconds (built in a worker thread so other users are not held up).

**Tests.**
- `backend/tests/test_rista.py` (new, 12 tests): import totals, no customer details stored, reload replaces instead of
  doubling, totals and breakdowns, both brand meanings and filters, Excel export, cancelled orders, menu and checks, Excel
  uploads, wrong or empty files refused, import history, permissions (management reads, cannot upload; chef refused).
- `frontend/src/components/SearchSelect.test.jsx` (new, 3 tests).
- `tests/e2e/rista.mjs` (new, 40 checks desktop and phone); `item-search.mjs` adds the dish and sub-recipe boxes;
  `business-flow.mjs` picks the sub-recipe and dish by search; `roles.mjs`, `smoke.mjs`, `mobile-layout.mjs` include `/rista`;
  `tests/e2e/README.md` updated.
Verified on a fresh local database: backend Rista 12/12; unit 15/15; e2e Rista 40/40 desktop and phone, roles 84 checks
desktop and phone with 0 failing, smoke passed, business flow 91/91, admin flows 49/49, item search 54/54 desktop and 56/56
phone, data entry passed, no phone overflow on any screen including `/rista`; production build OK; ESLint 0 errors.

## 2026-10-20: requirements document v2 updated with the Rista menu and cancellations

Input: two more Rista exports downloaded on 20 October, the full menu ("Export Items", emailed by Rista, 1,507 dishes and
386 columns) and one month of "Cancelled Transactions" (77 orders, all branches in one download). Both stay out of git
(`docs/*.csv`); only totals were used.

- Section 3 corrected: report limits apply only on screen (7 days, 1 to 8 branches); downloads covered a whole month and all
  branches; some exports are emailed to the account's mailbox. New facts on the menu (25 brand accounts, 144 categories,
  8 brands with a menu but no sales), prices per branch and channel (224 price columns), matching (every sold dish matches the
  menu by code except 2), and cancellations (77, about 1 in 85 orders, mostly cancelled by Zomato/Swiggy/Ownly).
- Account Name on a sale always equals the dish's brand account in the menu, so Q15 now explains the two choices.
- Decisions changed: importing sales starts from an uploaded monthly Rista download (nightly via the API later); channel
  prices kept per branch and channel as in Rista; matching checked against the menu export.
- Questions sharpened: Q12 (8 menu-only brands added to the brand table), Q13 (Jayanagar, Kalyan Nagar, Koramangala),
  Q16 (The Good Fud vs The Healthy Fud), Q39 (how owners change per-channel prices, with a real example), Q54 (read the menu),
  Q55 (API limits).
- Q1 answered by Youvraj: the new features go into this app. It is now decision 1 (25 decisions); Q1 only asks, for later,
  which other app owns the extra collections in the company's database.
Checked: the Word validator passes; the Word PDF preview of section 3 and the brand table was inspected (18 pages).

## 2026-10-20: version 2 of the requirements document, using real Rista data

Input: the Rista portal walkthrough of 19 October (screenshots of reports, downloads, catalog items, settings, order board,
table view and new order) and one month of sales downloaded from Rista ("Sales Items By Transaction", 19 Sep to 19 Oct 2026,
13,829 item lines, 82 columns). The analysis used only structure and totals; customer names and phone numbers in the file were
not copied into any document.

- `docs/Skope-Next-Phase-Questions-v2.docx` (17 pages) and `docs/open-questions.md`: new section 3 "What we learned from Rista"
  (6,520 orders, about 210 a day; Rs 20.35 lakh net; Zomato 44%, Swiggy 40%, Ownly 8%, in-store 8%; 2 of 5 Rista branches have
  sales, JP Nagar and Marathahalli; 13 brands, Kochi Kurry Klub 72%; Business Brand and Account Name do not always match; 375 dish
  codes; Rista report limits of 7 days and 1 branch on screen; catalog, price book, order board and dine-in features).
- Six more decisions, now that the data answers them: order steps as in Rista, Rista's Business Date as the business day, nightly
  import one branch and one day at a time, cancellations from Rista's separate report, matching dishes by Rista SKU, channel prices
  through Rista's Price book, and Rista's own Excel upload as a fallback for menu changes (24 decisions in total).
- Questions rewritten with real examples (56): which field decides a sale's brand, what the extra account names are, what the
  other 3 branches are, whether JP Nagar and Marathahalli become locations, whether Ownly and in-store orders are in scope, which
  report columns clients get, and whether Rista's own inventory is in use. Answered questions were removed (the sample sales
  report, the business-day cut-off).
- The client table is now pre-filled with the 13 brands (branches, channels, orders, share of sales); the team only adds the
  client company and corrections.
- `.gitignore`: `docs/*.csv`, `docs/*.xlsx`, `docs/*.xls`, so real data exports with customer details never reach GitHub.
- Version 1 (`Skope-Next-Phase-Questions.docx`) was deleted; version 2 replaces it.
Checked: the Word validator passes; a PDF preview exported through Microsoft Word was inspected.

## 2026-10-20: Word document of requirements, decisions and questions

`docs/Skope-Next-Phase-Questions.docx` (14 pages, A4) is the version to send to the team; `docs/open-questions.md` now holds the
same content for reading and diffing in git. Both are generated from one source, so they cannot drift apart.
Changes from the earlier draft:
- Technical questions are no longer asked: they are answered in a "Decisions we have made" table (18 decisions, for example photo
  shrinking, report formats, sync direction, customer data, password reset, hosting and security before real clients), each with an
  "Agree? (Yes / No)" column.
- DotPe will not provide a test account, so a section explains how we work on the live account safely (read first, changes only on
  dishes or an outlet you choose, every change recorded with the old value so it can be undone), and Q52 asks which dishes or outlet
  may be used for testing.
- 52 questions remain, all business questions, grouped A to H, each with "How to answer", "Needed" and a shaded "Your answer" cell;
  the client/brand/outlet table and the roles table (landscape page) are fill-in tables.
Checked: the skill's Word validator passes; a PDF preview exported through Microsoft Word was inspected page by page.

## 2026-10-20: requirements and questions for the next phase

`docs/open-questions.md` rewritten from the team's updated list of seven requests (live orders, sales reports, catalog management,
catalog sync, production vs sales, roles; item search already done). It now holds 59 plain-language questions, each saying **how to
answer** (yes/no, pick one, number, list, fill the table, send a file) and **whether it is needed before work starts**. It adds:
a glossary (client, brand, outlet, kitchen, channel, menu item vs raw item), a client/brand/outlet mapping table to fill, today's
permissions for all six roles as a table to correct (taken from the server's actual role checks, plus rows for the new features and
columns for brand owner and store staff), questions on what data each person may see, a checklist of files needed, and what can be
built before DotPe's API is available. No code changed.
Added "Project basics" (Q60 to Q65): which website the work belongs in (the company's MongoDB account holds another app's
`test` database that looks like a different website), real data to load, who tests and signs off, progress updates, running old
sheets in parallel, and the web address. 65 questions in total.

## 2026-10-20: one reusable item search everywhere, open questions for the next phase

Request from the team (item 1 of 8): wherever users pick an item, use the same search box, built once and reused. Before this,
only the purchase receipt and the kitchen request had search; nine other places used a plain dropdown of every item.

### Changed
| File | Change |
|---|---|
| `frontend/src/components/ItemPicker.jsx` | Now the single item search box for the whole app. New `includeInactive` option (history filters can find deactivated items; data-entry screens still cannot). Shows a "Prepared" label on sub-recipe items. When several boxes on a screen already have an item chosen (for example a recipe with many lines), they share one lookup of item names instead of each downloading the full item list. Change/clear buttons are 36px on phones (28px from tablet up) and have screen-reader labels. |
| `frontend/src/pages/Inventory.jsx` | Stock transfer lines (stock shown at the **from** location), stock adjustment (stock at the chosen location) and the ledger item filter (finds deactivated items; clearing returns to all items) use the search box. Removed the now-unused full item list download. |
| `frontend/src/pages/Wastage.jsx` | Item uses the search box with stock at the chosen kitchen; the item field takes the full width on phones (was half). Removed the unused item list download. |
| `frontend/src/pages/RnD.jsx` | Trial ingredients use the search box with stock at the R&D kitchen, the location trials actually consume from. Removed the unused item list download. |
| `frontend/src/pages/Recipes.jsx` | Recipe raw-item lines, sub-recipe output item and sub-recipe ingredients use the search box. Recipe lines set to "Sub-Recipe" keep their sub-recipe list. On phones the line's type and ingredient fields each take a full row. |
| `frontend/src/pages/Reports.jsx` | Item Ledger report item filter uses the search box (finds deactivated items). Removed the unused item list download. |

Each screen keeps its earlier behaviour: choosing an item still sets the line's unit to the item's usage unit where it did before.
Places still picking from a list on purpose: sub-recipes (Production, recipe lines of type Sub-Recipe) and dishes (Sales), which are
not items; whether they should also be searchable is open question 1 in `docs/open-questions.md`.

### Added
| File | Purpose |
|---|---|
| `frontend/src/components/ItemPicker.test.jsx` | 5 unit tests: search with location stock, "Prepared" label, inactive items for history filters, choosing and clearing, one shared name lookup. Checked that a test fails when the inactive-items feature is broken on purpose, then passes when restored. |
| `tests/e2e/item-search.mjs` | Browser test of all 11 places, each by the role that does that job (see the e2e README). |
| `docs/open-questions.md` | Plain-language questions for the eight requests, with an answer column and a status table. |

### Updated
- `tests/e2e/business-flow.mjs`, `tests/e2e/admin-and-edge-flows.mjs`: six steps now pick items through the search box.
- `tests/e2e/README.md`: lists the new test.

### Verification (fresh scratch database, dev server)
| Check | Result |
|---|---|
| Unit tests | 12/12 (was 7) |
| ESLint | 0 errors (the same 7 older warnings) |
| Item search, desktop / phone | 44/44, 46/46 |
| Business flow (now picking items by search) | 91/91 |
| Admin and edge flows | 49/49 |
| Roles, desktop / phone | 78/78 each |
| Smoke / data entry | 22/22, 6/6 |
| Phone layout audit | No overflow; item results list 324px wide on a 390px phone (was 154px on Wastage) |

A first attempt at the page edits matched the wrong tag and broke five files; they were restored from git and redone before any
testing. Not yet on the live test site: it updates after `git push`.

## 2026-10-18: shared test link (single-service deployment)

Goal: let the team try the whole application through one web address. The app can now run as one service:
one address serves the screens and the API, backed by a hosted MongoDB. Local development is unchanged.
Step-by-step instructions are in [DEPLOY.md](DEPLOY.md).

### Added
| File | Purpose |
|---|---|
| `Dockerfile` | Two stages: builds the React app with production settings, then runs the FastAPI server with the built app next to it. Listens on `$PORT`. |
| `.dockerignore` | Keeps `.env` files, tests, notes, `node_modules` and virtual environments out of the image. |
| `render.yaml` | Render Blueprint: one Docker web service on the free plan, health check on `/api`, settings asked for at creation (`MONGO_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DEMO_PASSWORD`), `JWT_SECRET` generated. |
| `backend/requirements-prod.txt` | The 13 packages the app imports, pinned to the exact versions it was tested with (the old 120-line list includes unused packages). |
| `backend/.env.example` | Every backend setting with an explanation and no secrets. |
| `DEPLOY.md` | Hosting guide (Atlas + Render), the temporary-tunnel alternative, limits of the free plans, and what was and was not tested. |

### Changed
| File | Change |
|---|---|
| `backend/server.py` | (1) Serves the built frontend from the same address when `frontend/build` exists (or `FRONTEND_DIST` is set): static files under `/assets`, and any other non-API path returns the app so links like `/inventory` work on reload; unknown `/api/...` paths still return a JSON 404; path traversal returns only the app shell. (2) CORS origins now come from `CORS_ORIGINS` (default `*`, so local behaviour is unchanged). |
| `backend/seed.py` | New optional step: when `SEED_DEMO_USERS=true` and `DEMO_PASSWORD` is set (6+ characters), creates the five role accounts if missing, with that password. Without the settings nothing is created. |
| `frontend/src/pages/Login.jsx` | The "User logins (tap to fill)" box is controlled by `VITE_SHOW_DEMO_LOGINS`. It still shows in development. Production builds set it to `false`, which removes the box **and the passwords from the shipped JavaScript** (checked: `admin123`, `demo123`, the admin email and the box markup are absent from the production bundle, and present in the development build). |
| `tests/e2e/prepare.py` | Demo password can be set with `E2E_DEMO_PASSWORD`, so a live copy is not prepared with a weak default. |

### Guide update (same day)
`DEPLOY.md` Step 1 now covers an existing free Atlas cluster that has auto-paused (click Resume; data is kept) and recommends a separate database user limited to `readWrite` on `skope_operations` when the cluster is shared with other projects. Prompted by finding a paused `Cluster0` in the owner's Atlas account.

### Why a single service
One address means no cross-site (CORS) setup, no second host to pay for or keep in sync, and the frontend calls the API on its own address.

### Verification
Docker is not installed on this computer, so the image itself was not built. Instead the same steps were run directly: production build, backend serving it on one address with a fresh MongoDB database and demo users created from settings, then the full browser suite against that address.
| Check | Result |
|---|---|
| `GET /`, `/inventory`, `/api`, an unknown `/api/...`, a built asset | 200 app, 200 app shell, 200 JSON, 404 JSON, 200 |
| Path traversal attempts (5 variants) | Only the app shell or 404; no file or secret returned |
| Login page of the production build | No demo-credentials box; sign-in form present |
| Roles matrix, desktop and phone | 78/78 each |
| Business flow (clean database) | 91/91 |
| Admin and edge flows | 49/49 |
| Smoke / data entry | 22/22, 6/6 |
| Phone layout audit | No overflow |
A first run of the business flow failed (22 checks) because that test database already held a completed earlier run; after dropping and recreating the database the same flow passed 91/91. The test databases were dropped afterwards.

### First live deployment (same day)
Deployed from the Blueprint on Render's free plan, with the database on the owner's existing MongoDB Atlas free cluster
(Cluster0, resumed after auto-pause) using a new user `skope_app` limited to `readWrite` on `skope_operations`. The cluster already
holds another application's data in a database called `test`; this app never touches it.
Result: the Docker image built (Python 3.14 base image, Node 22 build stage), the service went live, and Render's health check on
`/api` returns 200. Read-only checks against the public address:
| Check | Result |
|---|---|
| `GET /api` | 200, about 1 second |
| `GET /`, `GET /inventory` (deep link) | 200, the app |
| `GET /api/nope` | 404 JSON |
| Shipped JavaScript contains `admin123`, `demo123`, the credentials box, or `kitchen.com` | None of them |
| `GET /api/items`, `GET /api/users` without logging in | 401 |
Render shows a notice that the free instance spins down with inactivity, which can delay requests by 50 seconds or more.

### Not tested
- Signing in on the live address and using it as each role (the owner and team do this; `tests/e2e` scripts can also be pointed at it).
- The Cloudflare tunnel option in `DEPLOY.md`.

### Known limits of the free hosting (details in DEPLOY.md)
Sleeps after 15 minutes idle (about a minute to wake), uploaded files are lost on restart, 0.5 GB database, and it is not yet suitable for real business data (see the security list in the overview document).

## 2026-10-16: responsive layout, punctuation, role guard, Reports fix, end-to-end tests

### Mobile / small-screen layout (desktop look unchanged)
Measured first at 375px on all 11 screens: two screens overflowed horizontally
(Procurement by 55px, Administration by 124px), tab bars wrapped into ragged rows, tap
targets were 24 to 32px, and the Masters dialog forced two cramped columns.

| File | Change |
|---|---|
| `frontend/src/components/ui/tabs.jsx` | Tab bar is a single swipeable row on phones (no wrapping, hidden scrollbar), wraps from `sm` up. Tab buttons are 44px tall on phones. This fixed both overflowing screens. |
| `frontend/src/components/Layout.jsx` | Menu, close and logout buttons are 44px with `aria-label`s. Drawer scrolls (`overflow-y-auto`), is `max-w-[85vw]`. Root uses `min-h-dvh`, `overflow-x-clip` safety net, content column `min-w-0`. Long user names truncate. |
| `frontend/src/components/DataTable.jsx` | Search and CSV share one row on phones. Tighter cell padding on phones. A fade appears on the right edge while more columns are hidden off-screen (only when there really is more to scroll to). |
| `frontend/src/components/ui/button.jsx` | `sm` buttons are 40px and icon buttons 40px on phones (unchanged from `sm` up). |
| `frontend/src/components/ui/dialog.jsx` | Dialogs get `p-4` on phones, `max-h-[calc(100dvh-1rem)]` with scrolling, and a 44px close button. |
| `frontend/src/pages/Masters.jsx` | Dialog form is one column on phones, two from `sm` (`grid-cols-1 sm:grid-cols-2`, `col-span-2` became `sm:col-span-2`). |
| `frontend/src/pages/Inventory.jsx` | Adjustment row stacks on phones. |
| `frontend/src/pages/Procurement.jsx` | Line-item row on phones: unit 4, batch 8, expiry 9, delete 3 of 12 columns (the expiry date was clipped to about 95px, now about 210px); delete button has `aria-label`. |
| `frontend/src/pages/{Inventory,Kitchen,Recipes,Masters}.jsx` | Removed their own `flex-wrap h-auto` tab overrides so the shared tab bar behaves the same everywhere. |
| `frontend/src/pages/*.jsx` | Cards use `p-4 sm:p-6` instead of `p-6` (15 places) for more room on phones. |
| `frontend/src/components/DataTable.jsx` (`PageHeader`) | Header action buttons wrap. |

Result: no horizontal overflow at 360, 375, 412, 768 and 812x375 (landscape); every dialog fits.

### Punctuation: em dashes removed
All 49 em dashes were removed: 43 in the frontend (toasts, subtitles, dialog titles, labels,
empty-cell placeholders, one code comment) and 6 in backend messages that appear in toasts.
A search of `frontend/src`, `frontend/index.html` and `backend/*.py` now finds none.
Examples: `Stock issued — ...` became `Stock issued: ...`; `Name — Version History` became
`Name · Version History`; the empty-cell `—` became `-`.
Files: `frontend/src/components/BulkUpload.jsx`, `frontend/src/constants/testIds/index.js`,
`frontend/src/pages/{Admin,Dashboard,Inventory,Kitchen,Login,Masters,Procurement,Recipes,RnD,Sales,Wastage}.jsx`,
`backend/routers_masters.py`, `backend/routers_bulk.py`, `backend/routers_admin.py`.
The one remaining en dash is the row range `2–5` in the bulk upload preview (a range, not an em dash).

### Role-based route guard (new)
Found while testing every role: the sidebar hid sections a role should not use, but
typing the URL (for example a chef opening `/masters` or `/admin`) opened an empty page
full of 403 errors. The server was already refusing the data; the UI was not consistent with it.
- New `frontend/src/lib/permissions.js`: one map of which roles may open which route.
- `frontend/src/components/Layout.jsx` builds the sidebar from that map.
- `frontend/src/App.jsx` redirects a signed-in user to the dashboard when their role may not open the route.
The map is identical to what the sidebar already used, so no role gained or lost access.

### Bug fixed: Reports page crashed to a blank white screen
Running a report and then switching to **Item Ledger** (or any report whose columns read
fields the previous report's rows lack) threw `Cannot read properties of undefined
(reading 'replace')` during render and blanked the entire app.
- `frontend/src/pages/Reports.jsx`: rows are remembered together with the report they belong to and only shown for that report; `txn_type` is null-safe.
- New `frontend/src/components/ErrorBoundary.jsx` wrapped around the app in `frontend/src/index.jsx`: any future render error shows a "Something went wrong / Back to dashboard" screen instead of a blank page. Covered by `ErrorBoundary.test.jsx`.

### Tests added
- `frontend/src/components/ErrorBoundary.test.jsx` (2 unit tests; total now 7).
- `tests/e2e/`: Playwright suite, documented in `tests/e2e/README.md`.
  - `roles.mjs`: 6 roles x (login, nav, every route, forbidden URLs), desktop and phone: 78 checks each.
  - `business-flow.mjs`: purchase, approval, intents, issue, production, transfer, sales, wastage, closing, R&D, management views, 12 forbidden-role API calls, audit trail: 91 checks, desktop and phone.
  - `admin-and-edge-flows.mjs`: user create/login/deactivate/delete, reject and partial approval, intent rejection, recipe creation, bulk upload, all 10 reports, reopen day: 49 checks, desktop and phone.
  - `smoke.mjs` (22), `data-entry.mjs` (6), `mobile-layout.mjs` (overflow, tap targets, dialogs).
  - `prepare.py` builds the master data and demo users through the API, idempotently.
- `.gitignore`: ignores `tests/e2e/node_modules/`.

### Verification (final code, fresh runs)
| Check | Result |
|---|---|
| Unit tests | 7/7 |
| ESLint | 0 errors (7 old warnings) |
| Production build | passes |
| Roles matrix, desktop and phone | 78/78 each |
| Business flow, desktop and phone | 91/91 each |
| Admin and edge flows, desktop and phone | 49/49 each |
| Smoke / data entry | 22/22, 6/6 |
| Phone layout audit | no overflow |
| Clean-room: new database + `prepare.py` + repo suite | all pass |
| Backend `test_permissions.py` | 9/9 |
Run on MongoDB 9.0.4 with motor 3.7.1 / pymongo 4.19.0.

### Known limitations (not changed, by design: functionality kept as is)
- Action buttons are not hidden by role inside a screen. A role without permission (for example a procurement manager pressing "Create Receipt") gets the server's refusal as an error toast. The server enforces permissions on every call.
- On Windows, uploaded-file paths longer than 260 characters fail unless long paths are enabled. The default `backend/uploads/` is far shorter; keep `UPLOAD_DIR` short.
- Business-flow test needs an empty-transaction database (see `tests/e2e/README.md`).

## 2026-10-14: Create React App to Vite, Emergent removal
Documented in full in [`frontend/MIGRATION_VITE.md`](frontend/MIGRATION_VITE.md). Summary:
- Frontend build moved from Create React App + Craco to Vite 8; `index.html`, `vite.config.mjs`, `eslint.config.mjs`, `.env.example`, `src/lib/api.test.js` added; `craco.config.js`, `public/index.html`, `plugins/health-check/` removed; `src/index.js` and `src/App.js` renamed to `.jsx`.
- Emergent coupling removed: analytics and platform scripts in `index.html`, `@emergentbase/visual-edits`, `emergentintegrations` and the platform-hosted `litellm` wheel in `backend/requirements.txt`.
- `backend/storage.py`: file uploads use local disk when `EMERGENT_LLM_KEY` is absent (the hosted store only when it is set; `STORAGE_BACKEND=local|remote` forces one).
- Backend tests made path-portable (repo-relative instead of `/app/...`).
- The `.emergent/` folder (platform deploy config) was left in place.
