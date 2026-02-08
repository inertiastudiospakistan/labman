import firebase from 'firebase/compat/app';
import { db } from './firebase';

// Generate PO number with format: PO-YYYYMMDD-XXXXX
export const generatePONumber = (): string => {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomStr = Math.random().toString(36).substr(2, 5).toUpperCase();
    return `PO-${dateStr}-${randomStr}`;
};

// Calculate payment due date based on payment terms
export const calculatePaymentDueDate = (orderDate: Date, paymentTerms: string): Date => {
    const dueDate = new Date(orderDate);
    const termsMatch = paymentTerms.match(/Net (\d+)/i);

    if (termsMatch) {
        const days = parseInt(termsMatch[1]);
        dueDate.setDate(dueDate.getDate() + days);
    } else if (paymentTerms.toLowerCase() === 'immediate') {
        return new Date(orderDate);
    }
    return dueDate;
};

interface QCChecklist {
    coldChain: boolean;
    packaging: boolean;
    documentation: boolean;
    expiryMatch: boolean;
    batchMatch: boolean;
}

interface ReceiptLog {
    id: string;
    timestamp: any;
    receivedBy: string;
    quantityAccepted: number;
    quantityRejected: number;
    batchNumber?: string;
    expiryDate?: any;
    manufactureDate?: any;
    remarks?: string;
    qcChecklist?: QCChecklist;
    type: 'full' | 'partial' | 'excess' | 'damaged';
}

interface PurchaseOrderItem {
    itemId: string;
    itemName: string;
    description?: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
    batchNumber?: string;
    expiryDate?: any;
    manufactureDate?: any;
    specifications?: string;
    quantityUsed: number;
    quantityRemaining: number;
    valueUsed: number;
    valueRemaining: number;

    // Receipt Tracking
    quantityReceived: number;
    quantityRejected: number;
    status: 'pending' | 'partially_received' | 'fully_received' | 'over_received' | 'closed';
    receiptHistory: ReceiptLog[];
}

export interface PurchaseOrder {
    id: string;
    poNumber: string;
    orderDate: any;
    supplierName: string;
    supplierPhone?: string;
    supplierAddress?: string;
    requisitionRef?: string;
    expectedDeliveryDate?: any;
    allowPartialDelivery: boolean;
    items: PurchaseOrderItem[];
    subtotal: number;
    taxPercentage: number;
    taxAmount: number;
    totalAmount: number;
    paymentTerms: string;
    paymentDueDate: any;
    paymentStatus: 'unpaid' | 'paid';
    paidDate?: any;
    paidBy?: string;

    totalValueUsed: number;
    totalValueRemaining: number;
    usagePercentage: number;

    referenceNumber?: string;
    notes?: string;
    createdBy: string;
    createdAt: any;

    status: 'draft' | 'pending_payment' | 'paid_awaiting_delivery' | 'active' | 'fully_used' | 'cancelled' | 'rejected';
    receivedAt?: any;
    receivedBy?: string;
    closureNotes?: string;
    closedAt?: any;
    closedBy?: string;
    updatedAt?: any;
    usageHistory: any[];
}

export interface StockRequisition {
    id: string;
    requisitionNumber: string;
    requester: {
        name: string;
        email: string;
        department: string;
    };
    items: {
        itemId: string;
        itemName: string;
        quantity: number;
        unit: string;
    }[];
    purpose: string;
    status: 'pending' | 'approved' | 'rejected' | 'completed';
    approvedBy?: string;
    approvedAt?: any;
    rejectedReason?: string;
    createdAt: any;
    updatedAt: any;
}

interface FIFOQueueEntry {
    poId: string;
    poNumber: string;
    batchNumber: string;
    quantityRemaining: number;
    unitPrice: number;
    purchaseDate: any;
}

interface UsageAllocation {
    poId: string;
    poNumber: string;
    quantityDeducted: number;
    valueDeducted: number;
}

