import React, { useState } from 'react';
import { X, RotateCcw, AlertTriangle, ArrowLeftRight } from 'lucide-react';
import { processPOReturn } from './purchaseOrderUtils';
import firebase from 'firebase/compat/app';

interface POReturnModalProps {
    isOpen: boolean;
    onClose: () => void;
    purchaseOrder: any;
    currentUser: string;
    onSuccess: () => void;
}

interface ReturnItem {
    quantity: number;
    reason: string;
    returnValue: number;
}

const POReturnModal: React.FC<POReturnModalProps> = ({ isOpen, onClose, purchaseOrder, currentUser, onSuccess }) => {
    const [returns, setReturns] = useState<Record<string, ReturnItem>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen || !purchaseOrder) return null;

    const handleReturnQtyChange = (itemId: string, qty: number, unitPrice: number) => {
        setReturns({
            ...returns,
            [itemId]: {
                ...returns[itemId],
                quantity: qty,
                reason: returns[itemId]?.reason || '',
                returnValue: qty * unitPrice
            }
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const activeReturns = (Object.entries(returns) as [string, ReturnItem][])
            .filter(([_, data]) => data.quantity > 0)
            .map(([itemId, data]) => ({
                itemId,
                quantity: data.quantity,
                reason: data.reason,
                returnValue: data.returnValue
            }));

        if (activeReturns.length === 0) return;

        setIsSubmitting(true);
        try {
            await processPOReturn(purchaseOrder.id, activeReturns, currentUser);
            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            alert('Failed to process return: ' + (error instanceof Error ? error.message : String(error)));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[10002] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-red-100">
                <div className="px-6 py-4 border-b border-red-50 flex justify-between items-center bg-red-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 rounded-lg text-red-600">
                            <RotateCcw className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Return Items</h2>
                            <p className="text-sm text-gray-500">Processing returns for {purchaseOrder.poNumber}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-red-100 rounded-full transition-colors text-red-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                        <p className="text-sm text-amber-800">
                            Returning items will deduct stock from the ledger and update the PO's financial balance.
                            If items were already consumed, the deduction might fail or cause negative inventory rules to trigger.
                        </p>
                    </div>

                    <div className="space-y-4">
                        {purchaseOrder.items.map((item: any, idx: number) => {
                            const retData = returns[item.itemId] || { quantity: 0, reason: '', returnValue: 0 };
                            const maxReturn = item.quantityReceived || 0;

                            return (
                                <div key={idx} className="border rounded-xl p-4 bg-gray-50/50 space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-bold text-gray-900">{item.itemName}</h4>
                                            <p className="text-xs text-gray-500">Received: {item.quantityReceived || 0} {item.unit} | Unit Price: Rs.{item.unitPrice}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-bold text-gray-400 uppercase">Available to Return</p>
                                            <p className="text-lg font-black text-gray-800">{maxReturn} {item.unit}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 uppercase">Return Quantity</label>
                                            <input
                                                type="number"
                                                max={maxReturn}
                                                min={0}
                                                className="w-full p-2 border rounded text-sm mt-1"
                                                value={retData.quantity}
                                                onChange={e => handleReturnQtyChange(item.itemId, Math.min(maxReturn, parseFloat(e.target.value) || 0), item.unitPrice)}
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase">Reason for Return</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. Damascus on arrival, incorrect spec..."
                                                className="w-full p-2 border rounded text-sm mt-1"
                                                value={retData.reason}
                                                onChange={e => setReturns({ ...returns, [item.itemId]: { ...retData, reason: e.target.value } })}
                                                required={retData.quantity > 0}
                                            />
                                        </div>
                                    </div>
                                    {retData.quantity > 0 && (
                                        <div className="flex justify-between items-center pt-2 border-t border-gray-100 italic">
                                            <span className="text-xs text-gray-500 flex items-center gap-1"><ArrowLeftRight className="w-3 h-3" /> Financial Adjustment</span>
                                            <span className="text-sm font-bold text-red-600">- Rs.{retData.returnValue.toLocaleString()}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </form>

                <div className="px-6 py-4 border-t bg-gray-50 flex justify-between items-center">
                    <div className="text-xs text-gray-500 italic">
                        All returns are logged to the audit trail.
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-5 py-2 text-sm font-bold text-gray-600 hover:text-gray-800 transition-colors">Cancel</button>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting || Object.values(returns).every((r: ReturnItem) => r.quantity === 0)}
                            className={`px-8 py-2 rounded-lg font-bold shadow-lg transition-all flex items-center gap-2 ${isSubmitting || Object.values(returns).every((r: ReturnItem) => r.quantity === 0)
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-red-600 text-white hover:bg-red-700 active:scale-95'
                                }`}
                        >
                            {isSubmitting ? 'Processing...' : 'Process Return'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default POReturnModal;
