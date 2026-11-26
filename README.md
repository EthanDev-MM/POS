# Simple POS v2
Offline-first PWA point-of-sale: items, cash/QR/card checkout with change, discounts, receipts,
dashboard (date range, 7/30-day chart, payment mix, top items, low stock), CSV, backup, optional Supabase sync.

## Deploy
1. Upload every file in this folder to the repo root (replace old files). Settings -> Pages -> main / root.
2. Open the site on your phone and Add to Home Screen.

## Turn on cloud sync (optional)
1. Create a free project at supabase.com. SQL Editor -> run `schema.sql`.
2. Authentication -> Providers -> Email (for quick testing you can turn off "Confirm email").
3. Project Settings -> API: copy the Project URL and the anon public key into `config.js`. Never use the service_role key.
4. Commit. Open the app and create an account.

Sync model: one JSON document per user, last write wins. Don't edit the same shop on two devices at the same moment.