// Generate Purchase Order
export const generatePurchaseOrder = async (
    items: {
        itemId: string;
        itemName: string;
        description?: string;
        quantity: number;
        unit: string;
        unitPrice: number;
        batchNumber?: string;
        expiryDate?: Date;
        manufactureDate?: Date;
        specifications?: string;
    }[],
    supplier: { name: string; phone?: string; address?: string },
    taxPercentage: number,
    paymentTerms: string,
    createdBy: string,
    options?: {
        referenceNumber?: string;
        notes?: string;
        requisitionRef?: string;
        expectedDeliveryDate?: Date;
        allowPartialDelivery?: boolean;
        status?: 'draft' | 'pending_payment';
    }
): Promise<{ id: string; poNumber: string }> => {
    try {
        const poNumber = generatePONumber();
        const orderDate = new Date();

        const lineItems: PurchaseOrderItem[] = items.map(item => {
            const totalPrice = item.quantity * item.unitPrice;
            return {
                ...item,
                expiryDate: item.expiryDate ? firebase.firestore.Timestamp.fromDate(item.expiryDate) : null,
                manufactureDate: item.manufactureDate ? firebase.firestore.Timestamp.fromDate(item.manufactureDate) : null,
                totalPrice,
                quantityUsed: 0,
                quantityRemaining: item.quantity,
                valueUsed: 0,
                valueRemaining: totalPrice,
                quantityReceived: 0,
                quantityRejected: 0,
                status: 'pending',
                receiptHistory: []
            };
        });

        const subtotal = lineItems.reduce((sum, item) => sum + item.totalPrice, 0);
        const taxAmount = (subtotal * taxPercentage) / 100;
        const totalAmount = subtotal + taxAmount;
        const paymentDueDate = calculatePaymentDueDate(orderDate, paymentTerms);

        const poData: Omit<PurchaseOrder, 'id'> = {
            poNumber,
            orderDate: firebase.firestore.Timestamp.fromDate(orderDate),
            supplierName: supplier.name,
            supplierPhone: supplier.phone,
            supplierAddress: supplier.address,
            requisitionRef: options?.requisitionRef || '',
            expectedDeliveryDate: options?.expectedDeliveryDate ? firebase.firestore.Timestamp.fromDate(options.expectedDeliveryDate) : null,
            allowPartialDelivery: options?.allowPartialDelivery ?? true,
            items: lineItems,
            subtotal,
            taxPercentage,
            taxAmount,
            totalAmount,
            paymentTerms,
            paymentDueDate: firebase.firestore.Timestamp.fromDate(paymentDueDate),
            paymentStatus: 'unpaid',
            totalValueUsed: 0,
            totalValueRemaining: totalAmount,
            usagePercentage: 0,
            referenceNumber: options?.referenceNumber || '',
            notes: options?.notes || '',
            createdBy,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            status: options?.status || 'pending_payment',
            usageHistory: []
        };

        const docRef = await db.collection('purchase_orders').add(poData);
        return { id: docRef.id, poNumber };
    } catch (error) {
        console.error('Error generating purchase order:', error);
        throw error;
    }
};

// Advanced Receipt Logic with QC Checklist
export const receivePurchaseOrderItems = async (
    poId: string,
    receipts: {
        itemId: string;
        quantityAccepted: number;
        quantityRejected: number;
        batchNumber?: string;
        expiryDate?: Date;
        manufactureDate?: Date;
        remarks?: string;
        qcChecklist?: QCChecklist;
        type: 'full' | 'partial' | 'excess' | 'damaged';
    }[],
    receivedBy: string
): Promise<void> => {
    try {
        const poRef = db.collection('purchase_orders').doc(poId);
        const poDoc = await poRef.get();
        if (!poDoc.exists) throw new Error('PO not found');

        const poData = poDoc.data() as PurchaseOrder;
        const batch = db.batch();
        const now = firebase.firestore.Timestamp.now();

        const updatedItems = poData.items.map(item => {
            const receipt = receipts.find(r => r.itemId === item.itemId);
            if (!receipt) return item;

            if (receipt.quantityAccepted > 0) {
                const batchRef = db.collection('inventory_batches').doc();
                batch.set(batchRef, {
                    id: batchRef.id,
                    itemId: item.itemId,
                    itemName: item.itemName,
                    batchNumber: receipt.batchNumber || '',
                    quantityPurchased: receipt.quantityAccepted,
                    unitPrice: item.unitPrice,
                    totalCost: receipt.quantityAccepted * item.unitPrice,
                    vendorName: poData.supplierName,
                    vendorPhone: poData.supplierPhone || '',
                    invoiceNumber: poData.poNumber,
                    purchaseDate: now,
                    expiryDate: receipt.expiryDate ? firebase.firestore.Timestamp.fromDate(receipt.expiryDate) : null,
                    manufactureDate: receipt.manufactureDate ? firebase.firestore.Timestamp.fromDate(receipt.manufactureDate) : null,
                    remarks: receipt.remarks || `Received from PO ${poData.poNumber}`,
                    createdAt: now,
                    createdBy: receivedBy
                });
            }

            const newQtyReceived = (item.quantityReceived || 0) + receipt.quantityAccepted;
            const newQtyRejected = (item.quantityRejected || 0) + receipt.quantityRejected;

            let newStatus: typeof item.status = 'partially_received';
            const totalProcessed = newQtyReceived + newQtyRejected;

            if (totalProcessed >= item.quantity) {
                newStatus = 'fully_received';
            } else if (newQtyReceived > item.quantity) {
                newStatus = 'over_received';
            } else {
                newStatus = 'partially_received';
            }

            const newLog: ReceiptLog = {
                id: Math.random().toString(36).substr(2, 9),
                timestamp: now,
                receivedBy,
                quantityAccepted: receipt.quantityAccepted,
                quantityRejected: receipt.quantityRejected,
                batchNumber: receipt.batchNumber,
                expiryDate: receipt.expiryDate,
                manufactureDate: receipt.manufactureDate,
                remarks: receipt.remarks,
                qcChecklist: receipt.qcChecklist,
                type: receipt.type
            };

            return {
                ...item,
                quantityReceived: newQtyReceived,
                quantityRejected: newQtyRejected,
                status: newStatus,
                receiptHistory: [...(item.receiptHistory || []), newLog]
            };
        });

        for (const receipt of receipts) {
            if (receipt.quantityAccepted > 0) {
                const itemRef = db.collection('inventory_items').doc(receipt.itemId);
                const itemDoc = await itemRef.get();
                if (itemDoc.exists) {
                    const iData = itemDoc.data() as any;
                    const activePOs = iData.activePurchaseOrders || [];
                    if (!activePOs.includes(poId)) activePOs.push(poId);

                    const fifoQueue = iData.fifoQueue || [];
                    fifoQueue.push({
                        poId: poId,
                        poNumber: poData.poNumber,
                        batchNumber: receipt.batchNumber || '',
                        quantityRemaining: receipt.quantityAccepted,
                        unitPrice: (poData.items.find(i => i.itemId === receipt.itemId) || {}).unitPrice || 0,
                        purchaseDate: now,
                        expiryDate: receipt.expiryDate ? firebase.firestore.Timestamp.fromDate(receipt.expiryDate) : null
                    });

                    batch.update(itemRef, {
                        quantity: firebase.firestore.FieldValue.increment(receipt.quantityAccepted),
                        activePurchaseOrders: activePOs,
                        fifoQueue: fifoQueue,
                        updatedAt: now,
                        status: 'in_stock'
                    });
                }
            }
        }

        const txRef = db.collection('inventory_transactions').doc();
        batch.set(txRef, {
            type: 'purchase',
            description: `Receipt for PO ${poData.poNumber}`,
            quantity: receipts.reduce((s, r) => s + r.quantityAccepted, 0),
            items: receipts.map(r => ({ itemId: r.itemId, qty: r.quantityAccepted, rejected: r.quantityRejected })),
            performedBy: receivedBy,
            timestamp: now,
            poId: poId
        });

        const allFull = updatedItems.every(i => i.status === 'fully_received' || i.status === 'over_received' || i.status === 'closed');
        let poStatus: 'draft' | 'pending_payment' | 'paid_awaiting_delivery' | 'active' | 'fully_used' | 'cancelled' | 'rejected' = allFull ? 'active' : 'paid_awaiting_delivery';

        batch.update(poRef, {
            items: updatedItems,
            status: poStatus,
            updatedAt: now
        });

        await batch.commit();
    } catch (error) {
        console.error('Error receiving items:', error);
        throw error;
    }
};

