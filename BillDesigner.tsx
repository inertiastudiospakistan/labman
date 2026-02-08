import React, { useState, useRef, useEffect } from 'react';
import { db, auth } from './firebase';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { ReportPageRenderer } from './ReportRendererCore';
import { ReportDesign, PAGE_SPECS, PageFormat } from './ReportSchema';

const compressImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
    });
};

const ControlLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <label className="text-xs font-bold text-slate-700 uppercase tracking-tighter">{children}</label>
);

const UploadZone: React.FC<{ image?: string; onUpload: () => void; onClear: () => void }> = ({ image, onUpload, onClear }) => (
    <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 transition-all" onClick={onUpload}>
        {image ? (
            <div className="relative">
                <img src={image} alt="preview" className="h-20 mx-auto rounded" />
                <button onClick={(e) => { e.stopPropagation(); onClear(); }} className="text-xs mt-2 text-red-500 hover:underline">Remove</button>
            </div>
        ) : (
            <div className="text-xs text-slate-500">Click to upload image</div>
        )}
    </div>
);

const BillDesigner: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
    // THERMAL BILL SPECIFIC - FIXED THERMAL80 FORMAT
    const [design, setDesign] = useState<ReportDesign>({
        name: 'Thermal Bill Template',
        type: 'invoice',
        pageFormat: 'Thermal80',  // LOCKED - always thermal
        layers: [],
        isAutoLayout: true,
        headerStyle: { x: 10, y: 10, width: 282, height: 60 },
        footerStyle: { x: 10, y: 1050, width: 282, height: 40 },
        qrStyle: { x: 110, y: 1000, width: 80, height: 80 },
        contentPadding: { top: 40, bottom: 40 }
    });

    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [qrPreview, setQrPreview] = useState<string>('');

    const inputs = {
        header: useRef<HTMLInputElement>(null),
        footer: useRef<HTMLInputElement>(null),
        watermark: useRef<HTMLInputElement>(null)
    };

    // Load existing thermal bill template
    useEffect(() => {
        const load = async () => {
            try {
                const snap = await db.collection('bill_templates').get();
                if (!snap.empty) {
                    let data = snap.docs
                        .map(doc => ({ ...(doc.data() as any), id: doc.id, updatedAt: (doc.data() as any).updatedAt }))
                        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0] as ReportDesign & { id: string };
                    
                    console.log(`🖨️ [BILL DESIGNER] Loaded: "${data.name}", pageFormat: "${data.pageFormat}"`);
                    
                    setDesign({
                        ...data,
                        type: 'invoice',
                        pageFormat: 'Thermal80',  // FORCE thermal
                        isAutoLayout: true
                    });
                }

                // Generate QR preview
                const qr = await generateQRDataURL('PREVIEW', 100);
                setQrPreview(qr);
            } catch (e) {
                console.error("Load failed", e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const generateQRDataURL = async (text: string, size: number = 200): Promise<string> => {
        // Simplified QR generation - just return placeholder
        return '';
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            console.log(`🔄 [BILL DESIGNER] Deleting old templates...`);
            
            // Delete all existing bill templates
            const all = await db.collection('bill_templates').get();
            const deletePromises = all.docs.map(doc => {
                console.log(`🗑️ Deleting: ${doc.id}`);
                return doc.ref.delete();
            });
            await Promise.all(deletePromises);
            
            console.log(`✅ [BILL DESIGNER] All old templates deleted. Saving new...`);
            
            // Save new template - ALWAYS Thermal80
            const toSave: ReportDesign = {
                ...design,
                type: 'invoice',
                pageFormat: 'Thermal80',  // ENFORCE thermal
                updatedAt: Date.now(),
                isPublished: true
            };
            
            const newDocRef = await db.collection('bill_templates').add(toSave);
            
            console.log(`✅ [BILL DESIGNER] Saved with ID: ${newDocRef.id}`);
            console.log(`📋 Type: ${toSave.type}, Format: ${toSave.pageFormat}, Name: ${toSave.name}`);
            
            alert('Bill template saved successfully!');
        } catch (e) {
            console.error("Save failed", e);
            alert('Failed to save template.');
        } finally {
            setSaving(false);
        }
    };

    const onImageChange = async (file: File, target: 'header' | 'footer' | 'watermark') => {
        try {
            const compressed = await compressImage(file);
            if (target === 'watermark') {
                setDesign(prev => ({
                    ...prev,
                    watermark: {
                        url: compressed,
                        x: 50, y: 50, width: 40, height: 40, opacity: 0.3, rotation: -30
                    }
                }));
            } else {
                const styleKey = target === 'header' ? 'headerStyle' : 'footerStyle';
                const defaultStyle = target === 'header'
                    ? { x: 10, y: 10, width: 282, height: 60 }
                    : { x: 10, y: 1050, width: 282, height: 40 };

                setDesign(prev => ({
                    ...prev,
                    [target === 'header' ? 'headerImageUrl' : 'footerImageUrl']: compressed,
                    [styleKey]: prev[styleKey] || defaultStyle
                }));
            }
        } catch (err) {
            alert('Image processing failed');
        }
    };

    if (loading) return <div className="h-screen flex items-center justify-center text-slate-500">Loading...</div>;

    return (
        <div className="flex h-screen bg-slate-200 font-sans">
            {/* Sidebar */}
            <div className="w-80 bg-white border-r flex flex-col shadow-2xl z-20">
                <div className="p-4 border-b flex items-center gap-3">
                    {onBack && <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full"><ArrowLeft size={18} /></button>}
                    <h2 className="font-bold text-slate-800">Bill Designer</h2>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                    <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200">
                        <ControlLabel>Format</ControlLabel>
                        <div className="text-sm font-bold text-indigo-700 mt-2">🖨️ Thermal 80mm (Fixed)</div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl space-y-3 border border-slate-100">
                        <ControlLabel>Template Name</ControlLabel>
                        <input
                            type="text"
                            value={design.name}
                            onChange={e => setDesign({ ...design, name: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg text-sm"
                        />
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl space-y-3 border border-slate-100">
                        <ControlLabel>Header Image</ControlLabel>
                        <UploadZone image={design.headerImageUrl} onUpload={() => inputs.header.current?.click()} onClear={() => setDesign({ ...design, headerImageUrl: '' })} />
                        <input type="file" ref={inputs.header} className="hidden" onChange={e => e.target.files?.[0] && onImageChange(e.target.files[0], 'header')} />
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl space-y-3 border border-slate-100">
                        <ControlLabel>Footer Image</ControlLabel>
                        <UploadZone image={design.footerImageUrl} onUpload={() => inputs.footer.current?.click()} onClear={() => setDesign({ ...design, footerImageUrl: '' })} />
                        <input type="file" ref={inputs.footer} className="hidden" onChange={e => e.target.files?.[0] && onImageChange(e.target.files[0], 'footer')} />
                    </div>
                </div>

                <div className="p-4 border-t space-y-2">
                    <button onClick={handleSave} disabled={saving} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : '💾 Save Template'}
                    </button>
                </div>
            </div>

            {/* Preview */}
            <div className="flex-1 bg-slate-100 flex flex-col p-8">
                <h3 className="text-sm font-bold text-slate-600 mb-4">Preview (Thermal 80mm)</h3>
                <div className="flex-1 flex justify-center overflow-auto">
                    <div className="bg-white shadow-lg" style={{ width: '80mm', height: 'auto' }}>
                        <ReportPageRenderer design={design} data={{ patient: { name: '--', id: '--', age: 0, gender: '--', phone: '--' }, tests: [], invoice: { items: [], subtotal: 0, tax: 0, discount: 0, total: 0, paid: 0, due: 0, method: 'Cash' }, report: { date: '--', id: '--', title: 'BILL' }, qrToken: 'PREVIEW' }} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BillDesigner;
