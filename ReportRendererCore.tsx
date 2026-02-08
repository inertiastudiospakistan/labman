import React from 'react';
import { Settings } from 'lucide-react';
import { ReportDesign, ReportLayer, PAGE_SPECS } from './ReportSchema';

// --- Types for Data Binding ---
export interface ReportData {
    patient?: {
        name: string;
        id: string;
        age: number;
        gender: string;
        phone: string;
        address?: string;
        age_sex?: string; // For legacy templates
    };
    doctor?: {
        name: string;
        id: string;
    };
    report?: {
        date: string;
        id: string;
        title: string;
    };
    testResults?: {
        category: string;
        groups: {
            testName: string;
            parameters: {
                name: string;
                result: string;
                unit: string;
                range: string;
                flag: string;
                notes?: string;
            }[];
        }[];
    }[];
    invoice?: {
        items: { name: string; price: number; qty: number; total: number }[];
        subtotal: number;
        tax: number;
        discount?: number;
        total: number;
        date: string;
        id: string;
        paid?: number;
        due?: number;
        method?: string;
    };
    qrToken?: string;
    qrUrl?: string;
    qrDataUrl?: string;
    remarks?: string;
}

// --- Helper: Resolve Data Bindings ---
export const resolveBinding = (text: string, data?: ReportData): string => {
    if (!data || !text) return text;
    // Replace {{key}} patterns
    return text.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
        const path = key.trim().split('.');
        let current: any = data;
        for (const k of path) {
            if (current && current[k] !== undefined) {
                current = current[k];
            } else {
                return `{{${key}}}`; // Not found
            }
        }
        return String(current);
    });
};

// --- Single Layer Renderer ---
interface LayerProps {
    layer: ReportLayer;
    data?: ReportData;
    isPreview?: boolean;
}

