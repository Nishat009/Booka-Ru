# Booka-Ru

Booka-Ru contains the React storefront and its Express/MongoDB API:

- `client/` — React frontend
- `server/` — Express API and MongoDB persistence

- `database/` — MongoDB migrations (schema, validators, indexes) and demo seed data

This is one Git repository with two application folders. Run Git commands from this project root (`Booka-Ru/`). The client and server do not have separate repositories.

| Document | Contents |
|----------|----------|
| [HowToSetup.md](HowToSetup.md) | Install on a local machine, with Docker, on a VPS, or on Render; database setup; first admin login; branding |
| [database/README.md](database/README.md) | Collections, indexes, migrations and seed data |
| [CLAUDE.md](CLAUDE.md) | Architecture, folder map and conventions for AI coding tools |
| [CHANGELOG.md](CHANGELOG.md) | Version history |

**Quick start with Docker:** `cp .env.docker.example .env`, set `ADMIN_EMAIL`, then `docker compose up -d --build` and open http://localhost:8080.

## Install and run

From the project root, install each app's dependencies:

```powershell
npm --prefix server install
npm --prefix client install
```

Create the database schema and demo data (needs `server/.env`, see below):

```powershell
npm --prefix server run db:seed
```

Then run the API and frontend in separate terminals:

```powershell
npm --prefix server run dev
npm --prefix client start
```

## Run locally

1. Create `server/.env` from `server/.env.example`. Set `MONGODB_URI` and `DB_NAME`. Set `ADMIN_EMAIL` to the email address that should receive the first administrator account.
2. In `server/`, run `npm install`, then `npm run dev`.
3. Create `client/.env` from `client/.env.example`. Optional: set `REACT_APP_GOOGLE_MAPS_API_KEY` to use Google's Dhaka map embed. The existing Dhaka OpenStreetMap embed remains the fallback. The exact shop address/pin can be set in `client/src/components/Home/Home.js` once known.
4. In `client/`, run `npm install`, then `npm start`.

## Accounts and permissions

- Customers create a local Booka-Ru email/password account. Passwords are bcrypt-hashed and login sessions are stored in MongoDB with a seven-day expiry.
- Sign up with the configured `ADMIN_EMAIL` to get server-enforced administrator access. Admins can manage books, order statuses, staff accounts and permissions, and moderate reviews.
- In the admin team desk, create staff accounts with a temporary password and selected permissions. Share that temporary password securely. Staff access is checked by the API; changing a URL alone does not grant access.
- Book catalogue, order snapshots, support messages, user roles, sessions and review approval state are stored in MongoDB.
- Run `npm run seed:catalog` in `server/` to add the English and Bangla starter books and approved editorial reviews to MongoDB. This is an idempotent seed; storefront content is loaded from the API.
- For a local development database only, set `DEMO_ADMIN_PASSWORD`, `DEMO_STAFF_PASSWORD`, and `DEMO_CUSTOMER_PASSWORD` in `server/.env`, then run `npm run seed:demo` in `server/`. This creates the configured `ADMIN_EMAIL` account and `bookaru.staff.test@example.com` / `bookaru.customer.test@example.com`. Use strong, private passwords and never copy development credentials to production.
- With the API running and those demo passwords set, run `npm run verify:demo-flow` in `server/` to exercise the database-backed admin, staff, customer, order, support, and review workflow. It creates a demo Bangla book, order, and approved review in the configured database.
- For local development, set `ENABLE_DEMO_LOGINS=true` in `server/.env` and restart the API. The development login page then shows one-click admin, staff, and customer demo buttons; the API disables this endpoint in production.

New backend routes use `/books`, `/orders`, `/reviews`, `/admin/users`, and `/admin/reviews`. Legacy `/addBook`, `/buyBook`, and `/orderPreview` routes have been replaced by authenticated REST routes.

The API listens on port `5500` by default. Set `REACT_APP_API_URL` in `client/.env` if the API runs at a different address. Restart the React development server after changing this value.

## Tests

```powershell
npm --prefix server test
npm --prefix client test -- --watchAll=false
```

Never commit `.env` files or MongoDB credentials.
# Booka-Ru

## Deploy on Render

`render.yaml` defines two services: `booka-ru-api` (Express API) and `booka-ru` (static React site).

1. Create a MongoDB Atlas cluster and allow access from anywhere (`0.0.0.0/0`), since Render's outbound IPs change.
2. In Render, choose **New → Blueprint**, pick this repository, and fill in the prompted values:
   - `MONGODB_URI`: the Atlas connection string.
   - `ADMIN_EMAIL`: the email that becomes the administrator on sign-up.
   - `REACT_APP_API_URL`: the API's public URL, e.g. `https://booka-ru-api.onrender.com` (no trailing slash).
3. Seed the catalogue once from your machine: `MONGODB_URI="<atlas uri>" npm --prefix server run seed:catalog`.
4. If the API URL changes, update `REACT_APP_API_URL` and redeploy the static site; the value is baked in at build time.

The free API instance sleeps when idle, so the first request after a pause can take up to a minute.
