# Skope Operations Platform - Frontend

React 19 single-page app built with [Vite](https://vite.dev), styled with Tailwind CSS and
Radix-based (shadcn/ui style) components.

## Scripts

| Command | What it does |
|---|---|
| `yarn dev` (or `yarn start`) | Dev server on http://localhost:3000. `/api` is proxied to the backend (`http://localhost:8001`, override with `VITE_DEV_PROXY_TARGET`). |
| `yarn build` | Production build into `build/`. |
| `yarn preview` | Serve the production build locally (same `/api` proxy). |
| `yarn lint` | ESLint (flat config in `eslint.config.mjs`). |
| `yarn test` | Vitest unit tests. |

## Configuration

Copy `.env.example` to `.env` (or `.env.local`):

* `VITE_BACKEND_URL` - backend origin. Leave empty to use same-origin `/api`.
* `REACT_APP_BACKEND_URL` - legacy name, still supported.

Env values are inlined at build time; rebuild after changing them.

## Layout

```
index.html          Vite entry
vite.config.mjs     Vite + Vitest config (alias @ -> src, /api proxy)
src/
  index.jsx         bootstrap (React Query provider)
  App.jsx           routes + auth guard
  pages/            one file per screen
  components/       layout, data table, dialogs, ui/ (shadcn-style primitives)
  context/          AuthContext
  lib/api.js        axios instance + formatting/file helpers
```

See [MIGRATION_VITE.md](MIGRATION_VITE.md) for the CRA -> Vite migration notes.
