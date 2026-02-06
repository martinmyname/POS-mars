# Deploy Mars Kitchen Essentials POS to GitHub & Host Online

## 1. Push to GitHub

If the repo is already connected to GitHub, from the **project root** (one level above `pos`):

```bash
cd c:\Users\Dell\Downloads\eMars\MarsKitchenEssentialsEcommerce
git add .
git status
# Ensure .env is NOT listed (it must be ignored)
git commit -m "POS: add deploy config and docs"
git push origin main
```

If you haven’t created a GitHub repo yet:

1. Go to [github.com/new](https://github.com/new).
2. Create a new repository (e.g. `MarsKitchenEssentials` or `MarsKitchenEssentialsEcommerce`).
3. Do **not** add a README if you already have local files.
4. In your project folder (parent of `pos`):

```bash
cd c:\Users\Dell\Downloads\eMars\MarsKitchenEssentialsEcommerce
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

**Important:** Never commit `.env`. It should be in `.gitignore`. Use `.env.example` only as a template (with placeholder or fake values).

---

## 2. Host the POS online (Vercel – recommended)

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. **Add New Project** → import your GitHub repo.
3. **Configure:**
   - **Root Directory:** click **Edit** and set to `pos` (so Vercel builds only the POS app).
   - **Framework Preset:** Vite (auto-detected).
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. **Environment variables** (Settings → Environment Variables for the project):
   - `VITE_SUPABASE_URL` = your Supabase project URL (Settings → API in Supabase).
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon/public key.
5. Click **Deploy**. Your app will be at `https://your-project.vercel.app`.

---

## 3. Alternative: Netlify

1. Go to [netlify.com](https://netlify.com) and sign in with GitHub.
2. **Add new site** → **Import an existing project** → choose your repo.
3. **Build settings:**
   - **Base directory:** `pos`
   - **Build command:** `npm run build`
   - **Publish directory:** `pos/dist`
4. **Environment variables** (Site settings → Environment variables):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy. Your app will be at `https://your-site-name.netlify.app`.

---

## 4. If deploy fails

- **Build logs:** In Vercel or Netlify, open the latest deploy and check the **build logs** for the exact error.
- **Root directory:** This repo root is the POS app. Do **not** set “Root Directory” to `pos` (leave blank or `.`).
- **Env vars:** Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the host’s Environment Variables. Without them the app may build but auth/sync will not work.
- **Build locally:** Run `npm run build` in the project root. If it fails locally, fix that first (e.g. TypeScript or lint errors).
- **Node version:** Vercel/Netlify use Node 18 by default. The repo has `vercel.json` and `netlify.toml` with build command and output so no extra config is needed.

## 5. After deployment

- Use the hosted URL to open the POS in a browser; it works on desktop and mobile.
- Auth and data sync use the same Supabase project as in your `.env`; keep the anon key public and restrict access in Supabase (RLS, auth) if needed.
- For a custom domain, set it in your host’s dashboard (Vercel or Netlify).
