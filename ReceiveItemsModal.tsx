import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, Boxes, Calendar } from 'lucide-react';

interface ReceiveItemEntry {
    itemId: string;
    quantityAccepted: number;
    quantityRejected: number;
    batchNumber: string;
    expiryDate: string;
    manufactureDate: string;
    remarks: string;
    type: 'full' | 'partial' | 'excess' | 'damaged';
    qcChecklist: {
        coldChain: boolean;
        packaging: boolean;
        documentation: boolean;
        expiryMatch: boolean;
        batchMatch: boolean;
    };
}

interface ReceiveItemsModalProps {
    isOpen: boolean;
    onClose: () => void;
    poItems: any[]; // PurchaseOrderItem[]
    onConfirm: (receipts: any[]) => Promise<void>;
}

const ReceiveItemsModal: React.FC<ReceiveItemsModalProps> = ({ isOpen, onClose, poItems, onConfirm }) => {
    const [receipts, setReceipts] = useState<Record<string, ReceiveItemEntry>>({});
    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && poItems) {
            // Initialize receipts for items that are not fully received
            const validItems = poItems.filter(i => i.status !== 'fully_received' && i.status !== 'closed');
            const initialReceipts: Record<string, ReceiveItemEntry> = {};

            validItems.forEach(item => {
                const remaining = item.quantity - (item.quantityReceived || 0);
                initialReceipts[item.itemId] = {
                    itemId: item.itemId,
                    quantityAccepted: remaining > 0 ? remaining : 0,
                    quantityRejected: 0,
                    batchNumber: item.batchNumber || '',
                    expiryDate: item.expiryDate ? new Date(item.expiryDate.toDate ? item.expiryDate.toDate() : item.expiryDate).toISOString().split('T')[0] : '',
                    manufactureDate: item.manufactureDate ? new Date(item.manufactureDate.toDate ? item.manufactureDate.toDate() : item.manufactureDate).toISOString().split('T')[0] : '',
                    remarks: '',
                    type: 'full',
                    qcChecklist: {
                        coldChain: true,
                        packaging: true,
                        documentation: true,
                        expiryMatch: true,
                        batchMatch: true
                    }
                };
            });

            setReceipts(initialReceipts);
            setSelectedItems(validItems.map(i => i.itemId));
        }
    }, [isOpen, poItems]);

    const handleReceiptChange = (itemId: string, field: keyof ReceiveItemEntry, value: any) => {
        setReceipts(prev => {
            const current = prev[itemId];
            const updated = { ...current, [field]: value };

            // Auto-detect type
            const item = poItems.find(i => i.itemId === itemId);
            if (item) {
                const remaining = item.quantity - (item.quantityReceived || 0);
                const total = Number(updated.quantityAccepted) + Number(updated.quantityRejected);

                if (updated.quantityRejected > 0) updated.type = 'damaged';
                else if (total > remaining) updated.type = 'excess';
                else if (total < remaining) updated.type = 'partial';
                else updated.type = 'full';
            }

            return { ...prev, [itemId]: updated };
        });
    };

    const toggleSelection = (itemId: string) => {
        setSelectedItems(prev => prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]);
    };

    const handleSubmit = async () => {
        if (selectedItems.length === 0) return;
        setIsSubmitting(true);
        try {
            const payload = selectedItems.map(id => {
                const r = receipts[id];
                return {
                    ...r,
                    quantityAccepted: Number(r.quantityAccepted),
                    quantityRejected: Number(r.quantityRejected),
                    expiryDate: r.expiryDate ? new Date(r.expiryDate) : undefined,
                    manufactureDate: r.manufactureDate ? new Date(r.manufactureDate) : undefined
                };
            });
            await onConfirm(payload);
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[10000] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <Boxes className="w-5 h-5 text-indigo-600" />
                            Receive Items
                        </h2>
                        <p className="text-sm text-gray-500">Select items and enter receipt details</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                            <tr>
                                <th className="p-4 w-10">
                                    <input
                                        type="checkbox"
                                        onChange={(e) => setSelectedItems(e.target.checked ? Object.keys(receipts) : [])}
                                        checked={selectedItems.length > 0 && selectedItems.length === Object.keys(receipts).length}
                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                </th>
                                <th className="p-4 w-1/4">Item Details</th>
                                <th className="p-4">Quantities</th>
                                <th className="p-4">QC Checklist</th>
                                <th className="p-4">Batch & Expiry</th>
                                <th className="p-4">Remarks</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {Object.values(receipts).map((receipt: ReceiveItemEntry) => {
                                const item = poItems.find(i => i.itemId === receipt.itemId);
                                if (!item) return null;
                                const remaining = item.quantity - (item.quantityReceived || 0);

                                return (
                                    <tr key={receipt.itemId} className={`hover:bg-gray-50 ${selectedItems.includes(receipt.itemId) ? 'bg-indigo-50/30' : ''}`}>
                                        <td className="p-4 align-top">
                                            <input
                                                type="checkbox"
                                                checked={selectedItems.includes(receipt.itemId)}
                                                onChange={() => toggleSelection(receipt.itemId)}
                                                className="mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                        </td>
                                        <td className="p-4 align-top">
                                            <p className="font-bold text-gray-900">{item.itemName}</p>
                                            <p className="text-xs text-gray-500">{item.unit}</p>
                                            <div className="mt-2 text-xs flex gap-2">
                                                <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Order: {item.quantity}</span>
                                                <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded">Rec: {item.quantityReceived || 0}</span>
                                                <span className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded">Rem: {remaining}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 align-top space-y-2">
                                            <div className="flex items-center gap-2">
                                                <label className="text-xs w-16 font-medium">Accepted:</label>
                                                <input
                                                    type="number"
                                                    value={receipt.quantityAccepted}
                                                    onChange={(e) => handleReceiptChange(receipt.itemId, 'quantityAccepted', parseFloat(e.target.value))}
                                                    className="w-20 p-1 border rounded text-sm font-bold text-green-700"
                                                    min="0"
                                                />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <label className="text-xs w-16 font-medium text-red-600">Rej/Dmg:</label>
                                                <input
                                                    type="number"
                                                    value={receipt.quantityRejected}
                                                    onChange={(e) => handleReceiptChange(receipt.itemId, 'quantityRejected', parseFloat(e.target.value))}
                                                    className="w-20 p-1 border rounded text-sm text-red-600 border-red-200"
                                                    min="0"
                                                />
                                            </div>
                                            <div className="pt-1">
                                                {receipt.type === 'partial' && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-bold">Partial</span>}
                                                {receipt.type === 'excess' && <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-bold">Excess</span>}
                                                {receipt.type === 'damaged' && <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-bold">Damaged</span>}
                                                {receipt.type === 'full' && <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-bold">Full</span>}
                                            </div>
                                        </td>
                                        <td className="p-4 align-top">
                                            <div className="space-y-1">
                                                {Object.entries(receipt.qcChecklist).map(([key, val]) => (
                                                    <label key={key} className="flex items-center gap-2 cursor-pointer group">
                                                        <input
                                                            type="checkbox"
                                                            checked={val}
                                                            onChange={(e) => {
                                                                const newQC = { ...receipt.qcChecklist, [key]: e.target.checked };
                                                                handleReceiptChange(receipt.itemId, 'qcChecklist', newQC);
                                                            }}
                                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-3 h-3"
                                                        />
                                                        <span className="text-[10px] text-gray-600 group-hover:text-gray-900 capitalize">
                                                            {key.replace(/([A-Z])/g, ' $1').trim()}
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="p-4 align-top space-y-2">
                                            <input
                                                type="text"
                                                placeholder="Batch Number"
                                                value={receipt.batchNumber}
                                                onChange={(e) => handleReceiptChange(receipt.itemId, 'batchNumber', e.target.value)}
                                                className="w-full text-sm border-gray-300 rounded p-1.5"
                                            />
                                            <div className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3 text-gray-400" />
                                                <span className="text-xs text-gray-500">Expiry:</span>
                                                <input
                                                    type="date"
                                                    value={receipt.expiryDate}
                                                    onChange={(e) => handleReceiptChange(receipt.itemId, 'expiryDate', e.target.value)}
                                                    className="flex-1 text-xs border-gray-300 rounded p-1"
                                                />
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3 text-gray-400" />
                                                <span className="text-xs text-gray-500">Mfg:</span>
                                                <input
                                                    type="date"
                                                    value={receipt.manufactureDate}
                                                    onChange={(e) => handleReceiptChange(receipt.itemId, 'manufactureDate', e.target.value)}
                                                    className="flex-1 text-xs border-gray-300 rounded p-1"
                                                />
                                            </div>
                                        </td>
                                        <td className="p-4 align-top">
                                            <textarea
                                                placeholder="Remarks (e.g., Damaged Boxes...)"
                                                value={receipt.remarks}
                                                onChange={(e) => handleReceiptChange(receipt.itemId, 'remarks', e.target.value)}
                                                className="w-full text-sm border-gray-300 rounded p-1.5 h-24 resize-none"
                                            ></textarea>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
                    <button onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || selectedItems.length === 0}
                        className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm transition-all"
                    >
                        {isSubmitting ? 'Processing...' : `Receive ${selectedItems.length} Item(s)`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReceiveItemsModal;
