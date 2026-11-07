# CLAUDE.md

Guide for AI coding assistants (Claude Code, Cursor, Copilot, etc.) working on Booka-Ru.
`AGENTS.md`-style tools should read this file too.

## What this is

Booka-Ru is an online bookshop (English and Bangla books, Dhaka). One Git repository,
three folders, no workspaces — each app has its own `package.json` and lockfile.

| Folder | Stack | Entry point |
|--------|-------|-------------|
| `client/` | React 18, react-router 5, Create React App, Bootstrap 4 + custom CSS | `client/src/index.js` → `App.js` |
| `server/` | Node 22, Express 4, official MongoDB driver (no ORM), pdfkit | `server/index.js` |
| `database/` | MongoDB migrations and seed, run with the server's `node_modules` | `database/migrate.js`, `database/seed.js` |

## Folder map

```
client/
  public/                 index.html, manifest, favicon, book covers (covers/*.jpg)
  src/api.js              the only place that calls fetch; apiRequest() + ApiError
  src/App.js              routes and the signed-in user context
  src/categories.js       shelf / category definitions
  src/components/<Name>/  one folder per component: Name.js (+ Name.css)
    Admin/                team desk: books, orders, chat, reviews, pop-ups, staff
    PrivateRoute/         route guard (UI only — the API is the real check)
server/
  index.js                all routes, auth middleware, validation
  invoice.js              PDF invoice
  seed-catalog.js         starter books + editorial reviews (exports seedCatalog)
  seed-demo-accounts.js   demo admin/staff/customer (exports seedDemoAccounts)
  verify-demo-flow.js     end-to-end check against a running API
  test/                   node:test tests
database/
  migrations/NNN_*.js     { id, description, up(db, log) }
  migrate.js              runner; tracks applied ids in `_migrations`
  seed.js                 full demo dataset
docker-compose.yml        mongo + api + web (nginx)
render.yaml               Render Blueprint
```

## Commands

```bash
npm --prefix server ci && npm --prefix client ci   # install
npm --prefix server run dev                        # API on :5500 (needs server/.env)
npm --prefix client start                          # storefront on :3000
npm --prefix server test                           # API tests (no DB needed)
npm --prefix client test -- --watchAll=false       # storefront tests
CI=true npm --prefix client run build              # production build; warnings fail in CI
npm --prefix server run db:migrate | db:status | db:seed
docker compose up -d --build                       # full stack
```

Before finishing a change, run both test suites and the client build with `CI=true`
(Render builds with `CI=true`, so lint warnings break the deploy).

## API conventions — keep these

- **Response shape:** success is always HTTP 200 `{ success: true, message, data }`; every
  failure is HTTP 422 `{ success: false, errors: [{ code, message, field? }] }`. Use the
  `ok()`, `fail()` and `err()` helpers. The one exception is the invoice PDF stream.
  Unexpected errors go to the error middleware (HTTP 500, `SERVER_ERROR`).
- Error `code`s are UPPER_SNAKE_CASE and stable — the client matches on them
  (`AUTH_CODES` in `client/src/api.js`).
- Wrap async handlers in `asyncHandler`.
- **Authorisation:** every route that changes data starts with `authenticate`, then
  `allow('<permission>')` or `adminOnly`. Only `/auth/register`, `/auth/login` and
  `/auth/demo-login/:role` are public. `server/test/schema.test.js` enforces this.
- Permissions: `books:write`, `orders:manage`, `support:handle`, `reviews:moderate`,
  `users:manage`, `popups:manage`. Admin = the account whose email equals `ADMIN_EMAIL`
  and has every permission. Staff can only grant permissions they hold.
- Validate and normalise input on the server (trim, lower-case email, `Number()`, length
  caps) even if the form already does.
- IDs: check `ObjectId.isValid()` before `new ObjectId()`; return string `_id` to the client.
- Books are soft-deleted (`active: false`). Stock is decremented atomically with a
  `quantity: { $gte: n }` filter.
- Passwords: scrypt `salt:hash`; session tokens are stored only as SHA-256 hashes.

## Database conventions

- Schema changes go in a **new** `database/migrations/NNN_name.js`; never edit an applied one.
  Update the validator, indexes, `database/README.md` and the tests together.
- The API runs pending migrations at startup (`runMigrations` in `server/index.js`).
- Seed data uses a `seedKey` and upserts so seeds are idempotent.

## Client conventions

- All HTTP goes through `apiRequest()` in `client/src/api.js`; it adds the bearer token
  from `localStorage` (`bookaru_session`) and throws `ApiError`.
- Function components and hooks. Plain CSS files next to components; theme colours are
  CSS variables in `client/src/index.css` (light and dark).
- `REACT_APP_*` variables are baked in at build time.
- Show the server's error `message` to the user; don't invent new wording for API errors.

## Secrets and environment

- Never commit `.env` files, connection strings or passwords. Templates:
  `server/.env.example`, `client/.env.example`, `.env.docker.example`.
- Demo passwords come only from `DEMO_*_PASSWORD` env vars.
- `ENABLE_DEMO_LOGINS` must stay `false` in production (the API also refuses when
  `NODE_ENV=production`).

## Dependencies

Versions are pinned exactly. Add packages with `npm install --save-exact`, keep
`npm audit --omit=dev` clean, and record notable changes in `CHANGELOG.md`.
