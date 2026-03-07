# Sync Troubleshooting Guide

If items aren't syncing to Supabase or other devices, follow these steps.

## 0. RxDB storage backend (if sync is flaky or slow)

The app uses **RxDB** for local storage. By default it uses the **free Dexie (IndexedDB)** backend. In some environments (e.g. certain browsers, private mode, or heavy replication) this can contribute to sync issues.

- **Try LocalStorage backend (free):** Set `VITE_RXDB_STORAGE=localstorage` in your env (e.g. `.env` or host env vars). Rebuild and test. LocalStorage avoids Dexie/IndexedDB entirely, so if sync becomes reliable, Dexie may have been involved. **Limitation:** browser localStorage is ~5MB; use only for small/medium datasets. For large data, stay on Dexie or use premium.
- **Production / best reliability (paid):** [RxDB Premium](https://rxdb.info/premium/) includes an **IndexedDB RxStorage** that is faster, uses a WAL-like mode, and avoids some Dexie/IndexedDB quirks. Consider it if you need the most reliable sync and performance.

## 1. Verify Supabase Tables Exist

Run the complete `supabase-schema.sql` file in your Supabase SQL Editor. This creates all required tables with proper columns.

**Important:** Make sure you run the **entire** file, not just parts of it.

## 2. Check Row Level Security (RLS) Policies

Supabase blocks all operations by default if RLS is enabled. The schema file includes policies that allow authenticated users to read/write. If you see "permission denied" errors, the policies may not be applied.

**To verify:**
1. Go to Supabase Dashboard → Authentication → Policies
2. Check that each table has policies allowing authenticated users
3. If missing, run the RLS policy section from `supabase-schema.sql`

## 3. Verify Environment Variables

In Vercel (or your hosting platform), ensure these are set:
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anon/public key (NOT the service role key)

**To check:**
1. Vercel Dashboard → Your Project → Settings → Environment Variables
2. Verify both variables are set for Production, Preview, and Development

## 4. Enable Realtime for Tables

Supabase Realtime must be enabled for sync to work:

1. Go to Supabase Dashboard → Database → Replication
2. Enable replication for each table:
   - products
   - orders
   - expenses
   - stock_adjustments
   - report_notes
   - promotions
   - customers
   - deliveries
   - suppliers
   - supplier_ledger
   - layaways
   - cash_sessions

Or run this SQL:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
-- ... (all tables from schema file)
```

## 5. Check Browser Console

Open browser DevTools (F12) → Console tab and look for:
- `[replication products]` errors
- `Supabase replication start failed` messages
- Any red error messages

## 6. Check Sync Status Indicator

The sync status indicator in the header shows:
- 🟢 **Synced** - Everything working
- 🟡 **Sync Issues** - Some tables failing to sync
- 🔴 **Sync Error** - Database initialization failed
- 🟠 **Offline** - No internet connection

Click the **refresh icon** (⟳) next to "Sync Issues" to retry. This triggers a full resync of all tables and an immediate pull/push of **orders**, **deliveries**, and **products**, so orders of the day and stock should update on all devices. If errors persist, check the steps below and the browser console.

## 7. Verify Authentication

Sync only works when you're signed in. Make sure:
1. You're logged in to the POS system
2. Your Supabase auth is working (check Authentication → Users in Supabase)

## 8. Check Supabase Logs

1. Go to Supabase Dashboard → Logs → API Logs
2. Look for errors when adding items
3. Common errors:
   - `permission denied` → RLS policies missing
   - `relation does not exist` → Table not created
   - `column does not exist` → Schema mismatch

## 9. Manual Sync Test

To test if sync is working:

1. Add a product in one browser/device
2. Check Supabase Dashboard → Table Editor → products table
3. If the product appears, sync is working
4. If not, check the console errors

## 10. Reset Local Database (Last Resort)

If nothing works, you can reset the local database (or use **Settings → Data → Clear local data & reload** in the app):

1. Open browser DevTools (F12)
2. Go to Application → Storage → IndexedDB (or Local Storage if you use `VITE_RXDB_STORAGE=localstorage`)
3. Delete the `mars_pos`-related databases / keys
4. Refresh the page
5. Sign in again

**Warning:** This will delete all local data on that device. Only do this after important data is already on Supabase (check from another device or Supabase Dashboard). If you had **RC_PULL** or other sync errors, see the “RC_PULL” section above – fix the error and let sync push first, then clear if you still need a full reset.

## Common Issues

### 404 Not Found (e.g. `/rest/v1/layaways`, `/rest/v1/cash_sessions`)
- The table does not exist in your Supabase project.
- **Fix:** Run the full `supabase-schema.sql` in Supabase SQL Editor. It creates all 12 tables (including `layaways` and `cash_sessions`). If you only ran an older version of the schema, run the file again; the script uses `CREATE TABLE IF NOT EXISTS` so it is safe.

### 400 Bad Request (e.g. on `deliveries`)
- The request body does not match what Supabase expects (wrong column names, types, or missing required columns).
- **Fix:** Ensure your Supabase table definitions match `supabase-schema.sql` exactly (camelCase column names, same types). In Supabase Table Editor, compare the `deliveries` table with the schema file. If you created tables manually with snake_case, re-create them using the provided SQL, or the app will keep sending camelCase and get 400.

### "Table doesn't exist"
- Run `supabase-schema.sql` completely in Supabase SQL Editor

### "Permission denied"
- Check RLS policies are created (see step 2)
- Verify you're authenticated

### "Column doesn't exist"
- Your Supabase schema is outdated
- Run the updated `supabase-schema.sql` file
- Or manually add missing columns

### Orders of the day not syncing to other devices
- **Enable Realtime for `orders`:** In Supabase Dashboard → Database → Replication, ensure `orders` is in the publication (or run the Realtime section of `supabase-schema.sql`). Without this, other devices only get new orders when they pull (e.g. when you open the Dashboard or click the sync retry button).
- **Use the Sync retry button:** In the header, if you see "Sync Issues", click the refresh icon (⟳). This forces an immediate resync of orders, deliveries, and products so other devices can pull the latest.
- **Dashboard auto-refresh:** The Dashboard pulls orders from the server when you open it, when you switch back to the tab, and every 30 seconds while the Dashboard is open. So "orders today" and revenue should update on each device without leaving the page.
- **RLS and schema:** Ensure RLS allows authenticated users to SELECT/INSERT/UPDATE on `orders` and that the `orders` table has `_modified` (and the trigger from `supabase-schema.sql`) so replication sees updates.

### Items sync but don't appear on other devices
- **Deliveries / payment received:** The Deliveries page automatically syncs with the server every 15 seconds when open, so when one user marks delivery cash as received, other users will see it within about 15 seconds. Use the **Refresh** button to pull the latest immediately.
- **Stock / inventory:** The Inventory page automatically syncs products every 15 seconds when open. After editing a product, adding stock, or completing a layaway, the app triggers an immediate sync so other users see updated stock. For **server-side consistency**, run the full `supabase-schema.sql` so the `_modified` triggers are applied: then every UPDATE in Supabase updates `_modified`, and replication pull will see changes.
- For **instant** updates across devices, ensure Supabase Realtime is enabled for all tables (step 4 above). Then changes (e.g. delivery payment received, stock updates) appear on other devices as soon as they are saved.
- Verify both devices are online and signed in (same or different accounts—all authenticated users share the same data).

### Sync works locally but not in production
- Verify environment variables are set in Vercel
- Check Vercel build logs for errors
- Ensure Supabase URL/key are correct (not localhost)

### CSP blocks eval / "script-src blocked"
The app allows `unsafe-eval` in CSP (in `index.html`, `vercel.json`, `netlify.toml`) because RxDB and other deps use `eval`/`new Function()`. If you still see "script-src blocked" or "CSP prevents the evaluation of arbitrary strings":
- **Redeploy** so the latest `index.html` and headers are live.
- **Clear site data / service worker**: Application → Storage → Clear site data (or unregister the service worker and hard reload). A cached old page can send a stricter CSP.
- **Host Security Headers**: If your host (Vercel, Netlify, etc.) sets a CSP in the dashboard (e.g. "Security Headers"), that can override our headers. Add `'unsafe-eval'` to `script-src` there, or disable the host’s CSP so only our policy (from `vercel.json`/`netlify.toml` and `index.html`) applies.
- **Local dev**: `index.html` meta tag applies when running `npm run dev`; no need for vercel/netlify headers locally.

### RxDB Error RC_PULL (how to avoid losing data on the device)

**RC_PULL** means the **pull** from Supabase failed (the device could not fetch the latest data from the server). Your **local data on that device is not deleted** – it stays in the device’s database. The app keeps retrying the pull automatically.

**Do not clear local data on that device** until you’re sure you won’t lose anything. Clearing (e.g. Settings → Clear local data, or deleting IndexedDB) removes all local data; any **unsynced** orders or changes that haven’t been pushed to Supabase yet would be lost.

**“TypeError: Failed to fetch” (or similar in RC_PULL parameters):** This means the browser could not complete the HTTP request to Supabase. Common causes:
- **Network:** Device offline, unstable Wi‑Fi, VPN/firewall blocking, or DNS issues. Check you can open `https://<your-project>.supabase.co` in the browser.
- **Auth:** Session expired or invalid – the request may be rejected before a proper HTTP response. Sign out and sign in again, then use the sync retry (⟳).
- **CORS / origin:** If the app is served from an origin Supabase doesn’t allow, the request can fail as “Failed to fetch”. In Supabase Dashboard → Authentication → URL Configuration, add your app URL to “Redirect URLs” and ensure the site URL is correct.
- **Supabase down or unreachable:** Rare; check [Supabase status](https://status.supabase.com/) or try the project URL in a new tab.

**What to do:**

1. **Keep using the device normally** – Local data is still there. New orders and edits are still saved locally and will be pushed when sync recovers.
2. **Fix the pull error** so sync can recover:
   - **Network:** Ensure the device has a stable internet connection and can reach Supabase (try opening your Supabase project URL in the browser).
   - **Retry sync:** In the app header, if you see “Sync Issues”, click the **refresh icon (⟳)** to trigger a full resync (pull + push). Wait a minute and check if the indicator turns green.
   - **Auth:** Ensure you’re still signed in. If the session expired, sign in again and let replication start.
   - **Supabase / RLS:** Check Supabase Dashboard → Logs for errors. If you see permission errors, fix RLS policies (see step 2 in this guide). Ensure all tables exist and match `supabase-schema.sql`.
3. **Get local-only data to the server:** Once the device is online and the error is fixed (or after a retry), replication will push any pending local changes to Supabase. So the goal is to **fix the cause of RC_PULL and let sync run** – then push will run too and your data will be on the server.
4. **Only clear local data as a last resort** – e.g. if the device is stuck and you’ve already confirmed (from another device or Supabase Dashboard) that all important data is on Supabase. Then: Settings → Data → “Clear local data & reload”. After that, the app will re-sync from Supabase. If you clear before push has run, any data that existed only on that device can be lost.

**Development:** To see full RxDB error messages (including the exact cause of RC_PULL) in the console, add `VITE_RXDB_DEV_MODE=true` to your `.env` and restart the dev server. This enables the [RxDB dev-mode plugin](https://rxdb.info/dev-mode.html). It is off by default because it can slow the database; use it only when debugging sync.
