
import { ReportDesign, PageFormat, ReportLayer } from './ReportSchema';

// Helper to create IDs
const uid = () => Math.random().toString(36).substr(2, 9);

// Standard A4 Layout
export const TEMPLATE_A4_MODERN: ReportDesign = {
    id: 'sys_a4_modern',
    name: 'Modern Clean (A4)',
    type: 'report',
    pageFormat: 'A4',
    createdAt: Date.now(),
    layers: [
        // Header Background
        {
            id: 'header_bg', type: 'box', name: 'Header Background',
            x: 0, y: 0, width: 794, height: 100,
            style: { backgroundColor: '#f8fafc', borderBottom: '2px solid #3b82f6' }
        },
        // Lab Name
        {
            id: 'lab_name', type: 'text', name: 'Lab Name',
            x: 40, y: 30, width: 400, height: 40,
            content: 'CITY DIAGNOSTICS CENTER',
            style: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' }
        },
        // Address
        {
            id: 'address', type: 'text', name: 'Address',
            x: 40, y: 65, width: 400, height: 20,
            content: '123 Medical Plaza, Health District, NY\nPhone: (555) 123-4567',
            style: { fontSize: 11, color: '#64748b' }
        },
        // Patient Info Container
        {
            id: 'pat_box', type: 'box', name: 'Patient Box',
            x: 40, y: 120, width: 714, height: 90,
            style: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8 }
        },
        // Patient Fields
        { id: uid(), type: 'text', name: 'Lbl Name', x: 60, y: 135, width: 80, height: 20, content: 'PATIENT:', style: { fontSize: 10, fontWeight: 'bold', color: '#94a3b8' } },
        { id: uid(), type: 'text', name: 'Val Name', x: 140, y: 135, width: 250, height: 20, content: '{{patient.name}}', style: { fontSize: 12, fontWeight: 'bold' } },

        { id: uid(), type: 'text', name: 'Lbl ID', x: 400, y: 135, width: 80, height: 20, content: 'PATIENT ID:', style: { fontSize: 10, fontWeight: 'bold', color: '#94a3b8' } },
        { id: uid(), type: 'text', name: 'Val ID', x: 480, y: 135, width: 150, height: 20, content: '{{patient.id}}', style: { fontSize: 12 } },

        { id: uid(), type: 'text', name: 'Lbl Date', x: 400, y: 165, width: 80, height: 20, content: 'DATE:', style: { fontSize: 10, fontWeight: 'bold', color: '#94a3b8' } },
        { id: uid(), type: 'text', name: 'Val Date', x: 480, y: 165, width: 150, height: 20, content: '{{report.date}}', style: { fontSize: 12 } },

        // Test Table
        {
            id: 'test_table', type: 'table', name: 'Results Table',
            x: 40, y: 240, width: 714, height: 600,
            style: { fontSize: 12 },
            tableColumns: [
                { header: 'Test Name', key: 'name', width: '40%' },
                { header: 'Result', key: 'result', width: '20%' },
                { header: 'Unit', key: 'unit', width: '15%' },
                { header: 'Ref. Range', key: 'range', width: '25%' }
            ]
        },

        // Footer (Fixed position A4)
        {
            id: 'footer_line', type: 'line', name: 'Footer Line',
            x: 40, y: 1050, width: 714, height: 2,
            style: { backgroundColor: '#e2e8f0' }
        },
        {
            id: 'footer_text', type: 'text', name: 'Footer Text',
            x: 40, y: 1060, width: 714, height: 20,
            content: 'This report is electronically verified. No signature required.',
            style: { fontSize: 10, textAlign: 'center', color: '#94a3b8' }
        }
    ]
};

// Thermal Invoice using 80mm
export const TEMPLATE_THERMAL_80: ReportDesign = {
    id: 'sys_thermal_80',
    name: 'Thermal Receipt (80mm)',
    type: 'invoice',
    pageFormat: 'Thermal80',
    createdAt: Date.now(),
    layers: [
        { id: uid(), type: 'text', name: 'H Hospital', x: 10, y: 10, width: 282, height: 30, content: 'CITY LABS', style: { fontSize: 18, fontWeight: 'bold', textAlign: 'center' } },
        { id: uid(), type: 'text', name: 'H Date', x: 10, y: 40, width: 282, height: 20, content: '{{report.date}}', style: { fontSize: 11, textAlign: 'center' } },

        { id: uid(), type: 'line', name: 'Div', x: 10, y: 65, width: 282, height: 2, style: { borderStyle: 'dashed', borderColor: '#000' } },

        { id: uid(), type: 'text', name: 'Pt Name', x: 10, y: 75, width: 282, height: 20, content: 'Pt: {{patient.name}}', style: { fontSize: 12, fontWeight: 'bold' } },

        {
            id: 'inv_table', type: 'table', name: 'Items',
            x: 5, y: 110, width: 292, height: 200,
            style: { fontSize: 11 },
            dataKey: 'invoice.items',
            tableColumns: [
                { header: 'Item', key: 'name', width: '50%' },
                { header: 'Qty', key: 'qty', width: '15%' },
                { header: 'Cost', key: 'total', width: '35%' }
            ]
        },

        { id: uid(), type: 'text', name: 'Footer', x: 10, y: 350, width: 282, height: 30, content: 'Thank you for your visit!', style: { fontSize: 10, textAlign: 'center' } },
    ]
};

export const SYSTEM_TEMPLATES = [TEMPLATE_A4_MODERN, TEMPLATE_THERMAL_80];
