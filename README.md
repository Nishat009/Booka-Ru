<div align="center">

<img src="docs/covers/thumbnail.png" alt="Booka-Ru Logo" width="120" />

# 📚 Booka-Ru

**An online bookshop for English & Bangla books, based in Dhaka.**

[![Live Demo](https://img.shields.io/badge/🌐_Storefront-Vercel-black?style=for-the-badge)](https://booka-ru-kappa.vercel.app)
[![API](https://img.shields.io/badge/🔌_API-Render-46E3B7?style=for-the-badge)](https://booka-ru-api.onrender.com)
[![Node](https://img.shields.io/badge/Node.js-22+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com)
[![Version](https://img.shields.io/badge/version-1.0.3-blue?style=for-the-badge)](CHANGELOG.md)

</div>

---

## ✨ What is Booka-Ru?

Booka-Ru is a full-stack e-commerce platform where customers can:

- 🛒 Browse and search an English & Bangla book catalogue
- 🛍️ Place orders and view order history
- 💬 Chat with the shop about an order
- 📄 Download a **PDF invoice** for every order

The shop team manages everything from a **role-based Team Desk**:

- 📖 Add / edit books and cover images
- 📦 Manage orders and their statuses
- 🎉 Create promotional pop-ups
- 🛡️ Moderate reviews and handle support chats
- 👥 Grant and revoke staff permissions

---

## 🏗️ Architecture

```
Booka-Ru/
├── client/        → React 18 storefront + Team Desk (Bootstrap 4)
├── server/        → Express 4 REST API  (Node.js 22, MongoDB 7, PDFKit)
├── database/      → Migrations, schema.sql, seed data
├── docs/          → Cover images & screenshots
└── docker-compose.yml
```

| Layer | Tech |
|---|---|
| Frontend | React 18, React Router 5, Bootstrap 4 |
| Backend | Node.js 22, Express 4 |
| Database | MongoDB 7 (+ portable SQL schema for PostgreSQL / SQLite) |
| PDF | PDFKit |
| Auth | scrypt-hashed passwords · SHA-256 session tokens |
| Deployment | Render (API) · Vercel (storefront) · Docker Compose |

---

## 🌐 Live Demo

| | URL |
|---|---|
| 🌍 Storefront | [booka-ru-kappa.vercel.app](https://booka-ru-kappa.vercel.app) |
| 🌍 Storefront (Render mirror) | [booka-ru.onrender.com](https://booka-ru.onrender.com) |
| 🔌 API | [booka-ru-api.onrender.com](https://booka-ru-api.onrender.com) |

> [!NOTE]
> The API runs on Render's **free plan**. The first request after an idle period can take up to a minute while the server wakes up. Admin and staff credentials for reviewers are shared privately — never committed to this repository.

---

## 🚀 Quick Start

### 🐳 Docker (recommended — needs only Docker)

```bash
cp .env.docker.example .env        # fill in ADMIN_EMAIL
docker compose up -d --build       # → http://localhost:8080
```

### 🟢 Node.js 22 + MongoDB 7

```bash
# 1. Install dependencies
npm --prefix server ci
npm --prefix client ci

# 2. Set up environment
cp server/.env.example server/.env   # set MONGODB_URI and ADMIN_EMAIL
cp client/.env.example client/.env

# 3. Seed the database with the demo catalogue
npm --prefix server run db:seed

# 4. Start both servers
npm --prefix server run dev          # API  → http://localhost:5500
npm --prefix client start            # App  → http://localhost:3000
```

For VPS, Render, and Vercel deployment: see [HowToSetup.md](HowToSetup.md).

---

## 🗄️ Database

Booka-Ru runs on **MongoDB 7**. Versioned migrations create the schema automatically — the API also applies any pending migrations every time it starts.

| File | Purpose |
|---|---|
| [`database/migrations/`](database/migrations) | Live schema: collections, JSON-Schema validators, indexes |
| [`database/schema.sql`](database/schema.sql) | Same data model as portable SQL (PostgreSQL 13+ / SQLite 3.35+) |
| [`database/seed.js`](database/seed.js) | Demo data for MongoDB: 51 books, reviews, demo accounts, sample order & chat |
| [`database/seed.sql`](database/seed.sql) | Same demo data as SQL (no passwords) |

```bash
# MongoDB
npm --prefix server run db:migrate   # apply pending migrations
npm --prefix server run db:status    # show applied / pending
npm --prefix server run db:seed      # migrations + demo data (idempotent)

# SQL (PostgreSQL / SQLite)
psql -d bookaru -f database/schema.sql -f database/seed.sql
```

---

## 🔐 Accounts & Permissions

| Role | How to get it |
|---|---|
| **Customer** | Self-register with email + password |
| **Administrator** | The account whose email matches `ADMIN_EMAIL` env var |
| **Staff** | Created by the admin in Team Desk → Team Access |

Staff permissions (admin can grant any; staff can only grant what they already hold):

| Permission | What it unlocks |
|---|---|
| `books:write` | Add, edit, delete books |
| `orders:manage` | Update order statuses |
| `support:handle` | Reply to support chats |
| `reviews:moderate` | Approve or delete reviews |
| `users:manage` | Manage customer accounts |
| `popups:manage` | Create and schedule promotional pop-ups |

> [!IMPORTANT]
> Every permission check runs **server-side**. Hiding a UI button is not a security boundary. A server test enforces authentication and authorization on every mutating route.

**Session security:** passwords hashed with **scrypt** (random salt); sessions are random bearer tokens stored only as SHA-256 hashes and expire after **7 days**.

---

## 🧪 Tests & Checks

```bash
# API tests (no DB required)
npm --prefix server test

# Storefront tests
npm --prefix client test -- --watchAll=false

# Production build (lint warnings are treated as errors)
CI=true npm --prefix client run build

# Dependency audit
npm --prefix server audit --omit=dev
npm --prefix client audit --omit=dev

# End-to-end demo flow (needs the API running + demo passwords set)
npm --prefix server run verify:demo-flow
```

---

## 🔒 Security

- ✅ No secrets committed — config comes from `.env` files (see `*.env.example` templates)
- ✅ Demo passwords come only from `DEMO_*_PASSWORD` environment variables
- ✅ `ENABLE_DEMO_LOGINS` is ignored when `NODE_ENV=production`
- ✅ All dependency versions pinned; `npm audit --omit=dev` is clean for both apps

---

## 📂 Repository Layout

```
Booka-Ru/
├── client/
│   ├── src/
│   │   ├── components/     → Reusable UI components
│   │   ├── Landing.js      → Public landing page  (/)
│   │   ├── Shop.js         → Storefront           (/home)
│   │   ├── Admin.js        → Team Desk
│   │   ├── Login.js        → Auth page
│   │   └── api.js          → API client
│   └── package.json
├── server/
│   ├── index.js            → Express app + route mounting
│   ├── invoice.js          → PDF invoice generator
│   ├── seed-catalog.js     → Catalogue seeder
│   ├── seed-demo-accounts.js
│   ├── verify-demo-flow.js → E2E script
│   └── test/
│       ├── schema.test.js
│       └── sql.test.js
├── database/
│   ├── migrations/         → Versioned MongoDB migrations
│   ├── schema.sql          → Portable SQL schema
│   ├── seed.js
│   └── seed.sql
├── docs/covers/            → Marketplace cover images
├── docker-compose.yml
├── render.yaml             → Render Blueprint
├── HowToSetup.md
├── CHANGELOG.md
└── CLAUDE.md               → Architecture guide for AI coding tools
```

---

## 📖 Documentation

| Document | Contents |
|---|---|
| [HowToSetup.md](HowToSetup.md) | Local dev, Docker, VPS, Render, Vercel — step by step |
| [server/README.md](server/README.md) | Full API reference: endpoints, permissions, error codes |
| [client/README.md](client/README.md) | Storefront pages, env variables, build & deploy |
| [database/README.md](database/README.md) | Collections, indexes, migrations, SQL schema |
| [CLAUDE.md](CLAUDE.md) | Architecture, folder map & conventions for AI coding tools |
| [CHANGELOG.md](CHANGELOG.md) | Full version history |

---

## 📜 Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full version history. This project follows [Semantic Versioning](https://semver.org/) and [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

<div align="center">

Made with ❤️ in Dhaka &nbsp;·&nbsp; Booka-Ru v1.0.3

</div>
