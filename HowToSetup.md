# How to set up Booka-Ru

Booka-Ru is a bookshop with two parts:

| Part | Folder | What it is | Default port |
|------|--------|------------|--------------|
| API | `server/` | Node.js 22 + Express, stores data in MongoDB | 5500 |
| Storefront | `client/` | React app, built into static files | 3000 in development |
| Database | `database/` | MongoDB migrations and demo seed | 27017 |

This guide covers four ways to run it:

1. [Local development](#1-local-development)
2. [Docker (one command, any machine)](#2-docker)
3. [VPS (Ubuntu server with nginx and HTTPS)](#3-vps-ubuntu-2204--2404)
4. [Render (managed hosting)](#4-render)

After that: [database setup](#5-database-setup), [first admin login](#6-first-admin-login), [branding](#7-branding-changes) and [troubleshooting](#8-troubleshooting).

---

## Requirements

- **Node.js 22** (see `.nvmrc`) and npm 10 or newer — not needed for Docker.
- **MongoDB 7** or newer: a local install, the Docker image, or a free MongoDB Atlas cluster.
- Git.

---

## 1. Local development

```bash
git clone <your-repo-url> Booka-Ru
cd Booka-Ru

npm --prefix server ci
npm --prefix client ci

cp server/.env.example server/.env
cp client/.env.example client/.env
```

Edit `server/.env`:

| Variable | Example | Meaning |
|----------|---------|---------|
| `MONGODB_URI` | `mongodb://127.0.0.1:27017` | MongoDB connection string |
| `DB_NAME` | `bookDB` | Database name |
| `ADMIN_EMAIL` | `you@yourshop.com` | This email becomes the administrator |
| `ENABLE_DEMO_LOGINS` | `false` | `true` shows one-click demo logins (development only) |
| `SEED_CATALOG_IF_EMPTY` | `false` | `true` loads the 51-book starter catalogue on start when the database has no books |
| `DEMO_*_PASSWORD` | your own values | Only for the demo seed. 8+ characters with a number |

`client/.env` only needs `REACT_APP_API_URL=http://localhost:5500`.

Create the database and load demo data, then start both apps in two terminals:

```bash
npm --prefix server run db:seed      # schema + 51 books + demo accounts + sample order

npm --prefix server run dev          # API on http://localhost:5500
npm --prefix client start            # storefront on http://localhost:3000
```

Run the tests:

```bash
npm --prefix server test
npm --prefix client test -- --watchAll=false
```

---

## 2. Docker

Needs Docker Engine 24+ with the Compose plugin. Compose starts three containers: `mongo`, `api` and `web` (nginx).

```bash
git clone <your-repo-url> Booka-Ru
cd Booka-Ru
cp .env.docker.example .env
```

Edit `.env`:

- `ADMIN_EMAIL` — the administrator's email (required).
- `PUBLIC_API_URL` — the API address as a visitor's browser sees it. Keep `http://localhost:5500` on your own computer; on a server use `https://api.your-domain.com`.
- `DEMO_*_PASSWORD` — optional, only if you want demo accounts.

Start everything:

```bash
docker compose up -d --build
docker compose exec api npm run db:seed     # optional: catalogue and demo data
docker compose ps                           # all three should be "running"/"healthy"
```

Open **http://localhost:8080** (storefront) and **http://localhost:5500** (API, returns `{"success":true,...}`).

Useful commands:

```bash
docker compose logs -f api                  # API logs
docker compose exec api npm run db:status   # applied migrations
docker compose down                         # stop (data stays in the mongo-data volume)
docker compose down -v                      # stop and DELETE all data
```

`PUBLIC_API_URL` is baked into the storefront at build time. After changing it run `docker compose up -d --build web`.

**Backups:**

```bash
docker compose exec mongo mongodump --archive --gzip --db bookDB > backup-$(date +%F).gz
docker compose exec -T mongo mongorestore --archive --gzip < backup-2026-11-07.gz
```

---

## 3. VPS (Ubuntu 22.04 / 24.04)

Example layout: storefront at `https://shop.example.com`, API at `https://api.example.com`. Point both DNS A records to the server first.

### 3.1 Install Node.js, MongoDB, nginx and PM2

```bash
sudo apt update && sudo apt install -y git nginx curl gnupg

# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

# MongoDB 7 (official repository)
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update && sudo apt install -y mongodb-org
sudo systemctl enable --now mongod
```

MongoDB listens on `127.0.0.1` only by default — keep it that way. (Using MongoDB Atlas instead? Skip the MongoDB install and put the Atlas URI in `MONGODB_URI`.)

### 3.2 Get the code and configure

```bash
sudo mkdir -p /var/www && sudo chown $USER /var/www
git clone <your-repo-url> /var/www/booka-ru
cd /var/www/booka-ru

npm --prefix server ci --omit=dev
npm --prefix client ci

cp server/.env.example server/.env
nano server/.env
```

`server/.env` on the VPS:

```
PORT=5500
MONGODB_URI=mongodb://127.0.0.1:27017
DB_NAME=bookDB
ADMIN_EMAIL=you@yourshop.com
ENABLE_DEMO_LOGINS=false
NODE_ENV=production
```

### 3.3 Create the database

```bash
npm --prefix server run db:migrate      # collections, validators, indexes
npm --prefix server run seed:catalog    # starter catalogue (optional)
```

Use `db:seed` instead of `seed:catalog` only on a demo server — it also adds demo accounts and a sample order.

### 3.4 Start the API with PM2

```bash
cd /var/www/booka-ru/server
pm2 start index.js --name booka-ru-api
pm2 save
pm2 startup            # run the command it prints, so the API restarts after a reboot
```

### 3.5 Build the storefront

```bash
cd /var/www/booka-ru/client
echo "REACT_APP_API_URL=https://api.example.com" > .env
npm run build          # output in client/build
```

### 3.6 nginx

Create `/etc/nginx/sites-available/booka-ru`:

```nginx
server {
    server_name shop.example.com;
    root /var/www/booka-ru/client/build;
    index index.html;
    location /static/ { add_header Cache-Control "public, max-age=31536000, immutable"; try_files $uri =404; }
    location / { try_files $uri $uri/ /index.html; }
}

server {
    server_name api.example.com;
    client_max_body_size 2m;
    location / {
        proxy_pass http://127.0.0.1:5500;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/booka-ru /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# HTTPS
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d shop.example.com -d api.example.com

# Firewall: only SSH and web traffic
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

### 3.7 Updating

```bash
cd /var/www/booka-ru && git pull
npm --prefix server ci --omit=dev && pm2 restart booka-ru-api   # migrations run on start
npm --prefix client ci && npm --prefix client run build
```

---

## 4. Render

`render.yaml` is a Render Blueprint with two services: `booka-ru-api` (Express API) and `booka-ru` (static React site).

1. Create a free MongoDB Atlas cluster. Under **Network Access** allow `0.0.0.0/0` (Render's outbound IPs change). Create a database user and copy the connection string.
2. In Render choose **New → Blueprint**, pick this repository, and fill in the prompted values:
   - `MONGODB_URI` — the Atlas connection string.
   - `ADMIN_EMAIL` — the email that becomes the administrator on sign-up.
   - `REACT_APP_API_URL` — the API's public URL, e.g. `https://booka-ru-api.onrender.com` (no trailing slash).
   - `REACT_APP_GOOGLE_MAPS_API_KEY` — optional; leave empty for OpenStreetMap.
3. Deploy. On its first start the API creates the collections and indexes, and — because the Blueprint sets `SEED_CATALOG_IF_EMPTY=true` — loads the 51-book starter catalogue into the empty database. Set it to `false` if you want to start with an empty shop.
4. Open the storefront and sign up with `ADMIN_EMAIL` to become the administrator.

Already deployed the API by hand? Add `SEED_CATALOG_IF_EMPTY=true` under **Environment** and redeploy, or seed once from your machine: `MONGODB_URI="<atlas uri>" npm --prefix server run seed:catalog`.

If the API URL changes, update `REACT_APP_API_URL` and redeploy the static site — the value is baked in at build time. The free API instance sleeps when idle, so the first request after a pause can take up to a minute.

### Storefront on Vercel (optional)

The storefront can also be hosted on Vercel, using the API on Render:

1. **Add New → Project**, import the repository, set **Root Directory** to `client` (framework preset *Create React App* is detected).
2. Add the environment variable `REACT_APP_API_URL=https://booka-ru-api.onrender.com`.
3. Deploy. Vercel serves `index.html` for client-side routes such as `/login` automatically.

---

## 5. Database setup

Booka-Ru uses **MongoDB**, so the schema is a set of migration scripts instead of an SQL file. Everything lives in [`database/`](database/README.md).

| Command (run from the project root) | What it does |
|------|------|
| `npm --prefix server run db:migrate` | Creates the 7 collections with JSON-schema validators and all indexes. Safe to run again. |
| `npm --prefix server run db:status` | Lists applied and pending migrations. |
| `npm --prefix server run db:seed` | Migrations + 51 books + 4 editorial reviews + demo accounts + sample order, chat and review. |
| `npm --prefix server run seed:catalog` | Only the book catalogue and editorial reviews. |

The API also applies pending migrations every time it starts, so a brand-new empty database works without any manual step.

Collections: `users`, `sessions`, `books`, `orders`, `orderMessages`, `reviews`, `popups` (plus `_migrations`, which records applied migrations). The full field list is in [database/README.md](database/README.md).

**SQL edition.** [`database/schema.sql`](database/schema.sql) and [`database/seed.sql`](database/seed.sql) describe the same tables, constraints, indexes and demo data in portable SQL (PostgreSQL 13+ or SQLite 3.35+). The app itself does not use them; they are for reviewing the data model, reporting, or loading the data into a relational database:

```bash
createdb bookaru && psql -d bookaru -f database/schema.sql -f database/seed.sql
# or
sqlite3 bookaru.db < database/schema.sql && sqlite3 bookaru.db < database/seed.sql
```

`seed.sql` is generated from the catalogue with `npm --prefix server run db:sql`; the demo accounts in it are locked and contain no passwords.

---

## 6. First admin login

There is no default password in the code. The administrator is whoever owns `ADMIN_EMAIL`.

**Option A — sign up (production):**

1. Set `ADMIN_EMAIL` in `server/.env` (or `.env` for Docker) and restart the API.
2. Open the storefront, click **Sign in → Create account**, and register with exactly that email and a strong password (8+ characters with a number).
3. You are now the administrator. Open **Team desk** in the header to manage books, orders, reviews, pop-ups and the team.

**Option B — seeded demo accounts (demo/staging only):**

1. Set `ADMIN_EMAIL`, `DEMO_ADMIN_PASSWORD`, `DEMO_STAFF_PASSWORD` and `DEMO_CUSTOMER_PASSWORD`.
2. Run `npm --prefix server run db:seed`.
3. Sign in with:

| Role | Email | Password |
|------|-------|----------|
| Admin | your `ADMIN_EMAIL` | `DEMO_ADMIN_PASSWORD` |
| Staff | `bookaru.staff.test@example.com` | `DEMO_STAFF_PASSWORD` |
| Customer | `bookaru.customer.test@example.com` | `DEMO_CUSTOMER_PASSWORD` |

**Adding staff:** in **Team desk → Team access**, create an account with a temporary password and tick the permissions it needs (`books:write`, `orders:manage`, `support:handle`, `reviews:moderate`, `users:manage`, `popups:manage`). The API checks every permission; hiding a button is not the only protection.

---

## 7. Branding changes

| What | Where |
|------|-------|
| Shop name in the browser tab and search results | `client/public/index.html` (`<title>`, `<meta name="description">`) |
| App name for "Add to home screen" | `client/public/manifest.json` (`name`, `short_name`, `theme_color`) |
| Favicon / app icons | Replace `client/public/favicon.ico`, `logo192.png` and `logo512.png` |
| Header logo and name | `client/src/components/Header/Header.js` (`brand-mark` letter and the name next to it) |
| Footer text, map and shop location | `client/src/components/Home/Home.js` (footer block and `location-section`) |
| Colours (light and dark mode) | CSS variables at the top of `client/src/index.css` — e.g. `--burgundy`, `--cherry`, `--cream`, `--ink` |
| Book categories and shelves | `client/src/categories.js` |
| Book cover images | `client/public/covers/` (map of title → file in `client/src/bookCovers.json`) |
| Invoice name, colours, currency and footer | `server/invoice.js` (`Booka-Ru` strings, `colors`, the `money` formatter that prints `BDT`) |
| Map | Set `REACT_APP_GOOGLE_MAPS_API_KEY` for Google Maps; otherwise OpenStreetMap is used |
| Starter catalogue | `server/seed-catalog.js` |

Rebuild the storefront after any change in `client/` (`npm run build`, or `docker compose up -d --build web`) and restart the API after changing `server/invoice.js`.

---

## 8. Troubleshooting

| Problem | Fix |
|---------|-----|
| `MONGODB_URI must be set` | Create `server/.env` from `server/.env.example`. |
| Storefront shows "The server could not be reached" | `REACT_APP_API_URL` / `PUBLIC_API_URL` is wrong, or the API is not running. Rebuild the storefront after fixing it. |
| Admin menu missing after sign-up | The email does not exactly match `ADMIN_EMAIL`, or the API was not restarted after setting it. |
| `Skipped validator ... collMod privilege` in the log | Your MongoDB user only has `readWrite`. The app works; give it `dbAdmin` and run `db:migrate` again to add the validators. |
| Atlas connection times out | Add the server's IP (or `0.0.0.0/0`) to the Atlas network access list. |
| Demo login buttons do nothing | They are disabled unless `ENABLE_DEMO_LOGINS=true`, and always disabled when `NODE_ENV=production`. |