// Legacy Wrapper
export const receivePurchaseOrder = async (poId: string, receivedBy: string): Promise<void> => {
    try {
        const poDoc = await db.collection('purchase_orders').doc(poId).get();
        if (!poDoc.exists) throw new Error('PO not found');
        const poData = poDoc.data() as PurchaseOrder;

        const receipts = poData.items.map(item => ({
            itemId: item.itemId,
            quantityAccepted: item.quantity - (item.quantityReceived || 0),
            quantityRejected: 0,
            batchNumber: item.batchNumber,
            expiryDate: item.expiryDate?.toDate ? item.expiryDate.toDate() : item.expiryDate,
            manufactureDate: item.manufactureDate?.toDate ? item.manufactureDate.toDate() : item.manufactureDate,
            type: 'full' as const
        }));

        await receivePurchaseOrderItems(poId, receipts, receivedBy);
    } catch (error) {
        console.error('Error in legacy receivePurchaseOrder:', error);
        throw error;
    }
};

// Add initial stock directly to inventory (no Purchase Order)
export const addInitialStock = async (
    itemId: string,
    quantity: number,
    unitPrice: number,
    batchNumber: string,
    performedBy: string,
    options?: {
        vendorName?: string;
        expiryDate?: Date;
        manufactureDate?: Date;
        remarks?: string;
    }
): Promise<void> => {
    try {
        if (!itemId) throw new Error('Item id required');
        if (!quantity || quantity <= 0) throw new Error('Quantity must be greater than zero');

        const itemRef = db.collection('inventory_items').doc(itemId);
        const itemDoc = await itemRef.get();
        if (!itemDoc.exists) throw new Error('Item not found');
        const itemData = itemDoc.data() as any;

        const now = firebase.firestore.Timestamp.now();
        const batchRef = db.collection('inventory_batches').doc();
        const batchData = {
            id: batchRef.id,
            itemId,
            itemName: itemData.name,
            batchNumber: batchNumber || '',
            quantityPurchased: quantity,
            unitPrice,
            totalCost: quantity * unitPrice,
            vendorName: options?.vendorName || '',
            vendorPhone: '',
            invoiceNumber: 'INITIAL_STOCK',
            purchaseDate: now,
            expiryDate: options?.expiryDate ? firebase.firestore.Timestamp.fromDate(options.expiryDate) : null,
            manufactureDate: options?.manufactureDate ? firebase.firestore.Timestamp.fromDate(options.manufactureDate) : null,
            remarks: options?.remarks || 'Initial stock entry',
            createdAt: now,
            createdBy: performedBy,
            initialStock: true
        };

        const fifoEntry: any = {
            // No associated PO id for initial stock
            batchNumber: batchData.batchNumber,
            quantityRemaining: quantity,
            unitPrice: unitPrice,
            purchaseDate: now,
            expiryDate: batchData.expiryDate || null
        };

        const batch = db.batch();
        batch.set(batchRef, batchData);

        // Update inventory item: increment quantity, append fifoQueue entry
        const updatedFifo = [...(itemData.fifoQueue || []), fifoEntry];
        batch.update(itemRef, {
            quantity: firebase.firestore.FieldValue.increment(quantity),
            fifoQueue: updatedFifo,
            updatedAt: now,
            status: 'in_stock'
        });

        // Add inventory transaction record
        const txRef = db.collection('inventory_transactions').doc();
        batch.set(txRef, {
            type: 'initial_stock',
            description: `Initial stock for ${itemData.name}`,
            quantity,
            items: [{ itemId, qty: quantity }],
            performedBy,
            timestamp: now,
            batchId: batchRef.id,
            vendorName: options?.vendorName || ''
        });

        await batch.commit();
        console.log('[INVENTORY] addInitialStock committed', { itemId, quantity, unitPrice, batchId: batchRef.id });
    } catch (error) {
        console.error('Error adding initial stock:', error);
        throw error;
    }
};

