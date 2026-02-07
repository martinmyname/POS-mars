# Mars Kitchen Essentials – POS

**Offline-first Point of Sale, orders, and business management PWA for Mars Kitchen Essentials.**

---

## Summary

Mars Kitchen Essentials POS is a production-ready Progressive Web App (PWA) for retail and kitchen operations. It works **offline-first**: all data is stored locally (IndexedDB) and syncs to Supabase when online. Staff can take orders, manage inventory, track deliveries, run reports, and handle cash sessions on desktop or mobile—including in low-connectivity environments.

| Aspect | Details |
|--------|--------|
| **Type** | Offline-first PWA (React + TypeScript) |
| **Local DB** | RxDB 16 (Dexie/IndexedDB) |
| **Backend / Auth** | Supabase (PostgreSQL, Auth, Realtime) |
| **Deploy** | Static build; host on Vercel, Netlify, or any static host |

---

## Features

- **POS** – Scan/search products, cart, split payment (Cash, MTN MoMo, Airtel Pay), receipts, deposits/layaways, schedule-for-later, backdate orders for historical data
- **Orders & Returns** – Returns, exchanges, repair orders
- **Deliveries** – Assign riders, track payment/delivery status, amount to collect
- **Inventory** – Products (SKU, barcode, categories, pricing), stock levels, adjustments, low-stock awareness
- **Expenses** – Record expenses with date (including past dates for backfill)
- **Cash Management** – Open/close cash drawer, expected vs actual, sessions (including past-date sessions for backfill)
- **Customers** – Customer list (from orders/deliveries/deposits)
- **Suppliers & Ledger** – Suppliers, credit/payment ledger
- **Layaways** – Deposit-based layaway orders
- **Promotions** – Discounts by product/category, date range
- **Reports** – Daily/weekly/monthly sales, trends, period comparison
- **Settings** – Business info (receipts), profile, sync status, clear local data
- **PWA** – Install on phone/tablet, standalone window, offline use, auto-update

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript, Vite 5 |
| **UI** | Tailwind CSS, Radix (Slot), Lucide icons, Recharts (reports) |
| **Local DB** | RxDB 16, Dexie (IndexedDB), RxJS |
| **Sync** | RxDB Supabase replication (pull/push, live) |
| **Backend / Auth** | Supabase (PostgreSQL, Auth, Realtime) |
| **PWA** | vite-plugin-pwa (Workbox, manifest, service worker) |

---

## Architecture

- **Offline-first:** All writes go to local RxDB first. The app is usable without internet.
- **Sync:** When online and signed in, RxDB replicates each collection to the matching Supabase table (bidirectional, live). Conflict resolution is last-write-wins via `_modified`.
- **Auth:** Supabase Auth (email/password). Session is used for API access; RLS on Supabase restricts access to authenticated users.
- **Soft delete:** Documents use `_deleted` and `_modified` for replication and filtering.

---

## Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** (or yarn/pnpm)
- **Supabase** project ([supabase.com](https://supabase.com))

---

## Installation & Setup

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME
npm install
```

### 2. Environment variables

Copy the example env file and set your Supabase credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Get these from **Supabase Dashboard → Project Settings → API** (Project URL and anon/public key). **Do not** commit `.env`; it is in `.gitignore`.

### 3. Supabase database

1. In **Supabase Dashboard → SQL Editor**, run the full **`supabase-schema.sql`** once.  
   This creates all tables, indexes, RLS policies, and Realtime publication.

2. If you have existing migrations (e.g. extra columns), run them in order:
   - `supabase-migration-orders-orderNumber-scheduledFor.sql`
   - `supabase-migration-deliveries-columns.sql`
   (only if your schema doesn’t already include those changes)

3. Ensure **Realtime** is enabled for the tables used by the app (the schema script adds them to `supabase_realtime` publication).

---

## Running the app

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (e.g. http://localhost:5173) |
| `npm run build` | TypeScript check + production build → `dist/` |
| `npm run preview` | Serve `dist/` locally to test build |
| `npm run lint` | Run ESLint |

---

## Project structure

```
pos/
├── public/                 # Static assets (icons, logos)
├── src/
│   ├── components/         # Shared UI (Receipt, SyncStatus, etc.)
│   ├── context/             # AuthContext
│   ├── hooks/               # useRxDB, useSyncStatus, etc.
│   ├── lib/                 # rxdb, supabase, settings, formatUGX
│   ├── pages/               # Route pages (POS, Reports, Settings, …)
│   ├── types/               # Shared TypeScript types
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── supabase-schema.sql      # Full Supabase schema (run once)
├── supabase-migration-*.sql # Optional migrations
├── supabase-clear-all-data.sql  # Optional: truncate all tables
├── .env.example
├── vite.config.ts
├── vercel.json / netlify.toml
└── README.md
```

---

## Production deployment

- **Build:** `npm run build` → output in `dist/`.
- **Host:** Any static host (Vercel, Netlify, Cloudflare Pages, etc.). This repo root is the app root; no subdirectory needed.
- **Env:** Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the host’s environment variables (Production + Preview if you use preview URLs).

Step-by-step guides:

- **[DEPLOY.md](./DEPLOY.md)** – Vercel and Netlify setup, env vars, root directory, and post-deploy notes.
- **[GITHUB_SETUP.md](./GITHUB_SETUP.md)** – Pushing this app to its own GitHub repository.

### Production checklist

- [ ] Supabase project created; schema and migrations applied
- [ ] RLS policies and Realtime enabled for all app tables
- [ ] `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set in hosting env (no `.env` in repo)
- [ ] Build succeeds: `npm run build`
- [ ] Auth and sync tested on deployed URL (login, add order, check Supabase Table Editor)
- [ ] PWA: install from browser and test offline
- [ ] Custom domain (optional) configured in host

A detailed production checklist is in **[docs/PRODUCTION.md](./docs/PRODUCTION.md)**.

---

## Security

- **Secrets:** Only the Supabase **anon (public) key** is used in the frontend. It is safe for client-side use when RLS and Auth are correctly configured. Never expose the **service_role** key in the app.
- **Auth:** All Supabase access is gated by Auth; RLS policies limit rows to the authenticated user (or your chosen policy).
- **.env:** Must not be committed. Use `.env.example` as a template with placeholders.

---

## Data management

### Clearing data for testing

- **Remote (Supabase):** Run **`supabase-clear-all-data.sql`** in the Supabase SQL Editor to truncate all app tables. **This is destructive.**
- **Local (this device):** In the app go to **Settings → Data → “Clear local data & reload”**. This removes local RxDB data and reloads; the app will re-sync from Supabase (empty if you cleared remote first).

### Entering historical data (e.g. January)

- **Expenses:** Use the **Date** field on the Expenses page (default today; change to a past date).
- **Orders:** On POS, check **“Record order for a past date”** and set the order date/time, then complete the sale.
- **Cash sessions:** In Cash Management, check **“Open for a past date”**, choose the session date, open then close the session (use **Close** in Recent Sessions for past-date sessions).

Reports use these dates and `createdAt` for filtering.

---

## Troubleshooting

- **Sync / Realtime:** See **[SYNC_TROUBLESHOOTING.md](./SYNC_TROUBLESHOOTING.md)** for Supabase tables, RLS, Realtime, env vars, and resetting local data.
- **Build errors:** Run `npm run build` and `npm run lint` locally; fix TypeScript and ESLint errors before deploying.
- **Blank or broken deploy:** Confirm env vars are set in the host and that the build output is `dist/` with SPA fallback (e.g. `vercel.json` / `netlify.toml`).

---

## License

Proprietary – Mars Kitchen Essentials. All rights reserved.

---

## Related docs

| Document | Purpose |
|----------|---------|
| [DEPLOY.md](./DEPLOY.md) | Deploy to Vercel, Netlify; env and build notes |
| [GITHUB_SETUP.md](./GITHUB_SETUP.md) | Push this app to a separate GitHub repo |
| [SYNC_TROUBLESHOOTING.md](./SYNC_TROUBLESHOOTING.md) | Sync and Realtime troubleshooting |
| [docs/PRODUCTION.md](./docs/PRODUCTION.md) | Production readiness checklist |
