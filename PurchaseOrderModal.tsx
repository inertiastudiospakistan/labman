import React, { useState } from 'react';
import { X, Printer, Download, CheckCircle2, AlertCircle, DollarSign, Calendar } from 'lucide-react';
import ReceiveItemsModal from './ReceiveItemsModal';

interface PurchaseOrder {
    id: string;
    poNumber: string;
    orderDate: any;
    supplierName: string;
    supplierPhone?: string;
    supplierAddress?: string;
    requisitionRef?: string;
    expectedDeliveryDate?: any;
    allowPartialDelivery: boolean;
    items: {
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
        quantityReceived: number;
        quantityRejected: number;
        status: 'pending' | 'partially_received' | 'fully_received' | 'over_received' | 'closed';
        receiptHistory: any[];
    }[];
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

interface PurchaseOrderModalProps {
    isOpen: boolean;
    purchaseOrder: PurchaseOrder | null;
    onClose: () => void;
    onMarkPaid?: (poId: string) => Promise<void>;
    onPrint: () => void;
    onDownloadPDF: () => void;
    onReceive?: (poId: string, receipts?: any[]) => Promise<void>;
    onCancel?: (poId: string, remarks: string) => Promise<void>;
    showPrompt?: (message: string, options?: any) => Promise<string | null>;
}

const PurchaseOrderModal: React.FC<PurchaseOrderModalProps> = ({
    isOpen,
    purchaseOrder,
    onClose,
    onMarkPaid,
    onPrint,
    onDownloadPDF,
    onReceive,
    onCancel,
    showPrompt
}) => {
    const [showReceiveModal, setShowReceiveModal] = useState(false);

    if (!isOpen || !purchaseOrder) return null;

    const formatDate = (date: any) => {
        if (!date) return '--';
        try {
            const d = date.toDate ? date.toDate() : new Date(date);
            return d.toLocaleDateString();
        } catch (e) {
            return '--';
        }
    };

    const formatDateTime = (date: any) => {
        if (!date) return '--';
        try {
            const d = date.toDate ? date.toDate() : new Date(date);
            return d.toLocaleString();
        } catch (e) {
            return '--';
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
                id="po-print-area"
            >
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center z-10">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Purchase Order</h2>
                        <p className="text-sm text-gray-500">PO #{purchaseOrder.poNumber}</p>
                    </div>
                    <div className="flex gap-2">
                        {(purchaseOrder.status === 'paid_awaiting_delivery' || purchaseOrder.status === 'partially_received') && onReceive && (
                            <button
                                onClick={() => setShowReceiveModal(true)}
                                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 print:hidden"
                            >
                                <CheckCircle2 className="w-4 h-4" />
                                Receive Stock
                            </button>
                        )}
                        {purchaseOrder.status === 'pending_payment' && onMarkPaid && (
                            <button
                                onClick={() => onMarkPaid(purchaseOrder.id)}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 print:hidden"
                            >
                                <DollarSign className="w-4 h-4" />
                                Mark as Paid
                            </button>
                        )}
                        <button
                            onClick={onPrint}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 print:hidden"
                        >
                            <Printer className="w-4 h-4" />
                            Print
                        </button>
                        <button
                            onClick={onDownloadPDF}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 print:hidden"
                        >
                            <Download className="w-4 h-4" />
                            PDF
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg print:hidden">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-8">
                    {/* Company & PO Info */}
                    <div className="flex justify-between mb-8">
                        <div>
                            <h1 className="text-3xl font-bold text-blue-600">LABPRO PLUS</h1>
                            <p className="text-sm text-gray-600">Diagnostic OS</p>
                            <p className="text-xs text-gray-500 mt-1">Laboratory Management System</p>
                        </div>
                        <div className="text-right">
                            <div className="inline-block bg-blue-50 border-2 border-blue-600 px-4 py-2 rounded-lg">
                                <p className="text-xs text-gray-600 uppercase">Purchase Order</p>
                                <p className="text-xl font-bold text-blue-600">{purchaseOrder.poNumber}</p>
                            </div>
                            <p className="text-sm text-gray-600 mt-2">Date: {formatDate(purchaseOrder.orderDate)}</p>
                        </div>
                    </div>

                    {/* Supplier Details */}
                    <div className="bg-gray-50 rounded-lg p-4 mb-6">
                        <h3 className="text-sm font-bold text-gray-700 uppercase mb-2">Supplier Details</h3>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <p className="text-xs text-gray-500">Name</p>
                                <p className="text-sm font-semibold text-gray-900">{purchaseOrder.supplierName}</p>
                            </div>
                            {purchaseOrder.supplierPhone && (
                                <div>
                                    <p className="text-xs text-gray-500">Phone</p>
                                    <p className="text-sm text-gray-900">{purchaseOrder.supplierPhone}</p>
                                </div>
                            )}
                            {purchaseOrder.supplierAddress && (
                                <div className="col-span-2">
                                    <p className="text-xs text-gray-500">Address</p>
                                    <p className="text-sm text-gray-900">{purchaseOrder.supplierAddress}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Line Items */}
                    <div className="mb-6">
                        <h3 className="text-sm font-bold text-gray-700 uppercase mb-3">Order Details</h3>
                        <div className="border border-gray-300 rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="px-4 py-2 text-left font-semibold text-gray-700">#</th>
                                        <th className="px-4 py-2 text-left font-semibold text-gray-700">Item Name</th>
                                        <th className="px-4 py-2 text-right font-semibold text-gray-700">Ord</th>
                                        <th className="px-4 py-2 text-right font-semibold text-gray-700">Rec</th>
                                        <th className="px-4 py-2 text-right font-semibold text-gray-700">Rem</th>
                                        <th className="px-4 py-2 text-center font-semibold text-gray-700">Status</th>
                                        <th className="px-4 py-2 text-right font-semibold text-gray-700">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {purchaseOrder.items.map((item, index) => (
                                        <React.Fragment key={index}>
                                            <tr className="border-t border-gray-200">
                                                <td className="px-4 py-3 text-gray-600">{index + 1}</td>
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-gray-900">{item.itemName}</div>
                                                    {item.batchNumber && (
                                                        <div className="text-xs text-gray-500">Batch: {item.batchNumber}</div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right text-gray-900">{item.quantity}</td>
                                                <td className="px-4 py-3 text-right text-green-700 font-bold">{item.quantityReceived || 0}</td>
                                                <td className="px-4 py-3 text-right text-orange-700">{item.quantity - (item.quantityReceived || 0)}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${item.status === 'fully_received' ? 'bg-green-100 text-green-700' :
                                                        item.status === 'partially_received' ? 'bg-yellow-100 text-yellow-700' :
                                                            'bg-gray-100 text-gray-500'
                                                        }`}>
                                                        {item.status || 'pending'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right font-semibold text-gray-900">Rs.{item.totalPrice.toFixed(2)}</td>
                                            </tr>
                                            {item.receiptHistory && item.receiptHistory.length > 0 && (
                                                <tr className="bg-gray-50/30">
                                                    <td colSpan={7} className="px-10 py-3 border-t border-gray-100">
                                                        <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">Receipt History</div>
                                                        <div className="space-y-1.5">
                                                            {item.receiptHistory.map((log: any, lIdx: number) => (
                                                                <div key={lIdx} className="flex justify-between items-center text-xs p-2 rounded-lg border border-gray-100 bg-white shadow-sm ring-1 ring-black/5">
                                                                    <div className="flex items-center gap-4">
                                                                        <span className="font-mono text-gray-500 text-[10px]">{formatDateTime(log.timestamp)}</span>
                                                                        <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded font-bold">+{log.quantityAccepted} Accepted</span>
                                                                        {log.quantityRejected > 0 && <span className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded font-bold">-{log.quantityRejected} Rejected</span>}
                                                                        <span className="text-gray-400 font-medium">By: {log.receivedBy}</span>
                                                                    </div>
                                                                    {log.remarks && (
                                                                        <div className="text-gray-500 italic text-[10px] bg-gray-50 px-2 py-1 rounded truncate max-w-[200px]" title={log.remarks}>
                                                                            "{log.remarks}"
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Totals */}
                    <div className="flex justify-end mb-6">
                        <div className="w-80">
                            <div className="flex justify-between py-2 border-b border-gray-200">
                                <span className="text-gray-600">Subtotal:</span>
                                <span className="font-semibold text-gray-900">Rs.{purchaseOrder.subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-gray-200">
                                <span className="text-gray-600">Tax ({purchaseOrder.taxPercentage}%):</span>
                                <span className="font-semibold text-gray-900">Rs.{purchaseOrder.taxAmount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between py-3 bg-blue-50 px-4 rounded-lg mt-2">
                                <span className="text-lg font-bold text-gray-900">TOTAL:</span>
                                <span className="text-lg font-bold text-blue-600">Rs.{purchaseOrder.totalAmount.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* Payment Terms */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-gray-50 rounded-lg p-4">
                            <h3 className="text-sm font-bold text-gray-700 uppercase mb-2">Payment Terms</h3>
                            <div className="space-y-1">
                                <p className="text-sm text-gray-900">Terms: <span className="font-semibold">{purchaseOrder.paymentTerms}</span></p>
                                <p className="text-sm text-gray-900">Due Date: <span className="font-semibold">{formatDate(purchaseOrder.paymentDueDate)}</span></p>
                            </div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4">
                            <h3 className="text-sm font-bold text-gray-700 uppercase mb-2">Payment Status</h3>
                            {purchaseOrder.paymentStatus === 'paid' ? (
                                <div>
                                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                                        <CheckCircle2 className="w-4 h-4" />
                                        PAID
                                    </span>
                                    <p className="text-xs text-gray-600 mt-2">Paid on: {formatDate(purchaseOrder.paidDate)}</p>
                                    <p className="text-xs text-gray-600">By: {purchaseOrder.paidBy}</p>
                                </div>
                            ) : (
                                <div>
                                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-semibold">
                                        <AlertCircle className="w-4 h-4" />
                                        UNPAID
                                    </span>
                                    {onMarkPaid && (
                                        <button
                                            onClick={() => onMarkPaid(purchaseOrder.id)}
                                            className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline print:hidden"
                                        >
                                            Mark as Paid
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Usage Tracking */}
                    <div className="bg-purple-50 rounded-lg p-4 mb-6">
                        <h3 className="text-sm font-bold text-gray-700 uppercase mb-3">Inventory Usage Tracking</h3>
                        <div className="grid grid-cols-3 gap-4 mb-3">
                            <div>
                                <p className="text-xs text-gray-600">Value Used</p>
                                <p className="text-lg font-bold text-purple-700">Rs.{purchaseOrder.totalValueUsed.toFixed(2)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-600">Value Remaining</p>
                                <p className="text-lg font-bold text-orange-700">Rs.{purchaseOrder.totalValueRemaining.toFixed(2)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-600">Usage Rate</p>
                                <p className="text-lg font-bold text-blue-700">{purchaseOrder.usagePercentage.toFixed(1)}%</p>
                            </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                            <div
                                className="bg-purple-600 h-3 rounded-full transition-all duration-300"
                                style={{ width: `${purchaseOrder.usagePercentage}%` }}
                            ></div>
                        </div>
                    </div>

                    {/* Additional Details */}
                    {(purchaseOrder.notes || purchaseOrder.referenceNumber) && (
                        <div className="bg-gray-50 rounded-lg p-4 mb-6">
                            <h3 className="text-sm font-bold text-gray-700 uppercase mb-2">Additional Details</h3>
                            {purchaseOrder.referenceNumber && (
                                <p className="text-sm text-gray-900 mb-1">
                                    <span className="text-gray-600">Reference #:</span> {purchaseOrder.referenceNumber}
                                </p>
                            )}
                            {purchaseOrder.notes && (
                                <p className="text-sm text-gray-900">
                                    <span className="text-gray-600">Notes:</span> {purchaseOrder.notes}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Footer Actions */}
                    <div className="mt-8 pt-4 border-t border-gray-200 flex justify-between items-center print:hidden">
                        <div>
                            {purchaseOrder.status !== 'cancelled' && purchaseOrder.status !== 'fully_used' && (
                                <button
                                    onClick={async () => {
                                        let remarks: string | null = null;
                                        if (showPrompt) {
                                            remarks = await showPrompt('Cancel Purchase Order', {
                                                title: 'Cancel Order',
                                                placeholder: 'Reason for cancellation...',
                                                defaultValue: ''
                                            });
                                        } else {
                                            remarks = window.prompt('Enter reason for closing this order:');
                                        }

                                        if (remarks && onCancel) onCancel(purchaseOrder.id, remarks);
                                    }}
                                    className="text-red-600 hover:text-red-700 text-xs font-bold uppercase flex items-center gap-1 transition-colors"
                                >
                                    <X className="w-3 h-3" />
                                    Cancel Order / Close Short
                                </button>
                            )}
                        </div>
                        <div className="text-right text-[10px] text-gray-400">
                            <p>Generated by: {purchaseOrder.createdBy}</p>
                            <p>Generated on: {formatDateTime(purchaseOrder.createdAt)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Print Styles */}
            <style>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    #po-print-area, #po-print-area * {
                        visibility: visible;
                    }
                    #po-print-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        max-width: 100%;
                        max-height: none;
                        overflow: visible;
                    }
                    .print\\:hidden {
                        display: none !important;
                    }
                }
            `}</style>

            <ReceiveItemsModal
                isOpen={showReceiveModal}
                onClose={() => setShowReceiveModal(false)}
                poItems={purchaseOrder.items}
                onConfirm={async (receipts) => {
                    if (onReceive) await onReceive(purchaseOrder.id, receipts);
                    setShowReceiveModal(false);
                }}
            />
        </div>
    );
};

export default PurchaseOrderModal;