// Record usage with FIFO
export const recordInventoryUsage = async (
    itemId: string,
    quantityUsed: number,
    performedBy: string,
    relatedRequestId?: string
): Promise<void> => {
    try {
        // legacy single-item deduction preserved for compatibility
        const itemDoc = await db.collection('inventory_items').doc(itemId).get();
        if (!itemDoc.exists) throw new Error('Item not found');

        const itemData = itemDoc.data() as any;
        let ledgerQueue: any[] = [...(itemData.fifoQueue || [])];

        // Fallback for JSON-imported items that only have a `quantity` field
        // but no `fifoQueue`/batch entries. Create a synthetic FIFO entry so
        // legacy single-item deductions still work.
        if ((!ledgerQueue || ledgerQueue.length === 0) && (itemData.quantity && itemData.quantity > 0)) {
            ledgerQueue = [{
                poId: (itemData.activePurchaseOrders && itemData.activePurchaseOrders[0]) || null,
                poNumber: null,
                batchNumber: itemData.batchNumber || 'MIGRATION',
                quantityRemaining: itemData.quantity,
                unitPrice: itemData.unitPrice || itemData.purchasePrice || 0,
                purchaseDate: itemData.updatedAt || firebase.firestore.Timestamp.now(),
                expiryDate: null
            }];
            console.warn('[INVENTORY] Built synthetic fifoQueue for item', itemId, 'qty', itemData.quantity);
        }

        // --- FEFO Logic: Sort by Expiry Date (Ascending) ---
        // Batches expiring soonest are used first. No-expiry batches are used last (FIFO).
        ledgerQueue.sort((a, b) => {
            const dateA = a.expiryDate ? (a.expiryDate.toDate ? a.expiryDate.toDate() : new Date(a.expiryDate)).getTime() : Infinity;
            const dateB = b.expiryDate ? (b.expiryDate.toDate ? b.expiryDate.toDate() : new Date(b.expiryDate)).getTime() : Infinity;

            if (dateA !== dateB) return dateA - dateB;

            // If expiry dates match or are Infinity, fallback to FIFO (Purchase Date)
            const pDateA = a.purchaseDate ? (a.purchaseDate.toDate ? a.purchaseDate.toDate() : new Date(a.purchaseDate)).getTime() : 0;
            const pDateB = b.purchaseDate ? (b.purchaseDate.toDate ? b.purchaseDate.toDate() : new Date(b.purchaseDate)).getTime() : 0;
            return pDateA - pDateB;
        });

        let remainingToDeduct = quantityUsed;
        const usageAllocations: UsageAllocation[] = [];

        while (remainingToDeduct > 0 && ledgerQueue.length > 0) {
            const batch = ledgerQueue[0];
            if (batch.quantityRemaining >= remainingToDeduct) {
                const valueDeducted = remainingToDeduct * batch.unitPrice;
                usageAllocations.push({
                    poId: batch.poId,
                    poNumber: batch.poNumber,
                    quantityDeducted: remainingToDeduct,
                    valueDeducted
                });
                batch.quantityRemaining -= remainingToDeduct;
                remainingToDeduct = 0;
                if (batch.quantityRemaining === 0) ledgerQueue.shift();
            } else {
                const valueDeducted = batch.quantityRemaining * batch.unitPrice;
                usageAllocations.push({
                    poId: batch.poId,
                    poNumber: batch.poNumber,
                    quantityDeducted: batch.quantityRemaining,
                    valueDeducted
                });
                remainingToDeduct -= batch.quantityRemaining;
                ledgerQueue.shift();
            }
        }

        if (remainingToDeduct > 0) throw new Error(`Insufficient inventory. Missing: ${remainingToDeduct}`);

        const activePOs = ledgerQueue.map(b => b.poId).filter((v, i, a) => a.indexOf(v) === i);
        await db.collection('inventory_items').doc(itemId).update({
            fifoQueue: ledgerQueue,
            activePurchaseOrders: activePOs,
            quantity: firebase.firestore.FieldValue.increment(-quantityUsed)
        });

        for (const allocation of usageAllocations) {
            const poRef = db.collection('purchase_orders').doc(allocation.poId);
            const poDoc = await poRef.get();
            if (poDoc.exists) {
                const poData = poDoc.data() as any;
                const updatedItems = poData.items.map((poItem: any) => {
                    if (poItem.itemId === itemId) {
                        return {
                            ...poItem,
                            quantityUsed: (poItem.quantityUsed || 0) + allocation.quantityDeducted,
                            quantityRemaining: (poItem.quantityRemaining || 0) - allocation.quantityDeducted,
                            valueUsed: (poItem.valueUsed || 0) + allocation.valueDeducted,
                            valueRemaining: (poItem.valueRemaining || 0) - allocation.valueDeducted
                        };
                    }
                    return poItem;
                });

                const newTotalValueUsed = (poData.totalValueUsed || 0) + allocation.valueDeducted;
                const newTotalValueRemaining = (poData.totalValueRemaining || 0) - allocation.valueDeducted;

                await poRef.update({
                    items: updatedItems,
                    totalValueUsed: newTotalValueUsed,
                    totalValueRemaining: newTotalValueRemaining,
                    usagePercentage: (newTotalValueUsed / poData.totalAmount) * 100,
                    status: newTotalValueRemaining <= 0.01 ? 'fully_used' : poData.status,
                    usageHistory: firebase.firestore.FieldValue.arrayUnion({
                        timestamp: firebase.firestore.Timestamp.now(),
                        itemId,
                        itemName: itemData.name,
                        quantityUsed: allocation.quantityDeducted,
                        valueUsed: allocation.valueDeducted,
                        relatedRequestId,
                        performedBy
                    })
                });
            }
        }

        await db.collection('inventory_transactions').add({
            itemId,
            itemName: itemData.name,
            type: 'deduction',
            quantity: quantityUsed,
            cost: usageAllocations.reduce((sum, a) => sum + a.valueDeducted, 0),
            performedBy,
            relatedRequestId,
            timestamp: firebase.firestore.Timestamp.now()
        });
    } catch (error) {
        console.error('Error recording inventory usage:', error);
        throw error;
    }
};

