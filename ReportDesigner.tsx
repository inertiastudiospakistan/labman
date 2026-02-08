import React, { useState, useEffect, useRef } from 'react';
import {
    Image as ImageIcon, Save, ArrowLeft, Loader2,
    Upload, Info, Eye, CheckCircle2, Layout, Printer, X, Settings
} from 'lucide-react';
import { Rnd } from 'react-rnd';
import { db } from './firebase';
import { ReportDesign } from './ReportSchema';
import { ReportPageRenderer, ReportData } from './ReportRendererCore';
import { generateQRDataURL } from './QRCodeGenerator';
import { PAGE_SPECS, PageFormat } from './ReportSchema';

// --- Utils ---
const uid = () => Math.random().toString(36).substr(2, 9);

const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1200;
                let width = img.width;
                let height = img.height;
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                } else resolve(event.target?.result as string);
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
};

const ReportDesigner: React.FC<{ mode?: 'report' | 'bill', onBack?: () => void }> = ({ mode = 'report', onBack }) => {
    const [design, setDesign] = useState<ReportDesign>({
        name: 'Classic Pro Template',
        type: 'report',
        pageFormat: 'A4',
        layers: [],
        isAutoLayout: true,
        headerStyle: { x: 95, y: 38, width: 604, height: 80 },
        footerStyle: { x: 95, y: 1020, width: 604, height: 60 },
        qrStyle: { x: 680, y: 1000, width: 65, height: 65 },
        contentPadding: { top: 40, bottom: 40 }
    });
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [scale, setScale] = useState(mode === 'bill' ? 1.0 : 0.6);
    const [activeTab, setActiveTab] = useState<'assets' | 'watermark'>('assets');
    const [qrPreview, setQrPreview] = useState<string>('');

    const inputs = {
        header: useRef<HTMLInputElement>(null),
        footer: useRef<HTMLInputElement>(null),
        watermark: useRef<HTMLInputElement>(null)
    };

    // Load initial design and generate QR preview
    useEffect(() => {
        const load = async () => {
            const col = 'report_templates';
            try {
                const snap = await db.collection(col).orderBy('updatedAt', 'desc').limit(1).get();
                if (!snap.empty) {
                    const data = snap.docs[0].data() as ReportDesign;
                    setDesign({
                        ...data,
                        isAutoLayout: true,
                        headerStyle: data.headerStyle || { x: 95, y: 38, width: 604, height: 80 },
                        footerStyle: data.footerStyle || { x: 95, y: 1050, width: 604, height: 60 }
                    });
                }

                // Pre-generate QR for preview
                const qr = await generateQRDataURL('PREVIEW-TOKEN', 100, 'bill');
                setQrPreview(qr);
            } catch (e) {
                console.error("Load failed", e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const col = 'report_templates';
            const all = await db.collection(col).get();
            await Promise.all(all.docs.map(doc => doc.ref.delete()));

            const toSave = { ...design, updatedAt: Date.now(), isPublished: true };
            await db.collection(col).doc(uid()).set(toSave);
            alert('Template published successfully!');
        } catch (e) {
            console.error("Save failed", e);
            alert('Failed to save settings.');
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
                const isThermal = design.pageFormat.startsWith('Thermal');
                const styleKey = target === 'header' ? 'headerStyle' : 'footerStyle';
                const defaultStyle = target === 'header'
                    ? (isThermal ? { x: 10, y: 10, width: 282, height: 60 } : { x: 95, y: 38, width: 604, height: 80 })
                    : (isThermal ? { x: 10, y: 1050, width: 282, height: 40 } : { x: 95, y: 1020, width: 604, height: 60 });

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

    if (loading) return <div className="h-screen flex items-center justify-center text-slate-500">Initializing Designer...</div>;

    return (
        <div className="flex h-screen bg-slate-200 font-sans">
            {/* Sidebar Controls */}
            <div className="w-80 bg-white border-r flex flex-col shadow-2xl z-20">
                <div className="p-4 border-b flex items-center gap-3">
                    {onBack && <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full"><ArrowLeft size={18} /></button>}
                    <h2 className="font-bold text-slate-800">Classic Designer</h2>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button onClick={() => setActiveTab('assets')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'assets' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>Header/Footer</button>
                        <button onClick={() => setActiveTab('watermark')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'watermark' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>Watermark</button>
                    </div>

                    {activeTab === 'assets' ? (
                        <div className="space-y-6">
                            <div className="bg-slate-50 p-4 rounded-xl space-y-3 border border-slate-100">
                                <ControlLabel>Page Layout</ControlLabel>
                                <div className="grid grid-cols-2 gap-2">
                                    {(['A4', 'Thermal80'] as PageFormat[]).map(fmt => (
                                        <button
                                            key={fmt}
                                            onClick={() => setDesign({ ...design, pageFormat: fmt })}
                                            className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all border ${design.pageFormat === fmt ? 'bg-blue-600 text-white border-blue-600 shadow-lg scale-[1.02]' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'}`}
                                        >
                                            {PAGE_SPECS[fmt].label.split(' ')[0]} {fmt.includes('80') ? '80mm' : fmt}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <ControlLabel>Header Branding</ControlLabel>
                            <UploadZone image={design.headerImageUrl} onUpload={() => inputs.header.current?.click()} onClear={() => setDesign({ ...design, headerImageUrl: '' })} />
                            <input type="file" ref={inputs.header} className="hidden" onChange={e => e.target.files?.[0] && onImageChange(e.target.files[0], 'header')} />

                            <ControlLabel>Footer Branding</ControlLabel>
                            <UploadZone image={design.footerImageUrl} onUpload={() => inputs.footer.current?.click()} onClear={() => setDesign({ ...design, footerImageUrl: '' })} />
                            <input type="file" ref={inputs.footer} className="hidden" onChange={e => e.target.files?.[0] && onImageChange(e.target.files[0], 'footer')} />

                            <div className="pt-4 border-t space-y-4">
                                <ControlLabel>Content Margins (mm)</ControlLabel>
                                <Slider label="Top Margin" value={design.contentPadding?.top || 45} min={0} max={150} step={1} onChange={v => setDesign({ ...design, contentPadding: { ...(design.contentPadding || { top: 45, bottom: 40 }), top: v } })} />
                                <Slider label="Bottom Margin" value={design.contentPadding?.bottom || 40} min={0} max={150} step={1} onChange={v => setDesign({ ...design, contentPadding: { ...(design.contentPadding || { top: 45, bottom: 40 }), bottom: v } })} />
                            </div>

                            <div className="pt-4 border-t space-y-4">
                                <ControlLabel>Body Typography</ControlLabel>
                                <Slider label="Font Size (px)" value={design.bodyFontSize || 13} min={8} max={24} step={1} onChange={v => setDesign({ ...design, bodyFontSize: v })} />
                                <Slider label="Line Height" value={design.bodyLineHeight || 1.5} min={1} max={3} step={0.1} onChange={v => setDesign({ ...design, bodyLineHeight: v })} />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <ControlLabel>Watermark Image</ControlLabel>
                            <UploadZone image={design.watermark?.url} onUpload={() => inputs.watermark.current?.click()} onClear={() => setDesign({ ...design, watermark: undefined })} />
                            <input type="file" ref={inputs.watermark} className="hidden" onChange={e => e.target.files?.[0] && onImageChange(e.target.files[0], 'watermark')} />

                            {design.watermark && (
                                <div className="space-y-4 p-4 bg-slate-50 rounded-xl">
                                    <Slider label="Opacity" value={design.watermark.opacity} min={0} max={1} step={0.05} onChange={v => setDesign({ ...design, watermark: { ...design.watermark!, opacity: v } })} />
                                    <Slider label="Rotation" value={design.watermark.rotation} min={-180} max={180} step={1} onChange={v => setDesign({ ...design, watermark: { ...design.watermark!, rotation: v } })} />
                                </div>
                            )}
                        </div>
                    )}

                    <div className="pt-6 border-t">
                        <button onClick={handleSave} disabled={saving} className="w-full bg-blue-600 flex items-center justify-center gap-2 text-white font-bold py-3.5 rounded-2xl shadow-xl hover:bg-blue-700 disabled:opacity-50 active:scale-95 transition-all">
                            {saving ? <Loader2 className="animate-spin" /> : <Save />} {saving ? 'Publishing...' : 'Save Template'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Interactive Preview */}
            <div className="flex-1 overflow-auto flex flex-col items-center p-12 custom-scrollbar">
                <div className={`${design.pageFormat.startsWith('Thermal') ? 'w-[80mm]' : 'w-[210mm]'} max-w-full flex justify-between items-center mb-6`}>
                    <div className="flex items-center gap-2">
                        <div className="bg-white p-2 rounded-lg shadow-sm border"><Eye size={16} className="text-blue-600" /></div>
                        <div>
                            <span className="text-sm font-bold text-slate-700 block">Interactive Designer</span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{PAGE_SPECS[design.pageFormat].label} • Scaleable</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <select value={scale} onChange={e => setScale(parseFloat(e.target.value))} className="bg-white px-3 py-1.5 rounded-lg border text-xs font-bold shadow-sm outline-none">
                            <option value="0.4">40% Zoom</option>
                            <option value="0.5">50% Zoom</option>
                            <option value="0.6">60% Zoom</option>
                            <option value="0.75">75% Zoom</option>
                            <option value="0.8">80% Zoom</option>
                            <option value="1.0">100% (Actual)</option>
                        </select>
                    </div>
                </div>

                <div
                    className="relative bg-white shadow-2xl ring-1 ring-slate-300 transition-transform origin-top"
                    style={{
                        width: `${PAGE_SPECS[design.pageFormat].width}px`,
                        height: `${PAGE_SPECS[design.pageFormat].height}px`,
                        transform: `scale(${scale})`,
                        marginBottom: '400px'
                    }}
                >
                    {/* 1. Interactive Header (Free Movement) */}
                    {design.headerImageUrl ? (
                        <DesignerAsset
                            scale={scale}
                            initialPosition={{
                                x: design.headerStyle?.x !== undefined ? design.headerStyle.x : (794 - (design.headerStyle?.width || 604)) / 2,
                                y: design.headerStyle?.y || 38
                            }}
                            initialSize={{ width: design.headerStyle?.width || 604, height: design.headerStyle?.height || 80 }}
                            image={design.headerImageUrl}
                            label="Header"
                            onUpdate={(pos, size) => {
                                // Smart Logic: Auto-suggest top margin update
                                const headerBottom = pos.y + size.height;
                                const newTopMargin = Math.max(design.contentPadding?.top || 45, Math.ceil(headerBottom / 3.779) + 10);

                                setDesign({
                                    ...design,
                                    headerStyle: { ...pos, ...size },
                                    contentPadding: {
                                        ...(design.contentPadding || { top: 45, bottom: 40 }),
                                        top: Math.min(newTopMargin, 150) // Cap to reasonable limit
                                    }
                                });
                            }}
                        />
                    ) : null}

                    {/* 2. Interactive Footer (Free Movement) */}
                    {design.footerImageUrl ? (
                        <DesignerAsset
                            scale={scale}
                            initialPosition={{
                                x: design.footerStyle?.x !== undefined ? design.footerStyle.x : (794 - (design.footerStyle?.width || 604)) / 2,
                                y: design.footerStyle?.y || 1020
                            }}
                            initialSize={{ width: design.footerStyle?.width || 604, height: design.footerStyle?.height || 60 }}
                            image={design.footerImageUrl}
                            label="Footer"
                            onUpdate={(pos, size) => {
                                // Smart Logic: Auto-suggest bottom margin update
                                const footerTop = 1123 - pos.y;
                                const newBottomMargin = Math.max(design.contentPadding?.bottom || 40, Math.ceil(footerTop / 3.779) + 5);

                                setDesign({
                                    ...design,
                                    footerStyle: { ...pos, ...size },
                                    contentPadding: {
                                        ...(design.contentPadding || { top: 45, bottom: 40 }),
                                        bottom: Math.min(newBottomMargin, 150)
                                    }
                                });
                            }}
                        />
                    ) : null}

                    {/* 3. Moveable QR Code */}
                    <DesignerAsset
                        scale={scale}
                        initialPosition={{
                            x: design.qrStyle?.x !== undefined ? design.qrStyle.x : (PAGE_SPECS[design.pageFormat].width - (design.qrStyle?.width || (design.pageFormat.startsWith('Thermal') ? 80 : 65))) / 2,
                            y: design.qrStyle?.y !== undefined ? design.qrStyle.y : (design.pageFormat.startsWith('Thermal') ? 900 : 1000)
                        }}
                        initialSize={{ width: design.qrStyle?.width || (design.pageFormat.startsWith('Thermal') ? 80 : 65), height: design.qrStyle?.height || (design.pageFormat.startsWith('Thermal') ? 80 : 65) }}
                        image={qrPreview}
                        label="QR Code"
                        onUpdate={(pos, size) => setDesign({
                            ...design,
                            qrStyle: { ...pos, ...size }
                        })}
                        customClassName="z-50 ring-2 ring-transparent bg-white shadow-lg"
                    />

                    {/* 4. Interactive Watermark */}
                    {design.watermark && (
                        <Rnd
                            size={{ width: design.watermark.width * (PAGE_SPECS[design.pageFormat].width / 100), height: design.watermark.height * (PAGE_SPECS[design.pageFormat].height / 100) }}
                            position={{
                                x: (design.watermark.x / 100) * PAGE_SPECS[design.pageFormat].width - (design.watermark.width * (PAGE_SPECS[design.pageFormat].width / 100) / 2),
                                y: (design.watermark.y / 100) * PAGE_SPECS[design.pageFormat].height - (design.watermark.height * (PAGE_SPECS[design.pageFormat].height / 100) / 2)
                            }}
                            onDragStop={(e, d) => {
                                const wpx = design.watermark!.width * (PAGE_SPECS[design.pageFormat].width / 100);
                                const hpx = design.watermark!.height * (PAGE_SPECS[design.pageFormat].height / 100);
                                setDesign({
                                    ...design, watermark: {
                                        ...design.watermark!,
                                        x: ((d.x + wpx / 2) / PAGE_SPECS[design.pageFormat].width) * 100,
                                        y: ((d.y + hpx / 2) / PAGE_SPECS[design.pageFormat].height) * 100
                                    }
                                });
                            }}
                            onResizeStop={(e, direction, ref, delta, position) => {
                                const w = parseInt(ref.style.width);
                                const h = parseInt(ref.style.height);
                                setDesign({
                                    ...design, watermark: {
                                        ...design.watermark!,
                                        width: w / (PAGE_SPECS[design.pageFormat].width / 100),
                                        height: h / (PAGE_SPECS[design.pageFormat].height / 100),
                                        x: ((position.x + w / 2) / PAGE_SPECS[design.pageFormat].width) * 100,
                                        y: ((position.y + h / 2) / PAGE_SPECS[design.pageFormat].height) * 100
                                    }
                                });
                            }}
                            className="z-10 ring-1 ring-transparent hover:ring-orange-500 group"
                            style={{
                                opacity: design.watermark.opacity,
                                transform: `rotate(${design.watermark.rotation}deg) !important`
                            }}
                        >
                            <img src={design.watermark.url} className="w-full h-full object-contain pointer-events-none" alt="" style={{ transform: `rotate(${design.watermark.rotation}deg)` }} />
                        </Rnd>
                    )}

                    {/* 4. Background Content Flow (Read-only Preview) */}
                    <div className="pointer-events-none absolute inset-0">
                        <ReportPageRenderer
                            scale={1}
                            design={{
                                ...design,
                                headerImageUrl: design.headerImageUrl ? 'HIDDEN' : '',
                                footerImageUrl: design.footerImageUrl ? 'HIDDEN' : '',
                                watermark: undefined,
                                layers: (design.layers || []).filter(l => {
                                    if (l.type === 'qr') return false;
                                    if (l.type === 'image' && ((l.name || '').toLowerCase().includes('qr') || (l.name || '').toLowerCase().includes('qrcode') || (l.content || '').toLowerCase().includes('qrcode'))) return false;
                                    return true;
                                })
                            }}
                            data={{
                                patient: { name: 'Mrs Maria', id: 'RAHIM/LAB/2025/0500', age: 30, gender: 'Female', phone: '0300-1234567', address: 'Bahawalpur' },
                                report: { id: 'PRV-123', date: 'Dec 18, 2025 06:40 PM', title: 'Diagnostic Report' },
                                invoice: mode === 'bill' ? {
                                    id: 'INV-2026-001',
                                    date: new Date().toLocaleDateString(),
                                    items: [
                                        { name: 'Complete Blood Count', price: 1200, qty: 1, total: 1200 },
                                        { name: 'Liver Function Test', price: 2500, qty: 1, total: 2500 },
                                        { name: 'Lipid Profile', price: 1800, qty: 1, total: 1800 }
                                    ],
                                    subtotal: 5500,
                                    discount: 500,
                                    total: 5000,
                                    paid: 5000,
                                    due: 0,
                                    method: 'CASH'
                                } : undefined,
                                testResults: mode === 'bill' ? [] : [
                                    {
                                        category: 'BIOCHEMISTRY',
                                        groups: [
                                            {
                                                testName: 'GLUCOSE RANDOM',
                                                parameters: [{ name: 'Glucose', result: '84', unit: 'mg/dl', range: '<140', flag: 'N' }]
                                            }
                                        ]
                                    },
                                    {
                                        category: 'HAEMATOLOGY',
                                        groups: [
                                            {
                                                testName: 'COMPLETE BLOOD COUNT (CBC)',
                                                parameters: [
                                                    { name: 'HAEMOGLOBIN', result: '11.9', unit: 'g/dL', range: '11.0 - 14.4', flag: 'N' },
                                                    { name: 'WBC COUNT', result: '18.5', unit: '10³/µL', range: '4.0 - 11.0', flag: 'CH' }
                                                ]
                                            }
                                        ]
                                    }
                                ],
                                remarks: mode === 'bill' ? 'Thank you for choosing QUALITY CARE. Please bring this receipt for report collection (Est. 24h).' : 'Sample report preview showing the new vibrant medical aesthetic with colorful category headers and professional sub-test grouping. All elements are automatically aligned for a high-end feel.',
                                qrDataUrl: qrPreview,
                                qrToken: 'PREVIEW'
                            }}
                            isPreview={true}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Helper UI Components ---

const UploadZone: React.FC<{ image?: string, onUpload: () => void, onClear: () => void }> = ({ image, onUpload, onClear }) => (
    <div className="relative group">
        <div
            onClick={onUpload}
            className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all ${image ? 'border-blue-100 bg-blue-50/30' : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50'}`}
        >
            {image ? (
                <div className="relative py-2">
                    <img src={image} className="max-h-24 mx-auto rounded shadow-sm" alt="" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-white/40 rounded transition-opacity"><Upload className="text-blue-600" /></div>
                </div>
            ) : (
                <div className="py-6">
                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-2 text-slate-400"><ImageIcon size={20} /></div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Click to upload image</span>
                </div>
            )}
        </div>
        {image && <button onClick={(e) => { e.stopPropagation(); onClear(); }} className="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center shadow-lg hover:bg-red-600"><X size={12} /></button>}
    </div>
);

// --- Prestige Designer Asset (Ultra-Stable Movement with Scale Awareness) ---
const DesignerAsset: React.FC<{
    scale: number,
    initialPosition: { x: number, y: number },
    initialSize: { width: number, height: number },
    image: string,
    label: string,
    onUpdate: (pos: { x: number, y: number }, size: { width: number, height: number }) => void,
    customClassName?: string
}> = ({ scale, initialPosition, initialSize, image, label, onUpdate, customClassName }) => {
    const [pos, setPos] = React.useState(initialPosition);
    const [size, setSize] = React.useState(initialSize);
    const isInteracting = React.useRef(false);

    // Precise Syncing: Only update local state if props change significantly
    React.useLayoutEffect(() => {
        if (!isInteracting.current) {
            setPos(initialPosition);
            setSize(initialSize);
        }
    }, [initialPosition.x, initialPosition.y, initialSize.width, initialSize.height]);

    return (
        <Rnd
            size={{ width: size.width, height: size.height }}
            position={{ x: pos.x, y: pos.y }}
            scale={scale}
            lockAspectRatio={false} // CANVA FREEDOM
            onDragStart={() => { isInteracting.current = true; }}
            onResizeStart={() => { isInteracting.current = true; }}
            onDrag={(e, d) => setPos({ x: d.x, y: d.y })}
            onResize={(e, dir, ref, delta, p) => {
                setPos(p);
                setSize({ width: parseInt(ref.style.width), height: parseInt(ref.style.height) });
            }}
            onDragStop={(e, d) => {
                isInteracting.current = false;
                onUpdate({ x: d.x, y: d.y }, { width: size.width, height: size.height });
            }}
            onResizeStop={(e, dir, ref, delta, p) => {
                isInteracting.current = false;
                const newSize = { width: parseInt(ref.style.width), height: parseInt(ref.style.height) };
                onUpdate(p, newSize);
            }}
            // REMOVED bounds="parent" to allow for total "Canva-like" placement freedom
            dragHandleClassName="drag-handle"
            className={`${customClassName || 'z-50 ring-2 ring-transparent hover:ring-blue-600 hover:bg-blue-600/5'} group select-none transition-shadow`}
            enableResizing={{
                top: true, right: true, bottom: true, left: true,
                topRight: true, bottomRight: true, bottomLeft: true, topLeft: true
            }}
        >
            <div className="w-full h-full relative drag-handle cursor-move">
                <img src={image} className="w-full h-full object-fill pointer-events-none" alt="" />
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 text-white text-[10px] px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 uppercase font-black tracking-widest whitespace-nowrap shadow-2xl transition-all scale-95 group-hover:scale-100">
                    {label} Layer
                </div>
                <div className="absolute inset-0 border-2 border-blue-600/30 opacity-0 group-hover:opacity-100 pointer-events-none"></div>
            </div>
        </Rnd>
    );
};

const ControlLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest border-b pb-1.5 mb-2">{children}</div>
);

const Slider: React.FC<{ label: string, value: number, min: number, max: number, step: number, onChange: (v: number) => void }> = ({ label, value, min, max, step, onChange }) => (
    <div>
        <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] font-bold text-slate-500">{label}</span>
            <span className="text-[10px] font-mono text-blue-600 font-bold bg-blue-50 px-1 rounded">{value.toFixed(step < 1 ? 2 : 0)}{step < 1 ? '' : '°'}</span>
        </div>
        <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} className="w-full h-1 bg-slate-200 rounded-lg appearance-none accent-blue-600 cursor-pointer" />
    </div>
);

export const PrintReportModal: React.FC<{ data: any; onClose: () => void; mode?: 'report' | 'bill' }> = ({ data, onClose, mode = 'report' }) => {
    const [design, setDesign] = useState<ReportDesign | null>(null);
    const [loading, setLoading] = useState(true);
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [scale, setScale] = useState(0.8);
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const templateCollection = mode === 'bill' ? 'bill_templates' : 'report_templates';
                const snap = await db.collection(templateCollection).orderBy('updatedAt', 'desc').limit(1).get();
                if (!snap.empty) {
                    const d = snap.docs[0].data() as ReportDesign;
                    d.layers = (d.layers || []).filter(l => {
                        // Remove explicit qr layers and any image layers that are labelled as QR (legacy exports)
                        if (l.type === 'qr') return false;
                        if (l.type === 'image' && ((l.name || '').toLowerCase().includes('qr') || (l.name || '').toLowerCase().includes('qrcode') || (l.content || '').toLowerCase().includes('qrcode'))) return false;
                        return true;
                    }); // remove any fixed QR layers
                    setDesign(d);
                } else setDesign({ name: 'Default', type: 'report', pageFormat: 'A4', layers: [], isAutoLayout: true });
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    useEffect(() => {
        if (!data) return;
        if (data.patient && (data.testResults || data.test)) {
            loadQR(data);
            return;
        }

        if (Array.isArray(data) && data.length > 0) {
            const first = data[0];
            const cats: Record<string, any[]> = {}; // Map of category -> Array of { testName, parameters }

            data.forEach((s: any) => {
                const cat = s.testCategory || 'Diagnostics';
                if (!cats[cat]) cats[cat] = [];

                if (s.results) {
                    const parameters = Object.entries(s.results).map(([name, val]: [string, any]) => ({
                        name,
                        result: typeof val === 'object' ? val.value : val,
                        unit: typeof val === 'object' ? val.unit : '',
                        flag: typeof val === 'object' ? val.flag : 'N',
                        range: typeof val === 'object' ? val.range || '' : ''
                    }));

                    cats[cat].push({
                        testName: s.testName || 'Test',
                        parameters
                    });
                }
            });

            const processed = {
                patient: { name: first.patientName, id: first.patientId, age: first.patientAge, gender: first.patientGender, phone: first.patientPhone || '', address: first.patientAddress || '' },
                report: { date: new Date().toLocaleDateString(), id: first.orderId || 'PRV' },
                testResults: Object.entries(cats).map(([category, groups]) => ({ category, groups })),
                remarks: first.pathologistRemarks || first.conclusion || '',
                qrToken: first.trackToken || first.qrToken || first.orderId
            };
            loadQR(processed);
        }
    }, [data]);

    const loadQR = async (d: any) => {
        const qr = await generateQRDataURL(d.qrToken || 'TOKEN', 100, 'bill');
        // Ensure remarks are mapped from any possible field
        const remarks = d.remarks || d.pathologistRemarks || d.conclusion || '';
        setReportData({ ...d, remarks, qrDataUrl: qr });
    };

    const handlePrint = () => {
        const node = printRef.current;
        if (!node) return window.print();

        // Collect any <style> tags inside the rendered report so page rules are preserved
        const styleTags = Array.from(node.querySelectorAll('style')).map(s => (s as HTMLElement).innerHTML).join('\n');

        // Prefer explicit .page elements (ModernAutoReportRenderer creates them). If none, fall back to whole node.
        const pages = Array.from(node.querySelectorAll('.page')) as HTMLElement[];
        const bodyContent = pages.length > 0 ? pages.map(p => (p as HTMLElement).outerHTML).join('\n') : (node as HTMLElement).innerHTML;

        const extraCss = `
                        @page { size: A4; margin: 10mm; }
                        html,body { margin:0; padding:0; background: white; color: #0f172a; }
                        * { transform: none !important; }
                        .page { page-break-after: always; break-after: page; box-sizing: border-box; }
                        .page:last-child { page-break-after: avoid; }
                        img { max-width: 100%; height: auto; }
                `;

        const printHtml = `
                        <html>
                            <head>
                                <title>Print Report</title>
                                <meta charset="utf-8" />
                                <meta name="viewport" content="width=device-width,initial-scale=1" />
                                <style>${extraCss}\n${styleTags}</style>
                            </head>
                            <body>
                                <div class="print-root">${bodyContent}</div>
                            </body>
                        </html>
                `;

        // Debug: output generated print HTML to console for diagnosis
        try { console.debug('PRINT_HTML:', printHtml.slice(0, 2000)); } catch (e) { }

        // Use an iframe-based print to avoid popup blocking and keep main page untouched
        try {
            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = '0';
            iframe.setAttribute('aria-hidden', 'true');
            document.body.appendChild(iframe);

            const iw = iframe.contentWindow!;
            iw.document.open();
            iw.document.write(printHtml);
            iw.document.close();

            setTimeout(() => {
                try { iw.focus(); } catch (e) { /* ignore */ }
                try { iw.print(); } catch (e) { console.error('Print failed (iframe):', e); }

                setTimeout(() => {
                    try { document.body.removeChild(iframe); } catch (e) { }
                }, 1200);
            }, 800);
        } catch (err) {
            console.warn('Iframe print failed, falling back to window.print()', err);
            const w = window.open('', '_blank', 'noopener,noreferrer');
            if (!w) return window.print();

            w.document.open();
            w.document.write(printHtml);
            w.document.close();

            setTimeout(() => {
                try { w.focus(); } catch (e) { }
                try { w.print(); } catch (e) { console.error('Print failed', e); }
            }, 700);
        }
    };

    if (loading) return <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 text-white">Loading...</div>;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[2000] p-4 print:p-0 print:bg-white print:static overflow-auto" onClick={onClose}>
            <style>{`
                @media print {
                    @page {
                        size: A4;
                        margin: 0;
                    }

                    /* Radical UI Hide */
                    .bg-slate-900, .no-print, .shrink-0, button, select {
                        display: none !important;
                    }
                    
                    /* Reset body and html */
                    html, body {
                        margin: 0 !important;
                        padding: 0 !important;
                        height: auto !important;
                        background: white !important;
                        overflow: visible !important;
                    }

                    /* Ensure the containing path is visible and unconstrained */
                    .fixed.inset-0, .print-report-root {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        height: auto !important;
                        display: block !important;
                        background: white !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        overflow: visible !important;
                        z-index: auto !important;
                        max-height: none !important;
                        max-width: none !important;
                        box-shadow: none !important;
                        transform: none !important;
                    }

                    /* Neutralize transforms on everything inside */
                    .print-report-root *, [style*="transform"] {
                        transform: none !important;
                    }
                }

            `}</style>
            <div className="print-report-root bg-white w-full max-w-[210mm] max-h-[95vh] flex flex-col print:shadow-none shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="bg-slate-900 text-white p-4 flex justify-between items-center no-print shrink-0">
                    <div className="flex items-center gap-4">
                        <h3 className="font-bold flex items-center gap-2 text-sm"><Printer size={16} /> Final Print Preview</h3>
                        <select
                            value={scale}
                            onChange={e => setScale(parseFloat(e.target.value))}
                            className="bg-slate-800 text-white border-slate-700 rounded px-2 py-1 text-xs font-bold outline-none focus:ring-1 ring-blue-500"
                        >
                            <option value="0.4">40% Zoom</option>
                            <option value="0.5">50% Zoom</option>
                            <option value="0.6">60% Zoom</option>
                            <option value="0.7">70% Zoom</option>
                            <option value="0.8">80% Zoom</option>
                            <option value="0.9">90% Zoom</option>
                            <option value="1.0">100% (Actual)</option>
                        </select>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handlePrint} className="bg-blue-600 px-4 py-1.5 rounded-lg text-xs font-bold leading-none flex items-center gap-2"><Printer size={14} /> Print</button>
                        <button onClick={onClose} className="bg-slate-700 px-4 py-1.5 rounded-lg text-xs font-bold leading-none flex items-center gap-2">Close</button>
                    </div>
                </div>
                <div className="flex-1 overflow-auto bg-slate-200/30 p-8 flex justify-center print:p-0 print:bg-white custom-scrollbar">
                    <div ref={printRef} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                        {design && <ReportPageRenderer design={design} data={reportData || {}} isPreview={false} scale={scale} />}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportDesigner;