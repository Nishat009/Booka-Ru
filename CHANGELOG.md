# Changelog

All notable changes to Booka-Ru are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [1.0.3] — 2026-11-07

### Added
- `database/schema.sql`: the full data model as portable SQL (PostgreSQL 13+ / SQLite 3.35+) —
  9 tables with primary and foreign keys, `NOT NULL`/`CHECK`/`UNIQUE` constraints matching the
  MongoDB validators, and the same indexes. Creates the database from scratch; idempotent.
- `database/seed.sql`: the demo data as SQL (51 books, 5 reviews, locked demo accounts, a
  sample order with support chat, a welcome pop-up). Generated from `server/seed-catalog.js` by
  `database/export-sql.js` (`npm --prefix server run db:sql`); contains no passwords.
- `server/test/sql.test.js`: `schema.sql` must cover every MongoDB field and enum, `seed.sql`
  must be current, and both must load into SQLite twice with valid foreign keys.
- `SEED_CATALOG_IF_EMPTY`: when `true`, the API loads the starter catalogue on start if the
  database has no books. Enabled in the Render Blueprint and Docker Compose, so a fresh
  deployment never shows an empty shop. An existing catalogue is never changed.
- `server/README.md`: API reference — every endpoint with its permission, body and error codes.
- HowToSetup: complete Render steps and storefront hosting on Vercel.

### Changed
- `client/README.md` rewritten (pages, structure, environment, deployment); it previously
  described an old Firebase deployment.
- README: Vercel storefront in the live-demo list, documentation index, database file table.
- The `postcss` override in `client/package.json` is pinned to an exact version (8.5.31).
- Client and server package versions set to 1.0.3.

### Fixed
- README said passwords are bcrypt-hashed; they are hashed with scrypt.
- HowToSetup pointed to a Render section in `client/README.md` that did not exist.

## [1.0.1] — 2026-11-07

### Added
- README: live demo links and where the MongoDB schema and seed live (no `.sql` files).
- `database/` with a migration runner, `001_initial_schema` (collections, JSON-schema
  validators, indexes including a unique login email and a TTL index that removes expired
  sessions) and a demo seed (`db:migrate`, `db:status`, `db:seed` scripts).
- The API applies pending migrations on startup.
- Docker support: `docker-compose.yml` (MongoDB, API, nginx storefront), Dockerfiles for
  `server/` and `client/`, and `.env.docker.example`.
- `HowToSetup.md` covering local development, Docker, a VPS with nginx/PM2/HTTPS and Render,
  plus database setup, first admin login and branding.
- `CLAUDE.md` guide for AI coding tools, this changelog, and `.nvmrc` (Node 22).
- Server tests (`npm --prefix server test`): schema coverage, authentication on every
  mutating route, invoice PDF rendering.

### Changed
- All dependencies pinned to exact versions. Express upgraded to 4.22 and dotenv to 16;
  `npm audit --omit=dev` reports no vulnerabilities for the API or the storefront.
- Storefront build tooling (`react-scripts`, Testing Library) moved to `devDependencies`.
- Seed scripts export reusable functions; seeded demo accounts are created as active.
- Web app manifest uses the Booka-Ru name and colours.

### Fixed
- Storefront tests mock the API response format (`{ success, data }`); all tests pass.

### Removed
- Leftover Firebase hosting cache and project file from `client/`.

## [1.0.0] — 2026-11-07

### Added
- React storefront with English and Bangla catalogue, search, categories, checkout and
  order history.
- Express + MongoDB API with email/password accounts, scrypt-hashed passwords and
  server-side sessions.
- Roles (customer, staff, admin) with fine-grained staff permissions enforced by the API.
- Admin team desk: books, orders, support chat, review moderation, promotional pop-ups and
  staff accounts.
- PDF invoices, idempotent catalogue seed, demo accounts and an end-to-end verification script.
- Render Blueprint for the API and static storefront.