// New: Deduct inventory for multiple items AND mark samples as collected in a single transaction
export const deductInventoryAndMarkSamples = async (
    deductions: { itemId: string; quantity: number }[],
    sampleIds: string[],
    performedBy: string,
    relatedRequestId?: string,
    markSamplesAsCollected: boolean = true,
    sampleStatusUpdate?: Record<string, any> | null
): Promise<void> => {
    console.log('[INVENTORY] deductInventoryAndMarkSamples called', { deductions, sampleIds, performedBy, relatedRequestId, markSamplesAsCollected, sampleStatusUpdate });

    if (!deductions || deductions.length === 0) {
        // Nothing to deduct. Update samples only if caller asked for it.
        if (markSamplesAsCollected) {
            const batch = db.batch();
            const now = firebase.firestore.Timestamp.now();
            for (const id of sampleIds) {
                batch.update(db.collection('samples').doc(id), {
                    status: 'collected',
                    collectedAt: now,
                    collectorName: performedBy,
                    collectorId: ''
                });
            }
            await batch.commit();
            console.log('[INVENTORY] No deductions requested; samples marked as collected');
            return;
        } else if (sampleStatusUpdate) {
            const batch = db.batch();
            for (const id of sampleIds) {
                batch.update(db.collection('samples').doc(id), sampleStatusUpdate);
            }
            await batch.commit();
            console.log('[INVENTORY] No deductions requested; samples updated with provided status');
            return;
        } else {
            console.log('[INVENTORY] No deductions requested; nothing to do');
            return;
        }
    }

    try {
        await db.runTransaction(async tx => {
            const now = firebase.firestore.Timestamp.now();

            // Load inventory items within transaction (all reads first)
            const itemRefs = deductions.map(d => db.collection('inventory_items').doc(d.itemId));
            const itemDocs = await Promise.all(itemRefs.map(r => tx.get(r)));

            const itemDataMap: Record<string, any> = {};
            for (let i = 0; i < deductions.length; i++) {
                const d = deductions[i];
                const doc = itemDocs[i];
                if (!doc.exists) throw new Error(`Inventory item not found: ${d.itemId}`);
                itemDataMap[d.itemId] = doc.data();
            }

            console.log('[INVENTORY] item snapshots', Object.fromEntries(Object.keys(itemDataMap).map(k => [k, { quantity: itemDataMap[k].quantity, fifoCount: (itemDataMap[k].fifoQueue || []).length }])));

            // First pass: Calculate allocations for all deductions (no writes yet)
            const perItemResults: Record<string, {
                ledgerQueue: any[];
                allocations: UsageAllocation[];
                totalDeducted: number;
                totalCost: number;
                updatedActivePOs: string[];
            }> = {} as any;

            const allPOIds = new Set<string>();

            for (const d of deductions) {
                const itemId = d.itemId;
                let remainingToDeduct = d.quantity;
                let ledgerQueue: any[] = [...(itemDataMap[itemId].fifoQueue || [])];

                // Fallback for JSON-imported items: if there's no fifoQueue but
                // the inventory item has a quantity, build a synthetic ledger entry
                // so transactional deductions can proceed.
                let syntheticBatch: any = null;
                if ((!ledgerQueue || ledgerQueue.length === 0) && (itemDataMap[itemId].quantity && itemDataMap[itemId].quantity > 0)) {
                    // Prepare a synthetic batch doc reference (will be written later in the transaction)
                    const batchRef = db.collection('inventory_batches').doc();
                    const batchNumber = itemDataMap[itemId].batchNumber || `MIG-${Date.now()}`;
                    const batchData = {
                        id: batchRef.id,
                        itemId: itemId,
                        itemName: itemDataMap[itemId].name || itemDataMap[itemId].itemName || '',
                        batchNumber: batchNumber,
                        quantityPurchased: itemDataMap[itemId].quantity,
                        unitPrice: itemDataMap[itemId].unitPrice || itemDataMap[itemId].purchasePrice || 0,
                        totalCost: (itemDataMap[itemId].quantity || 0) * (itemDataMap[itemId].unitPrice || itemDataMap[itemId].purchasePrice || 0),
                        vendorName: itemDataMap[itemId].vendorName || 'MIGRATION',
                        invoiceNumber: itemDataMap[itemId].invoiceNumber || 'MIGRATION',
                        purchaseDate: now,
                        expiryDate: null,
                        manufactureDate: null,
                        remarks: 'Synthetic batch created during deduction',
                        createdAt: now,
                        createdBy: 'migration_fallback',
                        initialStock: true
                    };

                    ledgerQueue = [{
                        poId: null,
                        poNumber: null,
                        batchNumber: batchNumber,
                        quantityRemaining: itemDataMap[itemId].quantity,
                        unitPrice: batchData.unitPrice || 0,
                        purchaseDate: now,
                        expiryDate: null,
                        _syntheticBatchId: batchRef.id
                    }];
                    syntheticBatch = { ref: batchRef, data: batchData };
                    console.warn('[INVENTORY] Prepared synthetic fifoQueue in transaction for item', itemId, 'qty', itemDataMap[itemId].quantity, 'batchRef', batchRef.id);
                }

                // Sort FEFO
                ledgerQueue.sort((a, b) => {
                    const dateA = a.expiryDate ? (a.expiryDate.toDate ? a.expiryDate.toDate() : new Date(a.expiryDate)).getTime() : Infinity;
                    const dateB = b.expiryDate ? (b.expiryDate.toDate ? b.expiryDate.toDate() : new Date(b.expiryDate)).getTime() : Infinity;
                    if (dateA !== dateB) return dateA - dateB;
                    const pDateA = a.purchaseDate ? (a.purchaseDate.toDate ? a.purchaseDate.toDate() : new Date(a.purchaseDate)).getTime() : 0;
                    const pDateB = b.purchaseDate ? (b.purchaseDate.toDate ? b.purchaseDate.toDate() : new Date(b.purchaseDate)).getTime() : 0;
                    return pDateA - pDateB;
                });

                const usageAllocations: UsageAllocation[] = [];
                let totalCost = 0;

                while (remainingToDeduct > 0 && ledgerQueue.length > 0) {
                    const batch = ledgerQueue[0];
                    if (batch.quantityRemaining >= remainingToDeduct) {
                        const valueDeducted = remainingToDeduct * batch.unitPrice;
                        usageAllocations.push({ poId: batch.poId, poNumber: batch.poNumber, quantityDeducted: remainingToDeduct, valueDeducted });
                        totalCost += valueDeducted;
                        batch.quantityRemaining -= remainingToDeduct;
                        remainingToDeduct = 0;
                        if (batch.quantityRemaining === 0) ledgerQueue.shift();
                    } else {
                        const valueDeducted = batch.quantityRemaining * batch.unitPrice;
                        usageAllocations.push({ poId: batch.poId, poNumber: batch.poNumber, quantityDeducted: batch.quantityRemaining, valueDeducted });
                        totalCost += valueDeducted;
                        remainingToDeduct -= batch.quantityRemaining;
                        ledgerQueue.shift();
                    }
                }

                if (remainingToDeduct > 0) throw new Error(`Insufficient inventory for item ${itemId}. Missing: ${remainingToDeduct}`);

                const updatedActivePOs = ledgerQueue.map(b => b.poId).filter((v, i, a) => a.indexOf(v) === i);
                perItemResults[itemId] = {
                    ledgerQueue,
                    allocations: usageAllocations,
                    totalDeducted: d.quantity,
                    totalCost,
                    updatedActivePOs,
                    syntheticBatch
                };

                // Only add valid PO ids (skip undefined/null/empty) to avoid attempting to read non-existent PO docs
                usageAllocations.forEach(a => { if (a.poId) allPOIds.add(a.poId); });
            }

            // Now read all affected Purchase Orders (still in read phase)
            const poIds = Array.from(allPOIds);
            const poRefs = poIds.map(id => db.collection('purchase_orders').doc(id));
            const poDocs = await Promise.all(poRefs.map(r => tx.get(r)));

            const poDataMap: Record<string, any> = {};
            for (let i = 0; i < poIds.length; i++) {
                const doc = poDocs[i];
                if (!doc.exists) throw new Error(`Related PO not found: ${poIds[i]}`);
                poDataMap[poIds[i]] = doc.data();
            }

            // Prepare updates
            const nowTs = now;
            // Apply allocations to PO data in-memory
            for (const itemId of Object.keys(perItemResults)) {
                const res = perItemResults[itemId];
                for (const alloc of res.allocations) {
                    const poData = poDataMap[alloc.poId];
                    if (!poData) throw new Error(`Related PO missing in computed map: ${alloc.poId}`);

                    poData.items = poData.items.map((poItem: any) => {
                        if (poItem.itemId === itemId) {
                            return {
                                ...poItem,
                                quantityUsed: (poItem.quantityUsed || 0) + alloc.quantityDeducted,
                                quantityRemaining: (poItem.quantityRemaining || 0) - alloc.quantityDeducted,
                                valueUsed: (poItem.valueUsed || 0) + alloc.valueDeducted,
                                valueRemaining: (poItem.valueRemaining || 0) - alloc.valueDeducted
                            };
                        }
                        return poItem;
                    });

                    poData.totalValueUsed = (poData.totalValueUsed || 0) + alloc.valueDeducted;
                    poData.totalValueRemaining = (poData.totalValueRemaining || 0) - alloc.valueDeducted;
                    poData.usagePercentage = (poData.totalValueUsed / poData.totalAmount) * 100;
                    poData.status = poData.totalValueRemaining <= 0.01 ? 'fully_used' : poData.status;
                    poData.usageHistory = [...(poData.usageHistory || []), {
                        timestamp: nowTs,
                        itemId,
                        itemName: itemDataMap[itemId].name,
                        quantityUsed: alloc.quantityDeducted,
                        valueUsed: alloc.valueDeducted,
                        relatedRequestId,
                        performedBy
                    }];
                }
            }

            // All reads done. Now perform writes in transaction
            for (const itemId of Object.keys(perItemResults)) {
                const res = perItemResults[itemId];

                // Defensive check: ensure DB quantity is sufficient for the deduction to avoid negative inventory
                const dbQty = (itemDataMap[itemId].quantity || 0);
                if (dbQty < res.totalDeducted) {
                    throw new Error(`Insufficient inventory for item ${itemId}: available ${dbQty}, required ${res.totalDeducted}`);
                }

                console.log('[INVENTORY] applying update for', itemId, { dbQty, deduct: res.totalDeducted });

                // If a synthetic batch was prepared earlier, persist it now in the same transaction
                if (res.syntheticBatch && res.syntheticBatch.ref && res.syntheticBatch.data) {
                    tx.set(res.syntheticBatch.ref, res.syntheticBatch.data);
                    // Mark item so migration is idempotent
                    tx.update(db.collection('inventory_items').doc(itemId), {
                        fifoQueue: res.ledgerQueue,
                        activePurchaseOrders: res.updatedActivePOs,
                        quantity: firebase.firestore.FieldValue.increment(-res.totalDeducted),
                        updatedAt: nowTs,
                        _has_migration_batch: true
                    });
                } else {
                    tx.update(db.collection('inventory_items').doc(itemId), {
                        fifoQueue: res.ledgerQueue,
                        activePurchaseOrders: res.updatedActivePOs,
                        quantity: firebase.firestore.FieldValue.increment(-res.totalDeducted),
                        updatedAt: nowTs
                    });
                }

                // Add transaction record for this item
                const txRef = db.collection('inventory_transactions').doc();
                tx.set(txRef, {
                    itemId,
                    itemName: itemDataMap[itemId].name,
                    type: 'deduction',
                    quantity: res.totalDeducted,
                    cost: res.totalCost,
                    performedBy,
                    relatedRequestId,
                    timestamp: nowTs
                });
            }

            // Update POs
            for (const pid of Object.keys(poDataMap)) {
                const poRef = db.collection('purchase_orders').doc(pid);
                const poData = poDataMap[pid];
                tx.update(poRef, {
                    items: poData.items,
                    totalValueUsed: poData.totalValueUsed,
                    totalValueRemaining: poData.totalValueRemaining,
                    usagePercentage: poData.usagePercentage,
                    status: poData.status,
                    usageHistory: poData.usageHistory,
                    updatedAt: nowTs
                });
            }

            // Finally, update samples in the same transaction based on caller's intent
            if (markSamplesAsCollected) {
                for (const sid of sampleIds) {
                    tx.update(db.collection('samples').doc(sid), {
                        status: 'collected',
                        collectedAt: nowTs,
                        collectorName: performedBy,
                        collectorId: ''
                    });
                }
            } else if (sampleStatusUpdate) {
                for (const sid of sampleIds) {
                    tx.update(db.collection('samples').doc(sid), sampleStatusUpdate);
                }
            }
        });
        console.log('[INVENTORY] Transaction committed successfully for deductions:', deductions, 'samples:', sampleIds);
    } catch (err) {
        console.error('[INVENTORY] Transaction failed', err, { deductions, sampleIds });
        throw err;
    }

    console.log('[INVENTORY] Transaction committed successfully for deductions:', deductions, 'samples:', sampleIds);
};