export const ReportLayerComponent: React.FC<LayerProps> = ({ layer, data, isPreview }) => {
    const commonStyle: React.CSSProperties = {
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        fontFamily: layer.style.fontFamily || 'Inter, sans-serif',
        fontSize: (layer.style.fontSize || 12) + 'px',
        fontWeight: layer.style.fontWeight || 'normal',
        fontStyle: layer.style.fontStyle || 'normal',
        textDecoration: layer.style.textDecoration || 'none',
        textAlign: layer.style.textAlign || 'left',
        lineHeight: layer.style.lineHeight || 1.2,
        letterSpacing: (layer.style.letterSpacing || 0) + 'px',
        color: layer.style.color || '#000000',
        backgroundColor: layer.style.backgroundColor || 'transparent',
        border: layer.style.borderWidth ? `${layer.style.borderWidth}px ${layer.style.borderStyle || 'solid'} ${layer.style.borderColor || '#000'}` : 'none',
        borderBottom: layer.style.borderBottom || undefined,
        borderRadius: (layer.style.borderRadius || 0) + 'px',
        opacity: layer.style.opacity ?? 1,
        padding: (layer.style.padding || 0) + 'px',
        boxSizing: 'border-box',
        overflow: 'hidden', // Default to hidden unless it's a dynamic table
        whiteSpace: 'pre-wrap', // Preserve line breaks
    };

    if (layer.type === 'text') {
        const previewData: ReportData = {
            patient: { name: 'John Doe', id: 'P-123', age: 45, gender: 'Male', phone: '+123456789', address: '123 Medical St' },
            invoice: { id: 'INV-001', date: new Date().toLocaleDateString(), subtotal: 100, tax: 0, discount: 10, total: 90, items: [], paid: 50, due: 40, method: 'CASH' },
            doctor: { name: 'Dr. Smith', id: 'D-01' },
            report: { id: 'R-01', date: new Date().toLocaleDateString(), title: 'Lab Report' }
        };
        const textContent = resolveBinding(layer.content || '', isPreview ? { ...previewData, ...data } : data);
        return <div style={{ ...commonStyle, display: 'flex', alignItems: 'center' }}>{textContent}</div>;
    }

    if (layer.type === 'image') {
        return <img src={layer.content} style={{ ...commonStyle, objectFit: 'contain' }} alt={layer.name} />;
    }

    if (layer.type === 'box') {
        return <div style={commonStyle}></div>;
    }

    if (layer.type === 'shape') {
        // Circle/Ellipse shape
        return <div style={{ ...commonStyle, borderRadius: '50%' }}></div>;
    }

    if (layer.type === 'line') {
        return <div style={{ ...commonStyle, height: Math.max(1, layer.height), backgroundColor: layer.style.borderColor || layer.style.backgroundColor || '#000' }}></div>;
    }

    if (layer.type === 'table') {
        // Support both old 'tests' structure and new 'groups' structure for backward compatibility
        const rows = data?.testResults?.flatMap(c => {
            if (c.groups) return c.groups.flatMap(g => g.parameters || []);
            if ((c as any).tests) return (c as any).tests;
            return [];
        }) || [];
        const invItems = data?.invoice?.items || [];
        const isInvoice = layer.dataKey === 'invoice.items';

        // Mock data for preview if empty
        const displayRows = (isPreview && rows.length === 0 && invItems.length === 0) ?
            (isInvoice ? [{ name: 'Sample Item', price: 10, qty: 1, total: 10 }] : [{ name: 'Hemoglobin', result: '14.0', unit: 'g/dL', range: '13-17' }])
            : (isInvoice ? invItems : rows);

        return (
            <div style={{ ...commonStyle, overflow: 'visible', height: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'inherit' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid #000' }}>
                            {layer.tableColumns?.map((col, i) => (
                                <th key={i} style={{ textAlign: 'left', padding: '4px', width: col.width, fontWeight: 'bold' }}>{col.header}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {displayRows.map((row: any, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                {layer.tableColumns?.map((col, j) => (
                                    <td key={j} style={{ padding: '4px' }}>
                                        {col.key === 'index' ? i + 1 : row[col.key] || '--'}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    if (layer.type === 'qr') {
        // QR code layer - renders QR code from token binding
        // In preview mode or if no data, show placeholder
        const qrToken = (data as any)?.qrToken || 'preview-token-12345';
        const qrUrl = (data as any)?.qrUrl || `https://example.com/#/track/${qrToken}`;

        if (isPreview || !qrUrl) {
            return (
                <div style={{
                    ...commonStyle,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    border: '2px dashed #cbd5e0',
                    backgroundColor: '#f7fafc'
                }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>📱</div>
                    <div style={{ fontSize: '10px', color: '#718096', textAlign: 'center' }}>
                        QR Code<br />Placeholder
                    </div>
                </div>
            );
        }

        // In production, QR data URL should be provided
        const qrDataUrl = (data as any)?.qrDataUrl;
        if (qrDataUrl) {
            return (
                <div style={{ ...commonStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img
                        src={qrDataUrl}
                        alt="QR Code"
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain'
                        }}
                    />
                </div>
            );
        }

        // Fallback
        return (
            <div style={{ ...commonStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#999' }}>
                QR Code
            </div>
        );
    }

    return <div style={commonStyle}>Unknown Layer</div>;
};

// --- Modern Auto-Generated Report Renderer ---
export const ModernAutoReportRenderer: React.FC<{ design: ReportDesign; data?: ReportData }> = ({ design, data }) => {
    if (!data) return <div className="p-8 text-center text-slate-400 font-sans">Preview Data Unavailable</div>;

    const patient = data.patient || { name: '--', id: '--', age: 0, gender: '--', phone: '--' };
    const invoice = data.invoice;
    const isBill = design.type === 'invoice' || design.type === 'receipt' || design.type === 'bill' || !!invoice;
    const bodyFontSize = design.bodyFontSize || (isBill ? 11 : 13);
    const bodyLineHeight = design.bodyLineHeight || (isBill ? 1.3 : 1.5);

    const specs = PAGE_SPECS[design.pageFormat] || PAGE_SPECS['A4'];
    const isThermal = !!specs.isThermal;

    // --- Pagination Logic ---
    const topMargin = design.contentPadding?.top || 45;
    const bottomMargin = design.contentPadding?.bottom || 10; // Use small bottom margin since footer is in flow
    // Header/Footer heights (mm) with small safety buffers to prevent overlap
    const headerHeightMM = (design.headerStyle?.height ? design.headerStyle.height / 3.78 : 30) + (isThermal ? 1 : 3);
    const footerHeightMM = (design.footerStyle?.height ? design.footerStyle.height / 3.78 : 40) + (isThermal ? 2 : 6);
    // Realistic Height for A4/Letter: 275mm base.
    const availableHeightMM = isThermal ? 800 : (275 - headerHeightMM - bottomMargin - footerHeightMM - 5);

    // Improved Height Estimations (in mm)
    const CAT_HEADER_H = 15;
    const GRP_HEADER_H = 10;
    // Row height estimation: More accurate 8mm default + scaling
    const ROW_H = (bodyFontSize * 0.3) + 4;
    const PATIENT_BOX_H = 55;

    // Estimate Remarks Height (Interpretation Box)
    const estimateRemarksHeight = (text: string) => {
        if (!text) return 0;
        const charPerLine = 75; // More conservative
        const lines = Math.ceil(text.length / charPerLine) + (text.split('\n').length - 1);
        return 45 + (lines * 7); // Base padding/header + lines
    };

    const REMARKS_H = estimateRemarksHeight(data.remarks || '');

    const pages: any[][] = [[]];
    let currentPageH = PATIENT_BOX_H;

    if (data.testResults) {
        data.testResults.forEach((cat) => {
            const displayGroups = cat.groups || [{ testName: 'Diagnostic Analysis', parameters: (cat as any).tests || [] }];
            let catForCurrentPage: any = { ...cat, groups: [] };

            displayGroups.forEach((group) => {
                const groupH = GRP_HEADER_H + (group.parameters?.length || 0) * ROW_H;

                // If adding this group exceeds available height, move to next page
                if (currentPageH + groupH + CAT_HEADER_H > availableHeightMM) {
                    if (catForCurrentPage.groups.length > 0) {
                        pages[pages.length - 1].push(catForCurrentPage);
                    }
                    pages.push([]);
                    currentPageH = 0;
                    catForCurrentPage = { ...cat, groups: [group] };
                    currentPageH += CAT_HEADER_H + groupH;
                } else {
                    if (catForCurrentPage.groups.length === 0) currentPageH += CAT_HEADER_H;
                    catForCurrentPage.groups.push(group);
                    currentPageH += groupH;
                }
            });

            if (catForCurrentPage.groups.length > 0) {
                pages[pages.length - 1].push(catForCurrentPage);
            }
        });
    }

    // Check if remarks fit on the last page, if not, add one more page
    if (REMARKS_H > 0 && currentPageH + REMARKS_H > availableHeightMM) {
        pages.push([]); // Remarks go to a new empty page
    }

    return (
        <div className="print-root flex flex-col gap-8 print:gap-0 print:block">
            {pages.map((pageResults, pageIdx) => (
                <div key={pageIdx} className="page" style={{
                    width: isThermal ? '80mm' : '210mm',
                    height: isThermal ? 'auto' : '297mm',
                    minHeight: isThermal ? '100mm' : '297mm',
                    backgroundColor: 'white',
                    boxSizing: 'border-box',
                    fontFamily: "'Inter', 'Roboto', 'Helvetica', 'Arial', sans-serif",
                    fontSize: `${bodyFontSize}px`,
                    lineHeight: bodyLineHeight,
                    color: '#0f172a',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    padding: isThermal ? '0 4mm 10mm 4mm' : `0 20mm ${bottomMargin}mm 20mm`
                }}>
                    <style>{`
                        @media print {
                            .page { 
                                position: relative !important;
                                width: ${isThermal ? '80mm' : '210mm'} !important;
                                min-height: ${isThermal ? '100mm' : '297mm'} !important;
                                height: ${isThermal ? 'auto' : '297mm'} !important;
                                padding: 0 ${isThermal ? '4mm' : '20mm'} ${bottomMargin}mm ${isThermal ? '4mm' : '20mm'} !important;
                                margin: 0 auto !important;
                                page-break-after: ${isThermal ? 'auto' : 'always'} !important;
                                break-after: ${isThermal ? 'auto' : 'page'} !important;
                                display: flex !important;
                                flex-direction: column !important;
                                box-shadow: none !important;
                                transform: none !important;
                                box-sizing: border-box !important;
                                background: white !important;
                            }
                            .test-results-container > div { page-break-inside: avoid !important; break-inside: avoid !important; }
                            .page:last-child {
                                page-break-after: avoid !important;
                                break-after: avoid !important;
                            }
                            .footer { 
                                margin-top: auto !important; 
                                padding-bottom: 5mm !important;
                            }
                        }
                    `}</style>

                    {/* Background Watermark (Every Page) */}
                    {design.watermark?.url && (
                        <div style={{
                            position: 'absolute',
                            left: `${design.watermark.x}%`,
                            top: `${design.watermark.y}%`,
                            width: `${design.watermark.width}%`,
                            height: `${design.watermark.height}%`,
                            transform: `translate(-50%, -50%) rotate(${design.watermark.rotation}deg)`,
                            opacity: design.watermark.opacity,
                            zIndex: 0,
                            pointerEvents: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <img src={design.watermark.url} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="Watermark" />
                        </div>
                    )}

                    {/* Header branding */}
                    <header style={{
                        height: isThermal ? 'auto' : `${headerHeightMM}mm`,
                        minHeight: isThermal ? '20mm' : 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 5,
                        backgroundColor: 'white',
                        padding: isThermal ? '4mm 0' : '0',
                        marginBottom: isThermal ? '2mm' : '0'
                    }}>
                        {design.headerImageUrl && design.headerImageUrl !== 'HIDDEN' ? (
                            <img src={design.headerImageUrl} style={{ width: '100%', height: 'auto', maxHeight: isThermal ? '25mm' : '100%', objectFit: (isThermal ? 'contain' : 'fill') }} alt="" />
                        ) : (
                            design.headerImageUrl !== 'HIDDEN' && (
                                <div style={{ fontSize: isThermal ? '18px' : '32px', fontWeight: 900, color: '#0ea5e9', letterSpacing: '-0.04em', textAlign: 'center' }}>
                                    {design.labInfo?.name || 'QUALITY CARE'}
                                    {isThermal && <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 500, marginTop: '1mm' }}>{design.labInfo?.address || 'Premium Diagnostic Services'}</div>}
                                </div>
                            )
                        )}
                        {isThermal && <div style={{ width: '100%', borderBottom: '1px dashed #cbd5e0', marginTop: '4mm' }}></div>}
                    </header>

                    {/* Content Body */}
                    <main style={{
                        position: isThermal ? 'relative' : 'absolute',
                        top: isThermal ? '0' : `${headerHeightMM}mm`,
                        left: isThermal ? '0' : (isThermal ? '4mm' : '20mm'),
                        right: isThermal ? '0' : (isThermal ? '4mm' : '20mm'),
                        bottom: isThermal ? 'auto' : `${footerHeightMM}mm`,
                        zIndex: 1,
                        paddingBottom: isThermal ? '5mm' : '0'
                    }}>
                        {pageIdx === 0 && (
                            <div style={{
                                display: isThermal ? 'block' : 'grid',
                                gridTemplateColumns: isThermal ? 'none' : 'minmax(0, 1.2fr) minmax(0, 1fr)',
                                gap: isThermal ? '1mm' : '0 10mm',
                                marginBottom: isThermal ? '4mm' : '10mm',
                                padding: isThermal ? '2mm 0' : '6mm 8mm',
                                background: isThermal ? 'transparent' : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                                borderRadius: isThermal ? '0' : '6mm',
                                border: isThermal ? 'none' : '0.3mm solid #e2e8f0',
                                borderTop: isThermal ? '1px solid #f1f5f9' : '0.3mm solid #e2e8f0',
                                borderBottom: isThermal ? '1px solid #f1f5f9' : '0.3mm solid #e2e8f0',
                                height: isThermal ? 'auto' : `${PATIENT_BOX_H}mm`,
                                boxSizing: 'border-box'
                            }}>
                                {isThermal ? (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2mm 4mm', fontSize: '10px' }}>
                                        <div style={{ flex: '1 1 100%' }}><span style={{ color: '#64748b', fontWeight: 600 }}>Patient:</span> <span style={{ fontWeight: 800 }}>{patient.name}</span></div>
                                        <div><span style={{ color: '#64748b', fontWeight: 600 }}>ID:</span> <span style={{ fontWeight: 700 }}>{data.report?.id || patient.id || '---'}</span></div>
                                        <div><span style={{ color: '#64748b', fontWeight: 600 }}>Age/Sex:</span> <span style={{ fontWeight: 700 }}>{patient.age}Y/{patient.gender}</span></div>
                                        {patient.phone && <div><span style={{ color: '#64748b', fontWeight: 600 }}>P:</span> <span style={{ fontWeight: 700 }}>{patient.phone}</span></div>}
                                        <div style={{ flex: '1 1 100%', borderTop: '1px dotted #f1f5f9', paddingTop: '1mm' }}>
                                            <span style={{ color: '#64748b', fontWeight: 600 }}>Ref BY:</span> <span style={{ fontWeight: 700 }}>{data.doctor?.name || 'SELF'}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div style={{ display: 'grid', gap: '3mm' }}>
                                            <EliteInfoRow label="Patient Full Name" value={patient.name} size="large" />
                                            <EliteInfoRow label="Patient ID / Record" value={data.report?.id || patient.id || '---'} />
                                            <EliteInfoRow label="Address / Location" value={patient.phone ? `${patient.phone} • ${patient.address || 'Local'}` : (patient.address || '---')} />
                                        </div>
                                        <div style={{ display: 'grid', gap: '3mm' }}>
                                            <EliteInfoRow label="Visit Reference" value={data.report?.id || 'VIS-2026-PRESTIGE'} />
                                            <EliteInfoRow label="Age / Gender" value={`${patient.age}Y • ${patient.gender}`} />
                                            <EliteInfoRow label="Report Generated" value={new Date().toLocaleString()} />
                                            <EliteInfoRow label="Consulting Authority" value={data.doctor?.name || 'SELF REFERRAL'} />
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Render the moveable QR (prefer designer's qrStyle) on first page only */}
                        {pageIdx === 0 && (
                            (() => {
                                // Helper converters from designer canvas px -> mm
                                const pxToMMX = (v: number) => (v / PAGE_SPECS[design.pageFormat].width) * (isThermal ? 80 : 210);
                                const pxToMMY = (v: number) => (v / PAGE_SPECS[design.pageFormat].height) * (isThermal ? 297 : 297);

                                // Prefer dedicated qrStyle (moveable QR in designer)
                                if (design.qrStyle) {
                                    const left = pxToMMX(design.qrStyle.x || 0);
                                    const top = pxToMMY(design.qrStyle.y || 0);
                                    const width = pxToMMX(design.qrStyle.width || 65);
                                    const height = pxToMMY(design.qrStyle.height || 65);

                                    try { console.debug('Printing QR using qrStyle', { left, top, width, height }); } catch (e) { }

                                    return (
                                        <div style={{
                                            position: 'absolute',
                                            left: `${left}mm`,
                                            top: `${top}mm`,
                                            width: `${width}mm`,
                                            height: `${height}mm`,
                                            zIndex: 12,
                                            background: 'white',
                                            padding: '2mm',
                                            boxSizing: 'border-box'
                                        }}>
                                            {data.qrDataUrl ? (
                                                <img src={data.qrDataUrl} alt="QR" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                            ) : (
                                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#718096' }}>QR</div>
                                            )}
                                        </div>
                                    );
                                }

                                // Fallback: use first non-locked 'qr' layer if present, or image layers heuristically labelled as QR
                                const qrLayer = Array.isArray(design.layers) ? (
                                    design.layers.find(l => l.type === 'qr' && !l.locked)
                                    || design.layers.find(l => l.type === 'qr')
                                    || design.layers.find(l => l.type === 'image' && ((l.name || '').toLowerCase().includes('qr') || (l.content || '').toLowerCase().includes('qrcode')))
                                ) : null;
                                if (qrLayer) {
                                    const left = pxToMMX(qrLayer.x || 0);
                                    const top = pxToMMY(qrLayer.y || 0);
                                    const width = pxToMMX(qrLayer.width || 65);
                                    const height = pxToMMY(qrLayer.height || 65);

                                    return (
                                        <div style={{
                                            position: isThermal ? 'relative' : 'absolute',
                                            left: isThermal ? 'auto' : `${left}mm`,
                                            top: isThermal ? 'auto' : `${top}mm`,
                                            width: isThermal ? '25mm' : `${width}mm`,
                                            height: isThermal ? '25mm' : `${height}mm`,
                                            margin: isThermal ? '4mm auto' : '0',
                                            zIndex: 12,
                                            background: 'white',
                                            padding: '2mm',
                                            boxSizing: 'border-box'
                                        }}>
                                            {data.qrDataUrl ? (
                                                <img src={data.qrDataUrl} alt="QR" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                            ) : (
                                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#718096' }}>QR</div>
                                            )}
                                        </div>
                                    );
                                }

                                // Final Thermal Fallback for QR
                                if (isThermal && data.qrDataUrl) {
                                    return (
                                        <div style={{ width: '25mm', height: '25mm', margin: '4mm auto', background: 'white', padding: '1mm' }}>
                                            <img src={data.qrDataUrl} alt="QR" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                        </div>
                                    );
                                }

                                return null;
                            })()
                        )}

                        {/* Invoice Items (Specific to Bill mode) */}
                        {isBill && invoice && (
                            <div style={{ marginBottom: '6mm' }}>
                                <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', borderBottom: '1px solid #0f172a', paddingBottom: '1mm', marginBottom: '2mm' }}>BILLING DETAILS</div>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid #e2e8f0', fontSize: '9px', textTransform: 'uppercase', color: '#64748b' }}>
                                            <th style={{ textAlign: 'left', padding: '2mm 0' }}>Description</th>
                                            <th style={{ textAlign: 'right', padding: '2mm 0' }}>Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody style={{ fontSize: isThermal ? '10px' : '11px' }}>
                                        {invoice.items.map((item, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px dotted #f1f5f9' }}>
                                                <td style={{ padding: '2mm 0', fontWeight: 600 }}>{item.name}</td>
                                                <td style={{ textAlign: 'right', padding: '2mm 0', fontWeight: 700 }}>Rs. {item.total.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {/* Financial Summary */}
                                <div style={{ marginTop: '4mm', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1mm' }}>
                                    <div style={{ display: 'flex', width: isThermal ? '100%' : '50%', justifyContent: 'space-between', fontSize: '10px' }}>
                                        <span style={{ color: '#64748b' }}>Subtotal:</span>
                                        <span style={{ fontWeight: 600 }}>Rs. {invoice.subtotal.toLocaleString()}</span>
                                    </div>
                                    {(invoice.discount || 0) > 0 && (
                                        <div style={{ display: 'flex', width: isThermal ? '100%' : '50%', justifyContent: 'space-between', fontSize: '10px', color: '#ef4444' }}>
                                            <span>Discount:</span>
                                            <span style={{ fontWeight: 600 }}>-Rs. {invoice.discount!.toLocaleString()}</span>
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', width: isThermal ? '100%' : '50%', justifyContent: 'space-between', fontSize: '13px', fontWeight: 900, borderTop: '1px solid #0f172a', paddingTop: '1mm', marginTop: '1mm' }}>
                                        <span>NET TOTAL:</span>
                                        <span>Rs. {invoice.total.toLocaleString()}</span>
                                    </div>
                                    <div style={{ display: 'flex', width: isThermal ? '100%' : '50%', justifyContent: 'space-between', fontSize: '10px', marginTop: '1mm' }}>
                                        <span style={{ color: '#64748b' }}>Paid Amount:</span>
                                        <span style={{ fontWeight: 700, color: '#16a34a' }}>Rs. {(invoice.paid || 0).toLocaleString()}</span>
                                    </div>
                                    {(invoice.due || 0) > 0 && (
                                        <div style={{ display: 'flex', width: isThermal ? '100%' : '50%', justifyContent: 'space-between', fontSize: '11px', fontWeight: 800, color: '#ef4444', backgroundColor: '#fef2f2', padding: '1mm 2mm', borderRadius: '1mm', marginTop: '1mm' }}>
                                            <span>BALANCE DUE:</span>
                                            <span>Rs. {invoice.due!.toLocaleString()}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Test Results */}
                        <div className="test-results-container">
                            {pageResults.map((category, catIdx) => (
                                <div key={catIdx} style={{ marginBottom: '12mm' }}>
                                    <div style={{
                                        fontSize: '14px',
                                        fontWeight: 900,
                                        color: '#ffffff',
                                        background: 'linear-gradient(90deg, #1e293b, #334155)',
                                        padding: '3mm 6mm',
                                        marginBottom: '5mm',
                                        borderRadius: '3mm',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.15em',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}>
                                        <span>{category.category}</span>
                                        <span style={{ fontSize: '10px', opacity: 0.6 }}>Validated Diagnostics</span>
                                    </div>

                                    {(category.groups || []).map((group: any, groupIdx: number) => (
                                        <div key={groupIdx} style={{ marginBottom: '7mm' }}>
                                            <div style={{ fontSize: '12px', fontWeight: 800, color: '#0ea5e9', padding: '2mm 0', marginBottom: '3mm', display: 'flex', alignItems: 'center', gap: '3mm' }}>
                                                <div style={{ width: '8mm', height: '0.5mm', background: 'linear-gradient(90deg, #0ea5e9, transparent)' }}></div>
                                                {group.testName}
                                            </div>

                                            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 2mm' }}>
                                                <thead>
                                                    <tr>
                                                        <th style={{ padding: '0 3mm', textAlign: 'left', fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Parameter</th>
                                                        <th style={{ padding: '0 3mm', textAlign: 'right', fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Result</th>
                                                        <th style={{ padding: '0 3mm', textAlign: 'left', fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', paddingLeft: '8mm' }}>Units</th>
                                                        <th style={{ padding: '0 3mm', textAlign: 'right', fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Reference</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(group.parameters || []).map((param: any, paramIdx: number) => {
                                                        const isCritical = param.flag === 'CH' || param.flag === 'CL';
                                                        return (
                                                            <tr key={paramIdx} style={{ backgroundColor: isCritical ? '#fff1f2' : (paramIdx % 2 === 0 ? '#ffffff' : '#fcfcfc') }}>
                                                                <td style={{ padding: '3.5mm 3mm', fontWeight: 600, borderLeft: isCritical ? '1mm solid #ef4444' : '1mm solid transparent', borderRadius: '2mm 0 0 2mm' }}>{param.name}</td>
                                                                <td style={{ padding: '3.5mm 3mm', textAlign: 'right', fontWeight: 900, color: (param.flag === 'H' || param.flag === 'CH') ? '#dc2626' : (param.flag === 'L' || param.flag === 'CL') ? '#2563eb' : '#0f172a' }}>{param.result}</td>
                                                                <td style={{ padding: '3.5mm 3mm', color: '#64748b', paddingLeft: '8mm' }}>{param.unit}</td>
                                                                <td style={{ padding: '3.5mm 3mm', textAlign: 'right', color: '#94a3b8' }}>{param.range}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>

                        {/* Remarks (Only on last page) */}
                        {pageIdx === pages.length - 1 && data.remarks && (
                            <div style={{
                                marginTop: '20px',
                                padding: '15px 20px',
                                backgroundColor: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: '15px',
                                boxShadow: '0 5px 15px rgba(0,0,0,0.05)'
                            }}>
                                <div style={{ fontWeight: 900, color: '#1e293b', fontSize: '11px', textTransform: 'uppercase', marginBottom: '10px' }}>Interpretation</div>
                                <div style={{ whiteSpace: 'pre-wrap', color: '#1e293b', fontStyle: 'italic' }}>"{data.remarks}"</div>
                                <div style={{ borderTop: '1px dashed #e2e8f0', marginTop: '15px', paddingTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ height: '30px' }}></div>
                                        <div style={{ fontWeight: 800, fontSize: '10px' }}>Authorized Signature</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </main>

                    {/* Footer branding */}
                    <footer className="footer" style={{
                        position: isThermal ? 'relative' : 'absolute',
                        bottom: isThermal ? 'auto' : 0,
                        left: 0,
                        right: 0,
                        height: isThermal ? 'auto' : `${footerHeightMM}mm`,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 5,
                        backgroundColor: 'white',
                        padding: isThermal ? '2mm 0' : '0 20mm',
                        borderTop: isThermal ? '1px dashed #f1f5f9' : '1px solid #f1f5f9',
                        marginTop: isThermal ? '4mm' : 'auto'
                    }}>
                        <div style={{ width: '100%', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            {design.footerImageUrl && design.footerImageUrl !== 'HIDDEN' ? (
                                <img src={design.footerImageUrl} style={{ width: '100%', height: isThermal ? 'auto' : '100%', maxHeight: isThermal ? '15mm' : '100%', objectFit: isThermal ? 'contain' : 'fill' }} alt="" />
                            ) : (
                                design.footerImageUrl !== 'HIDDEN' && !isThermal && <div style={{ borderTop: '1px solid #e2e8f0', width: '100%' }}></div>
                            )}
                        </div>


                        {/* Page Numbering & Bottom Info */}
                        <div style={{
                            width: '100%',
                            display: 'flex',
                            justifyContent: 'space-between',
                            borderTop: isThermal ? 'none' : '1px solid #f1f5f9',
                            paddingTop: '5px',
                            marginTop: isThermal ? '1mm' : '2mm'
                        }}>
                            <div style={{ fontSize: '7px', color: '#cbd5e1' }}>{isThermal ? 'SCAN TO TRACK' : 'VALIDATED RECORD • LABPRO PRESTIGE v4.0'}</div>
                            <div style={{ fontSize: '7px', color: '#cbd5e1' }}>{isThermal ? data.report?.id : `PAGE ${String(pageIdx + 1).padStart(2, '0')} OF {String(pages.length).padStart(2, '0')}`}</div>
                        </div>
                    </footer>
                </div>
            ))}
        </div>
    );
};

// Internal Helper for Prestige Patient Data
const EliteInfoRow: React.FC<{ label: string, value: string, size?: 'normal' | 'large' }> = ({ label, value, size = 'normal' }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span style={{ color: '#94a3b8', fontWeight: 700, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        <span style={{ color: '#1e293b', fontWeight: size === 'large' ? 900 : 700, fontSize: size === 'large' ? '15px' : '12px' }}>{value || '---'}</span>
    </div>
);

// Internal Helper for Patient Info Styling
const PatientInfoRow: React.FC<{ label: string, value: string }> = ({ label, value }) => (
    <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '8px 0',
        borderBottom: '1px solid #f1f5f9'
    }}>
        <span style={{ color: '#64748b', fontWeight: 600, fontSize: '10px' }}>{label}</span>
        <span style={{ color: '#1e293b', fontWeight: 700 }}>{value || '---'}</span>
    </div>
);

// --- Page Renderer ---
interface PageProps {
    design: ReportDesign;
    data?: ReportData;
    scale?: number;
    showGrid?: boolean;
    isPreview?: boolean;
}

export const ReportPageRenderer: React.FC<PageProps> = ({ design, data, scale = 1, showGrid = false, isPreview = false }) => {
    if (!design) return <div>Loading Design...</div>;

    // --- NEW: Auto-Layout Mode ---
    if (design.isAutoLayout) {
        return (
            <div className="print-no-scale" style={{
                transform: `scale(${scale})`,
                transformOrigin: 'top center',
            }}>
                <ModernAutoReportRenderer design={design} data={data} />
            </div>
        );
    }

    // --- LEGACY: Layer-based Mode ---
    const specs = PAGE_SPECS[design.pageFormat] || PAGE_SPECS['A4'];
    const width = design.customDimensions?.width || specs.width;
    const height = design.pageFormat?.startsWith('Thermal') ? 'auto' : (design.customDimensions?.height || specs.height);

    return (
        <div
            className="bg-white shadow-lg relative print:shadow-none print:m-0"
            style={{
                width: width,
                minHeight: typeof height === 'number' ? height : 100,
                height: typeof height === 'number' ? height : undefined,
                transform: `scale(${scale})`,
                transformOrigin: 'top center',
                position: 'relative',
                overflow: height === 'auto' ? 'visible' : (isPreview ? 'hidden' : 'visible')
            }}
        >
            {/* Grid Overlay */}
            {showGrid && (
                <div
                    className="absolute inset-0 pointer-events-none z-0"
                    style={{
                        backgroundImage: `linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)`,
                        backgroundSize: `${design.gridSize || 20}px ${design.gridSize || 20}px`
                    }}
                />
            )}

            {/* Layers - Static Render */}
            {(design.layers || []).filter(l => {
                // Exclude explicit qr layers and any image layers that are likely QR exports (legacy)
                if (l.type === 'qr') return false;
                if (l.type === 'image' && ((l.name || '').toLowerCase().includes('qr') || (l.name || '').toLowerCase().includes('qrcode') || (l.content || '').toLowerCase().includes('qrcode'))) return false;
                return true;
            }).map(layer => (
                <div
                    key={layer.id}
                    style={{
                        position: 'absolute',
                        left: layer.x,
                        top: layer.y,
                        width: layer.width,
                        height: layer.height,
                        zIndex: layer.type === 'image' ? 1 : 10,
                    }}
                >
                    <ReportLayerComponent layer={layer} data={data} isPreview={isPreview} />
                </div>
            ))}
        </div>
    );
};
