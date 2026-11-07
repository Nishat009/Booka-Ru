# Booka-Ru

Booka-Ru is an online bookshop for English and Bangla books, based in Dhaka. Customers browse
the catalogue, order books, chat with the shop about an order and download a PDF invoice; the
shop team manages books, orders, reviews, pop-ups and staff from a role-based team desk.

| Folder | What it is |
|--------|-----------|
| [`client/`](client/README.md) | React 18 storefront and team desk |
| [`server/`](server/README.md) | Express 4 API on Node.js 22, MongoDB, PDF invoices |
| [`database/`](database/README.md) | Schema (MongoDB migrations + `schema.sql`) and demo data (`seed.js` + `seed.sql`) |

This is one Git repository. Run Git commands from the project root; the client and server do
not have separate repositories.

## Live demo

| | URL |
|--|-----|
| Storefront | https://booka-ru-kappa.vercel.app |
| Storefront (Render mirror) | https://booka-ru.onrender.com |
| API | https://booka-ru-api.onrender.com |

The API runs on Render's free plan, so the first request after a quiet period can take up to a
minute while it wakes up. Anyone can create a customer account on the storefront and place an
order. One-click demo logins are switched off in production; admin and staff credentials for
reviewers are shared privately, never in this repository.

## Documentation

| Document | Contents |
|----------|----------|
| [HowToSetup.md](HowToSetup.md) | Install locally, with Docker, on a VPS, on Render or Vercel; database setup; first admin login; branding; troubleshooting |
| [database/README.md](database/README.md) | Collections, indexes, migrations, `schema.sql` / `seed.sql` |
| [server/README.md](server/README.md) | API reference: every endpoint, its permission and error codes |
| [client/README.md](client/README.md) | Storefront structure, environment variables, build |
| [CLAUDE.md](CLAUDE.md) | Architecture, folder map and conventions for AI coding tools |
| [CHANGELOG.md](CHANGELOG.md) | Version history |

## Quick start

**Docker** (needs only Docker):

```bash
cp .env.docker.example .env        # set ADMIN_EMAIL
docker compose up -d --build       # http://localhost:8080
```

**Node.js 22 + MongoDB 7:**

```bash
npm --prefix server ci
npm --prefix client ci
cp server/.env.example server/.env   # set MONGODB_URI and ADMIN_EMAIL
cp client/.env.example client/.env

npm --prefix server run db:seed      # schema + demo catalogue + sample data
npm --prefix server run dev          # API on http://localhost:5500
npm --prefix client start            # storefront on http://localhost:3000
```

Full instructions, including VPS and Render deployment: [HowToSetup.md](HowToSetup.md).

## Database

Booka-Ru runs on **MongoDB**. The schema is created from an empty database by versioned
migrations, which the API also applies automatically every time it starts.

| File | Purpose |
|------|---------|
| [`database/migrations/`](database/migrations) | The live schema: collections, JSON-schema validators, indexes |
| [`database/schema.sql`](database/schema.sql) | The same data model as portable SQL (PostgreSQL / SQLite) — creates every table, constraint and index from scratch |
| [`database/seed.js`](database/seed.js) | Demo data for MongoDB: 51 books, reviews, demo accounts, a sample order and chat |
| [`database/seed.sql`](database/seed.sql) | The same demo data as SQL, generated from the catalogue (no passwords) |

```bash
npm --prefix server run db:migrate   # apply migrations
npm --prefix server run db:status    # applied / pending migrations
npm --prefix server run db:seed      # migrations + demo data (idempotent)

psql -d bookaru -f database/schema.sql -f database/seed.sql   # SQL edition
```

Server tests check that `schema.sql` matches the MongoDB validators and that `seed.sql` loads
cleanly and matches the catalogue.

## Accounts and permissions

- Customers sign up with email and password. Passwords are hashed with **scrypt** (random salt);
  sessions are random bearer tokens stored only as SHA-256 hashes and expire after seven days.
- The account whose email equals `ADMIN_EMAIL` is the administrator and has every permission.
  There is no default password in the code — the administrator signs up with that email.
- The administrator creates staff accounts in **Team desk → Team access** and grants
  permissions: `books:write`, `orders:manage`, `support:handle`, `reviews:moderate`,
  `users:manage`, `popups:manage`. Staff can only grant permissions they hold themselves.
- Every route that changes data checks the session and the permission on the server; hiding a
  button in the UI is not the protection. A test enforces this for every route.

## Tests and checks

```bash
npm --prefix server test                         # API, schema, SQL files, invoice (no DB needed)
npm --prefix client test -- --watchAll=false     # storefront
CI=true npm --prefix client run build            # production build; lint warnings fail
npm --prefix server audit --omit=dev             # dependency audit
npm --prefix client audit --omit=dev
```

With the API running and demo passwords set, `npm --prefix server run verify:demo-flow`
exercises the admin, staff and customer workflow end to end.

## Security

- No secrets are committed. Configuration comes from `.env` files created from the
  `*.env.example` templates, which contain placeholders only.
- Demo account passwords come only from `DEMO_*_PASSWORD` environment variables.
- `ENABLE_DEMO_LOGINS` is ignored when `NODE_ENV=production`.
- All dependency versions are pinned; `npm audit --omit=dev` is clean for both apps.
