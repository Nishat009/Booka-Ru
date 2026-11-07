-- Booka-Ru database schema (SQL edition)
--
-- The running application stores its data in MongoDB. The authoritative schema is
-- database/migrations/001_initial_schema.js, which the API applies automatically on start
-- (collections, $jsonSchema validators, indexes). This file describes the SAME data model
-- as portable SQL, so the database can be created from scratch and inspected with any SQL
-- tool, or loaded into a relational database for reporting.
--
-- Tested on PostgreSQL 16 and SQLite 3.45 (server/test/sql.test.js).
--
--   PostgreSQL:  createdb bookaru && psql -d bookaru -f database/schema.sql -f database/seed.sql
--   SQLite:      sqlite3 bookaru.db < database/schema.sql && sqlite3 bookaru.db < database/seed.sql
--
-- Re-running is safe: every statement uses IF NOT EXISTS / ON CONFLICT DO NOTHING.
--
-- Mapping from MongoDB:
--   * collection `orderMessages` -> table `order_messages`; `_migrations` -> `schema_migrations`
--   * camelCase fields -> snake_case columns (passwordHash -> password_hash, imageURL -> image_url)
--   * `_id` (ObjectId) -> `id CHAR(24)`, the same 24-character hex string the API returns
--   * `users.permissions[]` -> table `user_permissions`
--   * `orders.supportStaff { uid, email, name }` -> support_staff_id / _email / _name
--   * the TTL index on `sessions.expiresAt` has no SQL equivalent; delete expired rows with
--     DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP;
--
-- Security: passwords are stored only as scrypt "salt:hash" strings and session tokens only
-- as SHA-256 hashes. Never insert a plain password or a raw token.

-- ---------------------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
    id              CHAR(24)      PRIMARY KEY,
    email           VARCHAR(254)  NOT NULL UNIQUE
                    CHECK (email = lower(email) AND email LIKE '%_@_%._%' AND email NOT LIKE '% %'),
    name            VARCHAR(120),
    password_hash   VARCHAR(255)  NOT NULL,                 -- scrypt "salt:hash" (hex)
    role            VARCHAR(16)   NOT NULL DEFAULT 'customer'
                    CHECK (role IN ('customer', 'staff', 'admin')),
    active          BOOLEAN       NOT NULL DEFAULT TRUE,    -- false = deactivated, cannot sign in
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE
);

-- users.permissions[] in MongoDB. '*' is stored for the administrator (every permission).
CREATE TABLE IF NOT EXISTS user_permissions (
    user_id         CHAR(24)      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    permission      VARCHAR(32)   NOT NULL
                    CHECK (permission IN ('*', 'books:write', 'orders:manage', 'support:handle',
                                          'reviews:moderate', 'users:manage', 'popups:manage')),
    PRIMARY KEY (user_id, permission)
);

CREATE TABLE IF NOT EXISTS sessions (
    id              CHAR(24)      PRIMARY KEY,
    user_id         CHAR(24)      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash      CHAR(64)      NOT NULL UNIQUE,          -- SHA-256 of the bearer token
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at      TIMESTAMP WITH TIME ZONE NOT NULL       -- 7 days after sign-in
);
CREATE INDEX IF NOT EXISTS sessions_user_id    ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at ON sessions (expires_at);

