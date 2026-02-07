# Production Readiness Checklist

Use this checklist before and after going live with Mars Kitchen Essentials POS.

---

## 1. Supabase

- [ ] **Project** created at [supabase.com](https://supabase.com) (region chosen for your users).
- [ ] **Schema:** Full `supabase-schema.sql` run in SQL Editor (all 12 tables created).
- [ ] **Migrations:** Any `supabase-migration-*.sql` run if your project didn’t start from the latest schema.
- [ ] **Realtime:** Tables added to `supabase_realtime` publication (schema script does this).
- [ ] **RLS:** Row Level Security enabled; policies allow authenticated users (schema script does this).
- [ ] **Auth:** Email/password (or chosen provider) configured; test user can sign in.

---

## 2. Environment

- [ ] **Local:** `.env` created from `.env.example` with real `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- [ ] **Hosting:** Same variables set in production (and preview if used)—e.g. Vercel/Netlify Environment Variables.
- [ ] **No secrets in repo:** `.env` is in `.gitignore` and never committed.

---

## 3. Build & quality

- [ ] **Install:** `npm install` completes without errors.
- [ ] **Build:** `npm run build` succeeds (TypeScript and Vite).
- [ ] **Lint:** `npm run lint` passes (or known issues documented).
- [ ] **Preview:** `npm run preview` and smoke-test (login, one order, one report).

---

## 4. Deployment

- [ ] **Host:** Project connected to GitHub; build command `npm run build`, output `dist/`.
- [ ] **SPA routing:** All routes serve `index.html` (e.g. `vercel.json` / `netlify.toml` rewrites).
- [ ] **Env in host:** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set for Production (and Preview if needed).
- [ ] **Deploy:** Latest deploy green; no failed builds.

---

## 5. Post-deploy verification

- [ ] **URL:** Production URL loads and shows login (or redirect to login).
- [ ] **Auth:** Sign in works; sign out works.
- [ ] **Sync:** After login, sync indicator shows Synced (or expected state); no persistent errors.
- [ ] **Data:** Create one product, one order; confirm they appear in Supabase Table Editor.
- [ ] **PWA:** “Add to Home Screen” / “Install app” works; app runs in standalone window.
- [ ] **Offline:** With network off, app still opens and POS is usable; after going online, sync resumes.

---

## 6. Operational

- [ ] **Backups:** Supabase backups (or your own) configured and tested.
- [ ] **Users:** Staff have Supabase auth accounts (or SSO if configured).
- [ ] **Settings:** Business name, address, phone, email set in app Settings for receipts.
- [ ] **Docs:** Team has access to README, DEPLOY, SYNC_TROUBLESHOOTING (and this checklist).

---

## 7. Optional hardening

- [ ] **Custom domain:** Configured in host and DNS.
- [ ] **HTTPS:** Enforced (default on Vercel/Netlify).
- [ ] **Supabase:** Auth email templates and redirect URLs updated for production URL.
- [ ] **Monitoring:** Hosting and Supabase dashboards checked for errors after go-live.

---

## Quick reference

| Item | Where |
|------|--------|
| Schema | `supabase-schema.sql` in Supabase SQL Editor |
| Env template | `.env.example` → copy to `.env` and host env |
| Deploy steps | [DEPLOY.md](../DEPLOY.md) |
| Sync issues | [SYNC_TROUBLESHOOTING.md](../SYNC_TROUBLESHOOTING.md) |
| Clear data | `supabase-clear-all-data.sql` (remote); Settings → Clear local data (app) |
