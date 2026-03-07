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

If nothing works, you can reset the local database:

1. Open browser DevTools (F12)
2. Go to Application → Storage → IndexedDB
3. Delete the `mars_pos` database
4. Refresh the page
5. Sign in again

**Warning:** This will delete all local data. Make sure important data is synced first.

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
