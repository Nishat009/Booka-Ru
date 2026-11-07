# Booka-Ru API

Express 4 API on Node.js 22 with the official MongoDB driver. All routes live in
[`index.js`](index.js); the PDF invoice is built in [`invoice.js`](invoice.js).

## Run

```bash
npm ci
cp .env.example .env       # set MONGODB_URI and ADMIN_EMAIL
npm run db:seed            # optional: schema + demo data
npm run dev                # http://localhost:5500 (nodemon)
npm start                  # production
npm test                   # node:test, no database needed
```

| Variable | Required | Meaning |
|----------|----------|---------|
| `MONGODB_URI` | yes | MongoDB connection string |
| `DB_NAME` | no (`bookDB`) | Database name |
| `PORT` | no (`5500`) | HTTP port |
| `ADMIN_EMAIL` | yes | The account with this email is the administrator |
| `NODE_ENV` | production | `production` always disables demo logins |
| `ENABLE_DEMO_LOGINS` | no (`false`) | One-click demo logins, development only |
| `SEED_CATALOG_IF_EMPTY` | no (`false`) | Load the starter catalogue on start when there are no books |
| `DEMO_ADMIN_PASSWORD`, `DEMO_STAFF_PASSWORD`, `DEMO_CUSTOMER_PASSWORD` | demo only | Passwords for `npm run seed:demo` / `db:seed` |

