#!/usr/bin/env node
/**
 * Migration script to populate missing inventory fields for JSON-imported items.
 *
 * - Dry-run by default. Use --commit to write changes.
 * - Requires a Firebase service account JSON file path in env var FIRESTORE_SERVICE_ACCOUNT
 *
 * Usage:
 *   npm install firebase-admin
 *   FIRESTORE_SERVICE_ACCOUNT=path/to/serviceAccount.json node scripts/migrate_inventory.js --commit
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const doCommit = args.includes('--commit');
const saPath = process.env.FIRESTORE_SERVICE_ACCOUNT;

if (!saPath) {
  console.error('Please set FIRESTORE_SERVICE_ACCOUNT env var to your service account JSON file path.');
  process.exit(1);
}

if (!fs.existsSync(saPath)) {
  console.error('Service account file not found at', saPath);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(path.resolve(saPath)))
});

const db = admin.firestore();

async function migrate() {
  console.log('[MIGRATE] Starting inventory migration. commit=', doCommit);
  const now = admin.firestore.Timestamp.now();
  const itemsSnap = await db.collection('inventory_items').get();
  console.log('[MIGRATE] Found', itemsSnap.size, 'inventory_items');

  const report = { skipped: 0, updated: 0, createdBatches: 0, errors: 0 };

  for (const doc of itemsSnap.docs) {
    const id = doc.id;
    const data = doc.data() || {};

    // Determine current quantity (fallbacks)
    const qty = typeof data.quantity === 'number' ? data.quantity : (typeof data.stock === 'number' ? data.stock : (typeof data.initialQuantity === 'number' ? data.initialQuantity : 0));

    const hasFifo = Array.isArray(data.fifoQueue) && data.fifoQueue.length > 0;
    const hasBatches = !!data._has_migration_batch; // marker we'll set when we create one

    if (hasFifo) {
      report.skipped++;
      continue;
    }

    // If there's nothing to migrate (0 quantity and no fifo), skip
    if (!hasFifo && (!qty || qty <= 0)) {
      report.skipped++;
      continue;
    }

    try {
      // Create a batch doc representing existing stock
      const batchRef = db.collection('inventory_batches').doc();
      const batchData = {
        id: batchRef.id,
        itemId: id,
        itemName: data.name || data.itemName || '',
        batchNumber: data.batchNumber || `MIG-${Date.now()}`,
        quantityPurchased: qty,
        unitPrice: typeof data.purchasePrice === 'number' ? data.purchasePrice : (typeof data.unitPrice === 'number' ? data.unitPrice : 0),
        totalCost: qty * (typeof data.purchasePrice === 'number' ? data.purchasePrice : (typeof data.unitPrice === 'number' ? data.unitPrice : 0)),
        vendorName: data.vendorName || 'MIGRATION',
        invoiceNumber: data.invoiceNumber || 'MIGRATION',
        purchaseDate: now,
        expiryDate: data.expiryDate || null,
        manufactureDate: data.manufactureDate || null,
        remarks: 'Created by migration script',
        createdAt: now,
        createdBy: 'migration',
        initialStock: true
      };

      const fifoEntry = {
        poId: null,
        poNumber: null,
        batchNumber: batchData.batchNumber,
        quantityRemaining: qty,
        unitPrice: batchData.unitPrice || 0,
        purchaseDate: now,
        expiryDate: batchData.expiryDate || null
      };

      const itemUpdate = {
        quantity: qty,
        fifoQueue: [fifoEntry],
        activePurchaseOrders: [],
        status: qty > 0 ? 'in_stock' : 'out_of_stock',
        updatedAt: now,
        _has_migration_batch: true
      };

      console.log(`[MIGRATE] Item ${id} -> qty=${qty} will get fifo entry and batch ${batchRef.id}`);

      if (doCommit) {
        const batch = db.batch();
        batch.set(batchRef, batchData);
        batch.update(db.collection('inventory_items').doc(id), itemUpdate);
        await batch.commit();
        report.updated++;
        report.createdBatches++;
      } else {
        report.updated++;
      }

    } catch (err) {
      console.error('[MIGRATE] Error migrating item', id, err);
      report.errors++;
    }
  }

  console.log('[MIGRATE] Done', report);
  if (!doCommit) console.log('[MIGRATE] Dry-run only. Re-run with --commit to apply changes.');
}

migrate().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(2); });