export const markPOAsPaid = async (poId: string, paidBy: string): Promise<void> => {
    try {
        await db.collection('purchase_orders').doc(poId).update({
            paymentStatus: 'paid',
            status: 'paid_awaiting_delivery',
            paidDate: firebase.firestore.Timestamp.now(),
            paidBy,
            updatedAt: firebase.firestore.Timestamp.now()
        });
    } catch (error) {
        console.error('Error updating payment status:', error);
        throw error;
    }
};

export const createStockRequisition = async (
    items: { itemId: string; itemName: string; quantity: number; unit: string }[],
    requester: { name: string; email: string; department: string },
    purpose: string
): Promise<string> => {
    const requisitionNumber = `REQ-${new Date().getTime().toString().substr(-6)}`;
    const now = firebase.firestore.Timestamp.now();
    const reqData: Omit<StockRequisition, 'id'> = {
        requisitionNumber,
        requester,
        items,
        purpose,
        status: 'pending',
        createdAt: now,
        updatedAt: now
    };
    const docRef = await db.collection('inventory_requisitions').add(reqData);
    return docRef.id;
};

export const approveRequisition = async (
    reqId: string,
    approvedBy: string
): Promise<void> => {
    try {
        const reqRef = db.collection('inventory_requisitions').doc(reqId);
        const reqDoc = await reqRef.get();
        if (!reqDoc.exists) throw new Error('Requisition not found');
        const reqData = reqDoc.data() as StockRequisition;

        for (const item of reqData.items) {
            await recordInventoryUsage(item.itemId, item.quantity, approvedBy, reqId);
        }

        await reqRef.update({
            status: 'approved',
            approvedBy,
            approvedAt: firebase.firestore.Timestamp.now(),
            updatedAt: firebase.firestore.Timestamp.now()
        });
    } catch (error) {
        console.error('Error approving requisition:', error);
        throw error;
    }
};