On start the API applies pending database migrations (`../database/migrations`).

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run db:migrate` / `db:status` | Apply / list database migrations |
| `npm run db:seed` | Migrations + full demo dataset |
| `npm run db:sql` | Regenerate `database/seed.sql` |
| `npm run seed:catalog` | Starter catalogue and editorial reviews only (safe on a live shop) |
| `npm run seed:demo` | Demo admin, staff and customer accounts from `DEMO_*_PASSWORD` |
| `npm run verify:demo-flow` | End-to-end check against a running API |

## Responses

Every success is HTTP 200:

```json
{ "success": true, "message": "Order placed. You can follow it in My orders.", "data": { } }
```

Every validation or permission failure is HTTP 422 with stable, UPPER_SNAKE_CASE codes:

```json
{ "success": false, "errors": [{ "code": "QUANTITY_INVALID", "message": "Choose between 1 and 99 copies.", "field": "quantity" }] }
```

Unexpected errors return HTTP 500 with code `SERVER_ERROR`. The only non-JSON success is the
invoice PDF.

## Authentication

`POST /auth/login` returns `{ token, user }`. Send the token as `Authorization: Bearer <token>`.
Tokens are random 32-byte values, stored only as SHA-256 hashes, and expire after 7 days.
Passwords are hashed with scrypt and a random salt; they must be 8+ characters with a number.

Authentication errors: `AUTH_REQUIRED`, `SESSION_EXPIRED`, `ACCOUNT_NOT_FOUND`,
`ACCOUNT_DEACTIVATED`. Permission errors: `FORBIDDEN`, `ADMIN_ONLY`.

## Roles and permissions

| Role | Access |
|------|--------|
| customer | Own orders, own support chat, write reviews |
| staff | Only the permissions granted: `books:write`, `orders:manage`, `support:handle`, `reviews:moderate`, `users:manage`, `popups:manage` |
| admin | The account whose email equals `ADMIN_EMAIL`; every permission |

## Endpoints

Auth column: **public** = no token; **signed in** = any active account; otherwise the
permission required (the administrator always passes).

### Accounts

| Method | Path | Auth | Body / query | Notes |
|--------|------|------|--------------|-------|
| GET | `/` | public | | Health check |
| POST | `/auth/register` | public | `name`, `email`, `password` | Creates a customer. `NAME_REQUIRED`, `EMAIL_INVALID`, `PASSWORD_WEAK`, `EMAIL_TAKEN` |
| POST | `/auth/login` | public | `email`, `password` | `INVALID_CREDENTIALS`, `ACCOUNT_DEACTIVATED` |
| POST | `/auth/demo-login/:role` | public | | `admin`/`staff`/`customer`; only when `ENABLE_DEMO_LOGINS=true` and not production (`DEMO_DISABLED`) |
| GET | `/auth/me` | signed in | | Current account |
| POST | `/auth/logout` | signed in | | Ends this session |

### Books

| Method | Path | Auth | Body / query | Notes |
|--------|------|------|--------------|-------|
| GET | `/books` | public | `?category`, `?genre`, `?language`, `?q` | Active books, newest first |
| GET | `/books/:id` | public | | `BOOK_ID_INVALID`, `BOOK_NOT_FOUND` |
| POST | `/books` | `books:write` | `name`, `price`, `quantity`, `author`, `description`, `imageURL`, `category`, `genre`, `language` | `BOOK_NAME_REQUIRED`, `BOOK_PRICE_INVALID`, `BOOK_QUANTITY_INVALID` |
| PUT | `/books/:id` | `books:write` | same as POST | |
| DELETE | `/books/:id` | `books:write` | | Soft delete (`active: false`) |

### Orders and support chat

| Method | Path | Auth | Body / query | Notes |
|--------|------|------|--------------|-------|
| POST | `/orders` | signed in | `bookId`, `quantity` (1–99), `shippingAddress` | Stock is reduced atomically. `OUT_OF_STOCK`, `ADDRESS_REQUIRED` |
| GET | `/orders` | signed in | `?mine=1` | Own orders; every order for `orders:manage` / `support:handle` |
| PATCH | `/orders/:id` | `orders:manage` | `status` | `new`, `on-call` (admin only), `confirmed`, `shipped`, `completed`, `cancelled` |
| GET | `/orders/:id/messages` | signed in | | Order owner or admin. `CHAT_NOT_ASSIGNED` |
| POST | `/orders/:id/messages` | signed in | `text` (≤ 1600) | Order owner or admin. `MESSAGE_EMPTY` |
| GET | `/orders/:id/invoice` | signed in | | PDF. Order owner, `orders:manage` or `support:handle`. `INVOICE_FORBIDDEN` |

### Reviews

| Method | Path | Auth | Body | Notes |
|--------|------|------|------|-------|
| GET | `/reviews` | public | | 12 latest approved reviews |
| POST | `/reviews` | signed in | `rating` (1–5), `text` (≤ 800) | Waits for moderation |
| GET | `/admin/reviews` | `reviews:moderate` | | All reviews |
| PATCH | `/admin/reviews/:id` | `reviews:moderate` | `approved` | Approve or hide |

### Pop-ups

| Method | Path | Auth | Body | Notes |
|--------|------|------|------|-------|
| GET | `/popups/active` | public | | The pop-up visitors should see now, or `null` |
| GET | `/admin/popups` | `popups:manage` | | |
| POST | `/admin/popups` | `popups:manage` | `title`, `imageURL`, `linkURL`, `active`, `startsAt`, `endsAt` | `POPUP_IMAGE_INVALID`, `POPUP_LINK_INVALID`, `POPUP_DATES_INVALID` |
| PUT | `/admin/popups/:id` | `popups:manage` | same as POST | |
| PATCH | `/admin/popups/:id` | `popups:manage` | `active` | Show or hide |
| DELETE | `/admin/popups/:id` | `popups:manage` | | |

### Team access

| Method | Path | Auth | Body | Notes |
|--------|------|------|------|-------|
| GET | `/admin/users` | `users:manage` | | Admin sees everyone; team managers see staff only |
| PUT | `/admin/users/:uid` | `users:manage` | `name`, `email`, `password`, `role`, `permissions[]` | `:uid` = `new` to create. Staff can only grant permissions they hold; only the admin grants `users:manage`, resets passwords or edits the admin (`GRANT_FORBIDDEN`, `PASSWORD_RESET_ADMIN_ONLY`, `ADMIN_PROTECTED`) |
| PATCH | `/admin/users/:uid/status` | admin only | `active` | Deactivating also signs the account out. `SELF_DEACTIVATE`, `ADMIN_PROTECTED` |

## Tests

`npm test` runs [`test/`](test) with Node's built-in runner:

- every collection used by the API has a validator and indexes;
- unique login emails and session tokens, sessions expire;
- **every mutating route except sign-up and sign-in starts with `authenticate`**, and admin and
  book routes also check a permission;
- `database/schema.sql` covers every MongoDB field, `seed.sql` is current and loads into SQLite;
- the invoice renders a PDF.
