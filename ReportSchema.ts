
// ReportSchema.ts

export type PageFormat = 'A4' | 'A5' | 'Letter' | 'Thermal80' | 'Thermal58';

export const PAGE_SPECS: Record<PageFormat, { width: number; height: number; label: string; isThermal?: boolean }> = {
    A4: { width: 794, height: 1123, label: 'A4 (210x297mm)' },
    A5: { width: 559, height: 794, label: 'A5 (148x210mm)' },
    Letter: { width: 816, height: 1056, label: 'Letter (8.5x11in)' },
    Thermal80: { width: 302, height: 1000, label: 'Thermal 80mm', isThermal: true }, // Height ignored in auto-mode
    Thermal58: { width: 219, height: 1000, label: 'Thermal 58mm', isThermal: true }
};

export type LayerType = 'text' | 'image' | 'shape' | 'box' | 'line' | 'table' | 'barcode' | 'qr';

export interface LayerStyle {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
    fontStyle?: 'normal' | 'italic';
    textDecoration?: 'none' | 'underline' | 'line-through';
    textAlign?: 'left' | 'center' | 'right' | 'justify';
    lineHeight?: number;
    letterSpacing?: number;
    color?: string;
    backgroundColor?: string;
    borderWidth?: number;
    borderColor?: string;
    borderStyle?: 'solid' | 'dashed' | 'dotted' | 'none';
    borderBottom?: string; // e.g. "2px solid #000"
    borderRadius?: number;
    opacity?: number;
    padding?: number;
    boxShadow?: string;
}

export interface ReportLayer {
    id: string;
    type: LayerType;
    name: string; // For the layers panel

    // Position & Size
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;

    // Content & Data
    content?: string; // Text content or image URL
    dataKey?: string; // generic binding key e.g. "patient.name" or "tests" (for tables)

    style: LayerStyle;

    // Behavior
    locked?: boolean;
    visible?: boolean;

    // Specific metadata
    tableColumns?: { header: string; key: string; width: string }[]; // For tables
}

export interface ReportDesign {
    id?: string;
    name: string;
    type: 'report' | 'invoice' | 'receipt';
    pageFormat: PageFormat;
    customDimensions?: { width: number; height: number }; // In case of custom size overrides
    layers: ReportLayer[];

    // Auto-Layout & Branding (Simplified Mode)
    isAutoLayout?: boolean;
    headerImageUrl?: string;
    footerImageUrl?: string;
    headerStyle?: { x: number; y: number; width: number; height: number };
    footerStyle?: { x: number; y: number; width: number; height: number };
    qrStyle?: { x: number; y: number; width: number; height: number }; // Moveable QR
    contentPadding?: { top: number; bottom: number }; // Customizable margins
    bodyFontSize?: number;
    bodyLineHeight?: number;

    watermark?: {
        url: string;
        x: number;
        y: number;
        width: number;
        height: number;
        opacity: number;
        rotation: number;
    };

    labInfo?: {
        name?: string;
        address?: string;
        phone?: string;
        email?: string;
        website?: string;
    };

    // Canvas Settings
    margin?: number;
    gridSize?: number;

    createdAt?: number;
    updatedAt?: number;
    isPublished?: boolean;
}