export const closePurchaseOrder = async (poId: string, remarks: string, closedBy: string): Promise<void> => {
    try {
        const now = firebase.firestore.Timestamp.now();
        await db.collection('purchase_orders').doc(poId).update({
            status: 'cancelled',
            closureNotes: remarks,
            closedAt: now,
            closedBy: closedBy,
            updatedAt: now
        });
    } catch (error) {
        console.error('Error closing PO:', error);
        throw error;
    }
};

// Requisition Rejection logic
export const rejectRequisition = async (reqId: string, rejectedBy: string, reason: string): Promise<void> => {
    try {
        const reqRef = db.collection('inventory_requisitions').doc(reqId);
        await reqRef.update({
            status: 'rejected',
            rejectedBy,
            rejectedAt: firebase.firestore.Timestamp.now(),
            rejectionReason: reason,
            updatedAt: firebase.firestore.Timestamp.now()
        });
    } catch (error) {
        console.error("Error rejecting requisition:", error);
        throw error;
    }
};

export const processPOReturn = async (
    poId: string,
    returnData: { itemId: string; quantity: number; reason: string; returnValue: number }[],
    performedBy: string
): Promise<void> => {
    try {
        const poRef = db.collection('purchase_orders').doc(poId);
        const poDoc = await poRef.get();
        if (!poDoc.exists) throw new Error('Purchase Order not found');
        const poData = poDoc.data() as PurchaseOrder;

        const now = firebase.firestore.Timestamp.now();
        const batch = db.batch();

        for (const ret of returnData) {
            // Update the Inventory Item stock and Ledger Queue
            const itemRef = db.collection('inventory_items').doc(ret.itemId);
            const itemDoc = await itemRef.get();
            if (itemDoc.exists) {
                const itemData = itemDoc.data() as any;
                let ledgerQueue = [...(itemData.fifoQueue || [])];

                // Deduct from batches linked to THIS PO
                let remainingToDeduct = ret.quantity;
                ledgerQueue = ledgerQueue.map(b => {
                    if (b.poId === poId && remainingToDeduct > 0) {
                        const canDeduct = Math.min(b.quantityRemaining, remainingToDeduct);
                        remainingToDeduct -= canDeduct;
                        return { ...b, quantityRemaining: b.quantityRemaining - canDeduct };
                    }
                    return b;
                }).filter(b => b.quantityRemaining > 0);

                if (remainingToDeduct > 0) {
                    throw new Error(`Insufficient stock in PO batches to return ${ret.quantity}. Missing: ${remainingToDeduct}`);
                }

                batch.update(itemRef, {
                    quantity: firebase.firestore.FieldValue.increment(-ret.quantity),
                    fifoQueue: ledgerQueue,
                    updatedAt: now
                });

                // Add transaction record
                const txRef = db.collection('inventory_transactions').doc();
                batch.set(txRef, {
                    itemId: ret.itemId,
                    itemName: itemData.name,
                    type: 'return',
                    quantity: ret.quantity,
                    reason: ret.reason,
                    poId: poId,
                    cost: ret.returnValue,
                    performedBy,
                    timestamp: now
                });
            }
        }

        // Update the Purchase Order items and totals
        const updatedItems = poData.items.map(poItem => {
            const retItem = returnData.find(r => r.itemId === poItem.itemId);
            if (retItem) {
                const subtotalImpact = retItem.quantity * poItem.unitPrice;
                return {
                    ...poItem,
                    quantity: poItem.quantity - retItem.quantity,
                    quantityReceived: (poItem.quantityReceived || 0) - retItem.quantity,
                    totalPrice: poItem.totalPrice - subtotalImpact,
                    valueRemaining: (poItem.valueRemaining || 0) - subtotalImpact
                };
            }
            return poItem;
        });

        const newSubtotal = updatedItems.reduce((sum, i) => sum + i.totalPrice, 0);
        const newTaxAmount = (newSubtotal * poData.taxPercentage) / 100;
        const newTotalAmount = newSubtotal + newTaxAmount;
        const totalReturnValue = returnData.reduce((sum, r) => sum + r.returnValue, 0);

        batch.update(poRef, {
            items: updatedItems,
            subtotal: newSubtotal,
            taxAmount: newTaxAmount,
            totalAmount: newTotalAmount,
            totalValueRemaining: (poData.totalValueRemaining || 0) - totalReturnValue,
            updatedAt: now,
            returnHistory: firebase.firestore.FieldValue.arrayUnion({
                timestamp: now,
                items: returnData,
                performedBy
            })
        });

        await batch.commit();
    } catch (error) {
        console.error('Error processing PO return:', error);
        throw error;
    }
};
