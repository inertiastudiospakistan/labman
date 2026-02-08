#!/usr/bin/env node
/**
 * Inspect a single inventory item and its batches in Firestore.
 * Usage:
 *   set FIRESTORE_SERVICE_ACCOUNT=C:\path\to\serviceAccount.json
 *   node scripts/inspect_inventory_item.js MIZ07wls1Adya3AtGuLX
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const saPath = process.env.FIRESTORE_SERVICE_ACCOUNT;
if (!saPath) {
  console.error('Set FIRESTORE_SERVICE_ACCOUNT env var to service account JSON file path.');
  process.exit(1);
}
if (!fs.existsSync(saPath)) {
  console.error('Service account file not found at', saPath);
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(require(path.resolve(saPath))) });
const db = admin.firestore();

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/inspect_inventory_item.js <ITEM_ID>');
  process.exit(1);
}
const itemId = args[0];

async function inspect() {
  try {
    const itemRef = db.collection('inventory_items').doc(itemId);
    const itemDoc = await itemRef.get();
    if (!itemDoc.exists) {
      console.error('Item not found:', itemId);
      process.exit(2);
    }
    const data = itemDoc.data() || {};
    console.log('--- inventory_items doc ---');
    console.log('id:', itemId);
    console.log(JSON.stringify(data, null, 2));

    const batchesSnap = await db.collection('inventory_batches').where('itemId', '==', itemId).get();
    console.log(`\n--- inventory_batches (${batchesSnap.size}) ---`);
    batchesSnap.docs.forEach(d => console.log(JSON.stringify(d.data(), null, 2)));

    // Summarize fifoQueue if present
    const fifo = Array.isArray(data.fifoQueue) ? data.fifoQueue : [];
    const fifoTotal = fifo.reduce((s, b) => s + (b.quantityRemaining || 0), 0);
    console.log(`\nfifoQueue entries: ${fifo.length}, total quantityRemaining: ${fifoTotal}`);

    console.log('\nDone. If `fifoQueue` is empty but `quantity` > 0, run the migration script or add initial stock via the app to create batches.');
  } catch (err) {
    console.error('Error inspecting item:', err);
    process.exit(3);
  }
}

inspect();
