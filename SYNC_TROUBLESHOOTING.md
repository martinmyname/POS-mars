# Sync Troubleshooting Guide

If items aren't syncing to Supabase or other devices, follow these steps:

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

Click the refresh icon to clear errors and retry.

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

### Items sync but don't appear on other devices
- Check Realtime is enabled (step 4)
- Verify both devices are online
- Check both devices are signed in with the same account

### Sync works locally but not in production
- Verify environment variables are set in Vercel
- Check Vercel build logs for errors
- Ensure Supabase URL/key are correct (not localhost)
