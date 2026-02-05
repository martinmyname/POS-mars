# Mars Kitchen Essentials – POS (Offline-First PWA)

Standalone offline-first POS, order & expense management app for Mars Kitchen Essentials.

## Stack

- **Frontend:** React 18 + TypeScript (Vite)
- **UI:** Tailwind CSS, lucide-react
- **Local DB:** RxDB 16 (IndexedDB via Dexie) with Supabase replication
- **Backend / Auth:** Supabase (PostgreSQL, Auth, Realtime)
- **PWA:** vite-plugin-pwa (manifest, service worker, offline)

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Environment**
   - Copy `.env.example` to `.env`
   - Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from your [Supabase](https://supabase.com) project (Settings → API).

3. **Supabase tables**
   - Run `supabase-schema.sql` in the Supabase SQL Editor so RxDB can sync.

## Run

- **Dev:** `npm run dev` (Vite dev server, e.g. http://localhost:5173)
- **Build:** `npm run build`
- **Preview build:** `npm run preview`

## Deploy

- **GitHub Setup:** See [GITHUB_SETUP.md](./GITHUB_SETUP.md) for pushing to a separate GitHub repository
- **Hosting:** See [DEPLOY.md](./DEPLOY.md) for deploying to Vercel, Netlify, or other platforms
