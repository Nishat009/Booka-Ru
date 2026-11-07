# Database

Booka-Ru stores its data in **MongoDB 7+**. The live schema is a set of versioned migration
scripts that create every collection, its JSON-schema validator and its indexes from an empty
database. The same data model is also provided as portable SQL (`schema.sql`, `seed.sql`).

```
database/
├── migrations/
│   └── 001_initial_schema.js   collections, validators, indexes (the live schema)
├── migrate.js                  migration runner (also called by the API on startup)
├── seed.js                     demo data for MongoDB: catalogue, demo accounts, sample activity
├── schema.sql                  the same schema as SQL tables, constraints and indexes
├── seed.sql                    the same demo data as SQL (generated, no passwords)
├── export-sql.js               regenerates seed.sql from server/seed-catalog.js
└── lib.js                      loads server/.env and the MongoDB driver from server/
```

## SQL edition (`schema.sql`, `seed.sql`)

`schema.sql` creates the whole data model from scratch in PostgreSQL 13+ or SQLite 3.35+:
9 tables with primary keys, foreign keys, `NOT NULL`/`CHECK`/`UNIQUE` constraints matching the
MongoDB validators, and the same indexes. `seed.sql` loads the demo data. Both are idempotent.

```bash
createdb bookaru && psql -d bookaru -f database/schema.sql -f database/seed.sql
sqlite3 bookaru.db < database/schema.sql && sqlite3 bookaru.db < database/seed.sql
```

| MongoDB | SQL |
|---------|-----|
| collection `orderMessages`, `_migrations` | table `order_messages`, `schema_migrations` |
| camelCase field (`passwordHash`, `imageURL`) | snake_case column (`password_hash`, `image_url`) |
| `_id` ObjectId | `id CHAR(24)` (same hex string the API returns) |
| `users.permissions[]` | table `user_permissions (user_id, permission)` |
| `orders.supportStaff { uid, email, name }` | `support_staff_id`, `support_staff_email`, `support_staff_name` |
| TTL index on `sessions.expiresAt` | index on `expires_at`; delete expired rows with a scheduled job |

The demo accounts in `seed.sql` are locked (`password_hash = '!'` is not a valid scrypt hash),
so the file holds no credentials. After changing `server/seed-catalog.js`, run
`npm --prefix server run db:sql` to regenerate `seed.sql`. `server/test/sql.test.js` fails if
`schema.sql` misses a MongoDB field or `seed.sql` is out of date, and loads both into SQLite.

## Commands

Run from the project root. The scripts use the driver installed in `server/node_modules`,
so run `npm --prefix server ci` first.

| Command | Purpose |
|---------|---------|
| `npm --prefix server run db:migrate` | Apply pending migrations |
| `npm --prefix server run db:status` | Show applied / pending migrations |
| `npm --prefix server run db:seed` | Migrate, then load demo data (idempotent) |
| `npm --prefix server run db:sql` | Regenerate `seed.sql` from the catalogue |

Set `SEED_CATALOG_IF_EMPTY=true` on the API to load the starter catalogue automatically when the
database has no books (used by the Render Blueprint and Docker Compose).

Connection settings come from `server/.env` (`MONGODB_URI`, `DB_NAME`) or the environment.

## Collections

| Collection | Key fields | Indexes |
|------------|-----------|---------|
| `users` | `email` (lower-case), `name`, `passwordHash` (scrypt `salt:hash`), `role` (`customer`/`staff`/`admin`), `permissions[]`, `active` | `email` unique |
| `sessions` | `userId` → users, `tokenHash` (SHA-256 of bearer token), `expiresAt` | `tokenHash` unique, `userId`, TTL on `expiresAt` |
| `books` | `name`, `author`, `category`, `genre`, `language`, `price` ≥ 0, `quantity` ≥ 0, `imageURL`, `active` (soft delete), `seedKey` | `seedKey` unique (when set), `active+createdAt`, `category+genre+language` |
| `orders` | `userId`, `bookId`, book snapshot (`name`, `price`, `imageURL`), `quantity` 1–99, `total`, `status`, `shippingAddress`, `supportStaff` | `userId+createdAt`, `createdAt` |
| `orderMessages` | `orderId`, `senderId`, `senderRole`, `text` (≤ 1600) | `orderId+createdAt` |
| `reviews` | `rating` 1–5, `text` (≤ 800), `approved`, `editorial`, `userId` | `seedKey` unique (when set), `approved+createdAt` |
| `popups` | `title`, `imageURL`, `linkURL`, `active`, `startsAt`, `endsAt` | `seedKey` unique (when set), `active+updatedAt` |
| `_migrations` | `_id` = migration id, `appliedAt` | — |

Order `status` values: `new`, `on-call`, `confirmed`, `shipped`, `completed`, `cancelled`.

Validators use `validationLevel: "moderate"`, so documents created before a migration are
not rejected retroactively. The API validates every request as well.

## Adding a migration

1. Create `migrations/00N_short_name.js` exporting `{ id, description, up(db, log) }`.
   `id` must equal the file name without `.js`.
2. Make `up` safe on databases that already contain data.
3. Run `npm --prefix server run db:migrate`, then `npm --prefix server test`.

Never edit a migration that has already been applied to a shared database — add a new one.

## Demo data (`seed.js`)

- 51 books (English, Bangla and themed shelves) and 4 approved editorial reviews.
- Admin, staff and customer accounts — only when `ADMIN_EMAIL` and all three
  `DEMO_*_PASSWORD` variables are set. No password is stored in this repository.
- A sample order with a two-message support conversation, a pending customer review and
  an inactive welcome pop-up.

Every record carries a `seedKey`, so running the seed again does not create duplicates.
Do not run `seed.js` against a live shop; use `npm --prefix server run seed:catalog` there.
