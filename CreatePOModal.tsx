import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Search, DollarSign, Calendar, Truck } from 'lucide-react';
import firebase from 'firebase/compat/app';
import { db } from './firebase';
import { generatePurchaseOrder } from './purchaseOrderUtils';

interface CreatePOModalProps {
    isOpen: boolean;
    onClose: () => void;
    inventoryItems: any[];
    onSuccess: () => void;
    currentUser: string;
    showPrompt?: (message: string, options?: any) => Promise<string | null>;
    showAlert?: (type: 'success' | 'error' | 'warning' | 'info', message: string, title?: string) => Promise<void>;
}

const CreatePOModal: React.FC<CreatePOModalProps> = ({ isOpen, onClose, inventoryItems, onSuccess, currentUser, showPrompt, showAlert }) => {
    const [selectedItems, setSelectedItems] = useState<{
        itemId: string;
        itemName: string;
        quantity: number;
        unit: string;
        unitPrice: number;
        description?: string;
    }[]>([]);

    const [supplier, setSupplier] = useState({ name: '', phone: '', address: '' });
    const [taxPercentage, setTaxPercentage] = useState(0);
    const [paymentTerms, setPaymentTerms] = useState('Net 30');
    const [options, setOptions] = useState({
        referenceNumber: '',
        notes: '',
        expectedDeliveryDate: '',
        allowPartialDelivery: true
    });
    const [newItemMetadata, setNewItemMetadata] = useState<Record<string, {
        category: string;
        unit: string;
        minLevel: number;
        description: string;
    }>>({});

    const [searchTerm, setSearchTerm] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Inline Add Item State
    const [isManuallyAdding, setIsManuallyAdding] = useState(false);
    const [manualItemName, setManualItemName] = useState('');

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
            unit: item.unit,
            unitPrice: item.purchasePrice || 0
        }]);
        setSearchTerm('');
    };

    // Helper to add a completely new manual item
    const addManualItem = (name: string) => {
        if (!name.trim()) return;
        const newId = `new-${Date.now()}`;
        setSelectedItems([...selectedItems, {
            itemId: newId,
            itemName: name.trim(),
            quantity: 1,
            unit: 'pcs',
            unitPrice: 0
        }]);
        setNewItemMetadata({
            ...newItemMetadata,
            [newId]: {
                category: 'General',
                unit: 'pcs',
                minLevel: 10,
                description: ''
            }
        });
        // Reset states
        setSearchTerm('');
        setIsManuallyAdding(false);
        setManualItemName('');
    };

    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...selectedItems];
        (newItems[index] as any)[field] = value;
        setSelectedItems(newItems);
    };

    const removeItem = (index: number) => {
        setSelectedItems(selectedItems.filter((_, i) => i !== index));
    };

    const subtotal = selectedItems.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0);
    const taxAmount = (subtotal * taxPercentage) / 100;
    const total = subtotal + taxAmount;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedItems.length === 0 || !supplier.name) return;

        setIsSubmitting(true);
        try {
            // Logic to register new items first
            const finalItems = await Promise.all(selectedItems.map(async (item) => {
                if (item.itemId.startsWith('new-')) {
                    const metadata = newItemMetadata[item.itemId] || {
                        category: 'General',
                        unit: 'pcs',
                        minLevel: 10,
                        description: ''
                    };

                    const now = firebase.firestore.Timestamp.now();
                    const itemData = {
                        name: item.itemName,
                        category: metadata.category,
                        unit: item.unit || metadata.unit,
                        minLevel: metadata.minLevel,
                        description: metadata.description,
                        quantity: 0,
                        purchasePrice: item.unitPrice,
                        status: 'out_of_stock',
                        createdAt: now,
                        updatedAt: now,
                        createdBy: currentUser,
                        vendorName: supplier.name
                    };

                    const docRef = await db.collection('inventory_items').add(itemData);
                    return {
                        ...item,
                        itemId: docRef.id
                    };
                }
                return item;
            }));

            await generatePurchaseOrder(
                finalItems,
                supplier,
                taxPercentage,
                paymentTerms,
                currentUser,
                {
                    ...options,
                    expectedDeliveryDate: options.expectedDeliveryDate ? new Date(options.expectedDeliveryDate) : undefined,
                    status: 'pending_payment'
                }
            );
            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            if (showAlert) {
                await showAlert('error', 'Failed to generate Purchase Order. Please try again.', 'Submission Error');
            } else {
                alert('Failed to generate PO');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-[10001] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                            <Plus className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Generate Purchase Order</h2>
                            <p className="text-sm text-gray-500">Create a new multi-line procurement request</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8">
                    {/* Supplier & Logistics */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-gray-700 uppercase flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-green-600" /> Supplier Information
                            </h3>
                            <div className="grid grid-cols-1 gap-3">
                                <input
                                    type="text" required placeholder="Supplier Name"
                                    className="w-full p-2 border rounded-lg text-sm"
                                    value={supplier.name} onChange={e => setSupplier({ ...supplier, name: e.target.value })}
                                />
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        type="text" placeholder="Phone"
                                        className="w-full p-2 border rounded-lg text-sm"
                                        value={supplier.phone} onChange={e => setSupplier({ ...supplier, phone: e.target.value })}
                                    />
                                    <input
                                        type="text" placeholder="Address (Optional)"
                                        className="w-full p-2 border rounded-lg text-sm"
                                        value={supplier.address} onChange={e => setSupplier({ ...supplier, address: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-gray-700 uppercase flex items-center gap-2">
                                <Truck className="w-4 h-4 text-blue-600" /> Logistics & Terms
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">Expected Delivery</label>
                                    <input
                                        type="date"
                                        className="w-full p-2 border rounded-lg text-sm"
                                        value={options.expectedDeliveryDate} onChange={e => setOptions({ ...options, expectedDeliveryDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">Payment Terms</label>
                                    <select
                                        className="w-full p-2 border rounded-lg text-sm"
                                        value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)}
                                    >
                                        <option value="Immediate">Immediate</option>
                                        <option value="Net 15">Net 15 Days</option>
                                        <option value="Net 30">Net 30 Days</option>
                                        <option value="Net 60">Net 60 Days</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Item Selection */}
                    <div className="space-y-4 pt-4 border-t">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h3 className="text-sm font-bold text-gray-700 uppercase">Order Items</h3>
                                <p className="text-[10px] text-gray-400 mt-1 uppercase leading-none">Search inventory or add custom items below</p>
                            </div>

                            <div className="flex items-center gap-2 w-full md:w-auto">
                                <div className="relative flex-1 md:w-72">
                                    <input
                                        type="text"
                                        placeholder="Search inventory..."
                                        className="w-full p-2 pl-8 border rounded-lg text-sm bg-gray-50 focus:bg-white transition-all"
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                    />
                                    <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />

                                    {searchTerm.trim() && (
                                        <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-xl z-20 mt-1 max-h-64 overflow-y-auto">
                                            {filteredItems.map(item => (
                                                <button
                                                    key={item.id} type="button"
                                                    onClick={() => addItem(item)}
                                                    className="w-full text-left p-3 hover:bg-indigo-50 text-sm border-b last:border-0 flex justify-between items-center transition-colors"
                                                >
                                                    <div>
                                                        <p className="font-bold text-gray-900">{item.name}</p>
                                                        <p className="text-[10px] text-gray-500 uppercase">{item.category} • {item.unit}</p>
                                                    </div>
                                                    <Plus className="w-4 h-4 text-indigo-400" />
                                                </button>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => addManualItem(searchTerm)}
                                                className="w-full text-left p-3 bg-indigo-50 hover:bg-indigo-100 text-sm font-bold text-indigo-700 flex items-center gap-2"
                                            >
                                                <Plus className="w-4 h-4" /> Add "{searchTerm}" as item
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Inline Add Item Toggle */}
                                {isManuallyAdding ? (
                                    <div className="flex items-center gap-1 animate-in fade-in slide-in-from-right-2">
                                        <input
                                            autoFocus
                                            type="text"
                                            placeholder="Item name..."
                                            className="w-40 p-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            value={manualItemName}
                                            onChange={e => setManualItemName(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    addManualItem(manualItemName);
                                                }
                                                if (e.key === 'Escape') {
                                                    setIsManuallyAdding(false);
                                                    setManualItemName('');
                                                }
                                            }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => addManualItem(manualItemName)}
                                            disabled={!manualItemName.trim()}
                                            className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setIsManuallyAdding(false); setManualItemName(''); }}
                                            className="p-2 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setIsManuallyAdding(true)}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700 flex items-center gap-2 shrink-0 transition-transform active:scale-95"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Add Item
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="border rounded-xl overflow-hidden shadow-sm">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-gray-600 font-bold border-b">
                                    <tr>
                                        <th className="p-3 text-left">Item Name</th>
                                        <th className="p-3 w-24 text-center">Unit</th>
                                        <th className="p-3 w-24 text-right">Qty</th>
                                        <th className="p-3 w-32 text-right">Unit Price</th>
                                        <th className="p-3 w-32 text-right">Total</th>
                                        <th className="p-3 w-12"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {selectedItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="p-12 text-center text-gray-400 italic">
                                                No items added yet. Search or use the plus button to add items.
                                            </td>
                                        </tr>
                                    ) : (
                                        selectedItems.map((item, idx) => {
                                            const isNew = item.itemId.startsWith('new-');
                                            return (
                                                <React.Fragment key={idx}>
                                                    <tr className={`hover:bg-gray-50 ${isNew ? 'bg-amber-50/30' : ''}`}>
                                                        <td className="p-3">
                                                            <div className="font-medium text-gray-900">{item.itemName}</div>
                                                            {isNew && (
                                                                <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold uppercase">New Item Definition Required</span>
                                                            )}
                                                        </td>
                                                        <td className="p-3 text-center text-gray-500">
                                                            {isNew ? (
                                                                <input
                                                                    type="text"
                                                                    placeholder="Unit"
                                                                    className="w-16 p-1 border rounded text-center text-xs"
                                                                    value={item.unit}
                                                                    onChange={e => updateItem(idx, 'unit', e.target.value)}
                                                                />
                                                            ) : item.unit}
                                                        </td>
                                                        <td className="p-3">
                                                            <input
                                                                type="number" min="1" step="any"
                                                                className="w-full p-1 border rounded text-right"
                                                                value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                                            />
                                                        </td>
                                                        <td className="p-3">
                                                            <input
                                                                type="number" min="0" step="any"
                                                                className="w-full p-1 border rounded text-right"
                                                                value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                                                            />
                                                        </td>
                                                        <td className="p-3 text-right font-mono font-bold text-indigo-600">
                                                            Rs.{(item.quantity * item.unitPrice).toLocaleString()}
                                                        </td>
                                                        <td className="p-3 flex items-center gap-1 justify-end">
                                                            <button onClick={() => removeItem(idx)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors">
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                    {isNew && (
                                                        <tr className="bg-amber-50/20">
                                                            <td colSpan={6} className="px-3 pb-4">
                                                                <div className="grid grid-cols-4 gap-4 p-4 border border-amber-200 rounded-lg bg-white shadow-inner">
                                                                    <div className="col-span-1">
                                                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Category</label>
                                                                        <select
                                                                            className="w-full p-2 border rounded text-xs mt-1"
                                                                            value={newItemMetadata[item.itemId]?.category || 'General'}
                                                                            onChange={e => setNewItemMetadata({ ...newItemMetadata, [item.itemId]: { ...newItemMetadata[item.itemId], category: e.target.value } })}
                                                                        >
                                                                            {['General', 'Chemicals', 'Reagents', 'Labware', 'Safety'].map(c => <option key={c} value={c}>{c}</option>)}
                                                                        </select>
                                                                    </div>
                                                                    <div className="col-span-1">
                                                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Min Alert Level</label>
                                                                        <input
                                                                            type="number"
                                                                            className="w-full p-2 border rounded text-xs mt-1"
                                                                            value={newItemMetadata[item.itemId]?.minLevel || 0}
                                                                            onChange={e => setNewItemMetadata({ ...newItemMetadata, [item.itemId]: { ...newItemMetadata[item.itemId], minLevel: parseInt(e.target.value) || 0 } })}
                                                                        />
                                                                    </div>
                                                                    <div className="col-span-2">
                                                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Description (Optional)</label>
                                                                        <input
                                                                            type="text"
                                                                            className="w-full p-2 border rounded text-xs mt-1"
                                                                            placeholder="e.g. 500ml glass bottle"
                                                                            value={newItemMetadata[item.itemId]?.description || ''}
                                                                            onChange={e => setNewItemMetadata({ ...newItemMetadata, [item.itemId]: { ...newItemMetadata[item.itemId], description: e.target.value } })}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Summary & Totals */}
                    <div className="flex flex-col md:flex-row justify-between gap-6 pt-6 border-t items-start">
                        <div className="flex-1 w-full">
                            <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Internal Reference / Notes</label>
                            <textarea
                                placeholder="Enter any internal reference numbers or special instructions..."
                                className="w-full p-3 border rounded-xl text-sm h-32 resize-none bg-gray-50 focus:bg-white transition-all"
                                value={options.notes} onChange={e => setOptions({ ...options, notes: e.target.value })}
                            ></textarea>
                        </div>
                        <div className="w-full md:w-80 bg-gray-50 p-4 rounded-xl border border-gray-200">
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Subtotal</span>
                                    <span className="font-bold">Rs.{subtotal.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <div className="flex items-center gap-2">
                                        <span className="text-gray-600">Tax</span>
                                        <input
                                            type="number" className="w-12 p-0.5 border rounded text-xs text-center"
                                            value={taxPercentage} onChange={e => setTaxPercentage(parseFloat(e.target.value) || 0)}
                                        />
                                        <span className="text-xs text-gray-400">%</span>
                                    </div>
                                    <span className="font-bold">Rs.{taxAmount.toLocaleString()}</span>
                                </div>
                                <div className="h-px bg-gray-300 my-2" />
                                <div className="flex justify-between items-center">
                                    <span className="text-lg font-bold text-gray-900">Total</span>
                                    <span className="text-xl font-black text-indigo-600">Rs.{total.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </form>

                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Calendar className="w-3 h-3" />
                        PO will be created today. Last update by {currentUser.split('@')[0]}
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-5 py-2 text-sm font-bold text-gray-600 hover:text-gray-800">Cancel</button>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting || selectedItems.length === 0 || !supplier.name}
                            className={`px-8 py-2 rounded-lg font-bold shadow-lg transition-all flex items-center gap-2 ${isSubmitting || selectedItems.length === 0 || !supplier.name
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'
                                }`}
                        >
                            {isSubmitting ? 'Generating...' : 'Generate PO (Pending Payment)'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreatePOModal;
