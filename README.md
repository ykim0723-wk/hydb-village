# HYDB · The Village

Third-person medieval village storefront for Have You Died Before. Static game (`public/index.html`, three.js) plus three Vercel functions.

## Deploy (Vercel)
1. Import this repo in Vercel. Framework preset: **Other**. Build settings come from `vercel.json` (the build downloads the 3D models listed in `assets.json`).
2. Add environment variables (Project → Settings → Environment Variables):

| Name | What it is |
| --- | --- |
| `SESSION_SECRET` | Any long random string. Signs guest passes. |
| `SHOPIFY_STORE_DOMAIN` | The store's `xxxx.myshopify.com` domain. |
| `SHOPIFY_ADMIN_TOKEN` | Admin API access token from a custom app with **read_orders** (and read_products) scope. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | From Vercel → Storage → Upstash Redis (the `KV_REST_API_*` names also work). Stores points, room tiers, rate limits. |
| `PUBLIC_STORE_URL` | Optional. Defaults to `https://haveyoudiedbefore.online`. |
| `SHOPIFY_API_VERSION` | Optional. Defaults to `2026-07`. |

3. Redeploy after adding variables.
4. Domain: add a subdomain such as `village.haveyoudiedbefore.online` under Project → Domains and create the CNAME it shows in your DNS (keep the root domain on Shopify).

## What runs where
- `api/catalog.js`: live product list from the public storefront (`/products.json`). Falls back to `public/catalog.fallback.json`.
- `api/verify-order.js`: order number + email → Shopify Admin GraphQL. Returns the product handles in the order and a signed guest pass. 8 tries per IP per 10 min.
- `api/points.js`: 1 point per 10 active seconds, credited from real elapsed time between heartbeats (max 45 s gap), nothing while AFK (2 min idle). Room upgrades are paid here.

Without the Shopify/Redis variables the game still runs: order checking drops to a format check ("test mode") and points stay in the browser.

## Assets
3D shopkeepers were generated with Higgsfield (Meshy v7, rigged). To swap one, change its URL in `assets.json` and redeploy. `avatar-base.glb` is the unisex base body for the fitting room (not wired in yet).
