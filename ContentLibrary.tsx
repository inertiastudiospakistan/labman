import React, { useState } from 'react';
import {
    ChevronDown, ChevronRight, Type, Image as ImageIcon,
    Box, Circle, Minus, Table, FileText, Search,
    User, Calendar, TestTube, DollarSign, QrCode
} from 'lucide-react';

interface ContentLibraryProps {
    onAddLayer: (type: any, content?: string) => void;
    onImageUpload: () => void;
    mode?: 'report' | 'bill';
}

interface LibraryItem {
    icon: any;
    label: string;
    action: () => void;
    description?: string;
}

interface LibraryCategory {
    title: string;
    icon: any;
    items: LibraryItem[];
}

const ContentLibrary: React.FC<ContentLibraryProps> = ({ onAddLayer, onImageUpload, mode = 'report' }) => {
    const [expandedCategories, setExpandedCategories] = useState<string[]>(['text', 'shapes', 'dynamic fields']);
    const [searchQuery, setSearchQuery] = useState('');

    const toggleCategory = (category: string) => {
        setExpandedCategories(prev =>
            prev.includes(category)
                ? prev.filter(c => c !== category)
                : [...prev, category]
        );
    };

    const categories: LibraryCategory[] = [
        {
            title: 'Text',
            icon: Type,
            items: [
                { icon: Type, label: 'Heading', action: () => onAddLayer('text', 'Heading'), description: 'Large title text' },
                { icon: Type, label: 'Subheading', action: () => onAddLayer('text', 'Subheading'), description: 'Section header' },
                { icon: Type, label: 'Body Text', action: () => onAddLayer('text', 'Body text'), description: 'Paragraph content' },
                { icon: Type, label: 'Label', action: () => onAddLayer('text', 'Label'), description: 'Small label text' }
            ]
        },
        {
            title: 'Shapes',
            icon: Box,
            items: [
                { icon: Box, label: 'Rectangle', action: () => onAddLayer('box'), description: 'Box shape' },
                { icon: Circle, label: 'Circle', action: () => onAddLayer('shape'), description: 'Circular shape' },
                { icon: Minus, label: 'Line', action: () => onAddLayer('line'), description: 'Horizontal line' },
                { icon: Minus, label: 'Divider', action: () => onAddLayer('line'), description: 'Section divider' }
            ]
        },
        {
            title: 'Tables',
            icon: Table,
            items: mode === 'report' ? [
                { icon: Table, label: 'Test Results', action: () => onAddLayer('table'), description: 'Lab test results table' },
                { icon: Table, label: 'Custom Table', action: () => onAddLayer('table'), description: 'Blank table' }
            ] : [
                { icon: Table, label: 'Billing Items', action: () => onAddLayer('table'), description: 'Invoice items table' },
                { icon: Table, label: 'Tax Summary', action: () => onAddLayer('table'), description: 'Tax breakdown' },
                { icon: Table, label: 'Custom Table', action: () => onAddLayer('table'), description: 'Blank table' }
            ]
        },
        {
            title: 'Dynamic Fields',
            icon: FileText,
            items: mode === 'report' ? [
                { icon: User, label: 'Patient Name', action: () => onAddLayer('text', '{{patient.name}}'), description: 'Auto-populated' },
                { icon: User, label: 'Patient ID', action: () => onAddLayer('text', '{{patient.id}}'), description: 'Auto-populated' },
                { icon: User, label: 'Age / Gender', action: () => onAddLayer('text', '{{patient.age_sex}}'), description: 'Auto-populated' },
                { icon: Calendar, label: 'Report Date', action: () => onAddLayer('text', '{{report.date}}'), description: 'Auto-populated' },
            ] : [
                { icon: User, label: 'Patient Name', action: () => onAddLayer('text', '{{patient.name}}'), description: 'Auto-populated' },
                { icon: DollarSign, label: 'Invoice No', action: () => onAddLayer('text', '{{bill.invoice_no}}'), description: 'Invoice #' },
                { icon: DollarSign, label: 'Total Amount', action: () => onAddLayer('text', '{{bill.total_amount}}'), description: 'Final amount' },
                { icon: DollarSign, label: 'Discount', action: () => onAddLayer('text', '{{bill.discount}}'), description: 'Discount applied' },
                { icon: Calendar, label: 'Date', action: () => onAddLayer('text', '{{bill.date}}'), description: 'Invoice date' }
            ]
        },
        {
            title: 'QR & Barcodes',
            icon: QrCode,
            items: [
                { icon: QrCode, label: 'Tracking QR', action: () => onAddLayer('qr'), description: 'Scan to track status' },
                { icon: QrCode, label: 'Dynamic QR', action: () => onAddLayer('qr'), description: 'Custom data QR' }
            ]
        },
        {
            title: 'Images',
            icon: ImageIcon,
            items: [
                { icon: ImageIcon, label: 'Upload Logo', action: onImageUpload, description: 'Lab logo image' },
                { icon: ImageIcon, label: 'Upload Signature', action: onImageUpload, description: 'Doctor signature' },
                { icon: ImageIcon, label: 'Upload Stamp', action: onImageUpload, description: 'Official stamp' }
            ]
        }
    ];

    const filteredCategories = categories.map(category => ({
        ...category,
        items: category.items.filter(item =>
            searchQuery === '' ||
            item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.description?.toLowerCase().includes(searchQuery.toLowerCase())
        )
    })).filter(category => category.items.length > 0);

    return (
        <div className="w-64 bg-white border-r border-slate-200 flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-200">
                <h2 className="font-bold text-slate-800 mb-3">Content Library</h2>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search elements..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                </div>
            </div>

            {/* Categories */}
            <div className="flex-1 overflow-y-auto">
                {filteredCategories.map((category) => {
                    const isExpanded = expandedCategories.includes(category.title.toLowerCase());
                    const CategoryIcon = category.icon;

                    return (
                        <div key={category.title} className="border-b border-slate-100">
                            {/* Category Header */}
                            <button
                                onClick={() => toggleCategory(category.title.toLowerCase())}
                                className="w-full flex items-center gap-2 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                            >
                                {isExpanded ? (
                                    <ChevronDown size={16} className="text-slate-500" />
                                ) : (
                                    <ChevronRight size={16} className="text-slate-500" />
                                )}
                                <CategoryIcon size={18} className="text-slate-600" />
                                <span className="font-semibold text-sm text-slate-700">{category.title}</span>
                                <span className="ml-auto text-xs text-slate-400">{category.items.length}</span>
                            </button>

                            {/* Category Items */}
                            {isExpanded && (
                                <div className="pb-2">
                                    {category.items.map((item, index) => {
                                        const ItemIcon = item.icon;
                                        return (
                                            <button
                                                key={index}
                                                onClick={item.action}
                                                className="w-full flex items-start gap-3 px-4 py-2 pl-10 hover:bg-indigo-50 transition-colors text-left group"
                                            >
                                                <ItemIcon size={16} className="text-slate-400 group-hover:text-indigo-600 mt-0.5 flex-shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium text-slate-700 group-hover:text-indigo-700">
                                                        {item.label}
                                                    </div>
                                                    {item.description && (
                                                        <div className="text-xs text-slate-500 mt-0.5">
                                                            {item.description}
                                                        </div>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Footer Help */}
            <div className="p-4 bg-slate-50 border-t border-slate-200">
                <div className="text-xs text-slate-600">
                    <span className="font-semibold">Tip:</span> Click to add elements to your design. Drag to position.
                </div>
            </div>
        </div>
    );
};

export default ContentLibrary;
