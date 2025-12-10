
import React, { useState, useEffect, useMemo, useRef } from 'react';
import firebase from 'firebase/compat/app';
import { db, auth } from './firebase';
import { GoogleGenAI } from "@google/genai";
import {
    LayoutDashboard,
    Users,
    FileText,
    FlaskConical,
    CreditCard,
    Package,
    Settings,
    LogOut,
    UserPlus,
    Search,
    Bell,
    ChevronRight,
    Menu,
    X,
    Loader2,
    Phone,
    Calendar,
    MapPin,
    Trash2,
    Edit2,
    Shield,
    CheckCircle2,
    AlertCircle,
    Plus,
    TestTube,
    DollarSign,
    ClipboardList,
    Check,
    AlertTriangle,
    Printer,
    Syringe,
    Microscope,
    FileCheck,
    Clock,
    Info,
    ArrowRight,
    Globe,
    Lock,
    ChevronDown,
    Activity,
    Unlock,
    Eye,
    FileBarChart,
    Save,
    Database,
    History,
    TrendingUp,
    Download,
    Stethoscope,
    Receipt,
    QrCode,
    Filter,
    User,
    Briefcase,
    PenTool,
    XCircle,
    Sparkles,
    List,
    MinusCircle,
    GripVertical,
    Truck,
    CalendarClock,
    BarChart3,
    ArrowUpRight,
    ArrowDownRight,
    Zap,
    Armchair,
    Pen,
    Wallet,
    Landmark,
    TrendingDown,
    PieChart,
    FileSpreadsheet
} from 'lucide-react';

// --- Custom Dialog & Notification System ---

// Toast/Notification Component
type ToastType = 'success' | 'error' | 'warning' | 'info';
interface ToastMessage {
    id: string;
    type: ToastType;
    message: string;
}

const ToastContainer: React.FC<{ toasts: ToastMessage[], onClose: (id: string) => void }> = ({ toasts, onClose }) => {
    return (
        <div className="fixed top-4 right-4 z-[9999] space-y-2">
            {toasts.map(toast => {
                const icons = {
                    success: <CheckCircle2 className="w-5 h-5" />,
                    error: <XCircle className="w-5 h-5" />,
                    warning: <AlertTriangle className="w-5 h-5" />,
                    info: <Info className="w-5 h-5" />
                };
                const colors = {
                    success: 'bg-green-50 border-green-200 text-green-800',
                    error: 'bg-red-50 border-red-200 text-red-800',
                    warning: 'bg-amber-50 border-amber-200 text-amber-800',
                    info: 'bg-blue-50 border-blue-200 text-blue-800'
                };
                return (
                    <div key={toast.id} className={`${colors[toast.type]} border rounded-lg shadow-lg p-4 min-w-[300px] max-w-md animate-in slide-in-from-right-5 flex items-start gap-3`}>
                        {icons[toast.type]}
                        <p className="flex-1 text-sm font-medium">{toast.message}</p>
                        <button onClick={() => onClose(toast.id)} className="hover:opacity-70"><X className="w-4 h-4" /></button>
                    </div>
                );
            })}
        </div>
    );
};

