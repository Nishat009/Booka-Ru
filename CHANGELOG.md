# Changelog

All notable changes to Booka-Ru are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

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
