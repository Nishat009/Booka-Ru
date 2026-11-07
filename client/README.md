# Booka-Ru storefront

React 18 single-page app (Create React App, react-router 5, Bootstrap 4 + custom CSS) for
customers and the shop team. It talks only to the [Booka-Ru API](../server/README.md).

Live: https://booka-ru-kappa.vercel.app (mirror: https://booka-ru.onrender.com)

## Run

```bash
npm ci
cp .env.example .env
npm start                                  # http://localhost:3000
npm test -- --watchAll=false               # tests
CI=true npm run build                      # production build in build/ (warnings fail, as on Render)
```

| Variable | Meaning |
|----------|---------|
| `REACT_APP_API_URL` | API address, no trailing slash. Default: `http://localhost:5500` in development, `https://booka-ru-api.onrender.com` in production builds |
| `REACT_APP_GOOGLE_MAPS_API_KEY` | Optional Google Maps embed key; OpenStreetMap is used without it |

`REACT_APP_*` values are baked in at build time — rebuild after changing them. Never put a
secret in them: everything in the bundle is public.

## Pages

| Path | Who | Component |
|------|-----|-----------|
| `/`, `/home` | everyone | `Home` — shelves, search, categories, reviews, map |
| `/login` | everyone | `Login` — sign in / create account |
| `/checkOut/:id`, `/checkOut` | signed in | `CheckOut` — quantity and delivery address |
| `/orderPreview` | signed in | `OrderPreview` — my orders, support chat, invoice download |
| `/thank` | signed in | `ThankYou` |
| `/admin/:section`, `/addBook`, `/manageBook` | staff and admin | `Admin` team desk — books, orders, chat, reviews, pop-ups, team access |

`PrivateRoute` only hides pages in the UI. The API checks the session and permission on every
request, so changing the URL never grants access.

## Structure

```
src/
  api.js           the only place that calls fetch: apiRequest() adds the bearer token and throws ApiError
  App.js           routes and the signed-in user context
  categories.js    shelves and categories
  bookCovers.json  book title -> cover file in public/covers/
  index.css        theme colours as CSS variables (light and dark)
  components/<Name>/<Name>.js (+ <Name>.css)
public/
  covers/          book cover images (sources in covers/sources.json)
```

API errors are shown with the server's own `message`. The session token is kept in
`localStorage` under `bookaru_session`.

## Deploy

- **Render:** the static site in `../render.yaml` (`npm ci && npm run build`, publish `build/`).
- **Vercel:** import the repository with Root Directory `client` and set `REACT_APP_API_URL`.
- **Docker / nginx:** `Dockerfile` builds the app and serves it with `nginx.conf`.

See [HowToSetup.md](../HowToSetup.md) for step-by-step instructions.