// Custom Alert Dialog
const CustomAlert: React.FC<{
    isOpen: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title?: string;
    message: string;
    onClose: () => void;
}> = ({ isOpen, type, title, message, onClose }) => {
    if (!isOpen) return null;

    const typeConfig = {
        success: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
        error: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
        warning: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
        info: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' }
    };

    const config = typeConfig[type];
    const IconComponent = config.icon;

    return (
        <div className="fixed inset-0 bg-black/50 z-[9998] flex items-center justify-center p-4 animate-in fade-in" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                <div className={`${config.bg} ${config.border} border-b p-4 rounded-t-xl flex items-center gap-3`}>
                    <IconComponent className={`w-6 h-6 ${config.color}`} />
                    <h3 className="font-bold text-lg text-slate-800">{title || type.charAt(0).toUpperCase() + type.slice(1)}</h3>
                </div>
                <div className="p-6">
                    <p className="text-slate-700 leading-relaxed">{message}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-b-xl flex justify-end">
                    <button onClick={onClose} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors">
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
};

// Custom Confirm Dialog
const CustomConfirm: React.FC<{
    isOpen: boolean;
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'primary' | 'warning';
    onConfirm: () => void;
    onCancel: () => void;
}> = ({ isOpen, title, message, confirmText = 'Confirm', cancelText = 'Cancel', type = 'primary', onConfirm, onCancel }) => {
    if (!isOpen) return null;

    const buttonColors = {
        danger: 'bg-red-600 hover:bg-red-700',
        primary: 'bg-indigo-600 hover:bg-indigo-700',
        warning: 'bg-amber-600 hover:bg-amber-700'
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[9998] flex items-center justify-center p-4 animate-in fade-in" onClick={onCancel}>
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                <div className="p-6">
                    {title && <h3 className="font-bold text-xl text-slate-800 mb-4">{title}</h3>}
                    <p className="text-slate-700 leading-relaxed">{message}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-b-xl flex justify-end gap-3">
                    <button onClick={onCancel} className="px-6 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-bold transition-colors">
                        {cancelText}
                    </button>
                    <button onClick={onConfirm} className={`px-6 py-2 ${buttonColors[type]} text-white rounded-lg font-bold transition-colors`}>
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Custom Prompt Dialog
const CustomPrompt: React.FC<{
    isOpen: boolean;
    title?: string;
    message: string;
    defaultValue?: string;
    placeholder?: string;
    onConfirm: (value: string) => void;
    onCancel: () => void;
}> = ({ isOpen, title, message, defaultValue = '', placeholder, onConfirm, onCancel }) => {
    const [value, setValue] = useState(defaultValue);

    useEffect(() => {
        if (isOpen) setValue(defaultValue);
    }, [isOpen, defaultValue]);

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (value.trim()) {
            onConfirm(value);
            setValue('');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[9998] flex items-center justify-center p-4 animate-in fade-in" onClick={onCancel}>
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                <div className="p-6">
                    {title && <h3 className="font-bold text-xl text-slate-800 mb-4">{title}</h3>}
                    <p className="text-slate-700 leading-relaxed mb-4">{message}</p>
                    <input
                        type="text"
                        value={value}
                        onChange={e => setValue(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                        placeholder={placeholder}
                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        autoFocus
                    />
                </div>
                <div className="p-4 bg-slate-50 rounded-b-xl flex justify-end gap-3">
                    <button onClick={onCancel} className="px-6 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-bold transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleSubmit} disabled={!value.trim()} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Types ---
interface Patient {
    id: string;
    fullName: string;
    phone: string;
    dob: string;
    age?: number;
    gender: 'male' | 'female' | 'other';
    address: string;
    nationalId: string;
    email?: string;
    createdAt: any;
}

interface ReferenceRange {
    type: 'general' | 'gender' | 'age';
    gender?: 'male' | 'female';
    ageMin?: number;
    ageMax?: number;
    min?: number;
    max?: number;
    textVal?: string;
}

interface TestParameter {
    id: string;
    name: string;
    unit: string;
    type: 'numeric' | 'text' | 'dropdown' | 'boolean';
    options?: string[];
    refRanges: ReferenceRange[];
    notes?: string;
}

interface Test {
    id: string;
    code: string;
    name: string;
    description?: string;
    category?: string;
    price: number;
    labCost?: number;
    discountAllowed?: boolean;
    sampleType: string;
    turnaroundTime: string;
    parameters: TestParameter[];
    isActive: boolean;
    inventoryRequirements?: {
        itemId: string;
        itemName: string;
        quantity: number;
    }[];
    createdAt?: any;
    updatedAt?: any;
}

interface Order {
    id: string;
    patientId: string;
    patientName: string;
    doctorName?: string;
    doctorId?: string;
    doctorCommission?: number;
    commissionPaid?: boolean; // New: Track if commission is paid
    totalAmount: number;
    status: 'ordered' | 'partial' | 'completed';
    paymentStatus?: 'paid' | 'partial' | 'unpaid';
    createdAt: any;
    testCount: number;
}

interface Sample {
    id: string;
    orderId: string;
    patientId: string;
    patientName: string;
    patientGender: string;
    patientAge: number;
    testName: string;
    testId: string;
    sampleType: string;
    status: 'ordered' | 'collected' | 'analyzing' | 'review' | 'reported' | 'rejected';
    results?: Record<string, string>;
    verifiedBy?: string;
    collectedAt?: any;
    reportedAt?: any;
    createdAt: any;
    collectorId?: string;
    collectorName?: string;
    rejectedAt?: any;
    rejectedBy?: string;
    notes?: string;
    sampleLabelId?: string;
    pathologistRemarks?: string;
    conclusion?: string;
}

interface Invoice {
    id: string;
    orderId: string;
    patientName: string;
    amount: number;
    paidAmount: number;
    status: 'unpaid' | 'partial' | 'paid';
    createdAt: any;
    payments?: { amount: number; method: string; date: any }[];
    discount?: number;
}

// Purchase tracking (simplified batch system)
interface InventoryBatch {
    id: string;
    itemId: string;
    itemName: string;
    batchNumber: string; // Auto-generated: previous + 1
    quantityPurchased: number;
    unitPrice: number;
    totalCost: number;
    vendorName: string;
    vendorPhone?: string;
    invoiceNumber?: string;
    purchaseDate: any;
    expiryDate?: any;
    manufactureDate?: any;
    remarks?: string;
    createdAt: any;
    createdBy: string;
}

interface InventoryItem {
    id: string;
    name: string;
    category: string;
    description?: string;
    unit: string;
    quantity: number; // Current total quantity
    minLevel: number;
    reorderLevel?: number;
    sku?: string;
    barcode?: string;
    purchasePrice: number; // Latest purchase price
    totalValue?: number;
    vendorId?: string;
    vendorName: string;
    vendorPhone?: string;
    vendorAddress?: string;
    batchNumber: string; // Current/latest batch number
    purchaseDate: any;
    expiryDate?: any;
    location?: string;
    status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'expired';

    // Test mapping for auto-deduction
    testMappings?: {
        testId: string;
        testName: string;
        quantityPerTest: number;
    }[];

    createdAt: any;
    updatedAt?: any;
    createdBy?: string;
}

interface InventoryTransaction {
    id: string;
    itemId: string;
    itemName: string;
    type: 'purchase' | 'issue' | 'deduction' | 'adjustment' | 'return' | 'wastage'; // Added wastage
    quantity: number;
    cost?: number; // Value of the transaction (for accurate expense tracking)
    performedBy: string;
    reason?: string;
    batchNumber?: string; // New: Track specific batch
    relatedTestId?: string; // New: For auto-deductions
    relatedSampleId?: string; // New: For auto-deductions
    timestamp: any;
}

interface InventoryRequest {
    id: string;
    requesterId: string;
    requesterName: string;
    requesterRole: string;
    itemId: string;
    itemName: string;
    quantity: number;
    purpose: string;
    status: 'pending' | 'approved' | 'released' | 'completed' | 'rejected'; // Added 'approved' state
    releasedQuantity?: number;
    managerRemarks?: string;
    createdAt: any;
    approvedAt?: any; // New: When manager approved
    respondedAt?: any;
    respondedBy?: string;
    releasedAt?: any; // New: When items were released
    completedAt?: any;
    rejectedAt?: any; // New: When rejected
    rejectionReason?: string; // New: Why rejected
}

// New interfaces for enhanced inventory management
interface Vendor {
    id: string;
    name: string;
    contactPerson?: string;
    phone: string;
    email?: string;
    address?: string;
    notes?: string;
    status: 'active' | 'inactive';
    createdAt: any;
    updatedAt?: any;
}

interface InventoryPurchase {
    id: string;
    itemId: string;
    itemName: string;
    quantity: number;
    unitPrice: number;
    totalCost: number;
    vendorId?: string;
    vendorName: string;
    batchNumber: string;
    expiryDate?: any;
    purchaseDate: any;
    purchasedBy: string;
    invoiceNumber?: string;
    notes?: string;
    expenseId?: string; // Link to finance expense record
    createdAt: any;
}

interface InventoryWastage {
    id: string;
    itemId: string;
    itemName: string;
    quantity: number;
    reason: 'expired' | 'damaged' | 'spillage' | 'user_error' | 'contaminated' | 'other';
    reasonDetails?: string;
    cost: number;
    batchNumber?: string;
    reportedBy: string;
    reportedAt: any;
    expenseId?: string; // Link to finance expense record
}

interface InventoryNotification {
    id: string;
    type: 'low_stock' | 'expired' | 'expiring_soon' | 'request_pending' | 'request_approved' | 'request_rejected' | 'auto_deduction_failed' | 'out_of_stock';
    message: string;
    itemId?: string;
    itemName?: string;
    requestId?: string;
    priority: 'high' | 'medium' | 'low';
    createdAt: any;
    readAt?: any;
    recipientRole?: Role;
    recipientId?: string;
}

interface AppUser {
    id: string;
    fullName: string;
    username: string;
    password?: string;
    role: Role;
    status: 'active' | 'inactive';
    lastLogin?: any;
    email?: string;
}

interface AuditLog {
    id: string;
    action: string;
    module: string;
    details: string;
    userId: string;
    userName: string;
    timestamp: any;
}

interface Expense {
    id: string;
    title: string;
    category: string;
    amount: number;
    vendor?: string;
    date: any;
    dueDate?: string; // New: Due Date
    status: 'pending' | 'paid'; // New: Status
    paidAt?: any; // New: Payment Date
    paidBy?: string; // New: User
    isRecurring: boolean;
    notes?: string;
    createdBy: string;
}

interface Doctor {
    id: string;
    name: string;
    clinic: string;
    phone: string;
    commissionRate: number;
    status: 'active' | 'inactive';
}

interface PrintableInvoiceData {
    invoiceId: string;
    patientName: string;
    patientPhone: string;
    age: string;
    gender: string;
    date: string;
    doctor: string;
    items: Test[];
    subtotal: number;
    discount: number;
    total: number;
    paid: number;
    due: number;
    paymentMethod: string;
}

type ViewState = 'dashboard' | 'patients' | 'reception' | 'collection' | 'lab_tech' | 'lab_path' | 'finance' | 'inventory' | 'settings' |
    'admin_users' | 'admin_tests' | 'admin_finance' | 'admin_reports' | 'admin_logs' | 'admin_settings';

type Role = 'admin' | 'receptionist' | 'phlebotomist' | 'technician' | 'pathologist' | 'accountant' | 'inventory_manager';

const PERMISSIONS: Record<Role, ViewState[]> = {
    admin: ['dashboard', 'admin_users', 'admin_tests', 'finance', 'admin_reports', 'inventory', 'admin_logs', 'admin_settings', 'reception', 'collection', 'lab_tech', 'lab_path'],
    receptionist: ['dashboard', 'patients', 'reception'], // Removed inventory
    phlebotomist: ['dashboard', 'patients', 'collection'], // Removed inventory
    technician: ['dashboard', 'lab_tech'], // Removed inventory
    pathologist: ['dashboard', 'lab_path', 'patients', 'admin_reports'], // Removed inventory
    accountant: ['dashboard', 'finance'], // Removed inventory
    inventory_manager: ['dashboard', 'inventory', 'admin_reports']
};

const INVENTORY_CATEGORIES = [
    "Test Reagent",
    "Consumable",
    "Equipment",
    "Packaging",
    "PPE",
    "General",
    "Machinery",
    "Electric",
    "Stationary",
    "Furniture",
    "Other"
];

// Inventory permission helpers
const canManageInventory = (role: Role) => role === 'admin' || role === 'inventory_manager';
const canOnlyRequestInventory = (role: Role) => !canManageInventory(role);
const canViewInventoryCosts = (role: Role) => canManageInventory(role);

const AVAILABLE_ROLES = [
    { id: 'admin', label: 'System Administrator', icon: Shield },
    { id: 'receptionist', label: 'Receptionist', icon: Users },
    { id: 'phlebotomist', label: 'Sample Collection', icon: Syringe },
    { id: 'technician', label: 'Lab Technologist', icon: Microscope },
    { id: 'pathologist', label: 'Pathologist', icon: FileCheck },
    { id: 'accountant', label: 'Finance Manager', icon: DollarSign },
    { id: 'inventory_manager', label: 'Inventory Manager', icon: Package },
    { id: 'doctor', label: 'Referring Doctor', icon: UserPlus, disabled: true, disabledReason: 'Portal coming soon' },
];

const ANNOUNCEMENTS = [
    { id: 1, text: "System maintenance scheduled for Sunday 2 AM - 4 AM.", type: 'warning' },
    { id: 2, text: "New 'Liver Function Panel' added to test catalog.", type: 'info' },
    { id: 3, text: "COVID-19 RT-PCR reports now available in 6 hours.", type: 'success' },
];

// --- Helpers ---
const calculateAge = (dob: string) => {
    if (!dob) return 0;
    const birthDate = new Date(dob);
    const diff = Date.now() - birthDate.getTime();
    const ageDate = new Date(diff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
};

const formatDate = (date: any) => {
    if (!date) return '';
    try {
        const d = date.toDate ? date.toDate() : (date instanceof Date ? date : new Date(date));
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) { return ''; }
};

const formatTimeSafe = (date: any) => {
    if (!date) return '';
    try {
        const d = date.toDate ? date.toDate() : (date instanceof Date ? date : new Date(date));
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
}

const logAction = async (action: string, module: string, details: string, user: any) => {
    try {
        await db.collection('audit_logs').add({
            action, module, details,
            userId: user.uid || 'unknown',
            userName: user.email || user.username || 'System',
            timestamp: firebase.firestore.Timestamp.now()
        });
    } catch (e) { console.error("Audit log failed", e); }
};

const generateSampleLabel = (orderId: string, index: number) => {
    const today = new Date();
    const d = String(today.getDate()).padStart(2, '0');
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const y = String(today.getFullYear()).slice(-2);
    const suffix = orderId ? orderId.slice(-4).toUpperCase() : 'XXXX';
    return `${d}${m}${y}-${suffix}-${index + 1}`;
};

const downloadCSV = (data: any[], filename: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(fieldName => JSON.stringify(row[fieldName], (_, value) => value === null ? '' : value)).join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

// --- Visual Components ---

const SimpleBarChart: React.FC<{ data: { label: string, value: number }[], color?: string }> = ({ data, color = "bg-indigo-500" }) => {
    const max = Math.max(...data.map(d => d.value)) || 1;
    const containerHeight = 160; // Fixed height in pixels

    return (
        <div className="flex items-end gap-3 w-full" style={{ height: `${containerHeight}px` }}>
            {data.map((d, i) => {
                const heightPx = Math.max((d.value / max) * containerHeight, 4);
                return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative">
                        <div className="relative w-full flex justify-center items-end flex-1" style={{ minHeight: `${containerHeight}px` }}>
                            <div
                                style={{ height: `${heightPx}px` }}
                                className={`w-full max-w-[50px] ${color} opacity-80 group-hover:opacity-100 transition-all rounded-t relative`}
                            >
                                {/* Tooltip on hover */}
                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-slate-800 text-white text-[10px] px-2 py-1 rounded pointer-events-none whitespace-nowrap z-10 transition-opacity">
                                    ${d.value.toLocaleString()}
                                </div>
                            </div>
                        </div>
                        <div className="text-center">
                            <span className="text-[10px] text-slate-400 block">{d.label}</span>
                            <span className="text-xs font-bold text-slate-700 block mt-0.5">${(d.value / 1000).toFixed(1)}k</span>
                        </div>
                    </div>
                );
            })}
        </div>
    )
};

const SimpleDonutChart: React.FC<{ data: { label: string, value: number, color: string }[] }> = ({ data }) => {
    const total = data.reduce((a, b) => a + b.value, 0) || 1;
    let currentAngle = 0;
    return (
        <div className="relative w-32 h-32 mx-auto">
            <svg viewBox="0 0 100 100" className="w-full h-full rotate-[-90deg]">
                {data.map((d, i) => {
                    const sliceAngle = (d.value / total) * 360;
                    const x1 = 50 + 40 * Math.cos(Math.PI * currentAngle / 180);
                    const y1 = 50 + 40 * Math.sin(Math.PI * currentAngle / 180);
                    const x2 = 50 + 40 * Math.cos(Math.PI * (currentAngle + sliceAngle) / 180);
                    const y2 = 50 + 40 * Math.sin(Math.PI * (currentAngle + sliceAngle) / 180);
                    const largeArc = sliceAngle > 180 ? 1 : 0;
                    const pathData = `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`;
                    currentAngle += sliceAngle;
                    return <path key={i} d={pathData} fill={d.color} className="hover:opacity-80 transition-opacity" title={`${d.label}: ${d.value}`} />
                })}
                <circle cx="50" cy="50" r="25" fill="white" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-[10px] font-bold text-slate-400">Total</span>
            </div>
        </div>
    );
};

// --- Components ---

const InventoryRequestModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    userName: string;
    userRole: string;
}> = ({ isOpen, onClose, userId, userName, userRole }) => {
    const { showAlert, showConfirm, showToast } = useDialog();
    const [tab, setTab] = useState<'new' | 'history'>('new');
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [myRequests, setMyRequests] = useState<InventoryRequest[]>([]);
    const [selectedItemId, setSelectedItemId] = useState('');
    const [qty, setQty] = useState(1);
    const [purpose, setPurpose] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        const unsubItems = db.collection('inventory_items').where('status', '!=', 'out_of_stock').orderBy('name').onSnapshot(snap => setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem))));
        const unsubReqs = db.collection('inventory_requests').where('requesterId', '==', userId).orderBy('createdAt', 'desc').limit(20).onSnapshot(snap => setMyRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryRequest))));
        return () => { unsubItems(); unsubReqs(); };
    }, [isOpen, userId]);

    const handleSubmit = async () => {
        if (!selectedItemId || qty <= 0 || !purpose) {
            showAlert('warning', 'Please fill all required fields.', 'Incomplete Form');
            return;
        }
        const item = items.find(i => i.id === selectedItemId);
        if (!item) return;
        setLoading(true);
        try {
            await db.collection('inventory_requests').add({
                requesterId: userId, requesterName: userName, requesterRole: userRole,
                itemId: item.id, itemName: item.name, quantity: qty, purpose,
                status: 'pending', createdAt: firebase.firestore.Timestamp.now()
            });
            showToast('success', 'Request submitted successfully!');
            setTab('history');
            setSelectedItemId('');
            setQty(1);
            setPurpose('');
        } catch (e) {
            console.error(e);
            showAlert('error', 'Failed to submit request. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmReceipt = async (req: InventoryRequest) => {
        const confirmed = await showConfirm(
            `Confirm receipt of ${req.releasedQuantity} x ${req.itemName}? This will deduct items from stock.`,
            { title: 'Confirm Receipt', confirmText: 'Confirm Receipt', type: 'primary' }
        );
        if (!confirmed) return;

        const batch = db.batch();
        const reqRef = db.collection('inventory_requests').doc(req.id);
        batch.update(reqRef, { status: 'completed', completedAt: firebase.firestore.Timestamp.now() });

        // Fetch item to get price for transaction cost logic
        const itemSnap = await db.collection('inventory_items').doc(req.itemId).get();
        const itemData = itemSnap.data() as InventoryItem;
        const cost = (itemData.purchasePrice || 0) * (req.releasedQuantity || 0);

        const itemRef = db.collection('inventory_items').doc(req.itemId);
        batch.update(itemRef, { quantity: firebase.firestore.FieldValue.increment(-(req.releasedQuantity || 0)) });

        const txRef = db.collection('inventory_transactions').doc();
        batch.set(txRef, {
            itemId: req.itemId, itemName: req.itemName, type: 'issue',
            quantity: -(req.releasedQuantity || 0), cost: cost,
            performedBy: userId, reason: `Staff Request: ${req.purpose}`,
            timestamp: firebase.firestore.Timestamp.now()
        });

        try {
            await batch.commit();
            showToast('success', 'Receipt confirmed & stock deducted');
        } catch (e) {
            console.error(e);
            showAlert('error', 'Failed to confirm receipt. Please try again.');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden">
                <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><Truck className="w-5 h-5 text-indigo-600" /> Request Inventory</h3>
                    <button onClick={onClose}><X className="w-5 h-5 text-slate-500 hover:text-red-500" /></button>
                </div>
                <div className="flex border-b border-slate-200">
                    <button onClick={() => setTab('new')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${tab === 'new' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>New Request</button>
                    <button onClick={() => setTab('history')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${tab === 'history' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>My Requests {myRequests.filter(r => r.status === 'released').length > 0 && <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{myRequests.filter(r => r.status === 'released').length}</span>}</button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                    {tab === 'new' && (
                        <div className="space-y-4 max-w-lg mx-auto bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Item</label>
                                <select className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={selectedItemId} onChange={e => setSelectedItemId(e.target.value)}>
                                    <option value="">-- Choose Item --</option>
                                    {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.quantity} {i.unit} avail)</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Quantity Needed</label>
                                <input type="number" min="1" className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={qty} onChange={e => setQty(parseInt(e.target.value))} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Purpose / Reason</label>
                                <textarea className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none" placeholder="e.g. Restocking Phlebotomy Room 2" value={purpose} onChange={e => setPurpose(e.target.value)} />
                            </div>
                            <button onClick={handleSubmit} disabled={loading} className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold shadow-md hover:bg-indigo-700 disabled:opacity-50 flex justify-center items-center gap-2">{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />} Submit Request</button>
                        </div>
                    )}
                    {tab === 'history' && (
                        <div className="space-y-3">
                            {myRequests.map(req => (
                                <div key={req.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2"><h4 className="font-bold text-slate-800">{req.itemName}</h4><span className="text-sm font-medium bg-slate-100 px-2 py-0.5 rounded">x{req.quantity}</span></div>
                                        <p className="text-xs text-slate-500 mt-1">Requested: {formatDate(req.createdAt)} • Reason: {req.purpose}</p>
                                        {req.status === 'released' && <div className="mt-2 bg-green-50 p-2 rounded border border-green-100 text-xs"><p className="font-bold text-green-800">Ready for Pickup!</p><p className="text-green-700">Manager released {req.releasedQuantity} items.</p></div>}
                                        {req.status === 'rejected' && <div className="mt-2 bg-red-50 p-2 rounded border border-red-100 text-xs"><p className="font-bold text-red-800">Request Rejected</p><p className="text-red-700">Reason: {req.rejectionReason || 'No reason provided'}</p>{req.rejectedAt && <p className="text-red-600 mt-1">Rejected on: {formatDate(req.rejectedAt)}</p>}</div>}
                                    </div>
                                    <div className="shrink-0 flex items-center gap-3">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${req.status === 'pending' ? 'bg-blue-100 text-blue-700' : req.status === 'released' ? 'bg-amber-100 text-amber-700 animate-pulse' : req.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{req.status === 'released' ? 'Ready to Pick' : req.status}</span>
                                        {req.status === 'released' && <button onClick={() => handleConfirmReceipt(req)} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow hover:bg-green-700 flex items-center gap-1"><Check className="w-3 h-3" /> Confirm Received</button>}
                                    </div>
                                </div>
                            ))}
                            {myRequests.length === 0 && <p className="text-center text-slate-400 py-8 italic">No request history.</p>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

const PrintInvoiceModal: React.FC<{ data: PrintableInvoiceData; onClose: () => void }> = ({ data, onClose }) => {
    useEffect(() => { const timer = setTimeout(() => { window.print(); }, 800); return () => clearTimeout(timer); }, []);
    const handlePrint = () => { window.print(); };
    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 print:p-0 print:bg-white print:fixed print:inset-0 print:z-[9999]">
            <style>{`@media print { body > *:not(.print-modal-root) { display: none !important; } .print-modal-root { display: flex !important; width: 100% !important; height: 100% !important; } }`}</style>
            <div className="print-modal-root bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden print:shadow-none print:w-full print:max-w-none print:rounded-none print:h-full print:absolute print:top-0 print:left-0">
                <div className="bg-slate-800 text-white p-4 flex justify-between items-center print:hidden">
                    <h3 className="font-bold flex items-center gap-2"><Printer className="w-5 h-5" /> Print Preview</h3>
                    <div className="flex gap-2">
                        <button onClick={handlePrint} className="bg-indigo-500 hover:bg-indigo-600 px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-all">Print Now</button>
                        <button onClick={onClose} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-all">Close</button>
                    </div>
                </div>
                <div className="p-10 print:p-8 text-slate-900 font-serif h-full flex flex-col overflow-y-auto">
                    <div className="border-b-2 border-slate-800 pb-6 mb-6 flex justify-between items-start">
                        <div><h1 className="text-3xl font-bold text-slate-900 tracking-tight">LabPro Diagnostics</h1><p className="text-sm text-slate-600 mt-2 leading-relaxed">123 Medical Plaza, Suite 400<br />New York, NY 10001<br />Phone: +1 (555) 123-4567</p></div>
                        <div className="text-right"><h2 className="text-xl font-bold uppercase tracking-widest text-slate-400">Invoice</h2><p className="font-mono font-bold text-xl mt-1 text-slate-900">#{data.invoiceId.slice(0, 8).toUpperCase()}</p><p className="text-sm text-slate-500 mt-1">{data.date}</p></div>
                    </div>
                    <div className="flex justify-between mb-8 bg-slate-50 p-5 rounded-lg border border-slate-100 print:bg-transparent print:p-0 print:border-0">
                        <div><p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Patient Details</p><p className="font-bold text-lg text-slate-800">{data.patientName}</p><p className="text-sm text-slate-700">{data.age} / {data.gender}</p><p className="text-sm text-slate-700">{data.patientPhone}</p></div>
                        <div className="text-right"><p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Referred By</p><p className="font-bold text-slate-800">{data.doctor}</p><p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-4 mb-1">Payment Mode</p><p className="uppercase font-bold text-slate-800">{data.paymentMethod}</p></div>
                    </div>
                    <div className="flex-1"><table className="w-full text-left mb-8"><thead className="border-b-2 border-slate-200"><tr><th className="py-2 text-sm font-bold uppercase text-slate-500">Test Description</th><th className="py-2 text-right text-sm font-bold uppercase text-slate-500">Amount</th></tr></thead><tbody className="divide-y divide-slate-100">{data.items.map((item, idx) => (<tr key={idx}><td className="py-3"><p className="font-bold text-slate-800">{item.name}</p><p className="text-xs text-slate-500">{item.code}</p></td><td className="py-3 text-right font-mono font-medium text-slate-700">${item.price.toFixed(2)}</td></tr>))}</tbody></table></div>
                    <div className="flex justify-end border-t border-slate-200 pt-6"><div className="w-56 space-y-2"><div className="flex justify-between text-sm"><span className="text-slate-500 font-medium">Subtotal:</span><span className="font-mono font-bold text-slate-700">${data.subtotal.toFixed(2)}</span></div>{data.discount > 0 && (<div className="flex justify-between text-sm"><span className="text-slate-500 font-medium">Discount:</span><span className="font-mono font-bold text-red-500">-${data.discount.toFixed(2)}</span></div>)}<div className="flex justify-between text-xl font-bold border-t border-slate-800 pt-3 mt-2 text-slate-900"><span>Total:</span><span>${data.total.toFixed(2)}</span></div><div className="flex justify-between text-sm mt-4 pt-4 border-t border-slate-200"><span className="text-slate-500 font-medium">Amount Paid:</span><span className="font-mono font-bold text-slate-700">${data.paid.toFixed(2)}</span></div>{data.due > 0 && (<div className="flex justify-between text-sm text-red-600 bg-red-50 p-2 rounded mt-2 print:bg-transparent print:p-0 print:text-red-600"><span className="font-bold">Balance Due:</span><span className="font-mono font-bold">${data.due.toFixed(2)}</span></div>)}</div></div>
                    <div className="mt-12 pt-8 border-t border-slate-200 text-center text-xs text-slate-400"><p>Thank you for choosing LabPro Diagnostics.</p><p>This is a computer generated invoice and does not require a signature.</p><p className="mt-2 font-mono">{data.invoiceId}</p></div>
                </div>
            </div>
        </div>
    );
};

const PrintReportModal: React.FC<{ data: Sample; onClose: () => void }> = ({ data, onClose }) => {
    useEffect(() => { const timer = setTimeout(() => window.print(), 800); return () => clearTimeout(timer); }, []);
    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 print:p-0 print:bg-white print:fixed print:inset-0 print:z-[9999]">
            <style>{`@media print { body > *:not(.print-report-root) { display: none !important; } .print-report-root { display: flex !important; width: 100% !important; height: 100% !important; position: absolute; top: 0; left: 0; } @page { margin: 0; size: A4; } }`}</style>
            <div className="print-report-root bg-white w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden flex flex-col h-[90vh] print:h-full print:rounded-none print:shadow-none">
                <div className="bg-slate-800 text-white p-4 flex justify-between items-center print:hidden shrink-0"><h3 className="font-bold flex items-center gap-2"><FileText className="w-5 h-5" /> Report Preview</h3><div className="flex gap-2"><button onClick={() => window.print()} className="bg-indigo-500 hover:bg-indigo-600 px-4 py-2 rounded-lg font-bold text-sm">Print</button><button onClick={onClose} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg font-bold text-sm">Close</button></div></div>
                <div className="flex-1 overflow-y-auto p-10 print:p-8 font-serif bg-white text-slate-900">
                    <div className="border-b-2 border-slate-900 pb-6 mb-8 flex justify-between items-end"><div><h1 className="text-3xl font-bold tracking-tight text-slate-900">LabPro Diagnostics</h1><p className="text-sm text-slate-600 mt-1">123 Medical Plaza, New York, NY 10001</p><p className="text-sm text-slate-600">ISO 15189 Certified Laboratory</p></div><div className="text-right"><h2 className="text-xl font-bold uppercase tracking-widest text-slate-400">Lab Report</h2><p className="font-mono font-bold text-lg mt-1">{data.sampleLabelId || data.id.slice(0, 8).toUpperCase()}</p><p className="text-sm text-slate-500">{formatDate(data.reportedAt || new Date())}</p></div></div>
                    <div className="grid grid-cols-2 gap-8 mb-8 bg-slate-50 p-6 rounded-lg border border-slate-100 print:bg-transparent print:p-0 print:border-0"><div><p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Patient Name</p><p className="font-bold text-lg">{data.patientName}</p></div><div><p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Age / Gender</p><p className="font-bold text-lg">{data.patientAge || '--'} Yrs / {data.patientGender || '--'}</p></div><div><p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Referred By</p><p className="font-bold text-lg">Dr. Smith (General)</p></div><div><p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Sample Type</p><p className="font-bold text-lg">{data.sampleType}</p></div></div>
                    <div className="mb-6 text-center"><h2 className="text-xl font-bold underline decoration-2 underline-offset-4 text-slate-900">{data.testName}</h2></div>
                    <table className="w-full text-left mb-8"><thead className="border-b-2 border-slate-200"><tr><th className="py-2 font-bold uppercase text-xs text-slate-500 w-1/2">Investigation</th><th className="py-2 font-bold uppercase text-xs text-slate-500 w-1/4">Result</th><th className="py-2 font-bold uppercase text-xs text-slate-500 w-1/4 text-right">Reference Range</th></tr></thead><tbody className="divide-y divide-slate-100">{data.results && Object.entries(data.results).map(([key, value]) => (<tr key={key}><td className="py-3 font-medium text-slate-800">{key}</td><td className="py-3 font-bold text-slate-900">{value}</td><td className="py-3 text-right text-slate-500 text-sm">--</td></tr>))}{(!data.results || Object.keys(data.results).length === 0) && (<tr><td colSpan={3} className="py-4 text-center text-slate-400 italic">No quantitative results recorded.</td></tr>)}</tbody></table>
                    {(data.conclusion || data.pathologistRemarks) && (<div className="mb-12 border rounded-lg p-4 bg-slate-50 print:bg-transparent print:border-slate-300">{data.conclusion && (<div className="mb-4"><h4 className="font-bold text-sm uppercase text-slate-700 mb-1">Pathologist's Conclusion</h4><p className="text-slate-900 text-sm leading-relaxed">{data.conclusion}</p></div>)}{data.pathologistRemarks && (<div><h4 className="font-bold text-sm uppercase text-slate-700 mb-1">Remarks</h4><p className="text-slate-900 text-sm leading-relaxed">{data.pathologistRemarks}</p></div>)}</div>)}
                    <div className="mt-auto pt-6 flex justify-end"><div className="text-center w-48"><div className="h-16 mb-2 border-b border-slate-900/20"><div className="h-full flex items-end justify-center pb-2 font-cursive text-2xl text-slate-600">Dr. A. Pathologist</div></div><p className="font-bold text-sm text-slate-900">{data.verifiedBy || "Dr. Alice Pathologist"}</p><p className="text-xs text-slate-500">MD, Pathology (Reg: 12345)</p></div></div>
                    <div className="mt-8 pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400"><p>End of Report. Electronically generated by LabPro System.</p></div>
                </div>
            </div>
        </div>
    );
};

//  1. Unified Landing Page (Login)
const LandingPage: React.FC<{ onLoginSuccess: (role: Role, user: any) => void }> = ({ onLoginSuccess }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedRole, setSelectedRole] = useState<Role>('receptionist');

    // Set Firebase Auth persistence to local
    useEffect(() => {
        auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(console.error);
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username || !password) { setError("Please enter username and password."); return; }
        setLoading(true); setError('');
        try {
            const userSnap = await db.collection('users').where('username', '==', username).where('password', '==', password).where('status', '==', 'active').limit(1).get();
            if (!userSnap.empty) {
                const userData = userSnap.docs[0].data() as AppUser;
                if (userData.role !== selectedRole && userData.role !== 'admin') { setError(`Credentials valid, but this user is a ${userData.role}, not a ${selectedRole}.`); setLoading(false); return; }

                // Sign in with Firebase Auth for persistence
                try {
                    await auth.signInAnonymously();
                } catch (authError) {
                    console.warn('Anonymous auth failed:', authError);
                }

                onLoginSuccess(userData.role, { uid: userSnap.docs[0].id, email: userData.username, ...userData });
                await logAction('LOGIN', 'Auth', `User logged in as ${userData.role}`, { uid: userSnap.docs[0].id, username: userData.username });
                return;
            }
            if (username === 'admin' && password === 'admin') {
                const adminCheckSnap = await db.collection('users').where('role', '==', 'admin').limit(1).get();
                if (adminCheckSnap.empty) {
                    // Sign in with Firebase Auth for persistence
                    try {
                        await auth.signInAnonymously();
                    } catch (authError) {
                        console.warn('Anonymous auth failed:', authError);
                    }
                    onLoginSuccess('admin', { uid: 'sys-admin', email: 'System Admin', username: 'admin' });
                    return;
                } else { setError("Default admin access disabled. Use your assigned credentials."); return; }
            }
            setError('Invalid credentials.');
        } catch (err: any) { console.error(err); setError('Login failed. Please try again.'); } finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <header className="bg-white shadow-sm sticky top-0 z-40 border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2"><div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md"><FlaskConical className="w-5 h-5" /></div><div><h1 className="text-xl font-bold text-slate-800 leading-none">LabPro</h1><p className="text-[10px] text-slate-500 font-bold tracking-wider">DIAGNOSTICS</p></div></div>
                    <div className="flex items-center gap-4 text-xs font-medium text-slate-600"><div className="hidden sm:flex items-center gap-1 cursor-pointer hover:text-indigo-600"><Globe className="w-4 h-4" /><span>English</span></div><div className="flex items-center gap-1 cursor-pointer hover:text-indigo-600"><Info className="w-4 h-4" /><span>Help</span></div></div>
                </div>
            </header>
            <main className="flex-1 flex flex-col md:flex-row max-w-7xl mx-auto w-full">
                <div className="hidden md:flex flex-col justify-center p-12 lg:p-20 w-full md:w-1/2 bg-slate-50">
                    <h2 className="text-4xl lg:text-5xl font-extrabold text-slate-900 mb-6 leading-tight">Precision <br /><span className="text-indigo-600">Diagnostics</span> <br />Made Simple.</h2>
                    <p className="text-lg text-slate-600 mb-8 max-w-md leading-relaxed">Access your workspace securely. Manage patients, samples, and reports with LabPro's integrated platform.</p>
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 text-slate-700"><CheckCircle2 className="w-5 h-5 text-green-500" /><span>ISO 15189 Certified Laboratory</span></div>
                        <div className="flex items-center gap-3 text-slate-700"><CheckCircle2 className="w-5 h-5 text-green-500" /><span>24/7 Processing Capabilities</span></div>
                        <div className="flex items-center gap-3 text-slate-700"><CheckCircle2 className="w-5 h-5 text-green-500" /><span>Secure Cloud Data Storage</span></div>
                    </div>
                </div>
                <div className="flex-1 flex flex-col justify-center p-4 sm:p-12 w-full md:w-1/2 bg-white md:shadow-[-20px_0_40px_-10px_rgba(0,0,0,0.05)] z-10">
                    <div className="max-w-md mx-auto w-full">
                        <div className="bg-white rounded-2xl md:p-2 w-full">
                            <div className="mb-6"><h3 className="text-xl font-bold text-slate-800 mb-1">Login to Lab System</h3><p className="text-sm text-slate-400">Select role and enter credentials</p></div>
                            <form onSubmit={handleLogin} className="space-y-5" autoComplete="on">
                                <div><label className="block text-sm font-medium text-slate-600 mb-1.5">Select Role</label><div className="relative"><select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value as Role)} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none appearance-none font-bold text-slate-700" name="role">{AVAILABLE_ROLES.filter(r => !r.disabled).map(r => (<option key={r.id} value={r.id}>{r.label}</option>))}</select><ChevronDown className="absolute right-4 top-4 text-slate-400 w-4 h-4 pointer-events-none" /></div></div>
                                <div className="space-y-4"><div className="space-y-1.5"><label className="block text-sm font-medium text-slate-600">Username</label><input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" placeholder="Enter username" autoFocus name="username" autoComplete="username" /></div><div className="space-y-1.5"><div className="flex justify-between"><label className="block text-sm font-medium text-slate-600">Password</label></div><input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" placeholder="••••••••" name="password" autoComplete="current-password" /></div></div>
                                {error && (<div className="bg-red-50 border border-red-100 text-red-600 p-3 rounded-xl text-sm flex items-start gap-2 animate-in fade-in slide-in-from-top-2"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span className="leading-snug">{error}</span></div>)}
                                <button type="submit" disabled={loading || !username || !password} className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:scale-[0.99] shadow-lg shadow-indigo-100 flex justify-center items-center gap-2">{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Secure Login'}</button>
                            </form>
                            <div className="mt-10 border-t border-slate-100 pt-6"><h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2"><Bell className="w-3 h-3" /> System Notices</h4><div className="space-y-3">{ANNOUNCEMENTS.map(ann => (<div key={ann.id} className="flex gap-3 text-sm"><span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${ann.type === 'warning' ? 'bg-amber-500' : ann.type === 'success' ? 'bg-green-500' : 'bg-blue-500'}`}></span><p className="text-slate-600 leading-snug">{ann.text}</p></div>))}</div></div>
                        </div>
                    </div>
                </div>
            </main>
            <footer className="bg-slate-900 text-slate-300 py-6"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm"><div className="flex flex-col gap-2"><h5 className="text-white font-bold mb-1">Visit Us</h5><div className="flex items-start gap-2"><MapPin className="w-4 h-4 mt-0.5 text-indigo-400" /><span>123 Medical Plaza, Suite 400<br />New York, NY 10001</span></div></div><div className="flex flex-col gap-2"><h5 className="text-white font-bold mb-1">Working Hours</h5><div className="flex items-start gap-2"><Clock className="w-4 h-4 mt-0.5 text-indigo-400" /><span>Mon - Fri: 7:00 AM - 9:00 PM<br /><span className="text-amber-500 font-medium">Emergency: 24/7</span></span></div></div><div className="flex flex-col gap-2"><h5 className="text-white font-bold mb-1">Contact</h5><div className="flex items-center gap-2"><Phone className="w-4 h-4 text-indigo-400" /><span>+1 (555) 123-4567</span></div></div></div></footer>
        </div>
    );
};

// 3. FINANCE MODULE SUB-COMPONENTS
const FinanceExpensesPanel: React.FC<{ expenses: Expense[] }> = ({ expenses }) => {
    const [view, setView] = useState<'due' | 'paid'>('due');
    const [showAdd, setShowAdd] = useState(false);
    const [formData, setFormData] = useState<Partial<Expense>>({ category: 'General', isRecurring: false, status: 'pending' });
    const [filterPeriod, setFilterPeriod] = useState('month'); // day, week, month, year

    const handleSave = async () => {
        if (!formData.title || !formData.amount || !formData.dueDate) return;
        try {
            await db.collection('expenses').add({
                ...formData,
                date: firebase.firestore.Timestamp.now(),
                createdBy: auth.currentUser?.email || 'admin'
            });
            await logAction('ADD_EXPENSE', 'Finance', `Added expense: ${formData.title} ($${formData.amount})`, auth.currentUser);
            setShowAdd(false);
            setFormData({ category: 'General', isRecurring: false, status: 'pending' });
        } catch (e) { console.error(e); }
    };

    const markAsPaid = async (exp: Expense) => {
        try {
            await db.collection('expenses').doc(exp.id).update({
                status: 'paid',
                paidAt: firebase.firestore.Timestamp.now(),
                paidBy: auth.currentUser?.email || 'admin'
            });
        } catch (e) { console.error(e); }
    };

    const filteredPaidExpenses = useMemo(() => {
        if (view === 'due') return expenses.filter(e => e.status !== 'paid');
        const now = new Date();
        return expenses.filter(e => {
            if (e.status !== 'paid') return false;
            const d = e.paidAt ? (e.paidAt.toDate ? e.paidAt.toDate() : new Date(e.paidAt)) : new Date(e.date);
            if (filterPeriod === 'day') return d.toDateString() === now.toDateString();
            if (filterPeriod === 'week') return d > new Date(now.setDate(now.getDate() - 7));
            if (filterPeriod === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            if (filterPeriod === 'year') return d.getFullYear() === now.getFullYear();
            return true;
        });
    }, [expenses, view, filterPeriod]);

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-xl font-bold text-slate-800">Expense Management</h3>
                    <div className="flex gap-2 mt-2">
                        <button onClick={() => setView('due')} className={`px-3 py-1 text-sm rounded-full font-bold ${view === 'due' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>Due Expenses</button>
                        <button onClick={() => setView('paid')} className={`px-3 py-1 text-sm rounded-full font-bold ${view === 'paid' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>Paid History</button>
                    </div>
                </div>
                <div className="flex gap-2">
                    {view === 'paid' && (
                        <>
                            <select value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)} className="p-2 border rounded text-sm font-bold bg-white">
                                <option value="day">Today</option>
                                <option value="week">This Week</option>
                                <option value="month">This Month</option>
                                <option value="year">This Year</option>
                            </select>
                            <button onClick={() => downloadCSV(filteredPaidExpenses, 'paid_expenses.csv')} className="bg-slate-200 p-2 rounded hover:bg-slate-300" title="Export Excel"><FileSpreadsheet className="w-5 h-5" /></button>
                            <button onClick={() => window.print()} className="bg-slate-200 p-2 rounded hover:bg-slate-300" title="Print"><Printer className="w-5 h-5" /></button>
                        </>
                    )}
                    <button onClick={() => setShowAdd(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"><Plus className="w-4 h-4" /> Add Expense</button>
                </div>
            </div>

            {showAdd && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 animate-in slide-in-from-top-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <input className="p-2 border rounded" placeholder="Title / Description" value={formData.title || ''} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                        <input className="p-2 border rounded" type="number" placeholder="Amount" value={formData.amount || ''} onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) })} />
                        <select className="p-2 border rounded" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                            <option>General</option><option>Rent</option><option>Utilities</option><option>Salaries</option><option>Inventory</option><option>Maintenance</option>
                        </select>
                        <input className="p-2 border rounded" type="date" placeholder="Due Date" value={formData.dueDate || ''} onChange={e => setFormData({ ...formData, dueDate: e.target.value })} />
                    </div>
                    <div className="flex justify-between items-center">
                        <input className="p-2 border rounded w-64" placeholder="Vendor (Optional)" value={formData.vendor || ''} onChange={e => setFormData({ ...formData, vendor: e.target.value })} />
                        <div className="flex gap-2">
                            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-slate-500">Cancel</button>
                            <button onClick={handleSave} className="bg-green-600 text-white px-4 py-2 rounded font-bold">Save Record</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 overflow-hidden flex flex-col">
                <div className="overflow-y-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b sticky top-0">
                            <tr><th className="p-4">{view === 'due' ? 'Due Date' : 'Paid Date'}</th><th className="p-4">Description</th><th className="p-4">Category</th><th className="p-4">Vendor</th><th className="p-4 text-right">Amount</th>{view === 'due' && <th className="p-4 text-center">Action</th>}</tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredPaidExpenses.map(e => (
                                <tr key={e.id} className="hover:bg-slate-50">
                                    <td className="p-4 text-slate-500 text-xs font-mono">{view === 'due' ? e.dueDate : formatDate(e.paidAt)}</td>
                                    <td className="p-4 font-bold text-slate-700">{e.title}</td>
                                    <td className="p-4"><span className="bg-slate-100 px-2 py-1 rounded text-xs">{e.category}</span></td>
                                    <td className="p-4 text-slate-500">{e.vendor || '-'}</td>
                                    <td className="p-4 text-right font-bold text-slate-800">${e.amount.toFixed(2)}</td>
                                    {view === 'due' && (
                                        <td className="p-4 text-center">
                                            <button onClick={() => markAsPaid(e)} className="bg-green-500 text-white px-3 py-1 rounded text-xs font-bold shadow hover:bg-green-600 transition-colors">Mark Paid</button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                            {filteredPaidExpenses.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">No expenses found.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const FinanceDoctorsPanel: React.FC<{ doctors: Doctor[], orders: Order[] }> = ({ doctors, orders }) => {
    const { showAlert, showConfirm, showToast } = useDialog();
    const [showAdd, setShowAdd] = useState(false);
    const [formData, setFormData] = useState<Partial<Doctor>>({ status: 'active', commissionRate: 0 });

    const handleSave = async () => {
        if (!formData.name) return;
        try { await db.collection('doctors').add(formData); setShowAdd(false); setFormData({ status: 'active', commissionRate: 0 }); } catch (e) { console.error(e); }
    };

    const handleMarkPaid = async (doc: Doctor) => {
        try {
            console.log("Attempting to pay commission for:", doc.name);
            const unpaidOrders = orders.filter(o => o.doctorId === doc.id && !o.commissionPaid);
            console.log("Unpaid orders count:", unpaidOrders.length);

            if (unpaidOrders.length === 0) {
                showAlert('info', 'No unpaid orders found for this doctor in the current view.', 'No Pending Commissions');
                return;
            }

            const total = unpaidOrders.reduce((acc, o) => acc + (o.doctorCommission || 0), 0);

            const confirmed = await showConfirm(
                `Mark $${total.toFixed(2)} as paid to Dr. ${doc.name}? This will create a specific expense record.`,
                { title: 'Confirm Commission Payment', confirmText: 'Mark Paid', type: 'primary' }
            );

            if (!confirmed) return;

            const batch = db.batch();
            // Create Commission Expense
            const expRef = db.collection('expenses').doc();
            batch.set(expRef, {
                title: `Commission - ${doc.name}`,
                category: 'Commission',
                amount: total,
                status: 'paid',
                date: firebase.firestore.Timestamp.now(),
                paidAt: firebase.firestore.Timestamp.now(),
                paidBy: auth.currentUser?.email || 'admin',
                createdBy: 'system'
            });

            // Update Orders
            unpaidOrders.forEach(o => {
                const oRef = db.collection('orders').doc(o.id);
                batch.update(oRef, { commissionPaid: true });
            });

            await batch.commit();
            showToast('success', `Commission of $${total.toFixed(2)} paid & expense logged`);
        } catch (e) {
            console.error("Payment failed", e);
            showAlert('error', 'Failed to pay commission: ' + (e instanceof Error ? e.message : String(e)), 'Payment Failed');
        }
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-800">Doctor Referral Program</h3>
                <button onClick={() => setShowAdd(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"><UserPlus className="w-4 h-4" /> Add Doctor</button>
            </div>
            {showAdd && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <input className="p-2 border rounded" placeholder="Doctor Name" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                        <input className="p-2 border rounded" placeholder="Clinic / Hospital" value={formData.clinic || ''} onChange={e => setFormData({ ...formData, clinic: e.target.value })} />
                        <input className="p-2 border rounded" placeholder="Phone" value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                        <input className="p-2 border rounded" type="number" placeholder="Commission %" value={formData.commissionRate || ''} onChange={e => setFormData({ ...formData, commissionRate: parseFloat(e.target.value) })} />
                    </div>
                    <div className="flex justify-end gap-2"><button onClick={() => setShowAdd(false)} className="px-4 py-2 text-slate-500">Cancel</button><button onClick={handleSave} className="bg-green-600 text-white px-4 py-2 rounded font-bold">Save Doctor</button></div>
                </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-0">
                <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="overflow-y-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 border-b sticky top-0"><tr><th className="p-4">Doctor</th><th className="p-4">Clinic</th><th className="p-4">Comm. Rate</th><th className="p-4 text-right">Revenue Generated</th></tr></thead>
                            <tbody className="divide-y divide-slate-100">
                                {doctors.map(doc => {
                                    const totalRev = orders.filter(o => o.doctorId === doc.id).reduce((sum, o) => sum + o.totalAmount, 0);
                                    return (
                                        <tr key={doc.id} className="hover:bg-slate-50">
                                            <td className="p-4 font-bold text-slate-800">{doc.name}</td>
                                            <td className="p-4 text-slate-500">{doc.clinic}</td>
                                            <td className="p-4 font-mono text-indigo-600 font-bold">{doc.commissionRate}%</td>
                                            <td className="p-4 text-right font-bold text-green-600">${totalRev.toLocaleString()}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100 overflow-y-auto">
                    <h4 className="font-bold text-indigo-900 mb-4">Outstanding Commission Liabilities</h4>
                    <div className="space-y-4">
                        {doctors.map(doc => {
                            const owed = orders.filter(o => o.doctorId === doc.id && !o.commissionPaid).reduce((sum, o) => sum + (o.doctorCommission || 0), 0);
                            if (owed <= 0) return null;
                            return (
                                <div key={doc.id} className="bg-white p-3 rounded border border-indigo-100 flex justify-between items-center shadow-sm">
                                    <div><p className="font-bold text-slate-700 text-sm">{doc.name}</p><p className="text-xs text-slate-400">{doc.clinic}</p></div>
                                    <div className="text-right">
                                        <p className="font-bold text-indigo-600">${owed.toFixed(2)}</p>
                                        <button onClick={() => handleMarkPaid(doc)} className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-1 rounded hover:bg-green-200 mt-1 transition-colors">Mark Paid</button>
                                    </div>
                                </div>
                            )
                        })}
                        {doctors.every(d => orders.filter(o => o.doctorId === d.id && !o.commissionPaid).reduce((sum, o) => sum + (o.doctorCommission || 0), 0) <= 0) && (
                            <p className="text-center text-indigo-400 text-sm py-4">No pending commissions.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
};

const FinanceModule: React.FC = () => {
    const { showToast } = useDialog();
    const [subView, setSubView] = useState<'dashboard' | 'sales' | 'expenses' | 'profit' | 'doctors' | 'payroll' | 'inventory'>('dashboard');
    const [orders, setOrders] = useState<Order[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [inventoryVal, setInventoryVal] = useState(0);
    const [invTransactions, setInvTransactions] = useState<InventoryTransaction[]>([]);
    const [dateRange, setDateRange] = useState('month');

    useEffect(() => {
        const unsubOrders = db.collection('orders').orderBy('createdAt', 'desc').limit(200).onSnapshot(snap => setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order))));
        const unsubExpenses = db.collection('expenses').orderBy('date', 'desc').limit(200).onSnapshot(snap => setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Expense))));
        const unsubDoctors = db.collection('doctors').onSnapshot(snap => setDoctors(snap.docs.map(d => ({ id: d.id, ...d.data() } as Doctor))));
        const unsubInventory = db.collection('inventory_items').onSnapshot(snap => {
            const val = snap.docs.reduce((acc, d) => { const item = d.data() as InventoryItem; return acc + (item.quantity * (item.purchasePrice || 0)); }, 0);
            setInventoryVal(val);
        });
        const unsubInvTx = db.collection('inventory_transactions').orderBy('timestamp', 'desc').limit(100).onSnapshot(snap => setInvTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryTransaction))));

        return () => { unsubOrders(); unsubExpenses(); unsubDoctors(); unsubInventory(); unsubInvTx(); };
    }, []);

    const filterDate = (date: any) => {
        const d = date.toDate ? date.toDate() : new Date(date);
        const now = new Date();
        if (dateRange === 'today') return d.toDateString() === now.toDateString();
        if (dateRange === 'week') return d > new Date(now.setDate(now.getDate() - 7));
        if (dateRange === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        if (dateRange === 'year') return d.getFullYear() === now.getFullYear();
        return true;
    };

    const filteredOrders = useMemo(() => orders.filter(o => filterDate(o.createdAt)), [orders, dateRange]);
    const filteredPaidExpenses = useMemo(() => expenses.filter(e => e.status === 'paid' && filterDate(e.paidAt)), [expenses, dateRange]);
    const filteredInvTx = useMemo(() => invTransactions.filter(t => (t.type === 'issue' || t.type === 'deduction') && filterDate(t.timestamp)), [invTransactions, dateRange]);

    const kpi = useMemo(() => {
        const revenue = filteredOrders.reduce((sum, o) => sum + o.totalAmount, 0);
        const paidExp = filteredPaidExpenses.reduce((sum, e) => sum + e.amount, 0);
        // Calculate inventory usage cost from transactions (assume negative quantity for usage)
        const invUsageCost = filteredInvTx.reduce((sum, t) => sum + (t.cost || 0), 0);

        // Outstanding Commissions (Not an expense yet, but liability)
        const pendingCommissions = orders.filter(o => !o.commissionPaid).reduce((sum, o) => sum + (o.doctorCommission || 0), 0);

        // Profit = Revenue - Paid Expenses - Inventory Usage Cost
        const profit = revenue - paidExp - invUsageCost;

        return { revenue, paidExpenses: paidExp, invUsageCost, pendingCommissions, profit };
    }, [filteredOrders, filteredPaidExpenses, filteredInvTx, orders]);

    return (
        <div className="h-full flex flex-col bg-slate-50">
            <div className="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2"><h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><DollarSign className="w-6 h-6 text-indigo-600" /> Financial Dashboard</h2></div>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    {[{ id: 'dashboard', label: 'Overview', icon: LayoutDashboard }, { id: 'sales', label: 'Sales', icon: FileText }, { id: 'expenses', label: 'Expenses', icon: Wallet }, { id: 'doctors', label: 'Referrals', icon: UserPlus }, { id: 'inventory', label: 'Inventory Finance', icon: Package }].map(tab => (
                        <button key={tab.id} onClick={() => setSubView(tab.id as any)} className={`px-3 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${subView === tab.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}><tab.icon className="w-4 h-4" /> <span className="hidden sm:inline">{tab.label}</span></button>
                    ))}
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
                <div className="flex justify-end mb-6">
                    <select value={dateRange} onChange={e => setDateRange(e.target.value)} className="p-2 border rounded-lg text-sm bg-white font-bold text-slate-700">
                        <option value="today">Today</option><option value="week">This Week</option><option value="month">This Month</option><option value="year">This Year</option>
                    </select>
                </div>

                {subView === 'dashboard' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <p className="text-slate-500 text-xs font-bold uppercase">Total Revenue</p>
                                <p className="text-3xl font-bold text-slate-800 mt-2">${kpi.revenue.toLocaleString()}</p>
                                <p className="text-xs text-green-600 mt-1 font-bold flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Income</p>
                            </div>
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <p className="text-slate-500 text-xs font-bold uppercase">Paid Expenses</p>
                                <p className="text-3xl font-bold text-slate-800 mt-2">${kpi.paidExpenses.toLocaleString()}</p>
                                <p className="text-xs text-slate-400 mt-1">Operational & Paid Comms</p>
                            </div>
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <p className="text-slate-500 text-xs font-bold uppercase">Inventory Usage Cost</p>
                                <p className="text-3xl font-bold text-slate-800 mt-2">${kpi.invUsageCost.toLocaleString()}</p>
                                <p className="text-xs text-amber-600 mt-1 font-bold">Cost of Goods Sold</p>
                            </div>
                            <div className={`p-6 rounded-xl border shadow-lg text-white ${kpi.profit >= 0 ? 'bg-indigo-600 border-indigo-700 shadow-indigo-200' : 'bg-red-600 border-red-700 shadow-red-200'}`}>
                                <p className="text-white/80 text-xs font-bold uppercase">Net Profit</p>
                                <p className="text-3xl font-bold mt-2">${kpi.profit.toLocaleString()}</p>
                                <p className="text-xs text-white/70 mt-1 opacity-80">Rev - (Exp + Inv. Usage)</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <h3 className="font-bold text-slate-800 mb-4">Financial Overview</h3>
                                {[kpi.revenue, kpi.paidExpenses, kpi.invUsageCost].some(v => v > 0) ? (
                                    <>
                                        <SimpleBarChart data={[
                                            { label: 'Revenue', value: kpi.revenue },
                                            { label: 'Paid Exp', value: kpi.paidExpenses },
                                            { label: 'Inv. Usage', value: kpi.invUsageCost },
                                            { label: 'Profit', value: Math.max(0, kpi.profit) }
                                        ]} />
                                        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                                            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-indigo-500 rounded"></div><span className="text-slate-600">Data Values</span></div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="h-40 flex items-center justify-center text-slate-400 text-sm">No financial data for selected period</div>
                                )}
                            </div>
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <h3 className="font-bold text-slate-800 mb-4">Expense Breakdown (Paid)</h3>
                                {filteredPaidExpenses.length > 0 || filteredInvTx.length > 0 ? (
                                    <>
                                        <SimpleDonutChart data={
                                            (() => {
                                                // Get regular expense categories
                                                const expensesByCategory = filteredPaidExpenses.reduce((acc, e) => ({ ...acc, [e.category]: (acc[e.category] || 0) + e.amount }), {} as Record<string, number>);

                                                // Add inventory expenses
                                                const invUsageCost = filteredInvTx.reduce((sum, t) => sum + (t.cost || 0), 0);
                                                if (invUsageCost > 0) {
                                                    expensesByCategory['Inventory'] = invUsageCost;
                                                }

                                                return Object.entries(expensesByCategory)
                                                    .map(([k, v], i) => ({ label: k, value: v, color: ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6'][i % 5] }));
                                            })()
                                        } />
                                        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                                            {(() => {
                                                const expensesByCategory = filteredPaidExpenses.reduce((acc, e) => ({ ...acc, [e.category]: (acc[e.category] || 0) + e.amount }), {} as Record<string, number>);
                                                const invUsageCost = filteredInvTx.reduce((sum, t) => sum + (t.cost || 0), 0);
                                                if (invUsageCost > 0) {
                                                    expensesByCategory['Inventory'] = invUsageCost;
                                                }
                                                return Object.entries(expensesByCategory)
                                                    .map(([k, v], i) => (
                                                        <div key={k} className="flex items-center gap-2">
                                                            <div className="w-3 h-3 rounded" style={{ backgroundColor: ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6'][i % 5] }}></div>
                                                            <span className="text-slate-600">{k}: ${(v as number).toFixed(0)}</span>
                                                        </div>
                                                    ));
                                            })()}
                                        </div>
                                    </>
                                ) : (
                                    <div className="h-40 flex items-center justify-center text-slate-400 text-sm">No paid expenses for selected period</div>
                                )}
                            </div>
                        </div>

                        {/* Financial Reports Card */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2"><FileBarChart className="w-5 h-5 text-indigo-600" /> Financial Reports</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* Daily Report */}
                                <button onClick={() => {
                                    const today = new Date();
                                    const dailyOrders = orders.filter(o => {
                                        const d = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
                                        return d.toDateString() === today.toDateString();
                                    });
                                    const dailyExpenses = expenses.filter(e => e.status === 'paid' && e.paidAt && (e.paidAt.toDate ? e.paidAt.toDate() : new Date(e.paidAt)).toDateString() === today.toDateString());
                                    const report = `DAILY FINANCIAL REPORT - ${today.toDateString()}\n\n` +
                                        `REVENUE\n` +
                                        `Total Sales: $${dailyOrders.reduce((s, o) => s + o.totalAmount, 0).toFixed(2)}\n` +
                                        `Number of Orders: ${dailyOrders.length}\n\n` +
                                        `EXPENSES\n` +
                                        `Total Paid: $${dailyExpenses.reduce((s, e) => s + e.amount, 0).toFixed(2)}\n` +
                                        `Number of Expenses: ${dailyExpenses.length}\n\n` +
                                        `NET: $${(dailyOrders.reduce((s, o) => s + o.totalAmount, 0) - dailyExpenses.reduce((s, e) => s + e.amount, 0)).toFixed(2)}`;
                                    downloadCSV([{ Report: report }], `daily_report_${today.toISOString().split('T')[0]}.csv`);
                                    showToast('success', 'Daily report exported!');
                                }} className="p-4 border-2 border-slate-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left group">
                                    <Calendar className="w-6 h-6 text-indigo-600 mb-2" />
                                    <p className="font-bold text-slate-800 group-hover:text-indigo-600">Daily Report</p>
                                    <p className="text-xs text-slate-500 mt-1">Today's summary</p>
                                </button>

                                {/* Weekly Report */}
                                <button onClick={() => {
                                    const now = new Date();
                                    const weekAgo = new Date(now.setDate(now.getDate() - 7));
                                    const weeklyOrders = orders.filter(o => (o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt)) > weekAgo);
                                    const weeklyExpenses = expenses.filter(e => e.status === 'paid' && e.paidAt && (e.paidAt.toDate ? e.paidAt.toDate() : new Date(e.paidAt)) > weekAgo);
                                    downloadCSV(weeklyOrders.map(o => ({ Date: formatDate(o.createdAt), Patient: o.patientName, Amount: o.totalAmount })), `weekly_sales_${new Date().toISOString().split('T')[0]}.csv`);
                                    showToast('success', 'Weekly report exported!');
                                }} className="p-4 border-2 border-slate-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left group">
                                    <CalendarClock className="w-6 h-6 text-indigo-600 mb-2" />
                                    <p className="font-bold text-slate-800 group-hover:text-indigo-600">Weekly Report</p>
                                    <p className="text-xs text-slate-500 mt-1">Last 7 days</p>
                                </button>

                                {/* Monthly Report */}
                                <button onClick={() => {
                                    const now = new Date();
                                    const monthlyOrders = orders.filter(o => {
                                        const d = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
                                        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                                    });
                                    const monthlyExpenses = expenses.filter(e => {
                                        if (e.status !== 'paid' || !e.paidAt) return false;
                                        const d = e.paidAt.toDate ? e.paidAt.toDate() : new Date(e.paidAt);
                                        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                                    });
                                    downloadCSV(monthlyOrders.map(o => ({ Date: formatDate(o.createdAt), Patient: o.patientName, Amount: o.totalAmount })), `monthly_sales_${now.getFullYear()}_${now.getMonth() + 1}.csv`);
                                    showToast('success', 'Monthly report exported!');
                                }} className="p-4 border-2 border-slate-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left group">
                                    <BarChart3 className="w-6 h-6 text-indigo-600 mb-2" />
                                    <p className="font-bold text-slate-800 group-hover:text-indigo-600">Monthly Report</p>
                                    <p className="text-xs text-slate-500 mt-1">Current month</p>
                                </button>

                                {/* Master Report */}
                                <button onClick={() => {
                                    const masterData = {
                                        'Generated': new Date().toLocaleString(),
                                        'Period': dateRange,
                                        'Total Revenue': kpi.revenue,
                                        'Total Expenses': kpi.paidExpenses,
                                        'Inventory Cost': kpi.invUsageCost,
                                        'Net Profit': kpi.profit,
                                        'Pending Commissions': kpi.pendingCommissions,
                                        'Total Orders': filteredOrders.length,
                                        'Paid Expenses Count': filteredPaidExpenses.length
                                    };
                                    const detailData = [
                                        ...filteredOrders.map(o => ({ Type: 'Revenue', Date: formatDate(o.createdAt), Description: `Order - ${o.patientName}`, Amount: o.totalAmount })),
                                        ...filteredPaidExpenses.map(e => ({ Type: 'Expense', Date: formatDate(e.paidAt), Description: `${e.category} - ${e.title}`, Amount: -e.amount }))
                                    ];
                                    downloadCSV([masterData, ...detailData], `master_financial_report_${new Date().toISOString().split('T')[0]}.csv`);
                                    showToast('success', 'Master report with all financial data exported!');
                                }} className="p-4 border-2 border-indigo-500 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-all text-left group">
                                    <FileSpreadsheet className="w-6 h-6 text-indigo-600 mb-2" />
                                    <p className="font-bold text-indigo-800">Master Report</p>
                                    <p className="text-xs text-indigo-600 mt-1 font-medium">Complete financial data</p>
                                </button>
                            </div>
                            <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between">
                                <p className="text-xs text-slate-500">All reports are exported as CSV files for Excel/Sheets</p>
                                <button onClick={() => window.print()} className="text-sm font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                                    <Printer className="w-4 h-4" /> Print Dashboard
                                </button>
                            </div>
                        </div>

                        <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex justify-between items-center">
                            <div>
                                <p className="font-bold text-amber-900">Outstanding Liabilities</p>
                                <p className="text-sm text-amber-700">Pending Commissions: <b>${kpi.pendingCommissions.toLocaleString()}</b> • Due Expenses: <b>${expenses.filter(e => e.status !== 'paid').reduce((s, e) => s + e.amount, 0).toLocaleString()}</b></p>
                            </div>
                            <button onClick={() => setSubView('expenses')} className="px-4 py-2 bg-white text-amber-700 text-sm font-bold rounded shadow-sm hover:bg-amber-100">Manage Due Expenses</button>
                        </div>
                    </div>
                )}
                {subView === 'expenses' && <FinanceExpensesPanel expenses={expenses} />}
                {subView === 'doctors' && <FinanceDoctorsPanel doctors={doctors} orders={orders} />}
                {subView === 'sales' && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 border-b"><tr><th className="p-4">Date</th><th className="p-4">Bill #</th><th className="p-4">Patient</th><th className="p-4">Referred By</th><th className="p-4 text-right">Amount</th></tr></thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredOrders.map(o => (
                                    <tr key={o.id} className="hover:bg-slate-50">
                                        <td className="p-4 text-xs font-mono text-slate-500">{formatDate(o.createdAt)}</td>
                                        <td className="p-4 text-xs font-bold">{o.id.slice(0, 8).toUpperCase()}</td>
                                        <td className="p-4 font-bold text-slate-800">{o.patientName}</td>
                                        <td className="p-4 text-slate-600">{o.doctorName || 'Self'}</td>
                                        <td className="p-4 text-right font-bold text-slate-800">${o.totalAmount}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {subView === 'inventory' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100">
                                <h3 className="font-bold text-indigo-900 mb-2">Total Current Inventory Value</h3>
                                <p className="text-4xl font-bold text-indigo-600">${inventoryVal.toLocaleString()}</p>
                                <p className="text-sm text-indigo-400 mt-2">Valuation of current stock (Purchase Price × Quantity).</p>
                            </div>
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <h3 className="font-bold text-slate-800 mb-4">Inventory Usage Cost ({dateRange})</h3>
                                <p className="text-4xl font-bold text-slate-800 mb-4">${kpi.invUsageCost.toLocaleString()}</p>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm"><span className="text-slate-500">Used in Tests</span><span className="font-bold">${filteredInvTx.filter(t => t.type === 'deduction').reduce((s, t) => s + (t.cost || 0), 0).toFixed(2)}</span></div>
                                    <div className="flex justify-between text-sm"><span className="text-slate-500">Issued to Staff</span><span className="font-bold">${filteredInvTx.filter(t => t.type === 'issue').reduce((s, t) => s + (t.cost || 0), 0).toFixed(2)}</span></div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-4 border-b bg-slate-50 font-bold text-slate-700">Inventory Cost Ledger</div>
                            <table className="w-full text-left text-sm">
                                <thead className="border-b"><tr><th className="p-4">Date</th><th className="p-4">Item</th><th className="p-4">Type</th><th className="p-4">Reason</th><th className="p-4 text-right">Cost</th></tr></thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredInvTx.map(t => (
                                        <tr key={t.id} className="hover:bg-slate-50">
                                            <td className="p-4 text-xs font-mono text-slate-500">{formatDate(t.timestamp)}</td>
                                            <td className="p-4 font-bold text-slate-700">{t.itemName}</td>
                                            <td className="p-4"><span className="bg-slate-100 px-2 py-1 rounded text-xs uppercase">{t.type}</span></td>
                                            <td className="p-4 text-slate-600">{t.reason}</td>
                                            <td className="p-4 text-right font-bold text-slate-800">${(t.cost || 0).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
};

// ... (Rest of App: Sidebar, etc.)

const OrderHistoryTable: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    useEffect(() => { const unsub = db.collection('orders').orderBy('createdAt', 'desc').limit(50).onSnapshot(snap => setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)))); return () => unsub(); }, []);
    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm"><thead className="bg-slate-50 border-b"><tr><th className="p-4">Date</th><th className="p-4">Order ID</th><th className="p-4">Patient</th><th className="p-4">Amount</th><th className="p-4">Status</th></tr></thead><tbody className="divide-y divide-slate-50">{orders.map(o => (<tr key={o.id} className="hover:bg-slate-50"><td className="p-4 text-xs text-slate-500">{formatDate(o.createdAt)}</td><td className="p-4 font-mono text-xs font-bold">{o.id.slice(0, 8).toUpperCase()}</td><td className="p-4 font-bold text-slate-800">{o.patientName}</td><td className="p-4 font-bold text-slate-800">${o.totalAmount}</td><td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold uppercase ${o.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{o.status}</span></td></tr>))}{orders.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">No recent orders found.</td></tr>}</tbody></table>
        </div>
    );
};

const ReceptionReportsTable: React.FC<{ onPrint: (s: Sample) => void }> = ({ onPrint }) => {
    const [samples, setSamples] = useState<Sample[]>([]);
    useEffect(() => { const unsub = db.collection('samples').where('status', '==', 'reported').orderBy('reportedAt', 'desc').limit(50).onSnapshot(snap => setSamples(snap.docs.map(d => ({ id: d.id, ...d.data() } as Sample)))); return () => unsub(); }, []);
    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm"><thead className="bg-slate-50 border-b"><tr><th className="p-4">Reported Date</th><th className="p-4">Patient</th><th className="p-4">Test</th><th className="p-4 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-50">{samples.map(s => (<tr key={s.id} className="hover:bg-slate-50"><td className="p-4 text-xs text-slate-500">{formatDate(s.reportedAt)}</td><td className="p-4 font-bold text-slate-800">{s.patientName}</td><td className="p-4 text-slate-600">{s.testName}</td><td className="p-4 text-right"><button onClick={() => onPrint(s)} className="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded text-xs font-bold hover:bg-indigo-100 flex items-center gap-1 ml-auto transition-colors"><Printer className="w-3 h-3" /> Print Report</button></td></tr>))}{samples.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-400">No completed reports yet.</td></tr>}</tbody></table>
        </div>
    );
};

const PatientSearchPanel: React.FC<{ onSelect: (p: Patient) => void }> = ({ onSelect }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(false);
    const handleSearch = async () => { if (!query) return; setLoading(true); try { const snap = await db.collection('patients').where('fullName', '>=', query).where('fullName', '<=', query + '\uf8ff').limit(20).get(); setResults(snap.docs.map(d => ({ id: d.id, ...d.data() } as Patient))); } catch (e) { console.error(e); } setLoading(false); };
    return (
        <div className="p-6 h-full flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Search Patient Database</h3>
            <div className="flex gap-2 mb-6"><div className="relative flex-1"><Search className="absolute left-3 top-3 text-slate-400 w-4 h-4" /><input className="w-full pl-9 p-3 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Enter Patient Name..." value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} /></div><button onClick={handleSearch} disabled={loading} className="px-6 bg-indigo-600 text-white rounded-lg font-bold shadow hover:bg-indigo-700 disabled:opacity-50">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}</button></div>
            <div className="flex-1 overflow-y-auto">{results.map(p => (<div key={p.id} className="p-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 flex justify-between items-center transition-colors"><div><p className="font-bold text-slate-800">{p.fullName}</p><p className="text-xs text-slate-500">{p.phone} • {p.gender} • {calculateAge(p.dob)} yrs</p></div><button onClick={() => onSelect(p)} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded text-xs font-bold hover:bg-indigo-100">Select</button></div>))}{results.length === 0 && !loading && <div className="p-12 text-center text-slate-400 flex flex-col items-center"><Search className="w-8 h-8 mb-2 opacity-20" /><p>No patients found. Search by name.</p></div>}</div>
        </div>
    );
};

const DashboardModule: React.FC<{ role: Role }> = ({ role }) => {
    return (
        <div className="space-y-6"><div className="bg-indigo-600 rounded-2xl p-8 text-white shadow-xl shadow-indigo-200 relative overflow-hidden"><div className="relative z-10"><h2 className="text-3xl font-bold mb-2">Welcome Back, {role}</h2><p className="text-indigo-100">Here is what's happening in your lab today.</p></div><FlaskConical className="absolute right-0 bottom-0 text-indigo-500 w-48 h-48 -mr-8 -mb-8 opacity-20 rotate-12" /></div><div className="grid grid-cols-1 md:grid-cols-3 gap-6"><div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200"><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center text-green-600"><Activity className="w-6 h-6" /></div><div><p className="text-slate-500 text-xs font-bold uppercase">System Status</p><p className="text-xl font-bold text-slate-800">Operational</p></div></div></div><div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200"><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600"><Clock className="w-6 h-6" /></div><div><p className="text-slate-500 text-xs font-bold uppercase">Server Time</p><p className="text-xl font-bold text-slate-800">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p></div></div></div><div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200"><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-600"><Shield className="w-6 h-6" /></div><div><p className="text-slate-500 text-xs font-bold uppercase">Security Level</p><p className="text-xl font-bold text-slate-800">High</p></div></div></div></div></div>
    );
};

const PatientsModule: React.FC = () => {
    const [patients, setPatients] = useState<Patient[]>([]);
    useEffect(() => { const unsub = db.collection('patients').orderBy('createdAt', 'desc').limit(50).onSnapshot(s => setPatients(s.docs.map(d => ({ id: d.id, ...d.data() } as Patient)))); return () => unsub(); }, []);
    return (<div className="h-full flex flex-col"><h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Users className="w-6 h-6 text-indigo-600" /> Patient Directory</h2><div className="bg-white rounded-xl border border-slate-200 flex-1 overflow-hidden shadow-sm flex flex-col"><div className="overflow-y-auto flex-1"><table className="w-full text-left text-sm"><thead className="bg-slate-50 border-b sticky top-0"><tr><th className="p-4">Name</th><th className="p-4">Phone</th><th className="p-4">Gender</th><th className="p-4">Age</th><th className="p-4">Registered</th></tr></thead><tbody className="divide-y divide-slate-50">{patients.map(p => (<tr key={p.id} className="hover:bg-slate-50"><td className="p-4 font-bold text-slate-800">{p.fullName}</td><td className="p-4 text-slate-600">{p.phone}</td><td className="p-4 capitalize text-slate-600">{p.gender}</td><td className="p-4 text-slate-600">{calculateAge(p.dob)} yrs</td><td className="p-4 text-slate-500 text-xs">{formatDate(p.createdAt)}</td></tr>))}</tbody></table></div></div></div>);
};

const InventoryModule: React.FC<{ role: Role }> = ({ role }) => {
    const { showAlert, showConfirm, showPrompt, showToast } = useDialog();
    const isManager = canManageInventory(role);
    const [subView, setSubView] = useState<'dashboard' | 'items' | 'requests' | 'wastage' | 'vendors'>(isManager ? 'dashboard' : 'requests');
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [requests, setRequests] = useState<InventoryRequest[]>([]);
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [wastages, setWastages] = useState<InventoryWastage[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
    const [formData, setFormData] = useState<Partial<InventoryItem>>({ category: 'General', unit: 'pcs', status: 'in_stock' });
    const [selectedRequest, setSelectedRequest] = useState<InventoryRequest | null>(null);

    // Purchase More functionality
    const [showPurchaseModal, setShowPurchaseModal] = useState(false);
    const [purchasingItem, setPurchasingItem] = useState<InventoryItem | null>(null);
    const [purchaseData, setPurchaseData] = useState({
        quantity: 0,
        unitPrice: 0,
        vendorName: '',
        vendorPhone: '',
        invoiceNumber: '',
        expiryDate: '',
        manufactureDate: '',
        remarks: ''
    });

    // Real-time data subscriptions
    useEffect(() => {
        const unsubItems = db.collection('inventory_items').onSnapshot(s => setItems(s.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem))));
        const unsubRequests = db.collection('inventory_requests').orderBy('createdAt', 'desc').limit(50).onSnapshot(s => setRequests(s.docs.map(d => ({ id: d.id, ...d.data() } as InventoryRequest))));
        const unsubVendors = db.collection('vendors').onSnapshot(s => setVendors(s.docs.map(d => ({ id: d.id, ...d.data() } as Vendor))));
        const unsubWastages = db.collection('inventory_wastages').orderBy('reportedAt', 'desc').limit(50).onSnapshot(s => setWastages(s.docs.map(d => ({ id: d.id, ...d.data() } as InventoryWastage))));
        return () => { unsubItems(); unsubRequests(); unsubVendors(); unsubWastages(); };
    }, []);

    // Calculate statistics
    const stats = useMemo(() => {
        const now = new Date();
        const totalItems = items.length;
        const lowStock = items.filter(i => i.quantity < i.minLevel).length;
        const outOfStock = items.filter(i => i.quantity === 0).length;
        const expired = items.filter(i => {
            if (!i.expiryDate) return false;
            const expDate = i.expiryDate.toDate ? i.expiryDate.toDate() : new Date(i.expiryDate);
            return expDate < now;
        }).length;
        const expiringSoon = items.filter(i => {
            if (!i.expiryDate) return false;
            const expDate = i.expiryDate.toDate ? i.expiryDate.toDate() : new Date(i.expiryDate);
            const daysDiff = (expDate.getTime() - now.getTime()) / (1000 * 3600 * 24);
            return daysDiff > 0 && daysDiff <= 30;
        }).length;
        const totalValue = items.reduce((sum, i) => sum + ((i.purchasePrice || 0) * i.quantity), 0);
        const pendingRequests = requests.filter(r => r.status === 'pending').length;

        return { totalItems, lowStock, outOfStock, expired, expiringSoon, totalValue, pendingRequests };
    }, [items, requests]);

    // CRUD Operations
    const handleSave = async () => {
        // Comprehensive validation for required fields
        const missingFields: string[] = [];

        if (!formData.name?.trim()) missingFields.push('Item Name');
        if (!formData.category) missingFields.push('Category');
        if (!formData.unit?.trim()) missingFields.push('Unit');
        if (formData.quantity === undefined || formData.quantity === null) missingFields.push('Quantity');
        if (formData.minLevel === undefined || formData.minLevel === null) missingFields.push('Min Level');
        if (!formData.purchasePrice || formData.purchasePrice <= 0) missingFields.push('Purchase Price');
        if (!formData.vendorName?.trim()) missingFields.push('Vendor Name');
        if (!formData.batchNumber?.trim()) missingFields.push('Batch Number');

        // Require at least one: barcode OR SKU
        if (!formData.barcode?.trim() && !formData.sku?.trim()) {
            missingFields.push('Barcode or SKU (at least one is required)');
        }

        // Show specific error message
        if (missingFields.length > 0) {
            showAlert('error',
                `Please fill in the following required fields:\n\n${missingFields.map(f => `• ${f}`).join('\n')}`,
                'Missing Required Fields'
            );
            return;
        }

        // Validate number fields
        if (formData.quantity! < 0) {
            showAlert('error', 'Quantity cannot be negative', 'Invalid Quantity');
            return;
        }

        if (formData.minLevel! < 0) {
            showAlert('error', 'Min Level cannot be negative', 'Invalid Min Level');
            return;
        }

        try {
            const now = firebase.firestore.Timestamp.now();
            const data: Partial<InventoryItem> = {
                ...formData,
                name: formData.name?.trim(),
                vendorName: formData.vendorName?.trim(),
                batchNumber: formData.batchNumber?.trim(),
                barcode: formData.barcode?.trim() || undefined,
                sku: formData.sku?.trim() || undefined,
                updatedAt: now,
                status: (formData.quantity || 0) === 0 ? 'out_of_stock' : (formData.quantity || 0) < (formData.minLevel || 0) ? 'low_stock' : 'in_stock',
                createdBy: auth.currentUser?.email || 'admin'
            };

            if (editingItem) {
                await db.collection('inventory_items').doc(editingItem.id).update(data);
                await logAction('UPDATE_INVENTORY', 'Inventory', `Updated item: ${formData.name}`, auth.currentUser);
                showToast('success', 'Inventory item updated successfully');
            } else {
                await db.collection('inventory_items').add({ ...data, createdAt: now });
                await logAction('ADD_INVENTORY', 'Inventory', `Added new item: ${formData.name}`, auth.currentUser);
                showToast('success', 'Inventory item added successfully');
            }
            setShowModal(false);
            setEditingItem(null);
            setFormData({ category: 'General', unit: 'pcs', status: 'in_stock' });
        } catch (e) {
            console.error(e);
            showAlert('error', 'Failed to save item: ' + (e instanceof Error ? e.message : String(e)), 'Save Failed');
        }
    };

    const handleDelete = async (id: string, name: string) => {
        const confirmed = await showConfirm(
            `Delete "${name}"? This action cannot be undone.`,
            { title: 'Confirm Deletion', confirmText: 'Delete', cancelText: 'Cancel', type: 'danger' }
        );
        if (!confirmed) return;

        try {
            await db.collection('inventory_items').doc(id).delete();
            await logAction('DELETE_INVENTORY', 'Inventory', `Deleted item: ${name}`, auth.currentUser);
            showToast('success', `${name} deleted successfully`);
        } catch (e) {
            console.error(e);
            showAlert('error', 'Failed to delete item: ' + (e instanceof Error ? e.message : String(e)), 'Delete Failed');
        }
    };

    const openEdit = (item: InventoryItem) => {
        setEditingItem(item);
        setFormData(item);
        setShowModal(true);
    };

    // Purchase More functionality
    const openPurchaseMore = (item: InventoryItem) => {
        setPurchasingItem(item);
        setPurchaseData({
            quantity: 0,
            unitPrice: item.purchasePrice || 0,
            vendorName: item.vendorName || '',
            vendorPhone: item.vendorPhone || '',
            invoiceNumber: '',
            expiryDate: '',
            manufactureDate: '',
            remarks: ''
        });
        setShowPurchaseModal(true);
    };

    const handlePurchaseMore = async () => {
        if (!purchasingItem || purchaseData.quantity <= 0) {
            showAlert('error', 'Please enter a valid quantity', 'Invalid Input');
            return;
        }

        if (!purchaseData.vendorName?.trim()) {
            showAlert('error', 'Please enter vendor name', 'Missing Vendor');
            return;
        }

        try {
            const batch = db.batch();

            // Generate next batch number (previous + 1)
            const currentBatchNum = purchasingItem.batchNumber || 'B0';
            const numMatch = currentBatchNum.match(/\d+/);
            const nextNum = numMatch ? parseInt(numMatch[0]) + 1 : 1;
            const newBatchNumber = currentBatchNum.replace(/\d+/, nextNum.toString().padStart(numMatch?.[0].length || 3, '0'));

            // Create batch record
            const batchRef = db.collection('inventory_batches').doc();
            batch.set(batchRef, {
                id: batchRef.id,
                itemId: purchasingItem.id,
                itemName: purchasingItem.name,
                batchNumber: newBatchNumber,
                quantityPurchased: purchaseData.quantity,
                unitPrice: purchaseData.unitPrice,
                totalCost: purchaseData.quantity * purchaseData.unitPrice,
                vendorName: purchaseData.vendorName,
                vendorPhone: purchaseData.vendorPhone || '',
                invoiceNumber: purchaseData.invoiceNumber || '',
                purchaseDate: firebase.firestore.Timestamp.now(),
                expiryDate: purchaseData.expiryDate ? firebase.firestore.Timestamp.fromDate(new Date(purchaseData.expiryDate)) : null,
                manufactureDate: purchaseData.manufactureDate ? firebase.firestore.Timestamp.fromDate(new Date(purchaseData.manufactureDate)) : null,
                remarks: purchaseData.remarks || '',
                createdAt: firebase.firestore.Timestamp.now(),
                createdBy: auth.currentUser?.email || 'admin'
            });

            // Update item quantity and details
            const itemRef = db.collection('inventory_items').doc(purchasingItem.id);
            batch.update(itemRef, {
                quantity: firebase.firestore.FieldValue.increment(purchaseData.quantity),
                batchNumber: newBatchNumber,
                purchasePrice: purchaseData.unitPrice,
                vendorName: purchaseData.vendorName,
                vendorPhone: purchaseData.vendorPhone || '',
                purchaseDate: firebase.firestore.Timestamp.now(),
                expiryDate: purchaseData.expiryDate ? firebase.firestore.Timestamp.fromDate(new Date(purchaseData.expiryDate)) : purchasingItem.expiryDate,
                updatedAt: firebase.firestore.Timestamp.now()
            });

            // Create purchase transaction
            const txRef = db.collection('inventory_transactions').doc();
            batch.set(txRef, {
                itemId: purchasingItem.id,
                itemName: purchasingItem.name,
                type: 'purchase',
                quantity: purchaseData.quantity,
                cost: purchaseData.quantity * purchaseData.unitPrice,
                performedBy: auth.currentUser?.uid || 'admin',
                reason: `Purchase: Batch ${newBatchNumber}`,
                timestamp: firebase.firestore.Timestamp.now()
            });

            await batch.commit();
            await logAction('PURCHASE_INVENTORY', 'Inventory', `Purchased ${purchaseData.quantity} x ${purchasingItem.name} (Batch ${newBatchNumber})`, auth.currentUser);

            showToast('success', `Successfully purchased ${purchaseData.quantity} ${purchasingItem.unit}! New batch: ${newBatchNumber}`);
            setShowPurchaseModal(false);
            setPurchasingItem(null);
        } catch (e) {
            console.error(e);
            showAlert('error', 'Failed to record purchase: ' + (e instanceof Error ? e.message : String(e)), 'Purchase Failed');
        }
    };


    // Request Management
    const handleApproveRequest = async (req: InventoryRequest) => {
        const item = items.find(i => i.id === req.itemId);
        if (!item) {
            showAlert('error', 'Item not found', 'Error');
            return;
        }
        if (item.quantity < req.quantity) {
            showAlert('warning', `Insufficient stock. Available: ${item.quantity} ${item.unit}`, 'Low Stock');
            return;
        }

        const maxQty = Math.min(req.quantity, item.quantity);
        const releaseQty = await showPrompt(
            `Approve and release quantity (max ${maxQty}):`,
            { title: 'Approve Request', defaultValue: maxQty.toString(), placeholder: 'Enter quantity' }
        );

        if (!releaseQty) return;
        const qty = parseInt(releaseQty);
        if (isNaN(qty) || qty <= 0 || qty > maxQty) {
            showAlert('error', `Invalid quantity. Must be between 1 and ${maxQty}`, 'Invalid Input');
            return;
        }

        try {
            const batch = db.batch();

            // Update request status
            const reqRef = db.collection('inventory_requests').doc(req.id);
            batch.update(reqRef, {
                status: 'released',
                releasedQuantity: qty,
                releasedAt: firebase.firestore.Timestamp.now(),
                respondedBy: auth.currentUser?.email || 'manager'
            });

            // IMMEDIATELY DEDUCT STOCK (atomic operation)
            const itemRef = db.collection('inventory_items').doc(req.itemId);
            batch.update(itemRef, {
                quantity: firebase.firestore.FieldValue.increment(-qty)
            });

            // Create transaction record
            const txRef = db.collection('inventory_transactions').doc();
            const cost = (item.purchasePrice || 0) * qty;
            batch.set(txRef, {
                itemId: req.itemId,
                itemName: req.itemName,
                type: 'issue',
                quantity: -qty,
                cost: cost,
                performedBy: auth.currentUser?.uid || 'manager',
                reason: `Approved request from ${req.requesterName}: ${req.purpose}`,
                timestamp: firebase.firestore.Timestamp.now()
            });

            await batch.commit();
            await logAction('APPROVE_REQUEST', 'Inventory', `Approved & released ${qty} x ${req.itemName} to ${req.requesterName}`, auth.currentUser);
            showToast('success', `Request approved! ${qty} items released from stock`);
        } catch (e) {
            console.error(e);
            showAlert('error', 'Failed to approve request: ' + (e instanceof Error ? e.message : String(e)), 'Approval Failed');
        }
    };

    const handleRejectRequest = async (req: InventoryRequest) => {
        // Ask for confirmation first
        const confirmed = await showConfirm(
            `Reject inventory request from ${req.requesterName} for ${req.quantity} ${req.itemName}?`,
            { title: 'Confirm Rejection', confirmText: 'Reject', cancelText: 'Cancel', type: 'danger' }
        );
        if (!confirmed) return;

        // Get rejection reason
        const reason = await showPrompt(
            'Enter reason for rejection:',
            { title: 'Rejection Reason', placeholder: 'Why is this request being rejected?', defaultValue: '' }
        );
        if (!reason?.trim()) {
            showAlert('warning', 'Rejection cancelled - reason is required', 'No Reason Provided');
            return;
        }

        try {
            await db.collection('inventory_requests').doc(req.id).update({
                status: 'rejected',
                rejectionReason: reason.trim(),
                rejectedAt: firebase.firestore.Timestamp.now(),
                respondedBy: auth.currentUser?.email || 'manager'
            });
            await logAction('REJECT_REQUEST', 'Inventory', `Rejected request from ${req.requesterName}: ${reason}`, auth.currentUser);
            showToast('success', `Request rejected. ${req.requesterName} will be notified.`);
        } catch (e) {
            console.error(e);
            showAlert('error', 'Failed to reject request: ' + (e instanceof Error ? e.message : String(e)), 'Rejection Failed');
        }
    };

    // Render Dashboard (Manager Only)
    const renderDashboard = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-slate-500 text-xs font-bold uppercase">Total Items</p>
                        <Package className="w-5 h-5 text-indigo-600" />
                    </div>
                    <p className="text-3xl font-bold text-slate-800">{stats.totalItems}</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-slate-500 text-xs font-bold uppercase">Low Stock</p>
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                    </div>
                    <p className="text-3xl font-bold text-amber-600">{stats.lowStock}</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-slate-500 text-xs font-bold uppercase">Expired Items</p>
                        <XCircle className="w-5 h-5 text-red-600" />
                    </div>
                    <p className="text-3xl font-bold text-red-600">{stats.expired}</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-slate-500 text-xs font-bold uppercase">Total Value</p>
                        <DollarSign className="w-5 h-5 text-green-600" />
                    </div>
                    <p className="text-3xl font-bold text-green-600">${stats.totalValue.toLocaleString()}</p>
                </div>
            </div>

            {/* Alerts */}
            {(stats.lowStock > 0 || stats.expired > 0 || stats.expiringSoon > 0) && (
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                    <h3 className="font-bold text-amber-900 mb-3 flex items-center gap-2"><Bell className="w-4 h-4" /> Inventory Alerts</h3>
                    <div className="space-y-2">
                        {stats.lowStock > 0 && <p className="text-sm text-amber-700">⚠️ {stats.lowStock} items below minimum stock level</p>}
                        {stats.expired > 0 && <p className="text-sm text-red-700">🚫 {stats.expired} items have expired</p>}
                        {stats.expiringSoon > 0 && <p className="text-sm text-amber-700">⏰ {stats.expiringSoon} items expiring within 30 days</p>}
                    </div>
                    <button onClick={() => setSubView('items')} className="mt-3 text-sm font-bold text-amber-900 hover:underline">View Items →</button>
                </div>
            )}

            {/* Pending Requests */}
            {stats.pendingRequests > 0 && (
                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                    <h3 className="font-bold text-indigo-900 mb-2 flex items-center gap-2"><Truck className="w-4 h-4" /> Pending Requests</h3>
                    <p className="text-sm text-indigo-700">{stats.pendingRequests} requests awaiting your approval</p>
                    <button onClick={() => setSubView('requests')} className="mt-2 text-sm font-bold text-indigo-900 hover:underline">Review Requests →</button>
                </div>
            )}
        </div>
    );

    // Render Items List (Manager Only)
    const renderItemsList = () => (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-800">Inventory Items</h3>
                <button onClick={() => { setEditingItem(null); setFormData({ category: 'General', unit: 'pcs' }); setShowModal(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"><Plus className="w-4 h-4" /> Add Item</button>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <h3 className="font-bold text-lg mb-4">{editingItem ? 'Edit Item' : 'Add New Item'}</h3>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="col-span-2"><label className="text-xs font-bold text-slate-500 uppercase">Item Name *</label><input className="w-full p-2 border rounded" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
                            <div><label className="text-xs font-bold text-slate-500 uppercase">Category</label><select className="w-full p-2 border rounded" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>{INVENTORY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                            <div><label className="text-xs font-bold text-slate-500 uppercase">Unit</label><input className="w-full p-2 border rounded" placeholder="e.g., pcs, ml, boxes" value={formData.unit || ''} onChange={e => setFormData({ ...formData, unit: e.target.value })} /></div>
                            <div><label className="text-xs font-bold text-slate-500 uppercase">Quantity *</label><input type="number" className="w-full p-2 border rounded" value={formData.quantity || ''} onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })} /></div>
                            <div><label className="text-xs font-bold text-slate-500 uppercase">Min Level</label><input type="number" className="w-full p-2 border rounded" value={formData.minLevel || ''} onChange={e => setFormData({ ...formData, minLevel: parseInt(e.target.value) || 0 })} /></div>
                            <div><label className="text-xs font-bold text-slate-500 uppercase">Purchase Price ($)</label><input type="number" step="0.01" className="w-full p-2 border rounded" value={formData.purchasePrice || ''} onChange={e => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) || 0 })} /></div>
                            <div><label className="text-xs font-bold text-slate-500 uppercase">Batch Number</label><input className="w-full p-2 border rounded" value={formData.batchNumber || ''} onChange={e => setFormData({ ...formData, batchNumber: e.target.value })} /></div>
                            <div><label className="text-xs font-bold text-slate-500 uppercase">Expiry Date</label><input type="date" className="w-full p-2 border rounded" value={formData.expiryDate ? (formData.expiryDate.toDate ? formData.expiryDate.toDate().toISOString().split('T')[0] : '') : ''} onChange={e => setFormData({ ...formData, expiryDate: e.target.value ? firebase.firestore.Timestamp.fromDate(new Date(e.target.value)) : undefined })} /></div>
                            <div><label className="text-xs font-bold text-slate-500 uppercase">Barcode/SKU</label><input className="w-full p-2 border rounded" value={formData.barcode || formData.sku || ''} onChange={e => setFormData({ ...formData, barcode: e.target.value })} /></div>
                            <div className="col-span-2"><label className="text-xs font-bold text-slate-500 uppercase">Vendor</label><input className="w-full p-2 border rounded" value={formData.vendorName || ''} onChange={e => setFormData({ ...formData, vendorName: e.target.value })} /></div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-500">Cancel</button>
                            <button onClick={handleSave} className="bg-indigo-600 text-white px-4 py-2 rounded font-bold">Save</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Purchase More Modal */}
            {showPurchaseModal && purchasingItem && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-lg">Purchase More Stock</h3>
                            <button onClick={() => setShowPurchaseModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                        </div>

                        <div className="bg-indigo-50 p-4 rounded-lg mb-4 border border-indigo-100">
                            <div className="flex items-center gap-2 mb-2">
                                <Package className="w-5 h-5 text-indigo-600" />
                                <span className="font-bold text-slate-800">{purchasingItem.name}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                                <div><span className="text-slate-500">Current Stock:</span> <span className="font-bold">{purchasingItem.quantity} {purchasingItem.unit}</span></div>
                                <div><span className="text-slate-500">Current Batch:</span> <span className="font-bold">{purchasingItem.batchNumber}</span></div>
                                <div><span className="text-slate-500">SKU/Barcode:</span> <span className="font-bold">{purchasingItem.sku || purchasingItem.barcode || 'N/A'}</span></div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Quantity Purchased *</label><input type="number" min="1" className="w-full p-2 border rounded" placeholder="Enter quantity" value={purchaseData.quantity || ''} onChange={e => setPurchaseData({ ...purchaseData, quantity: parseInt(e.target.value) || 0 })} autoFocus /></div>
                            <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Unit Price ($) *</label><input type="number" step="0.01" min="0" className="w-full p-2 border rounded" placeholder="Price per unit" value={purchaseData.unitPrice || ''} onChange={e => setPurchaseData({ ...purchaseData, unitPrice: parseFloat(e.target.value) || 0 })} /></div>
                            <div className="col-span-2 bg-slate-50 p-3 rounded border border-slate-200"><span className="text-sm text-slate-600">Total Cost:</span> <span className="font-bold text-lg text-slate-800">${(purchaseData.quantity * purchaseData.unitPrice).toFixed(2)}</span></div>
                            <div className="col-span-2"><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Vendor Name *</label><input type="text" className="w-full p-2 border rounded" placeholder="Enter or confirm vendor" value={purchaseData.vendorName} onChange={e => setPurchaseData({ ...purchaseData, vendorName: e.target.value })} /></div>
                            <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Vendor Phone</label><input type="tel" className="w-full p-2 border rounded" placeholder="Optional" value={purchaseData.vendorPhone} onChange={e => setPurchaseData({ ...purchaseData, vendorPhone: e.target.value })} /></div>
                            <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Invoice Number</label><input type="text" className="w-full p-2 border rounded" placeholder="Optional" value={purchaseData.invoiceNumber} onChange={e => setPurchaseData({ ...purchaseData, invoiceNumber: e.target.value })} /></div>
                            <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Manufacture Date</label><input type="date" className="w-full p-2 border rounded" value={purchaseData.manufactureDate} onChange={e => setPurchaseData({ ...purchaseData, manufactureDate: e.target.value })} /></div>
                            <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Expiry Date</label><input type="date" className="w-full p-2 border rounded" value={purchaseData.expiryDate} onChange={e => setPurchaseData({ ...purchaseData, expiryDate: e.target.value })} /></div>
                            <div className="col-span-2"><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Remarks</label><textarea className="w-full p-2 border rounded" rows={2} placeholder="Optional notes" value={purchaseData.remarks} onChange={e => setPurchaseData({ ...purchaseData, remarks: e.target.value })}></textarea></div>
                        </div>

                        <div className="flex justify-end gap-2 pt-4 border-t">
                            <button onClick={() => setShowPurchaseModal(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded">Cancel</button>
                            <button onClick={handlePurchaseMore} className="bg-green-600 text-white px-6 py-2 rounded font-bold hover:bg-green-700 flex items-center gap-2"><Plus className="w-4 h-4" /> Confirm Purchase</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 flex-1 overflow-hidden shadow-sm flex flex-col">
                <div className="overflow-y-auto flex-1">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b sticky top-0"><tr><th className="p-4">Item Name</th><th className="p-4">Category</th><th className="p-4">Stock</th><th className="p-4">Batch</th><th className="p-4">Expiry</th><th className="p-4">Value</th><th className="p-4">Status</th><th className="p-4 text-right">Actions</th></tr></thead>
                        <tbody className="divide-y divide-slate-50">
                            {items.map(i => {
                                const isExpired = i.expiryDate && (i.expiryDate.toDate ? i.expiryDate.toDate() : new Date(i.expiryDate)) < new Date();
                                return (
                                    <tr key={i.id} className="hover:bg-slate-50">
                                        <td className="p-4 font-bold text-slate-800">{i.name}<div className="text-xs text-slate-400 font-normal">{i.vendorName || 'No vendor'}</div></td>
                                        <td className="p-4 text-slate-500">{i.category}</td>
                                        <td className="p-4 font-mono font-bold">{i.quantity} <span className="text-xs text-slate-400 font-normal">{i.unit}</span></td>
                                        <td className="p-4 text-xs text-slate-500">{i.batchNumber || '-'}</td>
                                        <td className="p-4 text-xs text-slate-500">{i.expiryDate ? formatDate(i.expiryDate) : '-'}</td>
                                        <td className="p-4 font-mono text-slate-600">${((i.purchasePrice || 0) * i.quantity).toLocaleString()}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${isExpired ? 'bg-red-100 text-red-700' : i.quantity === 0 ? 'bg-gray-100 text-gray-700' : i.quantity < i.minLevel ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                                                {isExpired ? 'Expired' : i.quantity === 0 ? 'Out' : i.quantity < i.minLevel ? 'Low' : 'OK'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => openPurchaseMore(i)}
                                                className="text-green-600 hover:bg-green-50 p-2 rounded font-bold text-sm flex items-center gap-1 ml-auto">
                                                <Plus className="w-4 h-4" /> Purchase More
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    // Render Requests (Manager sees all, others see only theirs + ability to request)
    const renderRequests = () => {
        const userRequests = isManager ? requests : requests.filter(r => r.requesterId === (auth.currentUser?.uid || ''));
        const pendingForManager = isManager ? requests.filter(r => r.status === 'pending') : [];

        return (
            <div className="space-y-6">
                {!isManager && <InventoryRequestModal isOpen={true} onClose={() => { }} userId={auth.currentUser?.uid || 'user'} userName={auth.currentUser?.email || 'User'} userRole={role} />}

                {isManager && pendingForManager.length > 0 && (
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 mb-4">Pending Approvals ({pendingForManager.length})</h3>
                        <div className="space-y-3">
                            {pendingForManager.map(req => {
                                const item = items.find(i => i.id === req.itemId);
                                const available = item ? item.quantity : 0;
                                return (
                                    <div key={req.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-start">
                                        <div>
                                            <p className="font-bold text-slate-800">{req.itemName} <span className="text-sm font-normal text-slate-500">(x{req.quantity})</span></p>
                                            <p className="text-xs text-slate-500 mt-1">Requested by: {req.requesterName} ({req.requesterRole})</p>
                                            <p className="text-xs text-slate-500">Reason: {req.purpose}</p>
                                            <p className="text-xs text-slate-600 mt-1">Available: {available} {item?.unit || 'units'}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => handleApproveRequest(req)} className="bg-green-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-green-700"><Check className="w-3 h-3 inline mr-1" /> Approve</button>
                                            <button onClick={() => handleRejectRequest(req)} className="bg-red-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-red-700"><XCircle className="w-3 h-3 inline mr-1" /> Reject</button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div>
                    <h3 className="text-lg font-bold text-slate-800 mb-4">{isManager ? 'All Requests' : 'My Request History'}</h3>
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg- slate-50 border-b"><tr><th className="p-4">Date</th><th className="p-4">Item</th><th className="p-4">Qty</th>{isManager && <th className="p-4">Requester</th>}<th className="p-4">Purpose</th><th className="p-4">Status</th></tr></thead>
                            <tbody className="divide-y">
                                {userRequests.map(r => (
                                    <tr key={r.id} className="hover:bg-slate-50">
                                        <td className="p-4 text-xs text-slate-500">{formatDate(r.createdAt)}</td>
                                        <td className="p-4 font-bold text-slate-700">{r.itemName}</td>
                                        <td className="p-4">{r.quantity}</td>
                                        {isManager && <td className="p-4 text-slate-600">{r.requesterName}</td>}
                                        <td className="p-4 text-slate-600 text-xs">{r.purpose}</td>
                                        <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold uppercase ${r.status === 'pending' ? 'bg-blue-100 text-blue-700' : r.status === 'released' ? 'bg-green-100 text-green-700' : r.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>{r.status}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    // Main render - Conditional based on role
    if (!isManager) {
        // Non-managers only see request interface
        return (
            <div className="p-6 h-full">
                <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Truck className="w-6 h-6 text-indigo-600" /> Request Inventory</h2>
                {renderRequests()}
            </div>
        );
    }

    // Manager view with tabs
    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Package className="w-6 h-6 text-indigo-600" /> Inventory Management</h2>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    {[{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }, { id: 'items', label: 'Items', icon: Package }, { id: 'requests', label: 'Requests', icon: Truck }, { id: 'wastage', label: 'Wastage', icon: AlertCircle }].map(tab => (
                        <button key={tab.id} onClick={() => setSubView(tab.id as any)} className={`px-3 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${subView === tab.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}><tab.icon className="w-4 h-4" /> <span>{tab.label}</span></button>
                    ))}
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
                {subView === 'dashboard' && renderDashboard()}
                {subView === 'items' && renderItemsList()}
                {subView === 'requests' && renderRequests()}
                {subView === 'wastage' && <div className="bg-white p-8 rounded-xl border text-center text-slate-400">Wastage tracking coming soon...</div>}
            </div>
        </div>
    );
};

const AdminUsers: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [users, setUsers] = useState<AppUser[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState<Partial<AppUser>>({ role: 'receptionist', status: 'active' });

    useEffect(() => { const u = db.collection('users').onSnapshot(s => setUsers(s.docs.map(d => ({ id: d.id, ...d.data() } as AppUser)))); return () => u(); }, []);

    const handleSave = async () => {
        if (!formData.username || !formData.password) return;
        try {
            await db.collection('users').add({ ...formData, createdAt: firebase.firestore.Timestamp.now() });
            setShowModal(false); setFormData({ role: 'receptionist', status: 'active' });
        } catch (e) { console.error(e); }
    };

    const handleDelete = async (id: string) => { if (window.confirm("Remove user?")) await db.collection('users').doc(id).delete(); };

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800">User Management</h2>
                <button onClick={() => setShowModal(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"><UserPlus className="w-4 h-4" /> Add User</button>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
                        <h3 className="font-bold text-lg mb-4">Create New User</h3>
                        <div className="space-y-3">
                            <div><label className="text-xs font-bold text-slate-500 uppercase">Full Name</label><input className="w-full p-2 border rounded" value={formData.fullName || ''} onChange={e => setFormData({ ...formData, fullName: e.target.value })} /></div>
                            <div><label className="text-xs font-bold text-slate-500 uppercase">Username</label><input className="w-full p-2 border rounded" value={formData.username || ''} onChange={e => setFormData({ ...formData, username: e.target.value })} /></div>
                            <div><label className="text-xs font-bold text-slate-500 uppercase">Password</label><input className="w-full p-2 border rounded" type="password" value={formData.password || ''} onChange={e => setFormData({ ...formData, password: e.target.value })} /></div>
                            <div><label className="text-xs font-bold text-slate-500 uppercase">Role</label><select className="w-full p-2 border rounded" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value as Role })}>{AVAILABLE_ROLES.filter(r => !r.disabled).map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</select></div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-500">Cancel</button>
                            <button onClick={handleSave} className="bg-indigo-600 text-white px-4 py-2 rounded font-bold">Create User</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 overflow-hidden flex flex-col">
                <div className="overflow-y-auto flex-1">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b sticky top-0"><tr><th className="p-4">Name</th><th className="p-4">Username</th><th className="p-4">Role</th><th className="p-4">Status</th><th className="p-4 text-right">Action</th></tr></thead>
                        <tbody className="divide-y divide-slate-50">
                            {users.map(u => (
                                <tr key={u.id} className="hover:bg-slate-50">
                                    <td className="p-4 font-bold text-slate-800">{u.fullName}</td>
                                    <td className="p-4 text-slate-600">{u.username}</td>
                                    <td className="p-4 capitalize text-slate-600">{u.role}</td>
                                    <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold uppercase ${u.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{u.status}</span></td>
                                    <td className="p-4 text-right"><button onClick={() => handleDelete(u.id)} className="text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 className="w-4 h-4" /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const TestManagementModule: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [tests, setTests] = useState<Test[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState<Partial<Test>>({ isActive: true, category: 'General', sampleType: 'Blood' });

    useEffect(() => { const u = db.collection('tests').onSnapshot(s => setTests(s.docs.map(d => ({ id: d.id, ...d.data() } as Test)))); return () => u(); }, []);

    const handleSave = async () => {
        if (!formData.name || !formData.code || !formData.price) return;
        try {
            await db.collection('tests').add({ ...formData, parameters: [], createdAt: firebase.firestore.Timestamp.now() });
            setShowModal(false); setFormData({ isActive: true, category: 'General', sampleType: 'Blood' });
        } catch (e) { console.error(e); }
    };

    const toggleStatus = async (test: Test) => { await db.collection('tests').doc(test.id).update({ isActive: !test.isActive }); };
    const handleDelete = async (id: string) => { if (window.confirm("Delete test?")) await db.collection('tests').doc(id).delete(); };

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800">Test Catalog</h2>
                <button onClick={() => setShowModal(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"><Plus className="w-4 h-4" /> Add Test</button>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg">
                        <h3 className="font-bold text-lg mb-4">Add New Test</h3>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="col-span-2"><label className="text-xs font-bold text-slate-500 uppercase">Test Name</label><input className="w-full p-2 border rounded" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
                            <div><label className="text-xs font-bold text-slate-500 uppercase">Test Code</label><input className="w-full p-2 border rounded" value={formData.code || ''} onChange={e => setFormData({ ...formData, code: e.target.value })} /></div>
                            <div><label className="text-xs font-bold text-slate-500 uppercase">Price ($)</label><input type="number" className="w-full p-2 border rounded" value={formData.price || ''} onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) })} /></div>
                            <div><label className="text-xs font-bold text-slate-500 uppercase">Sample Type</label><select className="w-full p-2 border rounded" value={formData.sampleType} onChange={e => setFormData({ ...formData, sampleType: e.target.value })}><option>Blood</option><option>Urine</option><option>Stool</option><option>Swab</option><option>Tissue</option></select></div>
                            <div><label className="text-xs font-bold text-slate-500 uppercase">Category</label><input className="w-full p-2 border rounded" value={formData.category || ''} onChange={e => setFormData({ ...formData, category: e.target.value })} /></div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-500">Cancel</button>
                            <button onClick={handleSave} className="bg-indigo-600 text-white px-4 py-2 rounded font-bold">Save Test</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 overflow-hidden flex flex-col">
                <div className="overflow-y-auto flex-1">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b sticky top-0"><tr><th className="p-4">Name</th><th className="p-4">Code</th><th className="p-4">Price</th><th className="p-4">Category</th><th className="p-4">Status</th><th className="p-4 text-right">Action</th></tr></thead>
                        <tbody className="divide-y divide-slate-50">
                            {tests.map(t => (
                                <tr key={t.id} className="hover:bg-slate-50">
                                    <td className="p-4 font-bold text-slate-800">{t.name}</td>
                                    <td className="p-4 text-xs font-mono text-slate-500">{t.code}</td>
                                    <td className="p-4 font-bold text-slate-800">${t.price}</td>
                                    <td className="p-4 text-slate-500">{t.category}</td>
                                    <td className="p-4">
                                        <button onClick={() => toggleStatus(t)} className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded ${t.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                            {t.isActive ? 'Active' : 'Inactive'}
                                        </button>
                                    </td>
                                    <td className="p-4 text-right"><button onClick={() => handleDelete(t.id)} className="text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 className="w-4 h-4" /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const AdminFinance: React.FC<{ onBack: () => void, onNavigate: (view: ViewState) => void }> = ({ onBack, onNavigate }) => {
    return (<div className="h-full flex flex-col p-6"><h2 className="text-2xl font-bold text-slate-800 mb-6">Admin Finance Control</h2><div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"><FinanceModule /></div></div>);
};

const AdminReports: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    return (<div className="h-full flex flex-col"><h2 className="text-2xl font-bold mb-6 text-slate-800">Analytics & Reports</h2><div className="bg-white p-12 text-center rounded-xl border border-slate-200 flex flex-col items-center justify-center flex-1"><FileBarChart className="w-16 h-16 text-slate-200 mb-4" /><p className="text-slate-500 font-medium">Detailed analytics module is currently under development.</p><p className="text-sm text-slate-400 mt-2">Please use the Finance or Dashboard views for current summaries.</p></div></div>);
};

const AdminLogs: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    useEffect(() => { const u = db.collection('audit_logs').orderBy('timestamp', 'desc').limit(50).onSnapshot(s => setLogs(s.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog)))); return () => u(); }, []);
    return (<div className="h-full flex flex-col"><h2 className="text-2xl font-bold mb-6 text-slate-800">System Audit Logs</h2><div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 overflow-hidden flex flex-col"><div className="overflow-y-auto flex-1"><table className="w-full text-left text-sm"><thead className="bg-slate-50 border-b sticky top-0"><tr><th className="p-4">Time</th><th className="p-4">User</th><th className="p-4">Action</th><th className="p-4">Details</th></tr></thead><tbody className="divide-y divide-slate-50">{logs.map(l => (<tr key={l.id} className="hover:bg-slate-50"><td className="p-4 text-xs font-mono text-slate-500">{formatTimeSafe(l.timestamp)}</td><td className="p-4 font-bold text-slate-800">{l.userName}</td><td className="p-4 font-bold text-indigo-600">{l.action}</td><td className="p-4 text-slate-600">{l.details}</td></tr>))}</tbody></table></div></div></div>);
};

const AdminSettings: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    return (<div className="h-full flex flex-col"><h2 className="text-2xl font-bold mb-6 text-slate-800">System Configuration</h2><div className="bg-white p-8 rounded-xl border border-slate-200 max-w-2xl space-y-6"><div><label className="block font-bold text-slate-700 mb-2">Laboratory Name</label><input className="border border-slate-300 p-3 rounded-lg w-full outline-none focus:ring-2 focus:ring-indigo-500" defaultValue="LabPro Diagnostics" /></div><div><label className="block font-bold text-slate-700 mb-2">Address</label><input className="border border-slate-300 p-3 rounded-lg w-full outline-none focus:ring-2 focus:ring-indigo-500" defaultValue="123 Medical Plaza, NY" /></div><div><label className="block font-bold text-slate-700 mb-2">Contact Phone</label><input className="border border-slate-300 p-3 rounded-lg w-full outline-none focus:ring-2 focus:ring-indigo-500" defaultValue="+1 (555) 123-4567" /></div><div className="pt-4"><button className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-indigo-700 transition-colors">Save Changes</button></div></div></div>);
};

const ReceptionModule: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
    const [subView, setSubView] = useState<'dashboard' | 'new-order' | 'history' | 'reports' | 'search-patients'>('dashboard');
    const [tests, setTests] = useState<Test[]>([]);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ todayPatients: 0, todayOrders: 0, pendingPayments: 0, completed: 0, todaySales: 0 });
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [selectedDoctorId, setSelectedDoctorId] = useState('');
    const [trackerSamples, setTrackerSamples] = useState<Sample[]>([]);
    const [notifications, setNotifications] = useState<{ id: string, text: string, type: 'alert' | 'info' }[]>([]);
    const [printData, setPrintData] = useState<PrintableInvoiceData | null>(null);
    const [viewReport, setViewReport] = useState<Sample | null>(null);
    const [patientForm, setPatientForm] = useState({ fullName: '', phone: '', age: '', ageUnit: 'Years', gender: 'male', address: '', referralType: 'self', doctorName: '', clinicName: '', existingId: '' });
    const [cart, setCart] = useState<Test[]>([]);
    const [payment, setPayment] = useState({ method: 'cash', paidAmount: '', discount: 0, discountReason: '' });
    const [testSearch, setTestSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const totalAmount = cart.reduce((sum, t) => sum + t.price, 0);
    const finalAmount = Math.max(0, totalAmount - payment.discount);
    const paidVal = parseFloat(payment.paidAmount) || 0;
    const dueVal = Math.max(0, finalAmount - paidVal);

    useEffect(() => { setPayment(p => ({ ...p, paidAmount: finalAmount.toString() })); }, [finalAmount]);
    useEffect(() => {
        const unsubTests = db.collection('tests').where('isActive', '==', true).onSnapshot(s => setTests(s.docs.map(d => ({ id: d.id, ...d.data() } as Test))));
        const unsubDocs = db.collection('doctors').where('status', '==', 'active').onSnapshot(s => setDoctors(s.docs.map(d => ({ id: d.id, ...d.data() } as Doctor))));
        const today = new Date(); today.setHours(0, 0, 0, 0); const startOfDay = firebase.firestore.Timestamp.fromDate(today);
        const unsubOrders = db.collection('orders').where('createdAt', '>=', startOfDay).onSnapshot(s => { const totalSales = s.docs.reduce((acc, doc) => acc + (doc.data().totalAmount || 0), 0); setStats(prev => ({ ...prev, todayOrders: s.size, todaySales: totalSales })); });
        return () => { unsubTests(); unsubOrders(); unsubDocs(); };
    }, []);
    useEffect(() => {
        const unsubSamples = db.collection('samples').orderBy('createdAt', 'desc').limit(20).onSnapshot(snap => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Sample));
            setTrackerSamples(data);
            const newNotifs = [];
            const rejected = data.filter(s => s.status === 'rejected');
            rejected.forEach(s => { newNotifs.push({ id: s.id, text: `Sample rejected for ${s.patientName} (${s.testName})`, type: 'alert' as const }); });
            const readyCount = data.filter(s => s.status === 'reported').length;
            if (readyCount > 0) { newNotifs.push({ id: 'reports-ready', text: `${readyCount} recent reports ready for printing.`, type: 'info' as const }); }
            setNotifications(newNotifs);
        });
        return () => unsubSamples();
    }, []);

    const handlePatientSearch = async (isSilent = false) => {
        const phoneQuery = patientForm.phone.trim();
        if (phoneQuery.length < 3) return;
        setLoading(true);
        try {
            const snap = await db.collection('patients').where('phone', '>=', phoneQuery).limit(1).get();
            if (!snap.empty) {
                const p = snap.docs[0].data() as Patient;
                let ageVal = '', ageUnit = 'Years';
                if (p.dob) { ageVal = calculateAge(p.dob).toString(); }
                setPatientForm(prev => ({ ...prev, fullName: p.fullName, gender: p.gender as any, address: p.address || '', age: ageVal, existingId: snap.docs[0].id }));
                if (!isSilent) alert("Patient Found: " + p.fullName);
            } else { if (!isSilent) alert("Patient not found. Please enter details manually."); }
        } catch (e) { console.error(e); if (!isSilent) alert("Error searching for patient."); } finally { setLoading(false); }
    };

    const filteredTests = tests.filter(t => { const matchSearch = t.name.toLowerCase().includes(testSearch.toLowerCase()) || t.code.toLowerCase().includes(testSearch.toLowerCase()); const matchCat = selectedCategory === 'All' || t.category === selectedCategory; return matchSearch && matchCat; });
    const categories = ['All', ...Array.from(new Set(tests.map(t => t.category || 'General')))];

    const handleBookOrder = async () => {
        if (!patientForm.fullName || cart.length === 0) { alert("Please enter patient details and select at least one test."); return; }
        setLoading(true);
        try {
            let patientId = patientForm.existingId;
            let dob = new Date();
            if (patientForm.age) { const val = parseInt(patientForm.age); if (patientForm.ageUnit === 'Years') dob.setFullYear(dob.getFullYear() - val); if (patientForm.ageUnit === 'Months') dob.setMonth(dob.getMonth() - val); if (patientForm.ageUnit === 'Days') dob.setDate(dob.getDate() - val); }
            const dobStr = dob.toISOString().split('T')[0];
            const patientData = { fullName: patientForm.fullName, phone: patientForm.phone, gender: patientForm.gender, address: patientForm.address, dob: dobStr, updatedAt: firebase.firestore.Timestamp.now() };
            if (patientId) { await db.collection('patients').doc(patientId).update(patientData); } else { const ref = await db.collection('patients').add({ ...patientData, createdAt: firebase.firestore.Timestamp.now() }); patientId = ref.id; }
            let doctorName = 'Self'; let doctorId = null; let commissionAmt = 0;
            if (patientForm.referralType === 'doctor' && selectedDoctorId) { const doc = doctors.find(d => d.id === selectedDoctorId); if (doc) { doctorName = doc.name; doctorId = doc.id; commissionAmt = (finalAmount * (doc.commissionRate || 0)) / 100; } } else if (patientForm.referralType === 'doctor' && patientForm.doctorName) { doctorName = patientForm.doctorName; }
            const payStatus = dueVal === 0 ? 'paid' : paidVal > 0 ? 'partial' : 'unpaid';
            const orderRef = await db.collection('orders').add({ patientId, patientName: patientForm.fullName, doctorName, doctorId, doctorCommission: commissionAmt, commissionPaid: false, totalAmount: finalAmount, status: 'ordered', paymentStatus: payStatus, testCount: cart.length, createdAt: firebase.firestore.Timestamp.now() });
            const invoiceRef = await db.collection('invoices').add({ orderId: orderRef.id, patientName: patientForm.fullName, amount: finalAmount, discount: payment.discount, paidAmount: paidVal, status: payStatus, createdAt: firebase.firestore.Timestamp.now(), payments: paidVal > 0 ? [{ amount: paidVal, method: payment.method, date: new Date() }] : [] });
            const batch = db.batch();
            cart.forEach(t => { const sRef = db.collection('samples').doc(); batch.set(sRef, { orderId: orderRef.id, patientId, patientName: patientForm.fullName, testId: t.id, testName: t.name, sampleType: t.sampleType, status: 'ordered', createdAt: firebase.firestore.Timestamp.now() }); });
            await batch.commit();
            setPrintData({ invoiceId: invoiceRef.id, patientName: patientForm.fullName, patientPhone: patientForm.phone, age: patientForm.age + ' ' + patientForm.ageUnit, gender: patientForm.gender, date: new Date().toLocaleDateString(), doctor: doctorName, items: [...cart], subtotal: totalAmount, discount: payment.discount, total: finalAmount, paid: paidVal, due: dueVal, paymentMethod: payment.method });
            setCart([]); setPatientForm({ fullName: '', phone: '', age: '', ageUnit: 'Years', gender: 'male', address: '', referralType: 'self', doctorName: '', clinicName: '', existingId: '' }); setPayment({ method: 'cash', paidAmount: '', discount: 0, discountReason: '' }); setSelectedDoctorId('');
        } catch (e) { console.error(e); alert("Failed to book order."); } finally { setLoading(false); }
    };

    const selectPatient = (p: Patient) => { let ageVal = '', ageUnit = 'Years'; if (p.dob) { ageVal = calculateAge(p.dob).toString(); } setPatientForm({ fullName: p.fullName, phone: p.phone, age: ageVal, ageUnit: 'Years', gender: p.gender as any, address: p.address || '', referralType: 'self', doctorName: '', clinicName: '', existingId: p.id }); setSubView('new-order'); };
    const handleRejectSample = async (sample: Sample) => { const reason = prompt("Enter rejection reason (e.g., Hemolyzed, Wrong Tube):"); if (!reason) return; try { await db.collection('samples').doc(sample.id).update({ status: 'ordered', notes: `RECOLLECTION REQUESTED: ${reason}`, rejectedAt: firebase.firestore.Timestamp.now(), rejectedBy: 'Receptionist' }); alert("Sample flagged for recollection."); } catch (e) { console.error(e); alert("Failed to reject sample"); } };

    const renderNewOrder = () => (
        <div className="h-full flex flex-col md:flex-row overflow-hidden">
            <div className="w-full md:w-1/3 bg-white border-r border-slate-200 overflow-y-auto p-6 scrollbar-thin">
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800"><User className="w-5 h-5 text-indigo-600" /> Patient Details</h3>
                <div className="space-y-4">
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone Number</label><div className="flex gap-2"><div className="relative flex-1"><Phone className="w-4 h-4 absolute left-3 top-3 text-slate-400" /><input type="tel" value={patientForm.phone} onChange={e => setPatientForm({ ...patientForm, phone: e.target.value })} onBlur={() => handlePatientSearch(true)} placeholder="Search or Enter Phone" className="w-full pl-9 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" /></div><button onClick={() => handlePatientSearch()} className="bg-indigo-100 text-indigo-600 p-2.5 rounded-lg hover:bg-indigo-200 transition-colors"><Search className="w-4 h-4" /></button></div></div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label><input value={patientForm.fullName} onChange={e => setPatientForm({ ...patientForm, fullName: e.target.value })} placeholder="Patient Name" className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
                    <div className="flex gap-3"><div className="flex-1"><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Age</label><div className="flex"><input type="number" value={patientForm.age} onChange={e => setPatientForm({ ...patientForm, age: e.target.value })} className="w-full p-2.5 border border-r-0 border-slate-200 rounded-l-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /><select value={patientForm.ageUnit} onChange={e => setPatientForm({ ...patientForm, ageUnit: e.target.value })} className="bg-slate-100 border border-slate-200 rounded-r-lg text-xs px-2 outline-none text-slate-600 font-medium"><option>Years</option><option>Months</option><option>Days</option></select></div></div><div className="flex-1"><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Gender</label><select value={patientForm.gender} onChange={e => setPatientForm({ ...patientForm, gender: e.target.value as any })} className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div></div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Referral By</label><div className="flex p-1 bg-slate-100 rounded-lg mb-2"><button onClick={() => setPatientForm({ ...patientForm, referralType: 'self' })} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${patientForm.referralType === 'self' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Self</button><button onClick={() => setPatientForm({ ...patientForm, referralType: 'doctor' })} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${patientForm.referralType === 'doctor' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Doctor</button></div>{patientForm.referralType === 'doctor' && (<div className="animate-in fade-in slide-in-from-top-1 space-y-2"><select value={selectedDoctorId} onChange={(e) => { setSelectedDoctorId(e.target.value); if (e.target.value) setPatientForm({ ...patientForm, doctorName: '' }); }} className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm outline-none"><option value="">-- Select Registered Doctor --</option>{doctors.map(d => <option key={d.id} value={d.id}>{d.name} ({d.clinic})</option>)}</select><p className="text-center text-xs text-slate-400 font-bold">- OR -</p><input value={patientForm.doctorName} onChange={e => { setPatientForm({ ...patientForm, doctorName: e.target.value }); setSelectedDoctorId(''); }} placeholder="Enter Manual Name" className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div>)}</div>
                </div>
                <div className="mt-8 pt-6 border-t border-slate-200"><h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800"><CreditCard className="w-5 h-5 text-indigo-600" /> Payment</h3><div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3"><div className="flex justify-between text-sm text-slate-600"><span>Subtotal ({cart.length} tests)</span><span className="font-mono font-bold">${totalAmount}</span></div><div className="flex justify-between items-center text-sm text-slate-600"><span>Discount</span><div className="flex items-center gap-1"><span className="text-slate-400 font-bold">-</span><input type="number" value={payment.discount} onChange={e => setPayment({ ...payment, discount: parseFloat(e.target.value) || 0 })} className="w-16 p-1 text-right border rounded bg-white font-mono text-xs" /></div></div><div className="flex justify-between items-center text-lg font-bold text-slate-900 pt-3 border-t border-slate-200"><span>Total Payable</span><span>${finalAmount}</span></div></div><div className="mt-4 grid grid-cols-2 gap-3"><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Amount Paid</label><div className="relative"><span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span><input type="number" value={payment.paidAmount} onChange={e => setPayment({ ...payment, paidAmount: e.target.value })} className="w-full pl-6 pr-2 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-green-500 outline-none" /></div></div><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Method</label><select value={payment.method} onChange={e => setPayment({ ...payment, method: e.target.value })} className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none bg-white"><option value="cash">Cash</option><option value="card">Card</option><option value="upi">UPI/Online</option></select></div></div><div className="mt-6"><button onClick={handleBookOrder} disabled={loading || cart.length === 0 || !patientForm.fullName} className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 disabled:shadow-none transition-all flex justify-center items-center gap-2">{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />} Confirm Order</button>{cart.length === 0 && <p className="text-xs text-center text-slate-400 mt-2">Add tests to proceed</p>}</div></div>
            </div>
            <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
                <div className="p-4 bg-white border-b border-slate-200 shadow-sm z-10"><div className="flex flex-col sm:flex-row gap-4 justify-between items-center"><div><h3 className="font-bold text-lg text-slate-800">Test Catalog</h3><p className="text-xs text-slate-500">{cart.length} tests selected</p></div><div className="flex gap-2 w-full sm:w-auto"><div className="relative flex-1 sm:w-64"><Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" /><input value={testSearch} onChange={e => setTestSearch(e.target.value)} placeholder="Search test name or code..." className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div><select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="p-2 border border-slate-200 rounded-lg text-sm outline-none bg-slate-50 max-w-[140px]">{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></div></div></div>
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar"><div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{filteredTests.map(t => { const isSelected = cart.some(c => c.id === t.id); return (<div key={t.id} onClick={() => { if (isSelected) setCart(cart.filter(c => c.id !== t.id)); else setCart([...cart, t]); }} className={`bg-white p-4 rounded-xl border cursor-pointer transition-all group ${isSelected ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/50' : 'border-slate-200 hover:border-indigo-300 hover:shadow-md'}`}><div className="flex justify-between items-start mb-2"><h4 className="font-bold text-sm text-slate-800 line-clamp-2 leading-tight pr-2">{t.name}</h4><div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white group-hover:border-indigo-400'}`}>{isSelected && <Check className="w-3 h-3 text-white" />}</div></div><div className="flex flex-wrap gap-1 mb-3"><span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{t.code}</span><span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{t.sampleType}</span></div><div className="flex justify-between items-end border-t border-slate-100 pt-2 mt-auto"><span className="text-[10px] font-medium text-slate-400">{t.category}</span><span className="font-bold text-slate-800">${t.price}</span></div></div>); })}</div>{filteredTests.length === 0 && (<div className="flex flex-col items-center justify-center h-64 text-slate-400"><FileText className="w-12 h-12 mb-3 opacity-20" /><p>No tests found matching your search.</p></div>)}</div>
            </div>
        </div>
    );

    const renderDashboard = () => (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in p-6">
            <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-4 gap-4"><div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between"><div><p className="text-slate-400 text-xs font-bold uppercase">Today's Orders</p><p className="text-2xl font-bold text-slate-800">{stats.todayOrders}</p></div><div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center"><ClipboardList className="w-5 h-5" /></div></div><div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between"><div><p className="text-slate-400 text-xs font-bold uppercase">Pending Dues</p><p className="text-2xl font-bold text-amber-600">3</p></div><div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center"><AlertCircle className="w-5 h-5" /></div></div><div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between"><div><p className="text-slate-400 text-xs font-bold uppercase">Completed</p><p className="text-2xl font-bold text-green-600">12</p></div><div className="w-10 h-10 bg-green-50 text-green-600 rounded-full flex items-center justify-center"><CheckCircle2 className="w-5 h-5" /></div></div><div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between"><div><p className="text-slate-400 text-xs font-bold uppercase">Revenue Today</p><p className="text-2xl font-bold text-slate-800">${stats.todaySales.toLocaleString()}</p></div><div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center"><DollarSign className="w-5 h-5" /></div></div></div>
            <div className="lg:col-span-2 space-y-6"><div className="grid grid-cols-2 md:grid-cols-3 gap-4"><button onClick={() => setSubView('new-order')} className="p-6 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all text-left group"><div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Plus className="w-6 h-6" /></div><h3 className="font-bold text-lg">Book New Order</h3><p className="text-indigo-200 text-sm mt-1">Register patient & tests</p></button><button onClick={() => setSubView('reports')} className="p-6 bg-white border border-slate-200 rounded-xl hover:border-indigo-200 hover:shadow-md transition-all text-left group"><div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center mb-4"><Printer className="w-6 h-6" /></div><h3 className="font-bold text-slate-800">Print Reports</h3><p className="text-slate-400 text-sm mt-1">View & Print Results</p></button><button onClick={() => setSubView('search-patients')} className="p-6 bg-white border border-slate-200 rounded-xl hover:border-indigo-200 hover:shadow-md transition-all text-left group"><div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center mb-4"><Search className="w-6 h-6" /></div><h3 className="font-bold text-slate-800">Patient Search</h3><p className="text-slate-400 text-sm mt-1">History & records</p></button></div><div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm"><h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Activity className="w-5 h-5 text-indigo-600" /> Live Test Tracker</h3><div className="space-y-4 max-h-[400px] overflow-y-auto">{trackerSamples.map(s => { let statusColor = 'bg-slate-100 text-slate-600'; let statusText = s.status; if (s.status === 'ordered') { statusText = 'Pending Collection'; statusColor = 'bg-gray-100 text-gray-700 border border-gray-200'; } else if (s.status === 'collected') { statusText = 'In Lab / Analyzing'; statusColor = 'bg-blue-50 text-blue-700 border border-blue-100'; } else if (s.status === 'reported') { statusText = 'Ready'; statusColor = 'bg-green-50 text-green-700 border border-green-100'; } else if (s.status === 'rejected') { statusText = 'Rejected'; statusColor = 'bg-red-50 text-red-700 border border-red-100'; } return (<div key={s.id} className="flex gap-4 items-center p-3 hover:bg-slate-50 rounded-lg transition-colors border-b border-slate-50 last:border-0 group/row"><div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">{s.patientName.slice(0, 2).toUpperCase()}</div><div className="flex-1"><p className="text-sm font-bold text-slate-800">{s.patientName}</p><p className="text-xs text-slate-500">{s.testName}</p></div>{s.status === 'collected' ? (<div className="flex items-center gap-2"><span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full whitespace-nowrap ${statusColor}`}>{statusText}</span><button onClick={() => handleRejectSample(s)} className="opacity-0 group-hover/row:opacity-100 p-1.5 text-red-500 hover:bg-red-50 rounded-full transition-all" title="Reject Sample"><XCircle className="w-4 h-4" /></button></div>) : (<span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full whitespace-nowrap ${statusColor}`}>{statusText}</span>)}</div>) })}{trackerSamples.length === 0 && (<p className="text-center text-slate-400 text-sm py-4">No recent test activity.</p>)}</div></div></div>
            <div className="space-y-6"><div className="bg-indigo-50 p-5 rounded-xl border border-indigo-100"><h3 className="font-bold text-indigo-900 mb-2 flex items-center gap-2"><Bell className="w-4 h-4" /> Notifications</h3><div className="space-y-3">{notifications.length > 0 ? notifications.map((n, idx) => (<div key={n.id || idx} className={`flex gap-2 items-start text-sm p-2 rounded border ${n.type === 'alert' ? 'bg-red-50 text-red-800 border-red-100' : 'bg-white/50 text-indigo-800 border-indigo-100'}`}>{n.type === 'alert' ? <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-red-600" /> : <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-indigo-600" />}<span className="leading-snug">{n.text}</span></div>)) : (<p className="text-xs text-indigo-400 italic">No new notifications.</p>)}</div></div></div>
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-slate-50">
            {printData && <PrintInvoiceModal data={printData} onClose={() => setPrintData(null)} />}
            {viewReport && <PrintReportModal data={viewReport} onClose={() => setViewReport(null)} />}
            <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-white shrink-0 shadow-sm z-30"><div className="flex items-center gap-4">{onBack && <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-full"><ArrowRight className="w-5 h-5 rotate-180" /></button>}<h2 className="text-2xl font-bold text-slate-800">Reception Desk</h2><div className="hidden md:flex bg-slate-100 p-1 rounded-lg">{['dashboard', 'new-order', 'history', 'reports', 'search-patients'].map(v => (<button key={v} onClick={() => setSubView(v as any)} className={`px-4 py-1.5 rounded-md text-sm font-bold capitalize transition-all ${subView === v ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{v.replace('-', ' ')}</button>))}</div></div>{subView === 'dashboard' && (<button onClick={() => setSubView('new-order')} className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold shadow hover:bg-indigo-700"><Plus className="w-4 h-4" /> New Order</button>)}</div>
            <div className="flex-1 min-h-0 overflow-hidden relative">{subView === 'dashboard' && <div className="overflow-y-auto h-full pb-20">{renderDashboard()}</div>}{subView === 'new-order' && renderNewOrder()}{subView === 'history' && <div className="overflow-y-auto h-full p-6 pb-20"><OrderHistoryTable /></div>}{subView === 'reports' && <div className="overflow-y-auto h-full p-6 pb-20"><ReceptionReportsTable onPrint={(s) => setViewReport(s)} /></div>}{subView === 'search-patients' && <PatientSearchPanel onSelect={selectPatient} />}</div>
        </div>
    );
};

const PhlebotomyModule: React.FC = () => {
    const [queue, setQueue] = useState<Sample[]>([]);
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [selectedSample, setSelectedSample] = useState<Sample | null>(null);
    const [consumedItems, setConsumedItems] = useState<{ itemId: string, itemName: string, quantity: number }[]>([]);

    useEffect(() => {
        const unsubQueue = db.collection('samples').where('status', '==', 'ordered').onSnapshot(s => setQueue(s.docs.map(d => ({ id: d.id, ...d.data() } as Sample))));
        const unsubInv = db.collection('inventory_items').where('status', '!=', 'out_of_stock').onSnapshot(s => setInventoryItems(s.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem))));
        return () => { unsubQueue(); unsubInv(); };
    }, []);

    const openCollectionModal = async (s: Sample) => {
        setSelectedSample(s); setConsumedItems([]);
        try { const testSnap = await db.collection('tests').doc(s.testId).get(); if (testSnap.exists) { const testData = testSnap.data() as Test; if (testData.inventoryRequirements) { setConsumedItems(testData.inventoryRequirements.map(req => ({ itemId: req.itemId, itemName: req.itemName, quantity: req.quantity }))); } } } catch (e) { console.error("Error fetching test defaults", e); }
    };

    const handleConfirmCollection = async () => {
        if (!selectedSample) return;

        console.log('[PHLEBOTOMY] Starting collection confirmation');
        console.log('[PHLEBOTOMY] Sample:', selectedSample.testName);
        console.log('[PHLEBOTOMY] Consumed items count:', consumedItems.length);
        console.log('[PHLEBOTOMY] Consumed items:', consumedItems);

        if (consumedItems.length === 0) {
            console.warn('[PHLEBOTOMY] WARNING: No inventory items to deduct!');
            alert('Warning: No inventory items selected. Collection will proceed without deducting inventory.');
        }

        try {
            const batch = db.batch();
            const label = generateSampleLabel(selectedSample.orderId, Math.floor(Math.random() * 100));
            const sampleRef = db.collection('samples').doc(selectedSample.id);
            batch.update(sampleRef, {
                status: 'collected',
                collectedAt: firebase.firestore.Timestamp.now(),
                sampleLabelId: label,
                collectorName: auth.currentUser?.email || 'Phlebotomist',
                notes: selectedSample.notes?.includes("RECOLLECTION") ? `Recollected after rejection. ${selectedSample.notes}` : ''
            });

            // Deduct inventory items
            let deductedCount = 0;
            consumedItems.forEach(item => {
                console.log('[PHLEBOTOMY] Processing item:', item.itemName, 'qty:', item.quantity);
                if (item.quantity > 0) {
                    const invItem = inventoryItems.find(i => i.id === item.itemId);
                    if (invItem) {
                        console.log('[PHLEBOTOMY] Found inventory item:', invItem.name, 'current qty:', invItem.quantity);
                        const itemRef = db.collection('inventory_items').doc(item.itemId);
                        batch.update(itemRef, {
                            quantity: firebase.firestore.FieldValue.increment(-item.quantity)
                        });

                        const cost = (invItem.purchasePrice || 0) * item.quantity;
                        const txRef = db.collection('inventory_transactions').doc();
                        batch.set(txRef, {
                            itemId: item.itemId,
                            itemName: item.itemName,
                            type: 'deduction',
                            quantity: -item.quantity,
                            cost,
                            performedBy: auth.currentUser?.uid || 'sys',
                            reason: `Sample Collection: ${selectedSample.testName}`,
                            relatedSampleId: selectedSample.id,
                            relatedTestId: selectedSample.testId,
                            timestamp: firebase.firestore.Timestamp.now()
                        });
                        deductedCount++;
                        console.log('[PHLEBOTOMY] Added deduction to batch for:', item.itemName);
                    } else {
                        console.error('[PHLEBOTOMY] ERROR: Inventory item not found in database:', item.itemId);
                    }
                } else {
                    console.warn('[PHLEBOTOMY] Skipping item with zero quantity:', item.itemName);
                }
            });

            console.log('[PHLEBOTOMY] Total items to deduct:', deductedCount);
            console.log('[PHLEBOTOMY] Committing batch...');
            await batch.commit();
            console.log('[PHLEBOTOMY] ✅ Batch committed successfully!');
            console.log('[PHLEBOTOMY] Collection completed, inventory updated');
            setSelectedSample(null);
        } catch (e) {
            console.error('[PHLEBOTOMY] ❌ Collection failed:', e);
            console.error('[PHLEBOTOMY] Error details:', e instanceof Error ? e.message : String(e));
            alert('Failed to confirm collection. Error: ' + (e instanceof Error ? e.message : String(e)));
        }
    };

    const renderCollectionModal = () => {
        if (!selectedSample) return null;
        return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="p-5 border-b bg-slate-50 flex justify-between items-center"><h3 className="font-bold text-lg text-slate-800">Confirm Collection</h3><button onClick={() => setSelectedSample(null)}><X className="w-5 h-5 text-slate-500" /></button></div>
                    <div className="p-6 overflow-y-auto space-y-6">
                        <div className="bg-indigo-50 p-3 rounded border border-indigo-100"><p className="font-bold text-indigo-900">{selectedSample.patientName}</p><p className="text-sm text-indigo-700">{selectedSample.testName} ({selectedSample.sampleType})</p></div>
                        <div>
                            <h4 className="font-bold text-sm text-slate-700 mb-2 flex items-center gap-2"><Package className="w-4 h-4" /> Consumables Used</h4>
                            <div className="space-y-2 mb-4">{consumedItems.map((item, idx) => (<div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded border border-slate-200"><span className="flex-1 text-sm font-medium">{item.itemName}</span><input type="number" className="w-16 p-1 border rounded text-right text-sm" value={item.quantity} onChange={(e) => { const newItems = [...consumedItems]; newItems[idx].quantity = parseFloat(e.target.value); setConsumedItems(newItems); }} /><button onClick={() => { const newItems = [...consumedItems]; newItems.splice(idx, 1); setConsumedItems(newItems); }} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4" /></button></div>))}{consumedItems.length === 0 && <p className="text-xs text-slate-400 italic">No items selected.</p>}</div>
                            <div className="flex gap-2"><select id="phleb-inv-select" className="flex-1 p-2 border rounded text-sm bg-white"><option value="">Select Item...</option>{inventoryItems.map(i => <option key={i.id} value={i.id}>{i.name} ({i.quantity})</option>)}</select><button onClick={() => { const sel = document.getElementById('phleb-inv-select') as HTMLSelectElement; const item = inventoryItems.find(i => i.id === sel.value); if (item) { setConsumedItems([...consumedItems, { itemId: item.id, itemName: item.name, quantity: 1 }]); } }} className="px-3 py-2 bg-slate-800 text-white rounded text-sm font-bold">Add</button></div>
                        </div>
                    </div>
                    <div className="p-5 border-t bg-slate-50 flex justify-end gap-3"><button onClick={() => setSelectedSample(null)} className="px-4 py-2 text-slate-600 font-bold text-sm">Cancel</button><button onClick={handleConfirmCollection} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-indigo-200 flex items-center gap-2"><QrCode className="w-4 h-4" /> Confirm & Print Label</button></div>
                </div>
            </div>
        );
    };
    return (<div className="p-6 space-y-6 h-full flex flex-col">{renderCollectionModal()}<div className="flex justify-between items-center"><h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Syringe className="w-6 h-6 text-indigo-600" /> Sample Collection</h2><div className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold">{queue.length} Pending</div></div><div className="flex-1 overflow-y-auto"><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{queue.map(s => (<div key={s.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group"><div className="flex justify-between items-start mb-4"><div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">{s.patientName.substring(0, 2).toUpperCase()}</div><span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider">{s.sampleType}</span></div><h4 className="font-bold text-slate-800 truncate" title={s.patientName}>{s.patientName}</h4><p className="text-sm text-slate-500 mb-4 truncate" title={s.testName}>{s.testName}</p>{s.notes && s.notes.includes("RECOLLECTION") && (<div className="mb-4 bg-red-50 p-2 rounded text-xs text-red-600 font-bold border border-red-100">⚠️ {s.notes}</div>)}<div className="pt-4 border-t border-slate-100"><button onClick={() => openCollectionModal(s)} className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4" /> Start Collection</button></div></div>))}{queue.length === 0 && <div className="col-span-full flex flex-col items-center justify-center h-64 text-slate-400 bg-white rounded-xl border border-dashed border-slate-300"><CheckCircle2 className="w-12 h-12 mb-2 opacity-20" /><p>All samples collected.</p></div>}</div></div></div>);
};

const LabTechModule: React.FC = () => {
    const [samples, setSamples] = useState<Sample[]>([]);
    const [testsMap, setTestsMap] = useState<Record<string, Test>>({});
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [selectedSample, setSelectedSample] = useState<Sample | null>(null);
    const [resultsForm, setResultsForm] = useState<Record<string, string>>({});
    const [consumedItems, setConsumedItems] = useState<{ itemId: string, itemName: string, quantity: number }[]>([]);

    useEffect(() => {
        const unsubSamples = db.collection('samples').where('status', 'in', ['collected', 'analyzing']).onSnapshot(s => setSamples(s.docs.map(d => ({ id: d.id, ...d.data() } as Sample))));
        const unsubTests = db.collection('tests').onSnapshot(s => { const map: Record<string, Test> = {}; s.docs.forEach(d => { map[d.id] = { id: d.id, ...d.data() } as Test; }); setTestsMap(map); });
        const unsubInv = db.collection('inventory_items').where('status', '!=', 'out_of_stock').onSnapshot(s => setInventoryItems(s.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem))));
        return () => { unsubSamples(); unsubTests(); unsubInv(); };
    }, []);

    const openResultEntry = (s: Sample) => {
        setSelectedSample(s); setResultsForm(s.results || {});
        const testDef = testsMap[s.testId];
        if (testDef && testDef.inventoryRequirements) { setConsumedItems(testDef.inventoryRequirements.map(req => ({ itemId: req.itemId, itemName: req.itemName, quantity: req.quantity }))); } else { setConsumedItems([]); }
    };

    const handleSaveResults = async () => {
        if (!selectedSample) return;
        try {
            const batch = db.batch();
            const sampleRef = db.collection('samples').doc(selectedSample.id);
            batch.update(sampleRef, { status: 'review', results: resultsForm });

            // Deduct inventory items (FIXED: using FieldValue.increment for atomic updates)
            consumedItems.forEach(item => {
                if (item.quantity > 0) {
                    const invItem = inventoryItems.find(i => i.id === item.itemId);
                    if (invItem) {
                        const itemRef = db.collection('inventory_items').doc(item.itemId);
                        // Use atomic increment instead of manual calculation
                        batch.update(itemRef, {
                            quantity: firebase.firestore.FieldValue.increment(-item.quantity)
                        });

                        const cost = (invItem.purchasePrice || 0) * item.quantity;
                        const txRef = db.collection('inventory_transactions').doc();
                        batch.set(txRef, {
                            itemId: item.itemId,
                            itemName: item.itemName,
                            type: 'deduction',
                            quantity: -item.quantity,
                            cost,
                            performedBy: auth.currentUser?.uid || 'sys',
                            reason: `Test Analysis: ${selectedSample.testName}`,
                            relatedSampleId: selectedSample.id,
                            relatedTestId: selectedSample.testId,
                            timestamp: firebase.firestore.Timestamp.now()
                        });
                    }
                }
            });

            await batch.commit();
            setSelectedSample(null);
        } catch (e) {
            console.error('Save results failed:', e);
            alert("Error saving results: " + (e instanceof Error ? e.message : String(e)));
        }
    };

    const renderResultForm = () => {
        if (!selectedSample) return null;
        const testDef = testsMap[selectedSample.testId];
        if (!testDef) return <div className="p-4 text-center"><p>Test definition not found.</p><button onClick={() => setSelectedSample(null)}>Close</button></div>;
        return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50"><div><h3 className="font-bold text-lg text-slate-800">Enter Results</h3><p className="text-xs text-slate-500 font-bold uppercase">{selectedSample.testName}</p></div><button onClick={() => setSelectedSample(null)} className="p-2 hover:bg-slate-200 rounded-full"><X className="w-5 h-5" /></button></div>
                    <div className="p-6 overflow-y-auto flex-1 space-y-6">
                        <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100 mb-4"><p className="text-xs font-bold text-indigo-800">Sample ID: <span className="font-mono">{selectedSample.sampleLabelId}</span></p><p className="text-xs text-indigo-700">Patient: {selectedSample.patientName} ({selectedSample.patientAge} / {selectedSample.patientGender})</p></div>
                        {(!testDef.parameters || testDef.parameters.length === 0) ? (<div className="text-center py-4"><p className="text-slate-500 mb-2">No specific parameters defined.</p><textarea className="w-full border rounded p-2" placeholder="Enter general result text..." value={resultsForm['main'] || ''} onChange={e => setResultsForm({ ...resultsForm, 'main': e.target.value })} /></div>) : (testDef.parameters.map(param => (<div key={param.id}><div className="flex justify-between mb-1"><label className="text-sm font-bold text-slate-700">{param.name}</label><span className="text-xs text-slate-400 font-mono">{param.unit}</span></div>{param.type === 'dropdown' && param.options ? (<select className="w-full p-2 border border-slate-200 rounded-lg" value={resultsForm[param.name] || ''} onChange={e => setResultsForm({ ...resultsForm, [param.name]: e.target.value })}><option value="">Select...</option>{param.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select>) : (<input type={param.type === 'numeric' ? 'number' : 'text'} className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" placeholder={`Enter ${param.name}`} value={resultsForm[param.name] || ''} onChange={e => setResultsForm({ ...resultsForm, [param.name]: e.target.value })} />)}</div>)))}
                        <div className="pt-4 border-t border-slate-100"><h4 className="font-bold text-sm text-slate-700 mb-2 flex items-center gap-2"><Package className="w-4 h-4" /> Inventory Used</h4><div className="space-y-2 mb-4">{consumedItems.map((item, idx) => (<div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded border border-slate-200"><span className="flex-1 text-sm font-medium">{item.itemName}</span><input type="number" className="w-16 p-1 border rounded text-right text-sm" value={item.quantity} onChange={(e) => { const newItems = [...consumedItems]; newItems[idx].quantity = parseFloat(e.target.value); setConsumedItems(newItems); }} /><button onClick={() => { const newItems = [...consumedItems]; newItems.splice(idx, 1); setConsumedItems(newItems); }} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4" /></button></div>))}</div><div className="flex gap-2"><select id="tech-inv-select" className="flex-1 p-2 border rounded text-sm bg-white"><option value="">Select Item...</option>{inventoryItems.map(i => <option key={i.id} value={i.id}>{i.name} ({i.quantity})</option>)}</select><button onClick={() => { const sel = document.getElementById('tech-inv-select') as HTMLSelectElement; const item = inventoryItems.find(i => i.id === sel.value); if (item) { setConsumedItems([...consumedItems, { itemId: item.id, itemName: item.name, quantity: 1 }]); } }} className="px-3 py-2 bg-slate-800 text-white rounded text-sm font-bold">Add</button></div></div>
                    </div>
                    <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50"><button onClick={() => setSelectedSample(null)} className="px-4 py-2 text-slate-600 font-bold text-sm">Cancel</button><button onClick={handleSaveResults} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-200">Save & Submit</button></div>
                </div>
            </div>
        );
    }
    return (<div className="p-6 space-y-6 h-full flex flex-col">{renderResultForm()}<h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Microscope className="w-6 h-6 text-indigo-600" /> Lab Processing</h2><div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col"><div className="overflow-y-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 border-b sticky top-0 z-10"><tr><th className="p-4">Sample ID</th><th className="p-4">Test</th><th className="p-4">Patient</th><th className="p-4">Status</th><th className="p-4 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{samples.map(s => (<tr key={s.id} className="hover:bg-slate-50"><td className="p-4 font-mono font-bold text-slate-600">{s.sampleLabelId || '---'}</td><td className="p-4 font-bold text-slate-800">{s.testName}</td><td className="p-4">{s.patientName}</td><td className="p-4"><span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">{s.status}</span></td><td className="p-4 text-right"><button onClick={() => openResultEntry(s)} className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-600 hover:text-white transition-colors">Enter Results</button></td></tr>))}{samples.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">No samples to process.</td></tr>}</tbody></table></div></div></div>);
};

const PathologistModule: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'review' | 'upcoming'>('review');
    const [reviews, setReviews] = useState<Sample[]>([]);
    const [upcoming, setUpcoming] = useState<Sample[]>([]);
    const [selectedSample, setSelectedSample] = useState<Sample | null>(null);
    const [loadingAction, setLoadingAction] = useState(false);
    const [remarks, setRemarks] = useState('');
    const [conclusion, setConclusion] = useState('');
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const [previewData, setPreviewData] = useState<Sample | null>(null);

    useEffect(() => {
        const unsubReview = db.collection('samples').where('status', '==', 'review').onSnapshot(snap => setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() } as Sample))));
        const unsubUpcoming = db.collection('samples').where('status', 'in', ['ordered', 'collected', 'analyzing']).onSnapshot(snap => setUpcoming(snap.docs.map(d => ({ id: d.id, ...d.data() } as Sample))));
        return () => { unsubReview(); unsubUpcoming(); };
    }, []);

    const openReviewModal = (s: Sample) => { setSelectedSample(s); setRemarks(s.pathologistRemarks || ''); setConclusion(s.conclusion || ''); };
    const closeReviewModal = () => { setSelectedSample(null); setRemarks(''); setConclusion(''); };

    const handleApprove = async () => { if (!selectedSample) return; setLoadingAction(true); try { await db.collection('samples').doc(selectedSample.id).update({ status: 'reported', verifiedBy: auth.currentUser?.email || 'Pathologist', reportedAt: firebase.firestore.Timestamp.now(), pathologistRemarks: remarks, conclusion: conclusion }); closeReviewModal(); } catch (e) { console.error(e); } finally { setLoadingAction(false); } };
    const handleReject = async () => { if (!selectedSample) return; if (!window.confirm("Reject this result and send back to Technician?")) return; setLoadingAction(true); try { await db.collection('samples').doc(selectedSample.id).update({ status: 'analyzing', notes: 'Result rejected by Pathologist. Please re-run.' }); closeReviewModal(); } catch (e) { console.error(e); } finally { setLoadingAction(false); } };
    const generateAIConclusion = async () => { if (!selectedSample) return; setIsGeneratingAI(true); try { const ai = new GoogleGenAI({ apiKey: process.env.API_KEY }); const prompt = `Act as a clinical pathologist. Analyze the following lab results for test "${selectedSample.testName}". Results: ${JSON.stringify(selectedSample.results)}. Patient Age: ${selectedSample.patientAge}, Gender: ${selectedSample.patientGender}. Provide a professional, concise medical conclusion (max 3 sentences) and a separate short remark if necessary. Format: JSON with keys "conclusion" and "remark".`; const result = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt }); const text = result.response.text; try { const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim(); const data = JSON.parse(jsonStr); if (data.conclusion) setConclusion(data.conclusion); if (data.remark) setRemarks(data.remark); } catch (parseError) { setConclusion(text); } } catch (error) { console.error("AI Error:", error); alert("AI Generation failed. Please try again or type manually."); } finally { setIsGeneratingAI(false); } };
    const handlePreview = () => { if (!selectedSample) return; setPreviewData({ ...selectedSample, pathologistRemarks: remarks, conclusion: conclusion }); };

    return (
        <div className="p-6 space-y-6 h-full flex flex-col">
            {previewData && <PrintReportModal data={previewData} onClose={() => setPreviewData(null)} />}
            <div className="flex justify-between items-center"><h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><FileCheck className="w-6 h-6 text-indigo-600" /> Pathologist Verification</h2><div className="bg-slate-100 p-1 rounded-lg flex gap-1"><button onClick={() => setActiveTab('review')} className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${activeTab === 'review' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Pending Review ({reviews.length})</button><button onClick={() => setActiveTab('upcoming')} className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${activeTab === 'upcoming' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Upcoming Work ({upcoming.length})</button></div></div>
            <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col"><div className="overflow-y-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 border-b sticky top-0 z-10"><tr><th className="p-4">Sample ID</th><th className="p-4">Patient</th><th className="p-4">Test</th><th className="p-4">Status</th><th className="p-4 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{(activeTab === 'review' ? reviews : upcoming).map(s => (<tr key={s.id} className="hover:bg-slate-50 group"><td className="p-4 font-mono text-xs text-slate-500">{s.sampleLabelId || s.id.slice(0, 6)}</td><td className="p-4 font-bold text-slate-800">{s.patientName}</td><td className="p-4"><p className="font-bold">{s.testName}</p><p className="text-xs text-slate-500">{s.sampleType}</p></td><td className="p-4"><span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${s.status === 'review' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{s.status === 'review' ? 'Waiting Approval' : s.status}</span></td><td className="p-4 text-right">{activeTab === 'review' && (<button onClick={() => openReviewModal(s)} className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-600 hover:text-white transition-colors">Review & Approve</button>)}</td></tr>))}{(activeTab === 'review' ? reviews : upcoming).length === 0 && <tr><td colSpan={5} className="p-10 text-center text-slate-400">No samples found.</td></tr>}</tbody></table></div></div>
            {selectedSample && (<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"><div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col"><div className="flex justify-between items-center p-6 border-b border-slate-100"><div><h3 className="text-xl font-bold text-slate-800">Review Sample Result</h3><p className="text-sm text-slate-500">{selectedSample.sampleLabelId} • {selectedSample.patientName}</p></div><button onClick={closeReviewModal} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-5 h-5 text-slate-500" /></button></div><div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-8"><div className="space-y-6"><div className="bg-slate-50 p-4 rounded-lg border border-slate-200"><h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><List className="w-4 h-4" /> Technical Results</h4><table className="w-full text-sm"><tbody className="divide-y divide-slate-200 border-t border-slate-200">{selectedSample.results && Object.entries(selectedSample.results).map(([key, val]) => (<tr key={key}><td className="py-2 text-slate-600 font-medium">{key}</td><td className="py-2 text-right font-bold text-slate-900">{val}</td></tr>))}</tbody></table></div><div className="text-xs text-slate-400"><p>Patient ID: {selectedSample.patientId}</p><p>Age/Gender: {selectedSample.patientAge}/{selectedSample.patientGender}</p><p>Collected: {formatDate(selectedSample.collectedAt)}</p></div></div><div className="space-y-4 flex flex-col h-full"><div className="flex justify-between items-center"><h4 className="font-bold text-slate-700">Clinical Evaluation</h4><button onClick={generateAIConclusion} disabled={isGeneratingAI} className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded border border-purple-100 font-bold flex items-center gap-1 hover:bg-purple-100">{isGeneratingAI ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Auto-Generate</button></div><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Conclusion / Impression</label><textarea className="w-full p-3 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none" placeholder="Enter medical conclusion..." value={conclusion} onChange={e => setConclusion(e.target.value)} /></div><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Remarks (Optional)</label><textarea className="w-full p-3 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none h-20 resize-none" placeholder="Any additional notes..." value={remarks} onChange={e => setRemarks(e.target.value)} /></div><div className="mt-auto pt-6 border-t border-slate-100 flex gap-3 justify-end"><button onClick={handleReject} disabled={loadingAction} className="px-4 py-2 border border-red-200 text-red-600 rounded-lg font-bold text-sm hover:bg-red-50">Reject</button><button onClick={handlePreview} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-bold text-sm hover:bg-slate-50 flex items-center gap-2"><Eye className="w-4 h-4" /> Preview Report</button><button onClick={handleApprove} disabled={loadingAction} className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold text-sm hover:bg-green-700 shadow-lg shadow-green-200 flex items-center gap-2">{loadingAction ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Approve & Publish</button></div></div></div></div></div>)}
        </div>
    );
};

const Sidebar: React.FC<{ role: Role, userId: string, currentView: ViewState, onChangeView: (v: ViewState) => void, onLogout: () => void, onRequestInventory: () => void }> = ({ role, userId, currentView, onChangeView, onLogout, onRequestInventory }) => {
    const menuItems = PERMISSIONS[role] || [];
    const [pendingReleaseCount, setPendingReleaseCount] = useState(0);
    useEffect(() => { const unsub = db.collection('inventory_requests').where('requesterId', '==', userId).where('status', '==', 'released').onSnapshot(snap => setPendingReleaseCount(snap.size)); return () => unsub(); }, [userId]);
    const getIcon = (v: ViewState) => { switch (v) { case 'dashboard': return LayoutDashboard; case 'patients': return Users; case 'reception': return Bell; case 'collection': return Syringe; case 'lab_tech': return Microscope; case 'lab_path': return FileCheck; case 'finance': return DollarSign; case 'inventory': return Package; case 'settings': return Settings; default: return CheckCircle2; } };
    const getLabel = (v: ViewState) => { if (v.startsWith('admin_')) return v.replace('admin_', 'Mgmt: '); if (v === 'finance') return 'Finance & Billing'; return v.replace('_', ' '); };
    return (
        <div className="w-64 bg-slate-900 text-slate-300 flex flex-col h-full shrink-0 transition-all duration-300">
            <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800"><div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-900/50">L</div><span className="font-bold text-white text-lg tracking-tight">LabPro</span></div>
            <div className="flex-1 py-6 px-3 space-y-1 overflow-y-auto custom-scrollbar"><p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Main Menu</p>{menuItems.map(item => { if (item.startsWith('admin_')) return null; const Icon = getIcon(item); return (<button key={item} onClick={() => onChangeView(item)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${currentView === item ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'hover:bg-slate-800 hover:text-white'}`}><Icon className="w-5 h-5 opacity-80" /><span className="capitalize">{getLabel(item)}</span></button>); })}<div className="pt-2 mt-2 border-t border-slate-800/50"><button onClick={onRequestInventory} className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-all group"><div className="flex items-center gap-3"><Truck className="w-5 h-5 opacity-80" /><span>Request Inventory</span></div>{pendingReleaseCount > 0 && (<span className="bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold shadow-md animate-pulse">{pendingReleaseCount}</span>)}</button></div>{(role === 'admin' || role === 'inventory_manager' || role === 'accountant') && (<><div className="my-4 border-t border-slate-800/50 mx-3"></div><p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Administration</p>{PERMISSIONS[role].filter(p => p.startsWith('admin_')).map(item => { const Icon = item === 'admin_finance' ? DollarSign : item === 'admin_users' ? Users : item === 'admin_tests' ? FlaskConical : item === 'admin_reports' ? FileBarChart : item === 'admin_logs' ? Shield : Settings; return (<button key={item} onClick={() => onChangeView(item as ViewState)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${currentView === item ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'hover:bg-slate-800 hover:text-white'}`}><Icon className="w-5 h-5 opacity-80" /><span>{getLabel(item)}</span></button>) })}</>)}</div>
            <div className="p-4 border-t border-slate-800 bg-slate-900/50"><button onClick={onLogout} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"><LogOut className="w-4 h-4" /><span>Sign Out</span></button></div>
        </div>
    );
};


// Dialog Context for global access
interface DialogContextType {
    showAlert: (type: 'success' | 'error' | 'warning' | 'info', message: string, title?: string) => void;
    showConfirm: (message: string, options?: { title?: string; confirmText?: string; cancelText?: string; type?: 'danger' | 'primary' | 'warning' }) => Promise<boolean>;
    showPrompt: (message: string, options?: { title?: string; defaultValue?: string; placeholder?: string }) => Promise<string | null>;
    showToast: (type: ToastType, message: string) => void;
}

const DialogContext = React.createContext<DialogContextType | null>(null);

export const useDialog = () => {
    const context = React.useContext(DialogContext);
    if (!context) throw new Error('useDialog must be used within DialogProvider');
    return context;
};

const App: React.FC = () => {
    const [user, setUser] = useState<any>(null);
    const [role, setRole] = useState<Role | null>(null);
    const [currentView, setCurrentView] = useState<ViewState>('dashboard');
    const [loading, setLoading] = useState(true);
    const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);

    // Dialog State Management
    const [alertDialog, setAlertDialog] = useState<{ isOpen: boolean; type: 'success' | 'error' | 'warning' | 'info'; message: string; title?: string }>({
        isOpen: false, type: 'info', message: ''
    });
    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean; message: string; title?: string; confirmText?: string; cancelText?: string; type?: 'danger' | 'primary' | 'warning';
        onConfirm: () => void; onCancel: () => void;
    }>({
        isOpen: false, message: '', onConfirm: () => { }, onCancel: () => { }
    });
    const [promptDialog, setPromptDialog] = useState<{
        isOpen: boolean; message: string; title?: string; defaultValue?: string; placeholder?: string;
        onConfirm: (value: string) => void; onCancel: () => void;
    }>({
        isOpen: false, message: '', defaultValue: '', onConfirm: () => { }, onCancel: () => { }
    });
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    // Dialog Wrapper Functions
    const showAlert = (type: 'success' | 'error' | 'warning' | 'info', message: string, title?: string) => {
        setAlertDialog({ isOpen: true, type, message, title });
    };

    const showConfirm = (message: string, options?: { title?: string; confirmText?: string; cancelText?: string; type?: 'danger' | 'primary' | 'warning' }): Promise<boolean> => {
        return new Promise((resolve) => {
            setConfirmDialog({
                isOpen: true,
                message,
                title: options?.title,
                confirmText: options?.confirmText,
                cancelText: options?.cancelText,
                type: options?.type,
                onConfirm: () => {
                    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                    resolve(true);
                },
                onCancel: () => {
                    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                    resolve(false);
                }
            });
        });
    };

    const showPrompt = (message: string, options?: { title?: string; defaultValue?: string; placeholder?: string }): Promise<string | null> => {
        return new Promise((resolve) => {
            setPromptDialog({
                isOpen: true,
                message,
                title: options?.title,
                defaultValue: options?.defaultValue || '',
                placeholder: options?.placeholder,
                onConfirm: (value) => {
                    setPromptDialog(prev => ({ ...prev, isOpen: false }));
                    resolve(value);
                },
                onCancel: () => {
                    setPromptDialog(prev => ({ ...prev, isOpen: false }));
                    resolve(null);
                }
            });
        });
    };

    const showToast = (type: ToastType, message: string) => {
        const id = Date.now().toString() + Math.random().toString(36);
        setToasts(prev => [...prev, { id, type, message }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    };

    const closeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const dialogFunctions: DialogContextType = { showAlert, showConfirm, showPrompt, showToast };

    useEffect(() => {
        const unsub = auth.onAuthStateChanged((u) => {
            if (!u) {
                setUser(null);
                setRole(null);
            } else {
                setUser(u);
                const savedRole = localStorage.getItem('labpro_role') as Role;
                const savedView = localStorage.getItem('labpro_view') as ViewState;

                if (savedRole && AVAILABLE_ROLES.some(r => r.id === savedRole)) {
                    setRole(savedRole);
                    // Restore last viewed panel
                    if (savedView && PERMISSIONS[savedRole]?.includes(savedView)) {
                        setCurrentView(savedView);
                    }
                } else {
                    setRole(null);
                }
            }
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleLoginSuccess = (r: Role, u: any) => {
        setRole(r);
        setUser(u);
        setCurrentView('dashboard');
        localStorage.setItem('labpro_role', r);
        localStorage.setItem('labpro_view', 'dashboard');
    };

    const handleLogout = () => {
        auth.signOut();
        localStorage.removeItem('labpro_role');
        localStorage.removeItem('labpro_view');
        setUser(null);
        setRole(null);
        setCurrentView('dashboard');
    };

    // Save current view to localStorage whenever it changes
    useEffect(() => {
        if (role && currentView) {
            localStorage.setItem('labpro_view', currentView);
        }
    }, [currentView, role]);

    if (loading) return <div className="h-screen w-full flex items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 text-indigo-600 animate-spin" /></div>;
    if (!user || !role) return <LandingPage onLoginSuccess={handleLoginSuccess} />;

    return (
        <DialogContext.Provider value={dialogFunctions}>
            {/* Dialog Components */}
            <CustomAlert
                isOpen={alertDialog.isOpen}
                type={alertDialog.type}
                title={alertDialog.title}
                message={alertDialog.message}
                onClose={() => setAlertDialog(prev => ({ ...prev, isOpen: false }))}
            />
            <CustomConfirm
                isOpen={confirmDialog.isOpen}
                title={confirmDialog.title}
                message={confirmDialog.message}
                confirmText={confirmDialog.confirmText}
                cancelText={confirmDialog.cancelText}
                type={confirmDialog.type}
                onConfirm={confirmDialog.onConfirm}
                onCancel={confirmDialog.onCancel}
            />
            <CustomPrompt
                isOpen={promptDialog.isOpen}
                title={promptDialog.title}
                message={promptDialog.message}
                defaultValue={promptDialog.defaultValue}
                placeholder={promptDialog.placeholder}
                onConfirm={promptDialog.onConfirm}
                onCancel={promptDialog.onCancel}
            />
            <ToastContainer toasts={toasts} onClose={closeToast} />

            <div className="flex h-screen w-full bg-slate-100 font-sans text-slate-900 overflow-hidden">
                <InventoryRequestModal isOpen={isInventoryModalOpen} onClose={() => setIsInventoryModalOpen(false)} userId={user.uid} userName={user.username || user.email || 'User'} userRole={role} />
                <Sidebar role={role} userId={user.uid} currentView={currentView} onChangeView={setCurrentView} onLogout={handleLogout} onRequestInventory={() => setIsInventoryModalOpen(true)} />
                <main className="flex-1 h-full overflow-hidden relative flex flex-col">
                    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 shadow-sm z-20">
                        <h1 className="text-xl font-bold text-slate-800 capitalize flex items-center gap-2">{currentView === 'dashboard' ? <LayoutDashboard className="w-5 h-5 text-indigo-600" /> : currentView === 'patients' ? <Users className="w-5 h-5 text-indigo-600" /> : <div className="w-2 h-2 rounded-full bg-indigo-600"></div>}{currentView === 'finance' ? 'Finance & Billing' : currentView.replace(/_/g, ' ')}</h1>
                        <div className="flex items-center gap-4"><div className="text-right hidden sm:block"><p className="text-sm font-bold text-slate-800">{user.username || user.email}</p><p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{AVAILABLE_ROLES.find(r => r.id === role)?.label || role}</p></div><div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold border border-indigo-200">{(user.username || user.email)?.[0]?.toUpperCase() || 'U'}</div></div>
                    </header>
                    <div className="flex-1 overflow-auto p-0 relative">
                        {currentView === 'dashboard' && <div className="p-6"><DashboardModule role={role} /></div>}
                        {currentView === 'patients' && <div className="p-6"><PatientsModule /></div>}
                        {currentView === 'reception' && <ReceptionModule />}
                        {currentView === 'collection' && <PhlebotomyModule />}
                        {currentView === 'lab_tech' && <LabTechModule />}
                        {currentView === 'lab_path' && <PathologistModule />}
                        {currentView === 'inventory' && <InventoryModule role={role} />}
                        {currentView === 'finance' && <FinanceModule />}
                        {currentView === 'admin_users' && <div className="p-6"><AdminUsers onBack={() => setCurrentView('dashboard')} /></div>}
                        {currentView === 'admin_tests' && <div className="h-full"><TestManagementModule onBack={() => setCurrentView('dashboard')} /></div>}
                        {currentView === 'admin_finance' && <div className="p-6"><AdminFinance onBack={() => setCurrentView('dashboard')} /></div>}
                        {currentView === 'admin_reports' && <div className="p-6"><AdminReports onBack={() => setCurrentView('dashboard')} /></div>}
                        {currentView === 'admin_logs' && <div className="p-6"><AdminLogs onBack={() => setCurrentView('dashboard')} /></div>}
                        {currentView === 'admin_settings' && <div className="p-6"><AdminSettings onBack={() => setCurrentView('dashboard')} /></div>}
                    </div>
                </main>
            </div>
        </DialogContext.Provider>
    );
};

export default App;

