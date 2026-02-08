import React, { useState, useEffect } from 'react';

// Module-level cache for bill template
let cachedBillTemplate: ReportDesign | null = null;
import { Printer, X, Loader2 } from 'lucide-react';
import { db, auth } from './firebase';
import { ReportPageRenderer } from './ReportRendererCore';
import { ReportDesign } from './ReportSchema';
import { generateQRDataURL } from './QRCodeGenerator';
import { getOrCreateQRToken } from './qrTokenUtils';

// Define ReportData locally since it's not exported
interface ReportData {
    qrToken?: string;
    qrDataUrl?: string;
    patient: any;
    doctor: any;
    invoice: any;
    report: any;
}

export interface PrintableBillData {
    orderId: string;
    patientName: string;
    patientId?: string;
    patientAge?: string;
    patientGender?: string;
    patientPhone?: string;
    tests: Array<{ name: string; price: number }>;
    subtotal: number;
    discount?: number;
    total: number;
    paid?: number;
    paidAmount?: number;
    due?: number;
    paymentMethod?: string;
    date?: any;
}

const BillPrintModal: React.FC<{ data: PrintableBillData; onClose: () => void }> = ({ data, onClose }) => {
    const [template, setTemplate] = useState<ReportDesign | null>(null);
    const [loading, setLoading] = useState(true);
    const [qrData, setQrData] = useState<{ token: string; dataUrl: string } | null>(null);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                // Use cached template if available
                if (cachedBillTemplate) {
                    setTemplate(cachedBillTemplate);
                } else {
                    // Load thermal bill template
                    const snap = await db.collection('bill_templates').where('isPublished', '==', true).get();
                    let templateLoaded = false;
                    for (const doc of snap.docs) {
                        let loaded = doc.data() as any;
                        const isValidBillType = loaded.type === 'invoice' || loaded.type === 'receipt';
                        if (!isValidBillType) continue;
                        if (!loaded.layers && loaded.elements) loaded.layers = loaded.elements;
                        if (!loaded.pageFormat) loaded.pageFormat = 'Thermal80';
                        loaded.isAutoLayout = true;
                        cachedBillTemplate = loaded as ReportDesign;
                        setTemplate(cachedBillTemplate);
                        templateLoaded = true;
                        break;
                    }
                    if (!templateLoaded) {
                        const fallbackDesign: ReportDesign = {
                            name: 'Standard Thermal',
                            type: 'invoice',
                            pageFormat: 'Thermal80',
                            isAutoLayout: true,
                            layers: [],
                            headerStyle: { x: 10, y: 10, width: 282, height: 60 },
                            footerStyle: { x: 10, y: 1050, width: 282, height: 40 },
                            qrStyle: { x: 110, y: 1000, width: 80, height: 80 },
                            contentPadding: { top: 40, bottom: 40 }
                        };
                        cachedBillTemplate = fallbackDesign;
                        setTemplate(fallbackDesign);
                    }
                }

                // Don't block UI on QR generation. Use existing data.qrDataUrl if provided, else generate QR in background.
                if (data.qrDataUrl) {
                    setQrData({ token: data.qrToken || '', dataUrl: data.qrDataUrl });
                } else if (data.orderId) {
                    // Fire-and-forget QR generation so modal appears immediately
                    (async () => {
                        try {
                            const token = await getOrCreateQRToken(
                                data.orderId,
                                data.patientId || 'unknown_patient',
                                'bill',
                                auth.currentUser?.uid || 'system'
                            );
                            const dataUrl = await generateQRDataURL(token);
                            setQrData({ token, dataUrl });
                        } catch (err) {
                            console.warn("🖨️ [BILL MODAL] QR generation failed (background)", err);
                        }
                    })();
                }
            } catch (e) {
                const fallbackDesign: ReportDesign = {
                    name: 'Standard Thermal',
                    type: 'invoice',
                    pageFormat: 'Thermal80',
                    isAutoLayout: true,
                    layers: [],
                    headerStyle: { x: 10, y: 10, width: 282, height: 60 },
                    footerStyle: { x: 10, y: 1050, width: 282, height: 40 },
                    qrStyle: { x: 110, y: 1000, width: 80, height: 80 },
                    contentPadding: { top: 40, bottom: 40 }
                };
                cachedBillTemplate = fallbackDesign;
                setTemplate(fallbackDesign);
            } finally {
                // stop blocking the UI once template is ready
                setLoading(false);
            }
        };
        load();

        // Add Enter key -> print handler (global while modal open)
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Enter' && e.key !== 'NumpadEnter') return;
            if (e.altKey || e.ctrlKey || e.metaKey) return;
            const active = document.activeElement as HTMLElement | null;
            if (active && active.tagName === 'TEXTAREA') return; // don't override textarea

            // Instead of relying on `loading`, check whether bill content is actually present.
            const billContent = document.querySelector('.bill-print-content');
            if (billContent) {
                e.preventDefault();
                console.log('🖨️ [BILL MODAL] Enter key detected -> attempting print');
                performPrintSync();
            } else {
                console.log('🖨️ [BILL MODAL] Enter key detected but bill content not ready');
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [data.orderId, data.patientId, loading]);

    const lastPrintAtRef = React.useRef<number>(0);

    // Synchronous print path to preserve the user gesture context (used by keyboard handler and print button)
    const performPrintSync = () => {
        const now = Date.now();
        if (now - (lastPrintAtRef.current || 0) < 1000) {
            // Prevent duplicate prints within 1s
            return;
        }
        lastPrintAtRef.current = now;

        console.log('🖨️ [BILL MODAL] Performing synchronous print...');

        const billContent = document.querySelector('.bill-print-content');
        if (!billContent) return;

        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);

        const iframeDoc = iframe.contentDocument;
        if (!iframeDoc) return;

        // Synchronously write and print using current HTML snapshot
        iframeDoc.open();
        iframeDoc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=80mm, initial-scale=1">
                <style>
                    * { 
                        margin: 0; 
                        padding: 0; 
                        box-sizing: border-box; 
                    }
                    html, body {
                        width: 80mm;
                        margin: 0;
                        padding: 0;
                    }
                    @page {
                        size: 80mm auto !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    @media print {
                        * {
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                            color-adjust: exact !important;
                        }
                        html, body {
                            width: 80mm !important;
                            height: auto !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            background: white !important;
                        }
                        .no-print { display: none !important; }
                    }
                </style>
            </head>
            <body>
                ${billContent.innerHTML}
            </body>
            </html>
        `);
        iframeDoc.close();

        try {
            console.log('🖨️ [BILL MODAL] Calling iframe.print() (sync)');
            iframe.contentWindow?.print();
            console.log('🖨️ [BILL MODAL] iframe.print() invoked');
        } catch (err) {
            console.warn('🖨️ [BILL MODAL] Synchronous print failed', err);
        }

        // Cleanup asynchronously
        setTimeout(() => {
            try { document.body.removeChild(iframe); } catch (err) { /* ignore */ }
        }, 1000);
    };

    const handlePrint = async () => {
        // Call synchronous path first to ensure browser sees a user gesture
        performPrintSync();

        // Background: wait for images if needed (do not block printing)
        try {
            const images = document.querySelectorAll('.bill-print-content img');
            await Promise.all(Array.from(images).map(img => {
                return new Promise((resolve) => {
                    const imgElement = img as HTMLImageElement;
                    if (imgElement.complete) {
                        resolve(true);
                    } else {
                        imgElement.onload = () => resolve(true);
                        imgElement.onerror = () => resolve(false);
                    }
                });
            }));
        } catch (err) {
            console.warn('🖨️ [BILL MODAL] Background image load check failed', err);
        }

        // Ensure Print button is focused after background checks so subsequent Enter presses keep working
        setTimeout(() => {
            const btn = document.querySelector('[data-print-bill]') as HTMLElement | null;
            if (btn) btn.focus();
        }, 200);
    };

    if (!template) return null;

    const reportData: ReportData = {
        qrToken: qrData?.token,
        qrDataUrl: qrData?.dataUrl,
        patient: {
            name: data.patientName || '',
            id: data.patientId || '',
            age: parseInt(data.patientAge || '0'),
            gender: data.patientGender || '',
            phone: data.patientPhone || '',
            address: '',
        },
        doctor: { name: 'Self', id: '' },
        invoice: {
            id: data.orderId || 'N/A',
            date: data.date ? new Date(data.date).toLocaleDateString() : new Date().toLocaleDateString(),
            items: (data.tests || []).map(t => ({
                name: t.name || 'Test',
                price: Number(t.price) || 0,
                qty: 1,
                total: Number(t.price) || 0,
            })),
            subtotal: Number(data.subtotal || 0),
            tax: 0,
            discount: Number(data.discount || 0),
            total: Number(data.total || 0),
            paid: Number(data.paid || data.paidAmount || 0),
            due: Number(data.due || (Number(data.total || 0) - Number(data.paid || 0))),
            method: String(data.paymentMethod || 'Cash').toUpperCase()
        },
        report: {
            date: new Date().toLocaleDateString(),
            id: data.orderId || 'N/A',
            title: 'THERMAL BILL'
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1100]">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
                    <h3 className="font-bold flex items-center gap-2">
                        <Printer size={20} />
                        Thermal Bill
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded transition">
                        <X size={20} />
                    </button>
                </div>

                {/* Preview */}
                <div className="flex-1 overflow-auto bg-slate-100 p-4 flex justify-center">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                        </div>
                    ) : (
                        <div className="bill-print-content bg-white" style={{ width: '80mm' }}>
                            <ReportPageRenderer design={template} data={reportData} />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-slate-50 p-4 flex gap-2 justify-end border-t">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-600 text-white rounded font-bold hover:bg-slate-700 transition"
                    >
                        Close
                    </button>
                    <button 
                        data-print-bill
                        onClick={handlePrint}
                        disabled={loading}
                        className="px-4 py-2 bg-indigo-600 text-white rounded font-bold hover:bg-indigo-700 disabled:opacity-50 transition flex items-center gap-2"
                    >
                        <Printer size={18} />
                        Print Now (Enter)
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BillPrintModal;
