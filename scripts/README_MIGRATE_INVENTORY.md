Migration for JSON-imported inventory
====================================

What this does
--------------
This script scans the `inventory_items` collection and for items that are missing a `fifoQueue` (or related batch records)
it will create an `inventory_batches` doc and populate a minimal `fifoQueue` entry on the item so the app's
consumption logic can deduct stock correctly.

Usage
-----
1. Install dependencies (on your development machine where you can run Node):

   npm install firebase-admin

2. Export the path to a service account JSON file with access to your Firestore database:

   Windows (PowerShell):
   $env:FIRESTORE_SERVICE_ACCOUNT = 'C:\path\to\serviceAccount.json'

   Windows (cmd):
   set FIRESTORE_SERVICE_ACCOUNT=C:\path\to\serviceAccount.json

3. Run a dry-run to preview changes:

   node scripts/migrate_inventory.js

4. If the dry-run looks good, re-run with `--commit` to apply changes:

   node scripts/migrate_inventory.js --commit

Notes
-----
- The script is conservative: if an item already has a non-empty `fifoQueue`, it will be skipped.
- For patched items the script sets a marker `_has_migration_batch: true` so it won't create duplicate batches on subsequent runs.
- Review the created `inventory_batches` docs after running to confirm correct unit prices and batch numbers.

If you prefer, instead of running this migration you can re-import inventory using the app's `addInitialStock` API which
creates the required batch & fifoQueue entries automatically.
