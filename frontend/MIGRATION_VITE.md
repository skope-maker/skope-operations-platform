# Migration: Create React App (Craco) -> Vite

Later changes (responsive layout, role guard, Reports fix, end-to-end tests) are in [../CHANGELOG.md](../CHANGELOG.md).

Date: 2026-10-14. Scope: frontend build tooling, removal of Emergent-platform coupling,
and the backend changes needed so nothing depends on a third-party platform.
Application behaviour, UI, routes, API contract and data model are **unchanged**.

## Why

* `react-scripts` / CRA is unmaintained. On a fresh install the CRA build **failed**
  (`ajv` `MODULE_NOT_FOUND` inside webpack's toolchain on Node 26 / npm 11).
* Craco existed only to patch CRA (alias, eslint, dev server) and to load an
  Emergent-only visual-edit plugin.
* Vite builds in a few seconds, pulls in roughly a third of the packages, and is the
  standard for React SPAs without a server.

## Result

| | Before (CRA + Craco) | After (Vite 8) |
|---|---|---|
| Fresh install builds | No (`ajv` MODULE_NOT_FOUND, measured) | Yes |
| Production build time | n/a (build failed) | ~2-5 s (measured) |
| Installed package versions | 1,545 packages (`npm install` output) | 519 |
| Dev server | webpack-dev-server via Craco | Vite |
| Bundle | n/a (build failed) | 950 kB JS (278 kB gzip) + 54 kB CSS |
| Output dir | `build/` | `build/` (unchanged) |
| Dev port | 3000 | 3000 (unchanged; `--port` to override) |

## Frontend changes (file by file)

### Added
| File | Purpose |
|---|---|
| `index.html` | Vite entry (moved from `public/index.html`). `<script type="module" src="/src/index.jsx">`. Title is now "Skope Operations Platform", favicon added. |
| `vite.config.mjs` | React plugin, `@` -> `src` alias, `REACT_APP_`+`VITE_` env prefixes, `/api` dev+preview proxy to `http://localhost:8001`, `build.outDir = build`, Vitest config. |
| `eslint.config.mjs` | Flat ESLint config reproducing the rules craco enabled (`react-hooks/rules-of-hooks` error, `exhaustive-deps` warn). `no-unused-vars` is a warning, as it was under CRA. |
| `src/lib/api.test.js` | Vitest unit tests for the `lib/api.js` helpers (5 tests). |
| `.env.example` | Documents the env variables. |
| `MIGRATION_VITE.md` | This document. |

### Renamed
| From | To | Reason |
|---|---|---|
| `src/index.js` | `src/index.jsx` | Vite only parses JSX in `.jsx` files. |
| `src/App.js` | `src/App.jsx` | Same. |

### Modified
| File | Change |
|---|---|
| `package.json` | Scripts: `start`/`dev` -> `vite`, `build` -> `vite build`, `preview`, `lint`, `test` -> `vitest run`. Removed `react-scripts`, `cra-template`, `@craco/craco`, `@emergentbase/visual-edits`, `@babel/plugin-proposal-private-property-in-object`, `dotenv`. Added `vite`, `@vitejs/plugin-react`, `vitest`, `jsdom`. `resolutions` pruned to the 3 that still apply (the rest only pinned CRA/webpack transitive deps). Yarn 1 remains the package manager. |
| `src/lib/api.js` | `process.env.REACT_APP_BACKEND_URL` -> `import.meta.env.VITE_BACKEND_URL ?? import.meta.env.REACT_APP_BACKEND_URL ?? ''`. Trailing slashes are trimmed. With nothing set the app calls same-origin `/api`. |
| `tailwind.config.js` | `content` path `./public/index.html` -> `./index.html`. |
| `src/constants/testIds/home.js` | Removed the unused `emergentLink` test id (nothing referenced it). |
| `src/constants/testIds/auth.js` | Removed a comment referencing an Emergent lint rule. |
| `yarn.lock` | Regenerated with Yarn 1.22.22. |
| `README.md` | Replaced the CRA boilerplate with real instructions. |

### Removed
| File | Reason |
|---|---|
| `craco.config.js` | CRA/Craco no longer used. Its alias and eslint config live in `vite.config.mjs` / `eslint.config.mjs`. |
| `public/index.html` | Replaced by root `index.html`. |
| `plugins/health-check/*` | Craco/webpack-only health endpoints for the hosting platform. |
| `index.html` Emergent script (`assets.emergent.sh/scripts/emergent-main.js`) | Platform script, not needed. |
| `index.html` PostHog snippet (sent analytics to `ap.emergent.sh`) | Third-party session analytics, not needed. |
| `index.html` `DataCloneError` workaround | Existed only for the removed platform script. |

## Environment variables

| Variable | Used by | Notes |
|---|---|---|
| `VITE_BACKEND_URL` | frontend | Preferred. Empty/unset => same-origin `/api` (use the Vite proxy in dev, a reverse proxy in prod). |
| `REACT_APP_BACKEND_URL` | frontend | Still honoured so an existing `frontend/.env` keeps working unchanged. |
| `VITE_DEV_PROXY_TARGET` | `vite.config.mjs` | Backend the dev/preview `/api` proxy targets. Default `http://localhost:8001`. |

Vite inlines these at **build time** - rebuild after changing them.

## Backend changes (needed to run without the hosting platform)

| File | Change |
|---|---|
| `storage.py` | File storage is now pluggable. **Local disk** (`UPLOAD_DIR`, default `backend/uploads/`) is used when `EMERGENT_LLM_KEY` is not set; the legacy hosted object store is used only when that key is set (so existing deployments behave identically). `STORAGE_BACKEND=local\|remote` forces one. Local paths are traversal-safe. |
| `requirements.txt` | Removed `emergentintegrations` and the platform-hosted `litellm` wheel (neither is imported anywhere). |
| `tests/test_permissions.py` | Default URL no longer points at the platform preview host; defaults to `http://localhost:8001`. |
| `tests/conftest.py`, `test_auth_hardening.py`, `test_approval_stock.py`, `test_invoice_attachment.py`, `tests/test_item_bulk.py` | Replaced hard-coded `/app/...` container paths with repo-relative paths / env vars so the suites run on any machine. |
| `.gitignore` | Added `backend/uploads/`. |

No API route, request/response model, or database schema changed.

## How to run

```bash
# backend (needs MongoDB; see backend/.env)
cd backend && uvicorn server:app --port 8001

# frontend
cd frontend
yarn install
yarn dev            # http://localhost:3000, /api proxied to :8001
yarn build          # -> frontend/build
yarn preview        # serve the production build locally
yarn lint
yarn test
```

## Verification performed

Environment: Node 26.10, Python 3.14, MongoDB 7.0.14 (local), backend FastAPI 0.110.1,
Chromium via Playwright.

| Check | Result |
|---|---|
| `vite build` | passes, exit 0 |
| `vitest run` | 5/5 pass |
| `eslint .` | 0 errors, 7 warnings (all pre-existing: unused vars, hook deps) |
| Browser E2E on `vite dev` | 22/22 steps pass, 0 page errors |
| Browser E2E on production build (`vite preview`) | 22/22 steps pass, 0 page errors |
| UI data flow (create/delete brand via dialogs, tabs, upload/download) | 6/6 pass |
| Backend pytest: `backend_test.py` + `test_auth_hardening.py` + `test_permissions.py` | 92 passed |
| Backend script suites `tests/test_item_bulk.py`, `tests/test_new_features.py` | both print "ALL ... CHECKS PASSED" |
| Local-disk storage: upload, Bearer + `?auth=` download, 401 without auth, path traversal blocked | pass |
| Legacy `REACT_APP_BACKEND_URL` inlined into the production bundle | confirmed |

Browser E2E covers: unauthenticated redirect, wrong-password error, login, all 11
routes render, sidebar navigation, deep-link reload keeps the session, logout.

### Known gaps / notes
* `backend/tests/test_invoice_attachment.py` and `test_approval_stock.py` need QA
  records (`PRC-00013`, `TEST_QA_IMG_001`) that only existed in the original hosted
  database; they skip or fail on a fresh database. Not caused by this migration.
* `backend/tests/backend_test.py` assumes a "Marinated..." sub-recipe and a "Tawa"
  recipe exist (they were removed by the "Masters Cleared" commit). They were
  recreated for verification; on a clean database those 7 tests need that data.
* The `.emergent/` folder (platform cron/deploy config) was left in place. Delete it
  if the app is no longer hosted on that platform.
* The 950 kB single JS chunk is the same size class as before; route-level
  `React.lazy` splitting is a possible follow-up.

## Rollback

Do **not** run `git checkout -- frontend backend`: it would also discard unrelated
uncommitted work (for example `Procurement.jsx`, `Wastage.jsx`, `backend/server.py`).
Restore only the files this migration touched:

```bash
git checkout -- frontend/package.json frontend/craco.config.js frontend/public/index.html   frontend/src/App.js frontend/src/index.js frontend/src/lib/api.js frontend/tailwind.config.js   frontend/plugins frontend/src/constants/testIds frontend/README.md
rm frontend/index.html frontend/vite.config.mjs frontend/eslint.config.mjs    frontend/src/App.jsx frontend/src/index.jsx frontend/src/lib/api.test.js frontend/.env.example
```

Note `frontend/yarn.lock` was untracked before this change, so the previous
lockfile cannot be restored from git (reinstall regenerates it). The frontend
`.env` was not modified.
