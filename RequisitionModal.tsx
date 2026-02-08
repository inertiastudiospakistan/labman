import React, { useState, useEffect, useMemo } from 'react';
import { X, ClipboardCheck, Plus, Trash2, Search, Info } from 'lucide-react';
import { createStockRequisition } from './purchaseOrderUtils';

interface RequisitionModalProps {
    isOpen: boolean;
    onClose: () => void;
    inventoryItems: any[];
    onSuccess: (reqId: string) => void;
    currentUser: { name: string, email: string, department: string };
}

const RequisitionModal: React.FC<RequisitionModalProps> = ({ isOpen, onClose, inventoryItems, onSuccess, currentUser }) => {
    const [selectedItems, setSelectedItems] = useState<{
        itemId: string;
        itemName: string;
        quantity: number;
        unit: string;
    }[]>([]);

    const [purpose, setPurpose] = useState('Daily Operations');
    const [searchTerm, setSearchTerm] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const filteredItems = useMemo(() => {
        if (!searchTerm.trim()) return [];
        return inventoryItems.filter(item =>
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.category.toLowerCase().includes(searchTerm.toLowerCase())
        ).slice(0, 10);
    }, [searchTerm, inventoryItems]);

    const addItem = (item: any) => {
        if (selectedItems.find(i => i.itemId === item.id)) return;
        setSelectedItems([...selectedItems, {
            itemId: item.id,
            itemName: item.name,
            quantity: 1,
            unit: item.unit
        }]);
        setSearchTerm('');
    };

    const updateItem = (index: number, quantity: number) => {
        const newItems = [...selectedItems];
        newItems[index].quantity = quantity;
        setSelectedItems(newItems);
    };

    const removeItem = (index: number) => {
        setSelectedItems(selectedItems.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedItems.length === 0 || !purpose.trim()) return;

        setIsSubmitting(true);
        try {
            const reqId = await createStockRequisition(
                selectedItems,
                currentUser,
                purpose
            );
            onSuccess(reqId);
            onClose();
        } catch (error) {
            console.error(error);
            alert('Failed to submit requisition');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-[10001] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-indigo-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                            <ClipboardCheck className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Internal Stock Requisition</h2>
                            <p className="text-sm text-gray-500">Request consumables for clinical or lab use</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Requester Info */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex gap-4">
                        <div className="flex-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Requester</label>
                            <p className="text-sm font-bold text-gray-800">{currentUser.name}</p>
                        </div>
                        <div className="flex-1 border-l pl-4">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Department</label>
                            <p className="text-sm font-bold text-gray-800">{currentUser.department}</p>
                        </div>
                    </div>

                    {/* Purpose */}
                    <div>
                        <label className="text-xs font-bold text-gray-500 mb-2 block uppercase">Purpose of Request</label>
                        <select
                            className="w-full p-2.5 border rounded-lg text-sm bg-white shadow-sm"
                            value={purpose} onChange={e => setPurpose(e.target.value)}
                        >
                            <option value="Daily Operations">Daily Operations / Routine Testing</option>
                            <option value="Emergency">Emergency / Urgency</option>
                            <option value="Sample Redo">Sample Collection Redo</option>
                            <option value="Research">Research & Development</option>
                            <option value="Other">Other (Specify in notes)</option>
                        </select>
                    </div>

                    {/* Item Search */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-500 uppercase flex items-center justify-between">
                            <span>Add Items from Stock</span>
                            <span className="text-[10px] font-normal text-gray-400 normal-case">Available items in inventory</span>
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Start typing item name (e.g., Blood Tube, Reagent...)"
                                className="w-full p-3 pl-10 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-3" />

                            {filteredItems.length > 0 && (
                                <div className="absolute top-full left-0 right-0 bg-white border rounded-xl shadow-2xl z-20 mt-2 max-h-56 overflow-y-auto ring-1 ring-black/5">
                                    {filteredItems.map(item => (
                                        <button
                                            key={item.id} type="button"
                                            onClick={() => addItem(item)}
                                            className="w-full text-left p-3 hover:bg-indigo-50 text-sm border-b last:border-0 flex justify-between items-center transition-colors"
                                        >
                                            <div>
                                                <p className="font-bold">{item.name}</p>
                                                <p className="text-[10px] text-gray-500">Stock: {item.quantity} {item.unit}</p>
                                            </div>
                                            <div className="p-1 bg-indigo-100 rounded text-indigo-600">
                                                <Plus className="w-4 h-4" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Selected Items */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <h3 className="text-sm font-bold text-gray-700">Requested Items ({selectedItems.length})</h3>
                        </div>

                        <div className="border rounded-xl overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-gray-500 border-b">
                                    <tr>
                                        <th className="p-3 text-left">Item</th>
                                        <th className="p-3 w-32 text-center">Quantity</th>
                                        <th className="p-3 w-12"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {selectedItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="p-12 text-center text-gray-400">
                                                <Info className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                                <p>No items selected. Search to add consumables.</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        selectedItems.map((item, idx) => {
                                            const stockItem = inventoryItems.find(i => i.id === item.itemId);
                                            const maxStock = stockItem ? stockItem.quantity : 0;
                                            return (
                                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                    <td className="p-3">
                                                        <p className="font-bold text-slate-800">{item.itemName}</p>
                                                        <p className="text-[10px] text-slate-500">{item.unit}</p>
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="number" min="0.1" step="any"
                                                                className="w-full p-1.5 border rounded text-center font-bold text-indigo-700 focus:ring-1 focus:ring-indigo-500 outline-none"
                                                                value={item.quantity}
                                                                onChange={e => updateItem(idx, parseFloat(e.target.value) || 0)}
                                                            />
                                                        </div>
                                                        {item.quantity > maxStock && (
                                                            <p className="text-[9px] text-red-500 mt-1 font-bold">Exceeds Stock ({maxStock})</p>
                                                        )}
                                                    </td>
                                                    <td className="p-3">
                                                        <button onClick={() => removeItem(idx)} className="text-gray-400 hover:text-red-500 p-1 rounded-lg transition-colors">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </form>

                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center shrink-0">
                    <p className="text-[10px] text-gray-400 max-w-[200px]">
                        Requisitions require manager approval before stocks are released.
                    </p>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-5 py-2 text-sm font-bold text-gray-600 hover:text-gray-800">Cancel</button>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting || selectedItems.length === 0 || selectedItems.some(i => {
                                const s = inventoryItems.find(si => si.id === i.itemId);
                                return i.quantity > (s?.quantity || 0);
                            })}
                            className={`px-8 py-2 rounded-lg font-bold shadow-lg transition-all flex items-center gap-2 ${isSubmitting || selectedItems.length === 0 || selectedItems.some(i => {
                                const s = inventoryItems.find(si => si.id === i.itemId);
                                return i.quantity > (s?.quantity || 0);
                            })
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'
                                }`}
                        >
                            {isSubmitting ? 'Submitting...' : 'Submit Requisition'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RequisitionModal;