-- ---------------------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS books (
    id              CHAR(24)      PRIMARY KEY,
    seed_key        VARCHAR(80)   UNIQUE,                   -- set only on seeded books
    isbn            VARCHAR(20),
    name            VARCHAR(300)  NOT NULL CHECK (length(name) >= 1),
    author          VARCHAR(200),
    description     TEXT,
    image_url       VARCHAR(1000),
    category        VARCHAR(80),
    genre           VARCHAR(80),
    language        VARCHAR(40),
    price           NUMERIC(10, 2) NOT NULL CHECK (price >= 0),        -- BDT
    quantity        INTEGER       NOT NULL CHECK (quantity >= 0),      -- copies in stock
    active          BOOLEAN       NOT NULL DEFAULT TRUE,    -- false = soft-deleted
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS books_active_created_at       ON books (active, created_at DESC);
CREATE INDEX IF NOT EXISTS books_category_genre_language ON books (category, genre, language);

-- ---------------------------------------------------------------------------------------
-- Orders and support chat
-- ---------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS orders (
    id                   CHAR(24)      PRIMARY KEY,
    seed_key             VARCHAR(80)   UNIQUE,
    user_id              CHAR(24)      NOT NULL REFERENCES users (id),
    email                VARCHAR(254),
    customer_name        VARCHAR(120),
    book_id              CHAR(24)      NOT NULL REFERENCES books (id),
    name                 VARCHAR(300),                      -- book name at order time
    image_url            VARCHAR(1000),
    quantity             INTEGER       NOT NULL CHECK (quantity BETWEEN 1 AND 99),
    price                NUMERIC(10, 2) NOT NULL CHECK (price >= 0),   -- unit price at order time
    total                NUMERIC(12, 2) NOT NULL CHECK (total >= 0),
    status               VARCHAR(16)   NOT NULL DEFAULT 'new'
                         CHECK (status IN ('new', 'on-call', 'confirmed', 'shipped', 'completed', 'cancelled')),
    support_staff_id     CHAR(24)      REFERENCES users (id), -- set when an admin takes the order on call
    support_staff_email  VARCHAR(254),
    support_staff_name   VARCHAR(120),
    shipping_address     VARCHAR(400),
    notes                TEXT,
    created_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS orders_user_id_created_at ON orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_created_at         ON orders (created_at DESC);

CREATE TABLE IF NOT EXISTS order_messages (
    id              CHAR(24)      PRIMARY KEY,
    seed_key        VARCHAR(80)   UNIQUE,
    order_id        CHAR(24)      NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    sender_id       CHAR(24)      NOT NULL REFERENCES users (id),
    sender_name     VARCHAR(120),
    sender_role     VARCHAR(16)   CHECK (sender_role IN ('customer', 'staff', 'admin')),
    text            VARCHAR(1600) NOT NULL CHECK (length(text) BETWEEN 1 AND 1600),
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS order_messages_order_id_created_at ON order_messages (order_id, created_at);

-- ---------------------------------------------------------------------------------------
-- Reviews and promotional pop-ups
-- ---------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS reviews (
    id              CHAR(24)      PRIMARY KEY,
    seed_key        VARCHAR(80)   UNIQUE,
    user_id         CHAR(24)      REFERENCES users (id) ON DELETE SET NULL, -- empty for editorial reviews
    name            VARCHAR(120),
    email           VARCHAR(254),
    rating          INTEGER       NOT NULL CHECK (rating BETWEEN 1 AND 5),
    text            VARCHAR(800)  NOT NULL CHECK (length(text) BETWEEN 1 AND 800),
    approved        BOOLEAN       NOT NULL DEFAULT FALSE,   -- shown on the storefront once approved
    editorial       BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS reviews_approved_created_at ON reviews (approved, created_at DESC);

CREATE TABLE IF NOT EXISTS popups (
    id              CHAR(24)      PRIMARY KEY,
    seed_key        VARCHAR(80)   UNIQUE,
    title           VARCHAR(120),
    image_url       VARCHAR(1000) NOT NULL CHECK (length(image_url) >= 1),
    link_url        VARCHAR(1000),
    active          BOOLEAN       NOT NULL DEFAULT TRUE,
    starts_at       TIMESTAMP WITH TIME ZONE,               -- NULL = no start limit
    ends_at         TIMESTAMP WITH TIME ZONE,               -- NULL = no end limit
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE,
    CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at >= starts_at)
);
CREATE INDEX IF NOT EXISTS popups_active_updated_at ON popups (active, updated_at DESC);

-- ---------------------------------------------------------------------------------------
-- Migration log (MongoDB: `_migrations`)
-- ---------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS schema_migrations (
    id              VARCHAR(100)  PRIMARY KEY,
    description     VARCHAR(300),
    applied_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO schema_migrations (id, description)
VALUES ('001_initial_schema', 'Create collections with validators and indexes')
ON CONFLICT DO NOTHING;
