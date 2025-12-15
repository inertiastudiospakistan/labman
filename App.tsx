
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate, Outlet } from 'react-router-dom';
import firebase from 'firebase/compat/app';
import { db, auth } from './firebase';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
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
    ArrowLeft, // Added missing import
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
    FileSpreadsheet,
    ScrollText
} from 'lucide-react';

// --- Global Helpers ---
const formatDate = (date: any) => {
    if (!date) return '--';
    try {
        if (date?.toDate && typeof date.toDate === 'function') return date.toDate().toLocaleString();
        if (date instanceof Date) return date.toLocaleString();
        const d = new Date(date);
        return isNaN(d.getTime()) ? '--' : d.toLocaleString();
    } catch (e) { return '--'; }
};

const formatTimeSafe = (date: any) => {
    if (!date) return '--:--';
    try {
        const d = date.toDate ? date.toDate() : new Date(date);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return '--:--'; }
};

// --- Error Boundary Component ---
class ErrorBoundary extends React.Component<any, any> {
    state = { hasError: false }; // Property initializer

    static getDerivedStateFromError(error: any) {
        return { hasError: true };
    }

    componentDidCatch(error: any, errorInfo: any) {
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return <div className="p-8 text-center text-red-500">Something went wrong in this module. Please refresh or contact support.</div>;
        }

        return this.props.children;
    }
}
const calculateAge = (dobString: string) => {
    if (!dobString) return 0;
    const dob = new Date(dobString);
    const diff_ms = Date.now() - dob.getTime();
    const age_dt = new Date(diff_ms);
    return Math.abs(age_dt.getUTCFullYear() - 1970);
};

// --- SAFE FIRESTORE WRAPPER ---
// Wraps Firestore operations to prevent crashes from internal assertion errors
const safeFirestore = {
    query: (query: any) => {
        try {
            return query;
        } catch (error) {
            console.error('Firestore query error:', error);
            return null;
        }
    },
    onSnapshot: (query: any, onNext: Function, onError?: Function) => {
        try {
            return query.onSnapshot(
                (snapshot: any) => {
                    try {
                        onNext(snapshot);
                    } catch (err) {
                        console.error('Snapshot handler error:', err);
                        if (onError) onError(err);
                    }
                },
                (error: any) => {
                    console.error('Firestore snapshot error:', error);
                    if (onError) onError(error);
                }
            );
        } catch (error) {
            console.error('Firestore onSnapshot setup error:', error);
            return () => { }; // Return noop unsubscribe
        }
    }
};

// --- Custom Dialog & Notification System ---

// --- THEME & UI CONSTANTS ---
// Medical Software Color Palette
// Based on healthcare industry standards: calming blues/teals, high contrast, accessible
const COLORS = {
    // Backgrounds
    RICH_BLACK: '#F0F9FF',        // Main Background (Soft Sky Blue - calming)
    MIDNIGHT_GREEN: '#FFFFFF',    // Cards/Panels (Pure White - clean, sterile)

    // Primary Actions & Accents
    PERSIAN_GREEN: '#0EA5E9',     // Primary Buttons/Borders (Sky Blue - medical trust)
    GAMBOGE: '#0EA5E9',           // Primary Action (Sky Blue)

    // Secondary Actions
    ALLOY_ORANGE: '#06B6D4',      // Secondary Buttons (Cyan - medical professional)

    // Text & Icons
    CITRON: '#0F172A',            // Primary Text (Dark Slate - high contrast)
    TIFFANY_BLUE: '#334155',      // Secondary Text/Icons (Medium Slate)

    // Semantic Colors (Medical Standard) - High Contrast / Readable
    RUST: '#B91C1C',              // Error/Critical (Dark Red)
    RUFOUS: '#991B1B',            // Error Hover (Deep Red)
    RUBY_RED: '#7F1D1D',          // Critical Alert (Darkest Red)

    // Additional Medical Colors
    SUCCESS: '#15803d',           // Success/Normal (Dark Green - WCAG compliant)
    WARNING: '#c2410c',           // Warning (Dark Orange/Amber - WCAG compliant)
    INFO: '#1d4ed8',              // Information (Dark Blue - WCAG compliant)
};

const TopBar: React.FC<{ user: any, onLogout: () => void }> = ({ user, onLogout }) => {
    const navigate = useNavigate();
    const location = useLocation();

    // Determine active tab based on current path
    const getActiveTab = (pathname: string) => {
        if (pathname === '/' || pathname === '/dashboard') return 'dashboard';
        // Remove leading slash
        return pathname.substring(1);
    };

    const activeTab = getActiveTab(location.pathname);

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'reception', label: 'Reception', icon: ClipboardList },
        { id: 'collection', label: 'Phlebotomy', icon: Syringe },
        { id: 'lab_tech', label: 'Technician', icon: Microscope },
        { id: 'lab_path', label: 'Pathologist', icon: FileCheck },
        { id: 'finance', label: 'Finance', icon: DollarSign },
        { id: 'inventory', label: 'Inventory', icon: Package },
        // Admin items are handled separately or via dashboard, but we can't fit them all in top bar easily
        // keeping mostly primary modules
    ];

    // Filter nav items based on user role roughly (optional, but good for UX)
    // For now, consistent with previous TopBar, show all?
    // Previous TopBar showed: dashboard, reception, phlebotomy, lab-tech, pathologist, admin.
    // Let's stick to the visible ones from the original list + Admin if role is admin.

    const visibleNavItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'reception', label: 'Reception', icon: ClipboardList },
        { id: 'collection', label: 'Phlebotomy', icon: Syringe },
        { id: 'lab_tech', label: 'Technician', icon: Microscope },
        { id: 'lab_path', label: 'Pathologist', icon: FileCheck },
        { id: 'admin', label: 'Admin', icon: Settings },
    ];

    return (
        <div className="w-full h-16 flex items-center justify-between px-6 shadow-md z-50 shrink-0" style={{ backgroundColor: COLORS.RICH_BLACK, borderBottom: `1px solid ${COLORS.MIDNIGHT_GREEN}` }}>
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/dashboard')}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transform transition-transform hover:scale-105" style={{ backgroundColor: COLORS.PERSIAN_GREEN }}>
                    <Activity className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h1 className="text-xl font-bold tracking-tight" style={{ color: COLORS.TIFFANY_BLUE }}>LabPro <span style={{ color: COLORS.GAMBOGE }}>Plus</span></h1>
                    <p className="text-[10px] uppercase tracking-widest font-bold opacity-60" style={{ color: COLORS.CITRON }}>Diagnostic OS</p>
                </div>
            </div>

            <div className="flex items-center gap-2 p-1.5 rounded-full border backdrop-blur-sm" style={{ backgroundColor: `${COLORS.MIDNIGHT_GREEN}`, borderColor: `${COLORS.PERSIAN_GREEN}40` }}>
                {visibleNavItems.map(item => {
                    const isActive = activeTab === item.id || (item.id === 'admin' && activeTab.startsWith('admin_'));
                    return (
                        <button
                            key={item.id}
                            onClick={() => navigate(`/${item.id === 'dashboard' ? '' : item.id}`)} // Redirect to specific route
                            className={`px-4 py-2 rounded-full flex items-center gap-2 text-sm font-bold transition-all duration-300 ${isActive ? 'shadow-md transform scale-105' : ''}`}
                            style={{
                                backgroundColor: isActive ? COLORS.PERSIAN_GREEN : 'transparent',
                                color: isActive ? '#fff' : COLORS.TIFFANY_BLUE
                            }}
                            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = `${COLORS.PERSIAN_GREEN}15`; }}
                            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                            <item.icon className={`w-4 h-4 ${isActive ? 'animate-pulse' : ''}`} />
                            <span className="hidden xl:inline">{item.label}</span>
                        </button>
                    );
                })}
            </div>

            <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                    <p className="text-sm font-bold truncate max-w-[150px]" style={{ color: COLORS.CITRON }}>{user?.email}</p>
                    <p className="text-xs opacity-70" style={{ color: COLORS.TIFFANY_BLUE }}>{user?.role || 'Staff'}</p>
                </div>
                <button
                    onClick={onLogout}
                    className="p-2 rounded-full hover:bg-red-500/20 transition-colors group"
                    title="Logout"
                >
                    <LogOut className="w-5 h-5 group-hover:text-red-400" style={{ color: COLORS.RUST }} />
                </button>
            </div>
        </div>
    );
};


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
                    success: 'bg-green-100 border-green-300 text-green-900',
                    error: 'bg-red-100 border-red-300 text-red-900',
                    warning: 'bg-amber-100 border-amber-300 text-amber-900',
                    info: 'bg-blue-100 border-blue-300 text-blue-900'
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
        success: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
        error: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
        warning: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
        info: { icon: Info, color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-200' }
    };

    const config = typeConfig[type] || typeConfig.info;
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
    max?: number; // Normal range High
    criticalMin?: number; // Critical Low
    criticalMax?: number; // Critical High
    safeMin?: number; // Safe Low (for auto-validation block)
    safeMax?: number; // Safe High
    textVal?: string;
}

interface TestParameter {
    id: string;
    name: string;
    unit: string;
    type: 'numeric' | 'text' | 'dropdown' | 'boolean';
    options?: string[]; // For dropdown
    refRanges: ReferenceRange[];
    isMandatory?: boolean; // New: Mandatory check
    notes?: string;
}

interface Test {
    id: string;
    code: string;
    name: string;
    description?: string;
    category: string;
    isActive: boolean;

    // Pricing
    price: number; // Customer Price
    labCost?: number; // Internal Cost
    urgentPrice?: number; // Optional urgent fee
    homeCollectionPrice?: number; // Optional home fee
    discountAllowed?: boolean;

    // Turnaround Time (TAT)
    sampleType: string;
    turnaroundTime: string; // Display text (e.g., "24 Hours")
    tatHours: number; // For calculation
    urgentTatHours?: number;
    gracePeriod?: number; // Minutes
    applyTat: boolean;

    // Configuration
    parameters: TestParameter[];
    inventoryRequirements?: {
        itemId: string;
        itemName: string;
        quantity: number;
    }[];
    aiTemplate?: string; // Prompt template for AI remarks

    createdAt?: any;
    updatedAt?: any;
}

interface Order {
    id: string;
    patientId: string;
    patientName: string;
    doctorName?: string;
    doctorId?: string;
    doctorPhone?: string; // New: For critical reporting
    doctorCommission?: number;
    commissionPaid?: boolean;
    totalAmount: number;
    status: 'ordered' | 'partial' | 'completed';
    paymentStatus?: 'paid' | 'partial' | 'unpaid';
    isUrgent?: boolean; // New: Urgent flag
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
    patientPhone?: string; // New: Fallback for critical reporting
    testName: string;
    testId: string;
    sampleType: string;
    status: 'ordered' | 'collected' | 'analyzing' | 'review' | 'reported' | 'rejected';
    results?: Record<string, { value: string; flag: 'N' | 'L' | 'H' | 'CL' | 'CH'; unit: string }>;
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
    isCritical?: boolean; // New: Critical flag
    isUrgent?: boolean; // New: Urgent flag
    doctorName?: string; // New: For critical reporting
    doctorPhone?: string; // New: For critical reporting
    criticalReported?: boolean;
    criticalReportedAt?: any;
    criticalReportedBy?: string;
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

// --- Helpers moved to global scope ---




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

const SimpleBarChart: React.FC<{ data: { label: string, value: number, color?: string }[], color?: string }> = ({ data, color = "bg-indigo-500" }) => {
    const max = Math.max(...data.map(d => Math.abs(d.value))) || 1;
    const containerHeight = 160;

    return (
        <div className="flex items-end gap-2 w-full pt-6" style={{ height: `${containerHeight + 40}px` }}>
            {data.map((d, i) => {
                const heightPx = Math.max((Math.abs(d.value) / max) * containerHeight, 4);
                const barColor = d.color || (d.value < 0 ? 'bg-red-500' : color);

                return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative min-w-[40px]">
                        <div className="relative w-full flex justify-center items-end flex-1" style={{ minHeight: `${containerHeight}px` }}>
                            <div
                                style={{ height: `${heightPx}px` }}
                                className={`w-full max-w-[40px] ${barColor} opacity-90 group-hover:opacity-100 transition-all rounded-t relative shadow-sm`}
                            >
                                {/* Tooltip */}
                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-slate-900 text-white text-[10px] px-2 py-1 rounded pointer-events-none whitespace-nowrap z-20 shadow-lg transition-opacity font-bold">
                                    ${d.value.toLocaleString()}
                                </div>
                            </div>
                        </div>
                        <div className="text-center w-full overflow-hidden">
                            <span className="text-[10px] text-slate-500 block truncate px-1" title={d.label}>{d.label}</span>
                            <span className={`text-[10px] font-bold block mt-0.5 ${d.value < 0 ? 'text-red-600' : 'text-slate-700'}`}>
                                {Math.abs(d.value) >= 1000 ? '$' + (d.value / 1000).toFixed(1) + 'k' : '$' + d.value}
                            </span>
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


//  1. Unified Landing Page (Login)
const LandingPage: React.FC<{ onLoginSuccess: (role: Role, user: any) => void }> = ({ onLoginSuccess }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedRole, setSelectedRole] = useState<Role>('receptionist');

    // Set Firebase Auth persistence to local
    // Moved inside handleLogin to ensure sequential execution
    // useEffect(() => {
    //    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(console.error);
    // }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username || !password) { setError("Please enter username and password."); return; }
        setLoading(true); setError('');
        try {
            // CRITICAL: Ensure persistence is LOCAL before signing in
            await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

            // Hardcoded admin login - always works
            if (username === 'admin' && password === 'admin') {
                try {
                    await auth.signInAnonymously();
                } catch (authError) {
                    console.warn('Anonymous auth failed:', authError);
                }
                onLoginSuccess('admin', { uid: 'sys-admin', email: 'System Admin', username: 'admin' });
                await logAction('LOGIN', 'Auth', `Admin logged in`, { uid: 'sys-admin', username: 'admin' });
                return;
            }

            // Regular user login from database
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

            setError('Invalid credentials.');
        } catch (err: any) { console.error(err); setError('Login failed. Please try again.'); } finally { setLoading(false); }
    };


    return (
        <div className="min-h-screen flex flex-col font-sans" style={{ backgroundColor: COLORS.RICH_BLACK }}>
            <header className="shadow-sm sticky top-0 z-40" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, borderBottom: `1px solid ${COLORS.PERSIAN_GREEN}20` }}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style={{ backgroundColor: COLORS.PERSIAN_GREEN }}>
                            <Activity className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight" style={{ color: COLORS.CITRON }}>
                                LabPro <span style={{ color: COLORS.PERSIAN_GREEN }}>Plus</span>
                            </h1>
                            <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: COLORS.TIFFANY_BLUE }}>Diagnostic Management System</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    <div className="rounded-2xl shadow-2xl p-8" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN }}>
                        <div className="mb-8 text-center">
                            <h3 className="text-2xl font-bold mb-2" style={{ color: COLORS.CITRON }}>System Login</h3>
                            <p className="text-sm" style={{ color: COLORS.TIFFANY_BLUE }}>Select role and enter credentials</p>
                        </div>

                        <form onSubmit={handleLogin} className="space-y-5" autoComplete="on">
                            <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: COLORS.TIFFANY_BLUE }}>Select Role</label>
                                <div className="relative">
                                    <select
                                        value={selectedRole}
                                        onChange={(e) => setSelectedRole(e.target.value as Role)}
                                        className="w-full p-3.5 border-2 rounded-xl outline-none appearance-none font-medium transition-all"
                                        style={{
                                            backgroundColor: COLORS.RICH_BLACK,
                                            borderColor: `${COLORS.PERSIAN_GREEN}30`,
                                            color: COLORS.CITRON
                                        }}
                                        onFocus={(e) => e.target.style.borderColor = COLORS.PERSIAN_GREEN}
                                        onBlur={(e) => e.target.style.borderColor = `${COLORS.PERSIAN_GREEN}30`}
                                        name="role"
                                    >
                                        {AVAILABLE_ROLES.filter(r => !r.disabled).map(r => (
                                            <option key={r.id} value={r.id}>{r.label}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-4 top-4 w-4 h-4 pointer-events-none" style={{ color: COLORS.TIFFANY_BLUE }} />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: COLORS.TIFFANY_BLUE }}>Username</label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    className="w-full p-3.5 border-2 rounded-xl outline-none transition-all"
                                    style={{
                                        backgroundColor: COLORS.RICH_BLACK,
                                        borderColor: `${COLORS.PERSIAN_GREEN}30`,
                                        color: COLORS.CITRON
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = COLORS.PERSIAN_GREEN}
                                    onBlur={(e) => e.target.style.borderColor = `${COLORS.PERSIAN_GREEN}30`}
                                    placeholder="Enter username"
                                    autoFocus
                                    name="username"
                                    autoComplete="username"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: COLORS.TIFFANY_BLUE }}>Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="w-full p-3.5 border-2 rounded-xl outline-none transition-all"
                                    style={{
                                        backgroundColor: COLORS.RICH_BLACK,
                                        borderColor: `${COLORS.PERSIAN_GREEN}30`,
                                        color: COLORS.CITRON
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = COLORS.PERSIAN_GREEN}
                                    onBlur={(e) => e.target.style.borderColor = `${COLORS.PERSIAN_GREEN}30`}
                                    placeholder="••••••••"
                                    name="password"
                                    autoComplete="current-password"
                                />
                            </div>

                            {error && (
                                <div className="border-2 p-3 rounded-xl text-sm flex items-start gap-2 animate-in fade-in slide-in-from-top-2" style={{ backgroundColor: '#FEE2E2', borderColor: '#FCA5A5', color: '#991B1B' }}>
                                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                    <span className="leading-snug">{error}</span>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading || !username || !password}
                                className="w-full py-3.5 rounded-xl font-bold transition-all disabled:opacity-50 shadow-lg flex justify-center items-center gap-2 text-white"
                                style={{
                                    backgroundColor: COLORS.PERSIAN_GREEN,
                                    boxShadow: `0 4px 14px 0 ${COLORS.PERSIAN_GREEN}40`
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Secure Login'}
                            </button>
                        </form>
                    </div>
                </div>
            </main>

            <footer className="py-6" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, borderTop: `1px solid ${COLORS.PERSIAN_GREEN}20` }}>
                <div className="max-w-7xl mx-auto px-4 text-center">
                    <p className="text-sm font-medium mb-2" style={{ color: COLORS.CITRON }}>
                        Developed by <span className="font-bold" style={{ color: COLORS.PERSIAN_GREEN }}>ABS TECH Bahawalpur</span>
                    </p>
                    <p className="text-sm mb-2" style={{ color: COLORS.TIFFANY_BLUE }}>
                        Contact Us at <span className="font-bold" style={{ color: COLORS.PERSIAN_GREEN }}>03009686545</span>
                    </p>
                    <p className="text-xs" style={{ color: COLORS.TIFFANY_BLUE }}>
                        All Rights Reserved © ABS BAHAWALPUR
                    </p>
                </div>
            </footer>
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

const FinanceModule: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
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

    const handleModuleBack = () => {
        if (subView !== 'dashboard') {
            setSubView('dashboard');
        } else if (onBack) {
            onBack();
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-50">
            <div className="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                    {onBack && <button onClick={handleModuleBack} className="p-2 rounded-full hover:bg-slate-100 transition-colors"><ArrowLeft className="w-5 h-5 text-indigo-600" /></button>}
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><DollarSign className="w-6 h-6 text-indigo-600" /> Financial Dashboard</h2>
                </div>
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
                            <div className={`p-6 rounded-xl border shadow-lg text-white ${kpi.profit >= 0 ? 'bg-green-600 border-green-700 shadow-green-200' : 'bg-red-600 border-red-700 shadow-red-200'}`}>
                                <p className="text-white/80 text-xs font-bold uppercase">Net Profit</p>
                                <p className="text-3xl font-bold mt-2">${kpi.profit.toLocaleString()}</p>
                                <p className="text-xs text-white/70 mt-1 opacity-80">Rev - (Exp + Inv. Usage)</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                <h3 className="font-bold text-slate-800 mb-4">Financial Overview</h3>
                                {[kpi.revenue, kpi.paidExpenses, kpi.invUsageCost].some(v => v > 0) ? (
                                    <>
                                        <SimpleBarChart data={[
                                            { label: 'Revenue', value: kpi.revenue, color: 'bg-green-500' },
                                            { label: 'Paid Exp', value: kpi.paidExpenses, color: 'bg-red-500' },
                                            { label: 'Inv. Usage', value: kpi.invUsageCost, color: 'bg-orange-500' },
                                            { label: 'Profit', value: kpi.profit, color: kpi.profit >= 0 ? 'bg-green-600' : 'bg-red-600' }
                                        ]} />
                                        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                                            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded"></div><span className="text-slate-600">Revenue</span></div>
                                            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded"></div><span className="text-slate-600">Expenses</span></div>
                                            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-orange-500 rounded"></div><span className="text-slate-600">Inventory</span></div>
                                            <div className="flex items-center gap-2"><div className={`w-3 h-3 rounded ${kpi.profit >= 0 ? 'bg-green-600' : 'bg-red-600'}`}></div><span className="text-slate-600">Net Profit</span></div>
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

const OrderHistoryTable: React.FC<{ onViewDetails?: (patientId: string) => void; onPrintReport?: (orderId: string) => void }> = ({ onViewDetails, onPrintReport }) => {
    const [orders, setOrders] = useState<Order[]>([]);
    useEffect(() => { const unsub = db.collection('orders').orderBy('createdAt', 'desc').limit(50).onSnapshot(snap => setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)))); return () => unsub(); }, []);
    const showAction = onViewDetails || onPrintReport;
    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b">
                    <tr>
                        <th className="p-4">Date</th>
                        <th className="p-4">Order ID</th>
                        <th className="p-4">Patient</th>
                        <th className="p-4">Amount</th>
                        <th className="p-4">Status</th>
                        {showAction && <th className="p-4 text-right">Action</th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {orders.map(o => (
                        <tr key={o.id} className="hover:bg-slate-50">
                            <td className="p-4 text-xs text-slate-500">{formatDate(o.createdAt)}</td>
                            <td className="p-4 font-mono text-xs font-bold">{o.id.slice(0, 8).toUpperCase()}</td>
                            <td className="p-4 font-bold text-slate-800">{o.patientName}</td>
                            <td className="p-4 font-bold text-slate-800">${o.totalAmount}</td>
                            <td className="p-4">
                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${o.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{o.status}</span>
                            </td>
                            {showAction && (
                                <td className="p-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        {onPrintReport && (
                                            <button onClick={() => onPrintReport(o.id)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded border border-indigo-200" title="Reprint Report">
                                                <Printer className="w-4 h-4" />
                                            </button>
                                        )}
                                        {onViewDetails && (
                                            <button onClick={() => onViewDetails(o.patientId)} className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded text-xs font-bold hover:bg-slate-50 flex items-center gap-1">
                                                <History className="w-3 h-3" /> Details
                                            </button>
                                        )}
                                    </div>
                                </td>
                            )}
                        </tr>
                    ))}
                    {orders.length === 0 && <tr><td colSpan={showAction ? 6 : 5} className="p-8 text-center text-slate-400">No recent orders found.</td></tr>}
                </tbody>
            </table>
        </div>
    );
};

const ReceptionReportsTable: React.FC<{ onPrint: (s: Sample[]) => void }> = ({ onPrint }) => {
    const [samples, setSamples] = useState<Sample[]>([]);

    useEffect(() => {
        const unsub = db.collection('samples')
            .where('status', '==', 'reported')
            .orderBy('reportedAt', 'desc')
            .limit(50)
            .onSnapshot(snap => setSamples(snap.docs.map(d => ({ id: d.id, ...d.data() } as Sample))));
        return () => unsub();
    }, []);

    // Group by Order ID
    const groupedSamples = useMemo(() => {
        const groups: Record<string, Sample[]> = {};
        samples.forEach(s => {
            const key = s.orderId || s.patientId; // Fallback to patient if no orderId
            if (!groups[key]) groups[key] = [];
            groups[key].push(s);
        });
        return Object.values(groups).sort((a, b) => {
            const dateA = a[0]?.reportedAt?.toDate ? a[0].reportedAt.toDate() : new Date();
            const dateB = b[0]?.reportedAt?.toDate ? b[0].reportedAt.toDate() : new Date();
            return dateB.getTime() - dateA.getTime();
        });
    }, [samples]);

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b">
                    <tr>
                        <th className="p-4">Reported Date</th>
                        <th className="p-4">Patient</th>
                        <th className="p-4">Tests Included</th>
                        <th className="p-4 text-right">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {groupedSamples.map((group, idx) => {
                        const s = group[0];
                        const testNames = group.map(g => g.testName).join(', ');
                        return (
                            <tr key={idx} className="hover:bg-slate-50">
                                <td className="p-4 text-xs text-slate-500">{formatDate(s.reportedAt)}</td>
                                <td className="p-4 font-bold text-slate-800">
                                    {s.patientName}
                                    <div className="text-xs font-normal text-slate-500">{s.patientAge} Y / {s.patientGender}</div>
                                </td>
                                <td className="p-4 text-slate-600">
                                    <span className="font-medium text-slate-900">{group.length} Test(s):</span> {testNames}
                                </td>
                                <td className="p-4 text-right">
                                    <button onClick={() => onPrint(group)} className="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded text-xs font-bold hover:bg-indigo-100 flex items-center gap-1 ml-auto transition-colors">
                                        <Printer className="w-3 h-3" /> Print Report
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                    {groupedSamples.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-400">No completed reports yet.</td></tr>}
                </tbody>
            </table>
        </div>
    );
};

const PatientSearchPanel: React.FC<{ onSelect: (p: Patient) => void, onViewDetails?: (p: Patient) => void }> = ({ onSelect, onViewDetails }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(false);

    const handleSearch = async () => {
        if (!query) return;
        setLoading(true);
        try {
            // Using >= and <= query for prefix match
            const snap = await db.collection('patients')
                .where('fullName', '>=', query)
                .where('fullName', '<=', query + '\uf8ff')
                .limit(20)
                .get();
            setResults(snap.docs.map(d => ({ id: d.id, ...d.data() } as Patient)));
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    return (
        <div className="p-6 h-full flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Search Patient Database</h3>
            <div className="flex gap-2 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                    <input
                        className="w-full pl-9 p-3 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Enter Patient Name..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    />
                </div>
                <button onClick={handleSearch} disabled={loading} className="px-6 bg-indigo-600 text-white rounded-lg font-bold shadow hover:bg-indigo-700 disabled:opacity-50">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
                </button>
            </div>
            <div className="flex-1 overflow-y-auto">
                {results.map(p => (
                    <div key={p.id} className="p-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 flex justify-between items-center transition-colors">
                        <div>
                            <p className="font-bold text-slate-800">{p.fullName}</p>
                            <p className="text-xs text-slate-500">{p.phone} • {p.gender} • {calculateAge(p.dob)} yrs</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => onSelect(p)} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded text-xs font-bold hover:bg-indigo-100">Select</button>
                            {onViewDetails && (
                                <button onClick={() => onViewDetails(p)} className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded text-xs font-bold hover:bg-slate-50 flex items-center gap-1">
                                    <History className="w-3 h-3" /> Details
                                </button>
                            )}
                        </div>
                    </div>
                ))}
                {results.length === 0 && !loading && (
                    <div className="p-12 text-center text-slate-400 flex flex-col items-center">
                        <Search className="w-8 h-8 mb-2 opacity-20" />
                        <p>No patients found. Search by name.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const PatientDetailsModal: React.FC<{ patient: Patient; onClose: () => void }> = ({ patient, onClose }) => {
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        db.collection('orders').where('patientId', '==', patient.id).limit(20).get().then(snap => {
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            docs.sort((a: any, b: any) => {
                const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
                const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
                return tB - tA;
            });
            setHistory(docs);
            setLoading(false);
        });
    }, [patient]);

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col">
                <div className="p-6 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Patient Details: {patient.fullName}</h2>
                        <p className="text-sm text-slate-500">{patient.phone} • {patient.gender} • {calculateAge(patient.dob)} yrs</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full"><XCircle className="w-6 h-6 text-slate-500" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                    <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><History className="w-5 h-5 text-indigo-500" /> Recent Visits & Tests</h3>
                    {loading ? <p className="text-center p-10 text-slate-400">Loading history...</p> : (
                        <div className="space-y-4">
                            {history.length > 0 ? history.map(h => (
                                <div key={h.id} className="border rounded-lg p-4 hover:shadow-sm transition-all">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <p className="font-bold text-indigo-900">Visit: {formatDate(h.createdAt)} <span className="text-slate-400 text-xs font-normal">at {formatTimeSafe(h.createdAt)}</span></p>
                                            <p className="text-xs text-slate-500 font-mono">Order ID: {h.id}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-slate-800">${h.totalAmount}</p>
                                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${h.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{h.status}</span>
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded text-sm text-slate-700 border border-slate-100">
                                        <p className="font-bold text-xs text-slate-500 uppercase mb-1">Tests Included:</p>
                                        {/* Since Order doc doesn't strictly have test names list, we query samples or rely on testCount? 
                                            Ideally we'd want test names. We can query samples. But for speed, we'll try to use a report print fallback or just list 'X Tests'. 
                                            Actually, to 'what test they took', we need the test names. 
                                            We'll add a 'Load Details' button or just query samples for this order. 
                                            Let's query samples on demand or just add a Print Report button that creates a report view. */}
                                        <TestListLoader orderId={h.id} />
                                    </div>
                                </div>
                            )) : <p className="text-center text-slate-400 italic">No history found.</p>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const TestListLoader: React.FC<{ orderId: string }> = ({ orderId }) => {
    const [tests, setTests] = useState<any[]>([]);
    const [loaded, setLoaded] = useState(false);
    useEffect(() => {
        db.collection('samples').where('orderId', '==', orderId).get().then(s => {
            setTests(s.docs.map(d => d.data()));
            setLoaded(true);
        });
    }, [orderId]);

    // Helper to print this specific order logic
    // We recycle PrintReportModal logic? But PrintReportModal needs 'data' in specific format.
    // We can construct it.
    const [showPrint, setShowPrint] = useState(false);

    if (!loaded) return <span className="text-xs text-slate-400 animate-pulse">Loading tests...</span>;

    return (
        <div className="flex justify-between items-center">
            <span className="font-medium">{tests.map(t => t.testName).join(', ')}</span>
            {tests.some(t => t.status === 'reported') && (
                <button onClick={() => setShowPrint(true)} className="text-xs bg-white border border-indigo-200 text-indigo-600 px-3 py-1 rounded font-bold hover:bg-indigo-50 flex items-center gap-1 shadow-sm">
                    <Printer className="w-3 h-3" /> Print Report
                </button>
            )}
            {showPrint && <PrintReportModal data={tests.filter(t => t.status === 'reported')} onClose={() => setShowPrint(false)} />}
        </div>
    );
};

const DashboardModule: React.FC<{ role: Role }> = ({ role }) => {
    return (
        <div className="space-y-6"><div className="bg-indigo-600 rounded-2xl p-8 text-white shadow-xl shadow-indigo-200 relative overflow-hidden"><div className="relative z-10"><h2 className="text-3xl font-bold mb-2">Welcome Back, {role}</h2><p className="text-indigo-100">Here is what's happening in your lab today.</p></div><FlaskConical className="absolute right-0 bottom-0 text-indigo-500 w-48 h-48 -mr-8 -mb-8 opacity-20 rotate-12" /></div><div className="grid grid-cols-1 md:grid-cols-3 gap-6"><div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200"><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center text-green-600"><Activity className="w-6 h-6" /></div><div><p className="text-slate-500 text-xs font-bold uppercase">System Status</p><p className="text-xl font-bold text-slate-800">Operational</p></div></div></div><div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200"><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600"><Clock className="w-6 h-6" /></div><div><p className="text-slate-500 text-xs font-bold uppercase">Server Time</p><p className="text-xl font-bold text-slate-800">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p></div></div></div><div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200"><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-600"><Shield className="w-6 h-6" /></div><div><p className="text-slate-500 text-xs font-bold uppercase">Security Level</p><p className="text-xl font-bold text-slate-800">High</p></div></div></div></div></div>
    );
};

const PatientsModule: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
    const [patients, setPatients] = useState<Patient[]>([]);
    useEffect(() => { const unsub = db.collection('patients').orderBy('createdAt', 'desc').limit(50).onSnapshot(s => setPatients(s.docs.map(d => ({ id: d.id, ...d.data() } as Patient)))); return () => unsub(); }, []);
    return (<div className="h-full flex flex-col">
        <div className="flex items-center gap-2 mb-6">
            {onBack && <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-100 transition-colors"><ArrowLeft className="w-6 h-6 text-indigo-600" /></button>}
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Users className="w-6 h-6 text-indigo-600" /> Patient Directory</h2>
        </div><div className="bg-white rounded-xl border border-slate-200 flex-1 overflow-hidden shadow-sm flex flex-col"><div className="overflow-y-auto flex-1"><table className="w-full text-left text-sm"><thead className="bg-slate-50 border-b sticky top-0"><tr><th className="p-4">Name</th><th className="p-4">Phone</th><th className="p-4">Gender</th><th className="p-4">Age</th><th className="p-4">Registered</th></tr></thead><tbody className="divide-y divide-slate-50">{patients.map(p => (<tr key={p.id} className="hover:bg-slate-50"><td className="p-4 font-bold text-slate-800">{p.fullName}</td><td className="p-4 text-slate-600">{p.phone}</td><td className="p-4 capitalize text-slate-600">{p.gender}</td><td className="p-4 text-slate-600">{calculateAge(p.dob)} yrs</td><td className="p-4 text-slate-500 text-xs">{formatDate(p.createdAt)}</td></tr>))}</tbody></table></div></div></div>);
};

const InventoryModule: React.FC<{ role: Role | null; onBack?: () => void }> = ({ role, onBack }) => {
    const { showAlert, showConfirm, showPrompt, showToast } = useDialog();
    const isManager = role ? canManageInventory(role) : false;
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
                <div className="p-6 rounded-xl border shadow-sm" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, borderColor: `${COLORS.PERSIAN_GREEN}40` }}>
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-xs font-bold uppercase" style={{ color: COLORS.TIFFANY_BLUE }}>Total Items</p>
                        <Package className="w-5 h-5" style={{ color: COLORS.PERSIAN_GREEN }} />
                    </div>
                    <p className="text-3xl font-bold" style={{ color: COLORS.CITRON }}>{stats.totalItems}</p>
                </div>
                <div className="p-6 rounded-xl border shadow-sm" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, borderColor: `${COLORS.PERSIAN_GREEN}40` }}>
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-xs font-bold uppercase" style={{ color: COLORS.TIFFANY_BLUE }}>Low Stock</p>
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                    </div>
                    <p className="text-3xl font-bold text-amber-500">{stats.lowStock}</p>
                </div>
                <div className="p-6 rounded-xl border shadow-sm" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, borderColor: `${COLORS.PERSIAN_GREEN}40` }}>
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-xs font-bold uppercase" style={{ color: COLORS.TIFFANY_BLUE }}>Expired Items</p>
                        <XCircle className="w-5 h-5 text-red-500" />
                    </div>
                    <p className="text-3xl font-bold text-red-500">{stats.expired}</p>
                </div>
                <div className="p-6 rounded-xl border shadow-sm" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, borderColor: `${COLORS.PERSIAN_GREEN}40` }}>
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-xs font-bold uppercase" style={{ color: COLORS.TIFFANY_BLUE }}>Total Value</p>
                        <DollarSign className="w-5 h-5 text-green-500" />
                    </div>
                    <p className="text-3xl font-bold text-green-500">${stats.totalValue.toLocaleString()}</p>
                </div>
            </div>

            {/* Alerts */}
            {(stats.lowStock > 0 || stats.expired > 0 || stats.expiringSoon > 0) && (
                <div className="p-4 rounded-xl border" style={{ backgroundColor: '#78350f30', borderColor: '#f59e0b40' }}>
                    <h3 className="font-bold mb-3 flex items-center gap-2" style={{ color: '#fbbf24' }}><Bell className="w-4 h-4" /> Inventory Alerts</h3>
                    <div className="space-y-2">
                        {stats.lowStock > 0 && <p className="text-sm" style={{ color: '#fcd34d' }}>⚠️ {stats.lowStock} items below minimum stock level</p>}
                        {stats.expired > 0 && <p className="text-sm" style={{ color: '#fca5a5' }}>🚫 {stats.expired} items have expired</p>}
                        {stats.expiringSoon > 0 && <p className="text-sm" style={{ color: '#fcd34d' }}>⏰ {stats.expiringSoon} items expiring within 30 days</p>}
                    </div>
                    <button onClick={() => setSubView('items')} className="mt-3 text-sm font-bold hover:underline" style={{ color: '#fbbf24' }}>View Items →</button>
                </div>
            )}

            {/* Pending Requests */}
            {stats.pendingRequests > 0 && (
                <div className="p-4 rounded-xl border" style={{ backgroundColor: '#312e8130', borderColor: '#6366f140' }}>
                    <h3 className="font-bold mb-2 flex items-center gap-2" style={{ color: '#818cf8' }}><Truck className="w-4 h-4" /> Pending Requests</h3>
                    <p className="text-sm" style={{ color: '#c7d2fe' }}>{stats.pendingRequests} requests awaiting your approval</p>
                    <button onClick={() => setSubView('requests')} className="mt-2 text-sm font-bold hover:underline" style={{ color: '#818cf8' }}>Review Requests →</button>
                </div>
            )}
        </div>
    );

    // Render Items List (Manager Only)
    const renderItemsList = () => (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold" style={{ color: COLORS.CITRON }}>Inventory Items</h3>
                <button onClick={() => { setEditingItem(null); setFormData({ category: 'General', unit: 'pcs' }); setShowModal(true); }} className="text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:opacity-90" style={{ backgroundColor: COLORS.GAMBOGE }}>
                    <Plus className="w-4 h-4" /> Add Item
                </button>
            </div>

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: '#00000080' }}>
                    <div className="rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, border: `1px solid ${COLORS.PERSIAN_GREEN}40` }}>
                        <h3 className="font-bold text-lg mb-4" style={{ color: COLORS.CITRON }}>{editingItem ? 'Edit Item' : 'Add New Item'}</h3>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="col-span-2"><label className="text-xs font-bold uppercase" style={{ color: COLORS.TIFFANY_BLUE }}>Item Name *</label><input className="w-full p-2 border rounded outline-none focus:ring-1 focus:ring-[#00b4d8]" style={{ backgroundColor: COLORS.RICH_BLACK, color: COLORS.CITRON, borderColor: `${COLORS.PERSIAN_GREEN}40` }} value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
                            <div><label className="text-xs font-bold uppercase" style={{ color: COLORS.TIFFANY_BLUE }}>Category</label><select className="w-full p-2 border rounded outline-none" style={{ backgroundColor: COLORS.RICH_BLACK, color: COLORS.CITRON, borderColor: `${COLORS.PERSIAN_GREEN}40` }} value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>{INVENTORY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                            <div><label className="text-xs font-bold uppercase" style={{ color: COLORS.TIFFANY_BLUE }}>Unit</label><input className="w-full p-2 border rounded outline-none focus:ring-1 focus:ring-[#00b4d8]" style={{ backgroundColor: COLORS.RICH_BLACK, color: COLORS.CITRON, borderColor: `${COLORS.PERSIAN_GREEN}40` }} placeholder="e.g., pcs, ml, boxes" value={formData.unit || ''} onChange={e => setFormData({ ...formData, unit: e.target.value })} /></div>
                            <div><label className="text-xs font-bold uppercase" style={{ color: COLORS.TIFFANY_BLUE }}>Quantity *</label><input type="number" className="w-full p-2 border rounded outline-none focus:ring-1 focus:ring-[#00b4d8]" style={{ backgroundColor: COLORS.RICH_BLACK, color: COLORS.CITRON, borderColor: `${COLORS.PERSIAN_GREEN}40` }} value={formData.quantity || ''} onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })} /></div>
                            <div><label className="text-xs font-bold uppercase" style={{ color: COLORS.TIFFANY_BLUE }}>Min Level</label><input type="number" className="w-full p-2 border rounded outline-none focus:ring-1 focus:ring-[#00b4d8]" style={{ backgroundColor: COLORS.RICH_BLACK, color: COLORS.CITRON, borderColor: `${COLORS.PERSIAN_GREEN}40` }} value={formData.minLevel || ''} onChange={e => setFormData({ ...formData, minLevel: parseInt(e.target.value) || 0 })} /></div>
                            <div><label className="text-xs font-bold uppercase" style={{ color: COLORS.TIFFANY_BLUE }}>Purchase Price ($)</label><input type="number" step="0.01" className="w-full p-2 border rounded outline-none focus:ring-1 focus:ring-[#00b4d8]" style={{ backgroundColor: COLORS.RICH_BLACK, color: COLORS.CITRON, borderColor: `${COLORS.PERSIAN_GREEN}40` }} value={formData.purchasePrice || ''} onChange={e => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) || 0 })} /></div>
                            <div><label className="text-xs font-bold uppercase" style={{ color: COLORS.TIFFANY_BLUE }}>Batch Number</label><input className="w-full p-2 border rounded outline-none focus:ring-1 focus:ring-[#00b4d8]" style={{ backgroundColor: COLORS.RICH_BLACK, color: COLORS.CITRON, borderColor: `${COLORS.PERSIAN_GREEN}40` }} value={formData.batchNumber || ''} onChange={e => setFormData({ ...formData, batchNumber: e.target.value })} /></div>
                            <div><label className="text-xs font-bold uppercase" style={{ color: COLORS.TIFFANY_BLUE }}>Expiry Date</label><input type="date" className="w-full p-2 border rounded outline-none focus:ring-1 focus:ring-[#00b4d8]" style={{ backgroundColor: COLORS.RICH_BLACK, color: COLORS.CITRON, borderColor: `${COLORS.PERSIAN_GREEN}40` }} value={formData.expiryDate ? (formData.expiryDate.toDate ? formData.expiryDate.toDate().toISOString().split('T')[0] : '') : ''} onChange={e => setFormData({ ...formData, expiryDate: e.target.value ? firebase.firestore.Timestamp.fromDate(new Date(e.target.value)) : undefined })} /></div>
                            <div><label className="text-xs font-bold uppercase" style={{ color: COLORS.TIFFANY_BLUE }}>Barcode/SKU</label><input className="w-full p-2 border rounded outline-none focus:ring-1 focus:ring-[#00b4d8]" style={{ backgroundColor: COLORS.RICH_BLACK, color: COLORS.CITRON, borderColor: `${COLORS.PERSIAN_GREEN}40` }} value={formData.barcode || formData.sku || ''} onChange={e => setFormData({ ...formData, barcode: e.target.value })} /></div>
                            <div className="col-span-2"><label className="text-xs font-bold uppercase" style={{ color: COLORS.TIFFANY_BLUE }}>Vendor</label><input className="w-full p-2 border rounded outline-none focus:ring-1 focus:ring-[#00b4d8]" style={{ backgroundColor: COLORS.RICH_BLACK, color: COLORS.CITRON, borderColor: `${COLORS.PERSIAN_GREEN}40` }} value={formData.vendorName || ''} onChange={e => setFormData({ ...formData, vendorName: e.target.value })} /></div>
                        </div>
                        <div className="flex justify-end gap-2 border-t pt-4" style={{ borderColor: `${COLORS.PERSIAN_GREEN}20` }}>
                            <button onClick={() => setShowModal(false)} className="px-4 py-2 hover:opacity-80" style={{ color: COLORS.TIFFANY_BLUE }}>Cancel</button>
                            <button onClick={handleSave} className="text-white px-4 py-2 rounded font-bold hover:opacity-90" style={{ backgroundColor: COLORS.GAMBOGE }}>Save</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Purchase More Modal omitted for brevity sake, but should be themed similarly if accessed. Focus on Main List first. */}

            <div className="rounded-xl border shadow-sm flex-1 overflow-hidden flex flex-col" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, borderColor: `${COLORS.PERSIAN_GREEN}40` }}>
                <div className="overflow-y-auto flex-1 custom-scrollbar">
                    <table className="w-full text-left text-sm">
                        <thead className="border-b sticky top-0 z-10" style={{ backgroundColor: `${COLORS.RICH_BLACK}90`, borderColor: `${COLORS.PERSIAN_GREEN}40`, backdropFilter: 'blur(4px)' }}><tr><th className="p-4" style={{ color: COLORS.TIFFANY_BLUE }}>Item Name</th><th className="p-4" style={{ color: COLORS.TIFFANY_BLUE }}>Category</th><th className="p-4" style={{ color: COLORS.TIFFANY_BLUE }}>Stock</th><th className="p-4" style={{ color: COLORS.TIFFANY_BLUE }}>Batch</th><th className="p-4" style={{ color: COLORS.TIFFANY_BLUE }}>Expiry</th><th className="p-4" style={{ color: COLORS.TIFFANY_BLUE }}>Value</th><th className="p-4" style={{ color: COLORS.TIFFANY_BLUE }}>Status</th><th className="p-4 text-right" style={{ color: COLORS.TIFFANY_BLUE }}>Actions</th></tr></thead>
                        <tbody className="divide-y" style={{ divideColor: `${COLORS.PERSIAN_GREEN}20` }}>
                            {items.map(i => {
                                const isExpired = i.expiryDate && (i.expiryDate.toDate ? i.expiryDate.toDate() : new Date(i.expiryDate)) < new Date();
                                return (
                                    <tr key={i.id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4 font-bold" style={{ color: COLORS.CITRON }}>{i.name}<div className="text-xs font-normal" style={{ color: COLORS.TIFFANY_BLUE }}>{i.vendorName || 'No vendor'}</div></td>
                                        <td className="p-4" style={{ color: COLORS.TIFFANY_BLUE }}>{i.category}</td>
                                        <td className="p-4 font-mono font-bold" style={{ color: COLORS.CITRON }}>{i.quantity} <span className="text-xs font-normal" style={{ color: COLORS.TIFFANY_BLUE }}>{i.unit}</span></td>
                                        <td className="p-4 text-xs opacity-70" style={{ color: COLORS.TIFFANY_BLUE }}>{i.batchNumber || '-'}</td>
                                        <td className="p-4 text-xs opacity-70" style={{ color: COLORS.TIFFANY_BLUE }}>{i.expiryDate ? formatDate(i.expiryDate) : '-'}</td>
                                        <td className="p-4 font-mono" style={{ color: COLORS.CITRON }}>${((i.purchasePrice || 0) * i.quantity).toLocaleString()}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${isExpired ? 'bg-red-900/40 text-red-300' : i.quantity === 0 ? 'bg-slate-700 text-slate-400' : i.quantity < i.minLevel ? 'bg-amber-900/40 text-amber-300' : 'bg-green-900/40 text-green-300'}`}>
                                                {isExpired ? 'Expired' : i.quantity === 0 ? 'Out' : i.quantity < i.minLevel ? 'Low' : 'OK'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => openPurchaseMore(i)}
                                                className="hover:bg-green-900/20 p-2 rounded font-bold text-sm flex items-center gap-1 ml-auto transition-colors"
                                                style={{ color: '#4ade80' }}>
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
                <div className="flex items-center gap-2 mb-6">
                    {onBack && <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-200 transition-colors"><ArrowLeft className="w-6 h-6 text-slate-800" /></button>}
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Truck className="w-6 h-6 text-indigo-600" /> Request Inventory</h2>
                </div>
                {renderRequests()}
            </div>
        );
    }

    // Manager view with tabs
    const handleModuleBack = () => {
        if (subView !== 'dashboard') {
            setSubView('dashboard');
        } else if (onBack) {
            onBack();
        }
    };

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                    {onBack && <button onClick={handleModuleBack} className="p-2 rounded-full hover:bg-slate-200 transition-colors"><ArrowLeft className="w-6 h-6 text-slate-800" /></button>}
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Package className="w-6 h-6 text-indigo-600" /> Inventory Management</h2>
                </div>
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

const AdminTopBar: React.FC<{ activeTab?: string }> = ({ activeTab }) => {
    const navigate = useNavigate();
    const tabs = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/admin' },
        { id: 'users', label: 'Users', icon: Users, path: '/admin_users' },
        { id: 'tests', label: 'Tests', icon: FlaskConical, path: '/admin_tests' },
        { id: 'finance', label: 'Finance', icon: DollarSign, path: '/admin_finance' },
        { id: 'reports', label: 'Reports', icon: FileBarChart, path: '/admin_reports' },
        { id: 'logs', label: 'Logs', icon: ScrollText, path: '/admin_logs' },
        { id: 'settings', label: 'Settings', icon: Settings, path: '/admin_settings' },
    ];

    return (
        <div className="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center shrink-0 mb-4 shadow-sm z-30">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/admin')} className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors" title="Back to Dashboard">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="h-6 w-px bg-slate-200" />
                <h2 className="text-xl font-bold text-slate-800 hidden md:block">Administration</h2>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-lg overflow-x-auto custom-scrollbar">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => navigate(tab.path)}
                        className={`px-3 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === tab.id
                            ? 'bg-white text-indigo-600 shadow-sm'
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        <span className="hidden xl:inline">{tab.label}</span>
                    </button>
                ))}
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
        <div className="h-full flex flex-col bg-slate-50">
            <AdminTopBar activeTab="users" />
            <div className="flex justify-between items-center mb-6 px-6">
                <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold text-slate-800">User Management</h2>
                </div>
                <button onClick={() => setShowModal(true)} className="text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:opacity-90" style={{ backgroundColor: COLORS.GAMBOGE }}>
                    <UserPlus className="w-4 h-4" /> Add User
                </button>
            </div>

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: '#00000080' }}>
                    <div className="rounded-xl shadow-2xl p-6 w-full max-w-md" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, border: `1px solid ${COLORS.PERSIAN_GREEN}40` }}>
                        <h3 className="font-bold text-lg mb-4" style={{ color: COLORS.CITRON }}>Create New User</h3>
                        <div className="space-y-3">
                            <div><label className="text-xs font-bold uppercase" style={{ color: COLORS.TIFFANY_BLUE }}>Full Name</label><input className="w-full p-2 border rounded outline-none focus:ring-1 focus:ring-[#00b4d8]" style={{ backgroundColor: COLORS.RICH_BLACK, color: COLORS.CITRON, borderColor: `${COLORS.PERSIAN_GREEN}40` }} value={formData.fullName || ''} onChange={e => setFormData({ ...formData, fullName: e.target.value })} /></div>
                            <div><label className="text-xs font-bold uppercase" style={{ color: COLORS.TIFFANY_BLUE }}>Username</label><input className="w-full p-2 border rounded outline-none focus:ring-1 focus:ring-[#00b4d8]" style={{ backgroundColor: COLORS.RICH_BLACK, color: COLORS.CITRON, borderColor: `${COLORS.PERSIAN_GREEN}40` }} value={formData.username || ''} onChange={e => setFormData({ ...formData, username: e.target.value })} /></div>
                            <div><label className="text-xs font-bold uppercase" style={{ color: COLORS.TIFFANY_BLUE }}>Password</label><input className="w-full p-2 border rounded outline-none focus:ring-1 focus:ring-[#00b4d8]" style={{ backgroundColor: COLORS.RICH_BLACK, color: COLORS.CITRON, borderColor: `${COLORS.PERSIAN_GREEN}40` }} type="password" value={formData.password || ''} onChange={e => setFormData({ ...formData, password: e.target.value })} /></div>
                            <div><label className="text-xs font-bold uppercase" style={{ color: COLORS.TIFFANY_BLUE }}>Role</label><select className="w-full p-2 border rounded outline-none" style={{ backgroundColor: COLORS.RICH_BLACK, color: COLORS.CITRON, borderColor: `${COLORS.PERSIAN_GREEN}40` }} value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value as Role })}>{AVAILABLE_ROLES.filter(r => !r.disabled).map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</select></div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6 border-t pt-4" style={{ borderColor: `${COLORS.PERSIAN_GREEN}20` }}>
                            <button onClick={() => setShowModal(false)} className="px-4 py-2 hover:opacity-80" style={{ color: COLORS.TIFFANY_BLUE }}>Cancel</button>
                            <button onClick={handleSave} className="text-white px-4 py-2 rounded font-bold hover:opacity-90" style={{ backgroundColor: COLORS.GAMBOGE }}>Create User</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="rounded-xl shadow-sm border flex-1 overflow-hidden flex flex-col" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, borderColor: `${COLORS.PERSIAN_GREEN}40` }}>
                <div className="overflow-y-auto flex-1 custom-scrollbar">
                    <table className="w-full text-left text-sm">
                        <thead className="border-b sticky top-0 z-10" style={{ backgroundColor: `${COLORS.RICH_BLACK}90`, borderColor: `${COLORS.PERSIAN_GREEN}40`, backdropFilter: 'blur(4px)' }}><tr><th className="p-4" style={{ color: COLORS.TIFFANY_BLUE }}>Name</th><th className="p-4" style={{ color: COLORS.TIFFANY_BLUE }}>Username</th><th className="p-4" style={{ color: COLORS.TIFFANY_BLUE }}>Role</th><th className="p-4" style={{ color: COLORS.TIFFANY_BLUE }}>Status</th><th className="p-4 text-right" style={{ color: COLORS.TIFFANY_BLUE }}>Action</th></tr></thead>
                        <tbody className="divide-y" style={{ divideColor: `${COLORS.PERSIAN_GREEN}20` }}>
                            {users.map(u => (
                                <tr key={u.id} className="hover:bg-white/5 transition-colors">
                                    <td className="p-4 font-bold" style={{ color: COLORS.CITRON }}>{u.fullName}</td>
                                    <td className="p-4" style={{ color: COLORS.TIFFANY_BLUE }}>{u.username}</td>
                                    <td className="p-4 capitalize" style={{ color: COLORS.TIFFANY_BLUE }}>{u.role}</td>
                                    <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold uppercase ${u.status === 'active' ? 'bg-green-900/40 text-green-300' : 'bg-slate-700/50 text-slate-400'}`}>{u.status}</span></td>
                                    <td className="p-4 text-right"><button onClick={() => handleDelete(u.id)} className="text-red-400 hover:bg-red-900/20 p-2 rounded transition-colors"><Trash2 className="w-4 h-4" /></button></td>
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
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [activeTab, setActiveTab] = useState<'basic' | 'pricing' | 'tat' | 'params' | 'inventory'>('basic');
    const { showConfirm, showToast, showAlert } = useDialog();

    // Initial empty state for a new test
    const initialTestState: Partial<Test> = {
        isActive: true,
        category: 'General',
        sampleType: 'Blood',
        parameters: [],
        inventoryRequirements: [],
        applyTat: true,
        tatHours: 24,
        urgentTatHours: 4,
        gracePeriod: 0
    };

    const [formData, setFormData] = useState<Partial<Test>>(initialTestState);

    useEffect(() => {
        let unsubTests: (() => void) | null = null;
        let unsubInv: (() => void) | null = null;

        try {
            unsubTests = db.collection('tests').onSnapshot(
                (snapshot) => {
                    setTests(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Test)));
                },
                (error) => {
                    console.error('Error in tests snapshot:', error);
                    setTests([]);
                }
            );

            unsubInv = db.collection('inventory_items')
                .where('status', '!=', 'out_of_stock')
                .onSnapshot(
                    (snapshot) => {
                        setInventoryItems(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem)));
                    },
                    (error) => {
                        console.error('Error in inventory snapshot:', error);
                        setInventoryItems([]);
                    }
                );
        } catch (error) {
            console.error('Error setting up listeners:', error);
        }

        return () => {
            try {
                if (unsubTests) unsubTests();
                if (unsubInv) unsubInv();
            } catch (error) {
                console.error('Error cleaning up listeners:', error);
            }
        };
    }, []);

    const handleSave = async () => {
        if (!formData.name || !formData.code || !formData.price) {
            await showAlert("Missing Fields", "Please fill in all required fields (Name, Code, Price)");
            return;
        }
        try {
            const testData = {
                ...formData,
                updatedAt: firebase.firestore.Timestamp.now()
            };

            if (formData.id) {
                await db.collection('tests').doc(formData.id).update(testData);
            } else {
                await db.collection('tests').add({
                    ...testData,
                    createdAt: firebase.firestore.Timestamp.now()
                });
            }
            setIsEditing(false);
            setFormData(initialTestState);
            setActiveTab('basic');
            showToast("Test saved successfully", "success");
        } catch (e) {
            console.error("Error saving test:", e);
            await showAlert("Error", "Failed to save test");
        }
    };

    const handleEdit = (test: Test) => {
        setFormData({ ...test });
        setIsEditing(true);
        setActiveTab('basic');
    };

    const handleDelete = async (id: string) => {
        const confirmed = await showConfirm("Delete Test", "Are you sure you want to delete this test? This cannot be undone.");
        if (confirmed) {
            await db.collection('tests').doc(id).delete();
            showToast("Test deleted successfully", "success");
        }
    };

    const loadCommonTests = async () => {
        const confirmed = await showConfirm(
            'Load Common Tests',
            'This will add 15 common lab tests to your database. Existing tests will not be affected. Continue?'
        );
        if (!confirmed) return;

        const commonTests = [
            {
                code: "CBC", name: "Complete Blood Count", category: "Hematology",
                description: "Comprehensive blood cell analysis", isActive: true, price: 800, labCost: 400,
                sampleType: "Blood", turnaroundTime: "4-6 Hours", tatHours: 6, applyTat: true,
                parameters: [
                    { id: "wbc", name: "White Blood Cells (WBC)", unit: "10³/μL", type: "numeric", refRanges: [{ type: "general", min: 4.0, max: 11.0, criticalMin: 2.0, criticalMax: 30.0 }] },
                    { id: "rbc", name: "Red Blood Cells (RBC)", unit: "10⁶/μL", type: "numeric", refRanges: [{ type: "gender", gender: "male", min: 4.5, max: 5.9 }, { type: "gender", gender: "female", min: 4.1, max: 5.1 }] },
                    { id: "hgb", name: "Hemoglobin", unit: "g/dL", type: "numeric", refRanges: [{ type: "gender", gender: "male", min: 13.5, max: 17.5 }, { type: "gender", gender: "female", min: 12.0, max: 15.5 }] },
                    { id: "plt", name: "Platelets", unit: "10³/μL", type: "numeric", refRanges: [{ type: "general", min: 150, max: 400 }] }
                ]
            },
            {
                code: "LFT", name: "Liver Function Test", category: "Biochemistry",
                isActive: true, price: 1500, labCost: 750, sampleType: "Serum",
                turnaroundTime: "6-8 Hours", tatHours: 8, applyTat: true,
                parameters: [
                    { id: "alt", name: "ALT (SGPT)", unit: "U/L", type: "numeric", refRanges: [{ type: "general", min: 7, max: 56 }] },
                    { id: "ast", name: "AST (SGOT)", unit: "U/L", type: "numeric", refRanges: [{ type: "general", min: 10, max: 40 }] },
                    { id: "alp", name: "Alkaline Phosphatase", unit: "U/L", type: "numeric", refRanges: [{ type: "general", min: 44, max: 147 }] },
                    { id: "bilirubin", name: "Total Bilirubin", unit: "mg/dL", type: "numeric", refRanges: [{ type: "general", min: 0.3, max: 1.2 }] }
                ]
            },
            {
                code: "RFT", name: "Renal Function Test", category: "Biochemistry",
                isActive: true, price: 1200, labCost: 600, sampleType: "Serum",
                turnaroundTime: "6-8 Hours", tatHours: 8, applyTat: true,
                parameters: [
                    { id: "creatinine", name: "Creatinine", unit: "mg/dL", type: "numeric", refRanges: [{ type: "general", min: 0.7, max: 1.3 }] },
                    { id: "urea", name: "Blood Urea", unit: "mg/dL", type: "numeric", refRanges: [{ type: "general", min: 7, max: 20 }] },
                    { id: "uric_acid", name: "Uric Acid", unit: "mg/dL", type: "numeric", refRanges: [{ type: "general", min: 3.5, max: 7.2 }] }
                ]
            },
            {
                code: "LIPID", name: "Lipid Profile", category: "Biochemistry",
                isActive: true, price: 1400, labCost: 700, sampleType: "Serum",
                turnaroundTime: "6-8 Hours", tatHours: 8, applyTat: true,
                parameters: [
                    { id: "cholesterol", name: "Total Cholesterol", unit: "mg/dL", type: "numeric", refRanges: [{ type: "general", min: 0, max: 200 }] },
                    { id: "hdl", name: "HDL Cholesterol", unit: "mg/dL", type: "numeric", refRanges: [{ type: "general", min: 40, max: 60 }] },
                    { id: "ldl", name: "LDL Cholesterol", unit: "mg/dL", type: "numeric", refRanges: [{ type: "general", min: 0, max: 100 }] },
                    { id: "triglycerides", name: "Triglycerides", unit: "mg/dL", type: "numeric", refRanges: [{ type: "general", min: 0, max: 150 }] }
                ]
            },
            {
                code: "FBS", name: "Fasting Blood Sugar", category: "Biochemistry",
                isActive: true, price: 250, labCost: 125, sampleType: "Serum",
                turnaroundTime: "2-4 Hours", tatHours: 4, applyTat: true,
                parameters: [
                    { id: "glucose", name: "Glucose (Fasting)", unit: "mg/dL", type: "numeric", refRanges: [{ type: "general", min: 70, max: 100 }] }
                ]
            },
            {
                code: "RBS", name: "Random Blood Sugar", category: "Biochemistry",
                isActive: true, price: 250, labCost: 125, sampleType: "Serum",
                turnaroundTime: "1-2 Hours", tatHours: 2, applyTat: true,
                parameters: [
                    { id: "glucose_random", name: "Glucose (Random)", unit: "mg/dL", type: "numeric", refRanges: [{ type: "general", min: 70, max: 140 }] }
                ]
            },
            {
                code: "HBA1C", name: "HbA1c (Glycated Hemoglobin)", category: "Biochemistry",
                isActive: true, price: 1800, labCost: 900, sampleType: "Blood",
                turnaroundTime: "24 Hours", tatHours: 24, applyTat: true,
                parameters: [
                    { id: "hba1c", name: "HbA1c", unit: "%", type: "numeric", refRanges: [{ type: "general", min: 4.0, max: 5.6 }] }
                ]
            },
            {
                code: "TSH", name: "Thyroid Stimulating Hormone", category: "Hormones",
                isActive: true, price: 1200, labCost: 600, sampleType: "Serum",
                turnaroundTime: "24 Hours", tatHours: 24, applyTat: true,
                parameters: [
                    { id: "tsh", name: "TSH", unit: "μIU/mL", type: "numeric", refRanges: [{ type: "general", min: 0.4, max: 4.0 }] }
                ]
            },
            {
                code: "HBSAG", name: "Hepatitis B Surface Antigen", category: "Serology",
                isActive: true, price: 800, labCost: 400, sampleType: "Serum",
                turnaroundTime: "4-6 Hours", tatHours: 6, applyTat: true,
                parameters: [
                    { id: "hbsag", name: "HBsAg", unit: "", type: "dropdown", options: ["Negative", "Positive"], refRanges: [{ type: "general", textVal: "Negative" }] }
                ]
            },
            {
                code: "HCV", name: "Hepatitis C Antibody", category: "Serology",
                isActive: true, price: 1200, labCost: 600, sampleType: "Serum",
                turnaroundTime: "4-6 Hours", tatHours: 6, applyTat: true,
                parameters: [
                    { id: "anti_hcv", name: "Anti-HCV", unit: "", type: "dropdown", options: ["Negative", "Positive"], refRanges: [{ type: "general", textVal: "Negative" }] }
                ]
            },
            {
                code: "URINE", name: "Urine Routine Examination", category: "Clinical Pathology",
                isActive: true, price: 400, labCost: 200, sampleType: "Urine",
                turnaroundTime: "2-4 Hours", tatHours: 4, applyTat: true,
                parameters: [
                    { id: "color", name: "Color", unit: "", type: "text", refRanges: [{ type: "general", textVal: "Pale Yellow" }] },
                    { id: "protein", name: "Protein", unit: "", type: "dropdown", options: ["Nil", "Trace", "+", "++", "+++"], refRanges: [{ type: "general", textVal: "Nil" }] },
                    { id: "pus_cells", name: "Pus Cells", unit: "/HPF", type: "text", refRanges: [{ type: "general", textVal: "0-5" }] }
                ]
            }
        ];

        try {
            showToast('info', 'Adding tests... Please wait');

            // Use batch writes for better reliability
            const batch = db.batch();
            let added = 0;

            for (const test of commonTests) {
                const testRef = db.collection('tests').doc();
                batch.set(testRef, {
                    ...test,
                    createdAt: firebase.firestore.Timestamp.now()
                });
                added++;
            }

            // Commit all at once
            await batch.commit();

            showToast('success', `Successfully added ${added} common tests!`);
        } catch (error: any) {
            console.error('Error loading tests:', error);
            const errorMsg = error?.message || 'Unknown error';
            showAlert('error', `Failed to load tests: ${errorMsg}. \n\nPlease check:\n1. Firestore is enabled in Firebase Console\n2. Security rules allow writes\n3. You have internet connection`);
        }
    };

    const renderTabs = () => (
        <div className="flex border-b border-slate-200 mb-6 bg-slate-50 rounded-t-xl overflow-hidden">
            {[
                { id: 'basic', label: 'Basic Info', icon: FileText },
                { id: 'pricing', label: 'Pricing', icon: DollarSign },
                { id: 'tat', label: 'Turnaround Time', icon: Clock },
                { id: 'params', label: 'Parameters', icon: List },
                { id: 'inventory', label: 'Inventory', icon: Package }
            ].map(tab => {
                const Icon = tab.icon;
                return (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-white text-indigo-600 border-t-2 border-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
                    >
                        <Icon className="w-4 h-4" /> {tab.label}
                    </button>
                );
            })}
        </div>
    );

    const renderBasicTab = () => (
        <div className="grid grid-cols-2 gap-6 animate-in fade-in">
            <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Test Name <span className="text-red-500">*</span></label>
                <input className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Complete Blood Count" />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Test Code <span className="text-red-500">*</span></label>
                <input className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-mono" value={formData.code || ''} onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })} placeholder="e.g. CBC" />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
                <input className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={formData.category || ''} onChange={e => setFormData({ ...formData, category: e.target.value })} list="categories" />
                <datalist id="categories"><option value="Hematology" /><option value="Biochemistry" /><option value="Serology" /><option value="Microbiology" /><option value="Clinical Pathology" /></datalist>
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Sample Type</label>
                <select className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white" value={formData.sampleType} onChange={e => setFormData({ ...formData, sampleType: e.target.value })}>
                    <option>Blood</option><option>Serum</option><option>Plasma</option><option>Urine</option><option>Stool</option><option>Swab</option><option>Sputum</option><option>Tissue</option><option>Other</option>
                </select>
            </div>
            <div className="flex items-center gap-2 pt-6">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} />
                    <span className="text-sm font-bold text-slate-700">Test is Active</span>
                </label>
            </div>
            <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description (Optional)</label>
                <textarea className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 h-20 resize-none" value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Clinical details regarding the test..." />
            </div>
        </div>
    );

    const renderPricingTab = () => (
        <div className="grid grid-cols-2 gap-6 animate-in fade-in">
            <div className="p-4 bg-green-50 rounded-xl border border-green-100 col-span-2 md:col-span-1">
                <h4 className="font-bold text-green-900 mb-4 flex items-center gap-2"><DollarSign className="w-4 h-4" /> Revenue Settings</h4>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Customer Price <span className="text-red-500">*</span></label>
                        <div className="relative"><span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span><input type="number" className="w-full pl-8 p-2.5 border border-slate-200 rounded-lg font-bold text-slate-800" value={formData.price || ''} onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) })} /></div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Urgent Fee (Optional)</label>
                        <div className="relative"><span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span><input type="number" className="w-full pl-8 p-2.5 border border-slate-200 rounded-lg" value={formData.urgentPrice || ''} onChange={e => setFormData({ ...formData, urgentPrice: parseFloat(e.target.value) })} placeholder="0.00" /></div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Home Collection Fee (Optional)</label>
                        <div className="relative"><span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span><input type="number" className="w-full pl-8 p-2.5 border border-slate-200 rounded-lg" value={formData.homeCollectionPrice || ''} onChange={e => setFormData({ ...formData, homeCollectionPrice: parseFloat(e.target.value) })} placeholder="0.00" /></div>
                    </div>
                </div>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 col-span-2 md:col-span-1">
                <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Wallet className="w-4 h-4" /> Cost Analysis</h4>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Lab Cost (Internal)</label>
                        <div className="relative"><span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span><input type="number" className="w-full pl-8 p-2.5 border border-slate-200 rounded-lg" value={formData.labCost || ''} onChange={e => setFormData({ ...formData, labCost: parseFloat(e.target.value) })} placeholder="0.00" /></div>
                        <p className="text-[10px] text-slate-400 mt-1">Estimated cost of reagents + labor per test.</p>
                    </div>
                    <div className="pt-4 mt-4 border-t border-slate-200">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300" checked={formData.discountAllowed} onChange={e => setFormData({ ...formData, discountAllowed: e.target.checked })} />
                            <span className="text-sm font-medium text-slate-600">Allow Discounts on this test</span>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderTatTab = () => (
        <div className="space-y-6 animate-in fade-in">
            <div className="flex items-center gap-4 mb-4">
                <label className="flex items-center gap-2 cursor-pointer bg-slate-100 px-4 py-2 rounded-lg hover:bg-slate-200 transition-colors">
                    <input type="checkbox" className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300" checked={formData.applyTat} onChange={e => setFormData({ ...formData, applyTat: e.target.checked })} />
                    <span className="text-sm font-bold text-slate-700">Enable Turnaround Time (TAT) Tracking</span>
                </label>
            </div>

            {formData.applyTat && (
                <div className="grid grid-cols-2 gap-6 p-6 bg-blue-50 rounded-xl border border-blue-100">
                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Display Text</label>
                        <input className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={formData.turnaroundTime || ''} onChange={e => setFormData({ ...formData, turnaroundTime: e.target.value })} placeholder="e.g. 24 Hours, Same Day" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Standard TAT (Hours)</label>
                        <input type="number" className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={formData.tatHours || ''} onChange={e => setFormData({ ...formData, tatHours: parseFloat(e.target.value) })} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Urgent TAT (Hours)</label>
                        <input type="number" className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={formData.urgentTatHours || ''} onChange={e => setFormData({ ...formData, urgentTatHours: parseFloat(e.target.value) })} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Grace Period (Minutes)</label>
                        <input type="number" className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={formData.gracePeriod || ''} onChange={e => setFormData({ ...formData, gracePeriod: parseFloat(e.target.value) })} placeholder="0" />
                        <p className="text-[10px] text-blue-400 mt-1">Buffer time before marking as delayed.</p>
                    </div>
                </div>
            )}
        </div>
    );

    const renderParamsTab = () => {
        const moveParam = (index: number, direction: 'up' | 'down') => {
            const params = [...(formData.parameters || [])];
            if (direction === 'up' && index > 0) {
                [params[index], params[index - 1]] = [params[index - 1], params[index]];
            } else if (direction === 'down' && index < params.length - 1) {
                [params[index], params[index + 1]] = [params[index + 1], params[index]];
            }
            setFormData({ ...formData, parameters: params });
        };

        const removeParam = async (index: number) => {
            const confirmed = await showConfirm("Remove Parameter", "Remove this parameter?");
            if (confirmed) {
                const params = [...(formData.parameters || [])];
                params.splice(index, 1);
                setFormData({ ...formData, parameters: params });
            }
        };

        const addParam = () => {
            const newParam: TestParameter = {
                id: Math.random().toString(36).substr(2, 9),
                name: '',
                unit: '',
                type: 'numeric',
                refRanges: [],
                isMandatory: true
            };
            setFormData({ ...formData, parameters: [...(formData.parameters || []), newParam] });
        };

        const updateParam = (index: number, updates: Partial<TestParameter>) => {
            const params = [...(formData.parameters || [])];
            params[index] = { ...params[index], ...updates };
            setFormData({ ...formData, parameters: params });
        };

        return (
            <div className="space-y-6 animate-in fade-in">
                <div className="flex justify-between items-center bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                    <div>
                        <h3 className="font-bold text-indigo-900">Parameter Configuration</h3>
                        <p className="text-sm text-indigo-700">Define what values need to be entered for this test.</p>
                    </div>
                    <button onClick={addParam} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold shadow hover:bg-indigo-700 flex items-center gap-2">
                        <Plus className="w-4 h-4" /> Add Parameter
                    </button>
                </div>

                <div className="space-y-4">
                    {(formData.parameters || []).map((param, idx) => (
                        <div key={param.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md hover:border-indigo-300 group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex flex-col gap-1">
                                        <button onClick={() => moveParam(idx, 'up')} disabled={idx === 0} className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-30"><ArrowUpRight className="w-4 h-4 -rotate-45" /></button>
                                        <button onClick={() => moveParam(idx, 'down')} disabled={idx === (formData.parameters?.length || 0) - 1} className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-30"><ArrowDownRight className="w-4 h-4 -rotate-45" /></button>
                                    </div>
                                    <div className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center font-bold text-sm">{idx + 1}</div>
                                    <div>
                                        <input
                                            className="font-bold text-slate-800 border-none focus:ring-0 p-0 text-lg w-full placeholder-slate-300"
                                            value={param.name}
                                            onChange={e => updateParam(idx, { name: e.target.value })}
                                            placeholder="Parameter Name (e.g. Hemoglobin)"
                                        />
                                        <div className="flex gap-2 mt-1">
                                            <select
                                                className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 outline-none focus:border-indigo-500"
                                                value={param.type}
                                                onChange={e => updateParam(idx, { type: e.target.value as any })}
                                            >
                                                <option value="numeric">Numeric Value</option>
                                                <option value="text">Text / String</option>
                                                <option value="dropdown">Dropdown Options</option>
                                                <option value="boolean">Yes / No</option>
                                            </select>
                                            <input
                                                className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 outline-none w-24 focus:border-indigo-500"
                                                value={param.unit}
                                                onChange={e => updateParam(idx, { unit: e.target.value })}
                                                placeholder="Unit (e.g. g/dL)"
                                            />
                                            <label className="flex items-center gap-1 cursor-pointer bg-slate-50 px-2 rounded border border-slate-200">
                                                <input type="checkbox" checked={param.isMandatory} onChange={e => updateParam(idx, { isMandatory: e.target.checked })} />
                                                <span className="text-xs font-bold text-slate-600">Required</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => removeParam(idx)} className="text-slate-400 hover:text-red-500 p-2"><Trash2 className="w-4 h-4" /></button>
                            </div>

                            {/* Reference Ranges Section */}
                            <div className="ml-12 pl-4 border-l-2 border-slate-100">
                                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">Reference Ranges <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full text-[10px]">{param.refRanges.length}</span></h4>

                                {param.type === 'dropdown' && (
                                    <div className="mb-4">
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Dropdown Options (comma separated)</label>
                                        <input
                                            className="w-full text-sm p-2 border border-slate-200 rounded bg-slate-50"
                                            value={param.options?.join(', ') || ''}
                                            onChange={e => updateParam(idx, { options: e.target.value.split(',').map(s => s.trim()) })}
                                            placeholder="e.g. Positive, Negative, Indeterminate"
                                        />
                                    </div>
                                )}

                                {param.type === 'numeric' && (
                                    <div className="space-y-2">
                                        {param.refRanges.map((range, rIdx) => (
                                            <div key={rIdx} className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-sm grid grid-cols-12 gap-2 items-end">
                                                <div className="col-span-2">
                                                    <label className="text-[10px] font-bold text-slate-400 block">Type</label>
                                                    <select
                                                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs"
                                                        value={range.type}
                                                        onChange={e => {
                                                            const newRanges = [...param.refRanges];
                                                            newRanges[rIdx].type = e.target.value as any;
                                                            updateParam(idx, { refRanges: newRanges });
                                                        }}
                                                    >
                                                        <option value="general">General</option>
                                                        <option value="gender">Gender</option>
                                                        <option value="age">Age</option>
                                                    </select>
                                                </div>
                                                {range.type !== 'general' && (
                                                    <div className="col-span-2">
                                                        <label className="text-[10px] font-bold text-slate-400 block">{range.type === 'gender' ? 'Gender' : 'Age (Yrs)'}</label>
                                                        {range.type === 'gender' ? (
                                                            <select className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs" value={range.gender} onChange={e => { const newRanges = [...param.refRanges]; newRanges[rIdx].gender = e.target.value as any; updateParam(idx, { refRanges: newRanges }); }}><option value="male">Male</option><option value="female">Female</option></select>
                                                        ) : (
                                                            <div className="flex gap-1"><input className="w-full bg-white border rounded px-1 py-1 text-xs" placeholder="Min" type="number" value={range.ageMin} onChange={e => { const newRanges = [...param.refRanges]; newRanges[rIdx].ageMin = parseFloat(e.target.value); updateParam(idx, { refRanges: newRanges }); }} /><input className="w-full bg-white border rounded px-1 py-1 text-xs" placeholder="Max" type="number" value={range.ageMax} onChange={e => { const newRanges = [...param.refRanges]; newRanges[rIdx].ageMax = parseFloat(e.target.value); updateParam(idx, { refRanges: newRanges }); }} /></div>
                                                        )}
                                                    </div>
                                                )}
                                                <div className="col-span-3">
                                                    <label className="text-[10px] font-bold text-green-600 block">Normal Range</label>
                                                    <div className="flex gap-1">
                                                        <input className="w-full bg-white border border-green-200 rounded px-2 py-1 text-xs" placeholder="Min" type="number" value={range.min} onChange={e => { const newRanges = [...param.refRanges]; newRanges[rIdx].min = parseFloat(e.target.value); updateParam(idx, { refRanges: newRanges }); }} />
                                                        <input className="w-full bg-white border border-green-200 rounded px-2 py-1 text-xs" placeholder="Max" type="number" value={range.max} onChange={e => { const newRanges = [...param.refRanges]; newRanges[rIdx].max = parseFloat(e.target.value); updateParam(idx, { refRanges: newRanges }); }} />
                                                    </div>
                                                </div>
                                                <div className="col-span-3">
                                                    <label className="text-[10px] font-bold text-red-600 block">Critical Range</label>
                                                    <div className="flex gap-1">
                                                        <input className="w-full bg-white border border-red-200 rounded px-2 py-1 text-xs" placeholder="< Low" type="number" value={range.criticalMin} onChange={e => { const newRanges = [...param.refRanges]; newRanges[rIdx].criticalMin = parseFloat(e.target.value); updateParam(idx, { refRanges: newRanges }); }} />
                                                        <input className="w-full bg-white border border-red-200 rounded px-2 py-1 text-xs" placeholder="> High" type="number" value={range.criticalMax} onChange={e => { const newRanges = [...param.refRanges]; newRanges[rIdx].criticalMax = parseFloat(e.target.value); updateParam(idx, { refRanges: newRanges }); }} />
                                                    </div>
                                                </div>
                                                <div className="col-span-1">
                                                    <button onClick={() => { const newRanges = [...param.refRanges]; newRanges.splice(rIdx, 1); updateParam(idx, { refRanges: newRanges }); }} className="text-slate-400 hover:text-red-500 p-1"><XCircle className="w-4 h-4" /></button>
                                                </div>
                                            </div>
                                        ))}
                                        <button
                                            onClick={() => updateParam(idx, { refRanges: [...param.refRanges, { type: 'general' }] })}
                                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100"
                                        >
                                            <Plus className="w-3 h-3" /> Add Reference Range
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {(formData.parameters?.length === 0) && (
                        <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                            <List className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                            <p className="text-slate-500 font-bold">No Parameters Defined</p>
                            <p className="text-sm text-slate-400 mb-4">Add parameters to define what lab technicians need to test.</p>
                            <button onClick={addParam} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm shadow hover:bg-indigo-700">Add First Parameter</button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderInventoryTab = () => {
        const addRequirement = () => {
            setFormData({
                ...formData,
                inventoryRequirements: [...(formData.inventoryRequirements || []), { itemId: '', itemName: '', quantity: 1 }]
            });
        };

        const updateRequirement = (index: number, field: keyof typeof formData.inventoryRequirements[0], value: any) => {
            const reqs = [...(formData.inventoryRequirements || [])];
            reqs[index] = { ...reqs[index], [field]: value };

            // If item changed, update name
            if (field === 'itemId') {
                const item = inventoryItems.find(i => i.id === value);
                if (item) reqs[index].itemName = item.name;
            }

            setFormData({ ...formData, inventoryRequirements: reqs });
        };

        const removeRequirement = (index: number) => {
            const reqs = [...(formData.inventoryRequirements || [])];
            reqs.splice(index, 1);
            setFormData({ ...formData, inventoryRequirements: reqs });
        };

        return (
            <div className="space-y-6 animate-in fade-in">
                <div className="flex justify-between items-center bg-orange-50 p-4 rounded-xl border border-orange-100">
                    <div>
                        <h3 className="font-bold text-orange-900">Inventory Mapping</h3>
                        <p className="text-sm text-orange-700">Link inventory items to this test for automatic deduction.</p>
                    </div>
                    <button onClick={addRequirement} className="bg-orange-600 text-white px-4 py-2 rounded-lg font-bold shadow hover:bg-orange-700 flex items-center gap-2">
                        <Plus className="w-4 h-4" /> Add Item
                    </button>
                </div>

                <div className="grid gap-4">
                    {(formData.inventoryRequirements || []).map((req, idx) => {
                        const selectedItem = inventoryItems.find(i => i.id === req.itemId);

                        return (
                            <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-end gap-4">
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Item Name</label>
                                    <select
                                        className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={req.itemId}
                                        onChange={e => updateRequirement(idx, 'itemId', e.target.value)}
                                    >
                                        <option value="">Select Inventory Item...</option>
                                        {inventoryItems.map(item => (
                                            <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="w-32">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Quantity</label>
                                    <input
                                        type="number"
                                        className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                                        value={req.quantity}
                                        onChange={e => updateRequirement(idx, 'quantity', parseFloat(e.target.value))}
                                    />
                                </div>
                                <div className="flex-1">
                                    {selectedItem && (
                                        <div className="p-2 bg-slate-50 rounded border border-slate-200">
                                            <p className="text-xs text-slate-500">Current Stock</p>
                                            <p className={`font-bold ${selectedItem.quantity > 0 ? 'text-green-600' : 'text-red-500'}`}>{selectedItem.quantity} {selectedItem.unit}</p>
                                        </div>
                                    )}
                                </div>
                                <button onClick={() => removeRequirement(idx)} className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        );
                    })}

                    {(formData.inventoryRequirements?.length === 0) && (
                        <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                            <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                            <p className="text-slate-500 font-bold">No Inventory Linked</p>
                            <p className="text-sm text-slate-400 mb-4">Link items like tubes, needles, or reagents to deduct stock automatically.</p>
                            <button onClick={addRequirement} className="px-4 py-2 bg-orange-500 text-white rounded-lg font-bold text-sm shadow hover:bg-orange-600">Link First Item</button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col bg-slate-50">
            <AdminTopBar activeTab="tests" />
            <div className="flex justify-between items-center mb-6 px-6">
                <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold text-slate-800">Test Catalog Management</h2>
                </div>
                <div className="flex gap-2">
                    {isEditing ? (
                        <>
                            <button onClick={() => { setIsEditing(false); setFormData(initialTestState); }} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">Cancel</button>
                            <button onClick={handleSave} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all"><Save className="w-4 h-4" /> Save Test</button>
                        </>
                    ) : (
                        <>
                            <button onClick={loadCommonTests} className="px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow transition-all" style={{ backgroundColor: COLORS.ALLOY_ORANGE, color: 'white' }}><Database className="w-4 h-4" /> Load Common Tests</button>
                            <button onClick={() => { setIsEditing(true); setFormData(initialTestState); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow hover:bg-indigo-700"><Plus className="w-4 h-4" /> Create New Test</button>
                        </>
                    )}
                </div>
            </div>

            {isEditing ? (
                <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    {renderTabs()}
                    <div className="p-6 flex-1 overflow-y-auto">
                        {activeTab === 'basic' && renderBasicTab()}
                        {activeTab === 'pricing' && renderPricingTab()}
                        {activeTab === 'tat' && renderTatTab()}
                        {activeTab === 'params' && renderParamsTab()}
                        {activeTab === 'inventory' && renderInventoryTab()}
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 overflow-hidden flex flex-col animate-in fade-in">
                    <div className="overflow-y-auto flex-1">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 border-b sticky top-0"><tr><th className="p-4">Name</th><th className="p-4">Code</th><th className="p-4">Price</th><th className="p-4">Category</th><th className="p-4">Status</th><th className="p-4 text-right">Action</th></tr></thead>
                            <tbody className="divide-y divide-slate-50">
                                {tests.map(t => (
                                    <tr key={t.id} className="hover:bg-slate-50 group">
                                        <td className="p-4 font-bold text-slate-800">{t.name}</td>
                                        <td className="p-4 text-xs font-mono text-slate-500">{t.code}</td>
                                        <td className="p-4 font-bold text-slate-800">${t.price}</td>
                                        <td className="p-4 text-slate-500">{t.category}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${t.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                                {t.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleEdit(t)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded"><Edit2 className="w-4 h-4" /></button>
                                            <button onClick={() => handleDelete(t.id)} className="p-2 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

const AdminFinance: React.FC<{ onBack: () => void, onNavigate: (view: ViewState) => void }> = ({ onBack, onNavigate }) => {
    return (<div className="h-full flex flex-col bg-slate-50">
        <AdminTopBar activeTab="finance" />
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mx-6 mb-6"><FinanceModule /></div></div>);
};


// --- Reporting Components ---

const ReportContainer: React.FC<{ children: React.ReactNode; title: string }> = ({ children, title }) => (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm print:border-0 print:shadow-none break-inside-avoid mb-6">
        <h4 className="font-bold text-slate-700 mb-4 print:text-black">{title}</h4>
        {children}
    </div>
);

const EmptyState: React.FC<{ message?: string }> = ({ message = "No data available." }) => (
    <div className="flex flex-col items-center justify-center py-12 text-center h-48 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
        <div className="bg-slate-100 p-3 rounded-full mb-3">
            <Filter className="w-6 h-6 text-slate-400" />
        </div>
        <p className="text-slate-500 font-medium">{message}</p>
    </div>
);

const ReportChart: React.FC<{ title: string; type: 'bar' | 'line' | 'pie' | 'kpi' | 'table'; data: any[]; color?: string; subtitle?: string }> = ({ title, type, data, color = COLORS.PERSIAN_GREEN, subtitle }) => {
    // Safety check for data
    if (!data || data.length === 0) {
        return (
            <ReportContainer title={title}>
                <div className="h-48 flex items-center justify-center text-slate-400 text-sm italic border rounded-lg bg-slate-50">
                    No data available
                </div>
            </ReportContainer>
        );
    }

    return (
        <ReportContainer title={title}>
            {subtitle && <p className="text-xs text-slate-400 mb-4 -mt-2">{subtitle}</p>}

            {/* KPI Tile */}
            {type === 'kpi' && (
                <div className="flex items-end gap-2 mt-2">
                    <span className="text-4xl font-bold" style={{ color }}>{data[0]?.value}</span>
                    <span className="text-sm text-slate-500 mb-1.5">{data[0]?.label}</span>
                </div>
            )}

            {/* Bar Chart */}
            {type === 'bar' && (
                <div className="mt-4 h-48 flex items-end gap-2 text-xs text-slate-500">
                    {data.map((d, i) => {
                        const max = Math.max(...data.map(x => typeof x.value === 'number' ? x.value : 0), 1);
                        const val = typeof d.value === 'number' ? d.value : 0;
                        const h = max === 0 ? 0 : (val / max) * 100;
                        return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                                <div className="absolute bottom-full mb-1 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">{d.label}: {val}</div>
                                <div className="w-full rounded-t transition-all duration-500" style={{ height: `${h}%`, backgroundColor: d.color || color, minHeight: h > 0 ? '4px' : '0' }}></div>
                                <span className="truncate w-full text-center text-[10px]">{d.label.substring(0, 10)}</span>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Line Chart */}
            {type === 'line' && (
                <div className="mt-4 h-48 relative border-l border-b border-slate-200">
                    <svg className="absolute inset-0 w-full h-full overflow-visible" preserveAspectRatio="none">
                        <polyline
                            points={data.map((d, i) => {
                                const max = Math.max(...data.map(x => typeof x.value === 'number' ? x.value : 0), 1);
                                const val = typeof d.value === 'number' ? d.value : 0;
                                const x = (i / (data.length - 1 || 1)) * 100;
                                const y = 100 - ((val / max) * 100);
                                return `${x},${y}`;
                            }).join(' ')}
                            fill="none"
                            stroke={color}
                            strokeWidth="2"
                            vectorEffect="non-scaling-stroke"
                        />
                        {data.map((d, i) => {
                            const max = Math.max(...data.map(x => typeof x.value === 'number' ? x.value : 0), 1);
                            const val = typeof d.value === 'number' ? d.value : 0;
                            const x = (i / (data.length - 1 || 1)) * 100;
                            const y = 100 - ((val / max) * 100);
                            return (
                                <circle key={i} cx={`${x}%`} cy={`${y}%`} r="3" fill="white" stroke={color} strokeWidth="2" />
                            );
                        })}
                    </svg>
                    <div className="absolute top-100 w-full flex justify-between mt-2 text-[10px] text-slate-400">
                        {data.filter((_, i) => i === 0 || i === data.length - 1 || i % Math.max(1, Math.floor(data.length / 5)) === 0).map((d, i) => <span key={i}>{d.label}</span>)}
                    </div>
                </div>
            )}

            {/* Pie Chart */}
            {type === 'pie' && (
                <div className="mt-4 flex flex-wrap items-center justify-center gap-8">
                    <div className="w-32 h-32 rounded-full relative shrink-0" style={{
                        background: `conic-gradient(${data.reduce((acc: string[], d, i) => {
                            const total = data.reduce((s, x) => s + (typeof x.value === 'number' ? x.value : 0), 0);
                            if (total === 0) return acc;
                            const prevVal = data.slice(0, i).reduce((s, x) => s + (typeof x.value === 'number' ? x.value : 0), 0);
                            const start = (prevVal / total) * 100;
                            const currentVal = typeof d.value === 'number' ? d.value : 0;
                            const end = start + ((currentVal / total) * 100);
                            acc.push(`${d.color || color} ${start}% ${end}%`);
                            return acc;
                        }, []).join(', ')})`
                    }}></div>
                    <div className="space-y-1">
                        {data.map((d, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color || color }}></div>
                                <span className="text-slate-600">{d.label} <span className="font-bold">({d.value})</span></span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </ReportContainer>
    );
};

// --- Main Reports Component ---
const AdminReports: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [activeTab, setActiveTab] = useState('executive');
    const [dateRange, setDateRange] = useState('month'); // daily, weekly, month, year
    const [customRange, setCustomRange] = useState({ start: '', end: '' });
    const [loading, setLoading] = useState(false);

    // Data States
    const [stats, setStats] = useState<any>({});
    const [rawData, setRawData] = useState<any>({ orders: [], patients: [], inventory: [], logs: [], expenses: [] });

    // Fetch All Required Data on Mount (Filtered by Date in Memory for Prototyping)
    useEffect(() => {
        setLoading(true);
        // Robust Real-time listeners
        const unsubscribeList: (() => void)[] = [];

        try {
            unsubscribeList.push(db.collection('orders').orderBy('createdAt', 'desc').limit(2000).onSnapshot(s => setRawData((p: any) => ({ ...p, orders: s.docs.map(d => ({ id: d.id, ...d.data() })) })), e => console.error("Orders err", e)));
            unsubscribeList.push(db.collection('patients').orderBy('registeredAt', 'desc').limit(2000).onSnapshot(s => setRawData((p: any) => ({ ...p, patients: s.docs.map(d => ({ id: d.id, ...d.data() })) })), e => console.error("Patients err", e)));
            unsubscribeList.push(db.collection('users').onSnapshot(s => setRawData((p: any) => ({ ...p, users: s.docs.map(d => ({ id: d.id, ...d.data() })) })), e => console.error("Users err", e)));
            unsubscribeList.push(db.collection('inventory_items').onSnapshot(s => setRawData((p: any) => ({ ...p, inventory: s.docs.map(d => ({ id: d.id, ...d.data() })) })), e => console.error("Inv err", e)));
            unsubscribeList.push(db.collection('expenses').orderBy('date', 'desc').limit(1000).onSnapshot(s => setRawData((p: any) => ({ ...p, expenses: s.docs.map(d => ({ id: d.id, ...d.data() })) })), e => console.error("Exp err", e)));
            unsubscribeList.push(db.collection('audit_logs').orderBy('timestamp', 'desc').limit(500).onSnapshot(s => setRawData((p: any) => ({ ...p, logs: s.docs.map(d => ({ id: d.id, ...d.data() })) })), e => console.error("Logs err", e)));
        } catch (e) {
            console.error("Setup error", e);
        }

        setTimeout(() => setLoading(false), 1000);

        return () => unsubscribeList.forEach(u => u());
    }, []);

    // Helper: Filter by Date
    const checkDate = (dateVal: any) => {
        try {
            if (!dateVal) return false;
            const d = dateVal?.toDate ? dateVal.toDate() : new Date(dateVal);
            if (isNaN(d.getTime())) return false;

            const now = new Date();
            const y = now.getFullYear();
            const m = now.getMonth();

            if (dateRange === 'daily') return d.toDateString() === now.toDateString();
            if (dateRange === 'weekly') { const start = new Date(now); start.setDate(start.getDate() - 7); return d >= start; }
            if (dateRange === 'monthly') return d.getMonth() === m && d.getFullYear() === y;
            if (dateRange === 'year') return d.getFullYear() === y;
            if (dateRange === 'custom' && customRange.start && customRange.end) {
                return d >= new Date(customRange.start) && d <= new Date(customRange.end);
            }
            return true;
        } catch (e) {
            return false;
        }
    };

    // Calculate Metrics based on active tab & filters
    const metrics = useMemo(() => {
        try {
            const fOrders = Array.isArray(rawData.orders) ? rawData.orders.filter((o: any) => checkDate(o.createdAt)) : [];
            const fPatients = Array.isArray(rawData.patients) ? rawData.patients.filter((p: any) => checkDate(p.registeredAt)) : [];
            const fExpenses = Array.isArray(rawData.expenses) ? rawData.expenses.filter((e: any) => checkDate(e.date)) : [];

            // Core Calculations
            const totalRev = fOrders.reduce((sum: number, o: any) => sum + (Number(o.totalAmount) || 0), 0);
            const totalExp = fExpenses.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
            const netProfit = totalRev - totalExp;
            const totalTests = fOrders.reduce((sum: number, o: any) => sum + (Array.isArray(o.tests) ? o.tests.length : 0), 0);

            return { fOrders, fPatients, fExpenses, totalRev, totalExp, netProfit, totalTests };
        } catch (e) {
            console.error("Metrics Calc Error", e);
            return { fOrders: [], fPatients: [], fExpenses: [], totalRev: 0, totalExp: 0, netProfit: 0, totalTests: 0 };
        }
    }, [rawData, dateRange, customRange]);

    // --- Safe Data Generators ---
    const getSalesData = () => {
        try {
            const testRevenue: Record<string, number> = {};
            metrics.fOrders.forEach((o: any) => {
                if (Array.isArray(o.tests)) {
                    o.tests.forEach((t: any) => {
                        if (t?.name) {
                            testRevenue[t.name] = (testRevenue[t.name] || 0) + (Number(t.price) || 0);
                        }
                    });
                }
            });
            const topTests = Object.entries(testRevenue)
                .map(([k, v]) => ({ label: k, value: Number(v) || 0, color: COLORS.GAMBOGE }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 5);

            const paymentMethods = [
                { label: 'Cash', value: metrics.fOrders.filter((o: any) => o.paymentMethod === 'cash').length, color: '#10b981' },
                { label: 'Card', value: metrics.fOrders.filter((o: any) => o.paymentMethod === 'card').length, color: '#3b82f6' },
                { label: 'Online', value: metrics.fOrders.filter((o: any) => o.paymentMethod === 'online').length },
                { label: 'Credit', value: metrics.fOrders.filter((o: any) => o.paymentMethod === 'credit' || !o.paymentMethod).length, color: '#ef4444' }
            ].filter(d => d.value > 0);

            return { topTests, paymentMethods };
        } catch (e) {
            console.error("Sales Gen Error", e);
            return { topTests: [], paymentMethods: [] };
        }
    };

    const getInventoryData = () => {
        try {
            const inventory = Array.isArray(rawData.inventory) ? rawData.inventory : [];
            const catValue: Record<string, number> = {};
            inventory.forEach((i: any) => {
                const val = (Number(i.quantity) || 0) * (Number(i.purchasePrice) || 0);
                const cat = i.category || 'Uncategorized';
                catValue[cat] = (catValue[cat] || 0) + val;
            });
            const valueShare = Object.entries(catValue).map(([k, v]) => ({ label: k, value: v }));
            const lowStock = inventory
                .filter((i: any) => (Number(i.quantity) || 0) <= (Number(i.minLevel) || 5))
                .map((i: any) => ({ label: i.name, value: Number(i.quantity) || 0, color: '#ef4444' }));
            return { valueShare, lowStock, inventory };
        } catch (e) {
            return { valueShare: [], lowStock: [], inventory: [] };
        }
    };

    const getOperationalData = () => {
        try {
            const techLoad: Record<string, number> = {};
            const dailyVol: Record<string, number> = {};
            metrics.fOrders.forEach((o: any) => {
                const techs: string[] = [];
                if (o.processedBy) techs.push(o.processedBy);
                if (techs.length === 0 && o.status === 'completed') techs.push('Unassigned');
                techs.forEach(t => techLoad[t] = (techLoad[t] || 0) + (o.tests?.length || 1));

                const dDate = new Date(o.createdAt?.toDate ? o.createdAt.toDate() : (o.createdAt || new Date()));
                const d = isNaN(dDate.getTime()) ? 'Unknown' : dDate.toLocaleDateString();

                dailyVol[d] = (dailyVol[d] || 0) + 1;
            });
            return {
                techLoad: Object.entries(techLoad).map(([k, v]) => ({ label: k, value: v })),
                dailyVol: Object.entries(dailyVol).map(([k, v]) => ({ label: k, value: v }))
            };
        } catch (e) {
            return { techLoad: [], dailyVol: [] };
        }
    };

    const salesData = getSalesData();
    const invData = getInventoryData();
    const opsData = getOperationalData();

    const handlePrint = () => { window.print(); };

    const handleExportPDF = () => {
        try {
            const doc: any = new jsPDF();

            // Branding logic
            doc.setFontSize(22);
            doc.setTextColor(40, 40, 40);
            doc.text("LABPRO DIAGNOSTICS", 14, 20);

            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text("123 Medical Plaza, New York, NY 10001", 14, 26);
            doc.text(`Report Period: ${dateRange.toUpperCase()}`, 14, 32);
            doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 37);

            doc.setDrawColor(200, 200, 200);
            doc.line(14, 42, 196, 42);

            // Summary Section
            doc.setFontSize(14);
            doc.setTextColor(0, 0, 0);
            doc.text("Executive Summary", 14, 50);

            doc.autoTable({
                startY: 55,
                head: [['Key Metric', 'Value']],
                body: [
                    ['Total Revenue', `$${metrics.totalRev.toLocaleString()}`],
                    ['Total Tests', metrics.totalTests],
                    ['Total Patients', metrics.fPatients.length],
                    ['Total Expenses', `$${metrics.totalExp.toLocaleString()}`],
                    ['Net Profit', `$${metrics.netProfit.toLocaleString()}`]
                ],
                theme: 'striped',
                headStyles: { fillColor: [63, 81, 181] },
                styles: { fontSize: 10 }
            });

            // Detailed Report based on Active Tab
            let finalY = (doc as any).lastAutoTable.finalY + 15;

            if (activeTab === 'sales' || activeTab === 'executive') {
                doc.text("Sales Analysis", 14, finalY);

                // Top Tests Table
                doc.autoTable({
                    startY: finalY + 5,
                    head: [['Test Name', 'Revenue']],
                    body: salesData.topTests.map(t => [t.label, `$${t.value.toLocaleString()}`]),
                    theme: 'grid',
                    headStyles: { fillColor: [63, 81, 181] }
                });

                finalY = (doc as any).lastAutoTable.finalY + 10;
            }

            if (activeTab === 'inventory') {
                doc.addPage();
                doc.text("Inventory Report", 14, 20);

                const data = rawData.inventory.map((i: any) => [
                    i.name,
                    i.category || '-',
                    i.quantity || 0,
                    `$${i.purchasePrice || 0}`
                ]);

                doc.autoTable({
                    startY: 25,
                    head: [['Item Name', 'Category', 'Qty', 'Unit Cost']],
                    body: data,
                    theme: 'grid'
                });
            }

            // Footer
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.text(`Page ${i} of ${pageCount}`, 196, 285, { align: 'right' });
                doc.text('Confidential Report - LabPro Diagnostics', 14, 285);
            }

            doc.save(`LabPro_Report_${dateRange}_${new Date().toISOString().split('T')[0]}.pdf`);

        } catch (e) {
            console.error("PDF Export Error", e);
            alert("Failed to generate PDF. Please ensure libraries are loaded.");
        }
    };

    // Layout
    return (
        <div className="h-full flex flex-col bg-slate-50">
            <style>{`
                @media print {
                    @page { margin: 1cm; size: landscape; }
                    body { background: white !important; font-family: sans-serif; -webkit-print-color-adjust: exact; }
                    .no-print { display: none !important; }
                    .print-only { display: block !important; }
                    .print-break { page-break-before: always; }
                    .overflow-y-auto { overflow: visible !important; height: auto !important; }
                    table { border-collapse: collapse; width: 100%; font-size: 10pt; }
                    th, td { border: 1px solid #ddd; padding: 4px 8px; }
                    th { background-color: #f8f9fa !important; }
                    svg { max-height: 300px; }
                    .break-inside-avoid { break-inside: avoid; }
                    .print-footer { position: fixed; bottom: 0; width: 100%; border-top: 1px solid #ddd; padding-top: 8px; font-size: 10px; color: #94a3b8; background: white; }
                }
                .print-only { display: none; }
            `}</style>

            <div className="no-print">
                <AdminTopBar activeTab="reports" />
            </div>

            {/* Print Header */}
            <div className="print-only p-8 text-center border-b mb-6">
                <h1 className="text-3xl font-bold text-slate-800">LABPRO DIAGNOSTICS</h1>
                <p className="text-slate-500">Analytics & Performance Report</p>
                <p className="text-sm mt-2 font-mono">{new Date().toLocaleDateString()} • {dateRange.toUpperCase()}</p>
            </div>

            <div className="px-6 pb-6 flex-1 flex flex-col overflow-hidden">
                {/* Controls */}
                <div className="flex flex-wrap justify-between items-center mb-6 gap-4 no-print">
                    <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-bold text-slate-800">Analytics & Reports</h2>
                    </div>
                    <div className="flex gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm overflow-x-auto">
                        {['executive', 'patient', 'sales', 'financial', 'inventory', 'operational', 'quality'].map(t => (
                            <button
                                key={t}
                                onClick={() => setActiveTab(t)}
                                className={`px-3 py-1.5 rounded text-xs font-bold capitalize transition-colors ${activeTab === t ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <select className="px-3 py-2 rounded-lg border text-sm font-bold bg-white" value={dateRange} onChange={e => setDateRange(e.target.value)}>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="year">Yearly</option>
                            <option value="custom">Custom</option>
                        </select>
                        <button onClick={handlePrint} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-bold text-sm hover:bg-slate-50">
                            <Printer className="w-4 h-4" /> Print View
                        </button>
                        <button onClick={handleExportPDF} className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-white rounded-lg font-bold text-sm hover:bg-slate-900">
                            <FileText className="w-4 h-4" /> Download PDF
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pb-20">
                    {/* Summary Header for Reports (Visible in App & Print) */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6 flex justify-between items-center text-sm break-inside-avoid">
                        <div>
                            <span className="text-slate-400 block text-xs font-bold uppercase tracking-wider">Selected Period</span>
                            <span className="font-bold text-lg capitalize text-slate-700">{dateRange} Overview</span>
                        </div>
                        <div className="text-right">
                            <span className="text-slate-400 block text-xs font-bold uppercase tracking-wider">Total Revenue</span>
                            <span className="font-bold text-xl text-emerald-600">${metrics.totalRev.toLocaleString()}</span>
                        </div>
                        <div className="text-right">
                            <span className="text-slate-400 block text-xs font-bold uppercase tracking-wider">Total Tests</span>
                            <span className="font-bold text-xl text-indigo-600">{metrics.totalTests}</span>
                        </div>
                        <div className="text-right">
                            <span className="text-slate-400 block text-xs font-bold uppercase tracking-wider">New Patients</span>
                            <span className="font-bold text-xl text-amber-500">{metrics.fPatients.length}</span>
                        </div>
                    </div>

                    {/* --- REPORT CONTENT --- */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                        {/* EXECUTIVE DASHBOARD */}
                        {activeTab === 'executive' && (
                            <>
                                <ReportChart title="Total Patients" type="kpi" data={[{ label: 'Registered', value: metrics.fPatients.length }]} color={COLORS.GAMBOGE} />
                                <ReportChart title="Net Profit" type="kpi" data={[{ label: 'Net Earnings', value: '$' + metrics.netProfit.toLocaleString() }]} color={COLORS.ALLOY_ORANGE} />
                                <ReportChart title="Inventory Worth" type="kpi" data={[{ label: 'Current Assets', value: '$' + rawData.inventory.reduce((s: number, i: any) => s + (i.quantity * i.purchasePrice || 0), 0).toLocaleString() }]} color={COLORS.PERSIAN_GREEN} />

                                <div className="col-span-1 md:col-span-2 lg:col-span-3">
                                    <ReportChart
                                        title="Revenue Trend"
                                        type="line"
                                        subtitle="Income over selected period"
                                        data={Object.entries(metrics.fOrders.reduce((acc: any, o: any) => { const d = formatDate(o.createdAt).split(',')[0]; acc[d] = (acc[d] || 0) + o.totalAmount; return acc; }, {})).map(([k, v]) => ({ label: k, value: v }))}
                                        color={COLORS.MIDNIGHT_GREEN}
                                    />
                                </div>
                            </>
                        )}

                        {/* PATIENT REPORTS */}
                        {activeTab === 'patient' && (
                            <>
                                <ReportChart title="Gender Distribution" type="pie" data={[
                                    { label: 'Male', value: metrics.fPatients.filter((p: any) => p.gender === 'Male').length, color: '#3b82f6' },
                                    { label: 'Female', value: metrics.fPatients.filter((p: any) => p.gender === 'Female').length, color: '#ec4899' }
                                ]} />
                                <ReportChart title="Age Groups" type="bar" data={[
                                    { label: '0-18', value: metrics.fPatients.filter((p: any) => p.age < 18).length, color: '#818cf8' },
                                    { label: '19-40', value: metrics.fPatients.filter((p: any) => p.age >= 19 && p.age <= 40).length, color: '#6366f1' },
                                    { label: '41-60', value: metrics.fPatients.filter((p: any) => p.age >= 41 && p.age <= 60).length, color: '#4f46e5' },
                                    { label: '60+', value: metrics.fPatients.filter((p: any) => p.age > 60).length, color: '#4338ca' }
                                ]} />
                                <ReportChart title="Registration Source" type="pie" data={[
                                    { label: 'Walk-in', value: metrics.fOrders.filter((o: any) => !o.doctorId).length, color: '#10b981' },
                                    { label: 'Referred', value: metrics.fOrders.filter((o: any) => o.doctorId).length, color: '#f59e0b' }
                                ]} />
                                <div className="col-span-full">
                                    <h4 className="font-bold mb-2">Registration Trends</h4>
                                    <ReportChart title="Registrations Over Time" type="line" data={
                                        Object.entries(metrics.fPatients.reduce((acc: any, p: any) => { const d = formatDate(p.registeredAt).split(',')[0]; acc[d] = (acc[d] || 0) + 1; return acc; }, {})).map(([k, v]) => ({ label: k, value: v }))
                                    } color={COLORS.TIFFANY_BLUE} />
                                </div>
                            </>
                        )}

                        {/* SALES REPORTS */}
                        {activeTab === 'sales' && (
                            <>
                                <ReportChart title="Top Revenue Tests" type="bar" data={salesData.topTests} />
                                <ReportChart title="Payment Methods" type="pie" data={salesData.paymentMethods} />
                                <div className="col-span-full bg-white rounded-xl border p-4 break-inside-avoid">
                                    <h4 className="font-bold mb-4">Daily Sales Log</h4>
                                    <table className="w-full text-sm text-left">
                                        <thead><tr className="border-b"><th className="pb-2">Date</th><th className="pb-2">Patient</th><th className="pb-2">Tests</th><th className="pb-2 text-right">Amount</th></tr></thead>
                                        <tbody>
                                            {metrics.fOrders.slice(0, 15).map((o: any) => (
                                                <tr key={o.id} className="border-b last:border-0"><td className="py-2 text-xs">{formatDate(o.createdAt)}</td><td className="py-2 font-medium">{o.patientName}</td><td className="py-2 text-xs text-slate-500">{o.tests.length} Tests</td><td className="py-2 text-right font-bold text-emerald-600">${o.totalAmount}</td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}

                        {/* FINANCIAL REPORTS */}
                        {activeTab === 'financial' && (
                            <>
                                <ReportChart title="Income vs Expenses" type="bar" data={[
                                    { label: 'Income', value: metrics.totalRev, color: '#10b981' },
                                    { label: 'Expense', value: metrics.totalExp, color: '#ef4444' }
                                ]} />
                                <ReportChart title="Expense Categories" type="pie" data={
                                    Object.entries(metrics.fExpenses.reduce((acc: any, e: any) => {
                                        acc[e.category] = (acc[e.category] || 0) + (Number(e.amount) || 0); return acc;
                                    }, {})).map(([k, v]) => ({ label: k, value: v }))
                                } />
                                <div className="col-span-full bg-white rounded-xl border p-4 break-inside-avoid">
                                    <h4 className="font-bold mb-4">P&L Detailed View</h4>
                                    <div className="grid grid-cols-3 gap-4 text-center">
                                        <div className="p-4 bg-green-50 rounded">
                                            <p className="text-xs text-green-700 font-bold uppercase">Gross Revenue</p>
                                            <p className="text-xl font-bold text-green-800">${metrics.totalRev.toLocaleString()}</p>
                                        </div>
                                        <div className="p-4 bg-red-50 rounded">
                                            <p className="text-xs text-red-700 font-bold uppercase">Total Expenses</p>
                                            <p className="text-xl font-bold text-red-800">${metrics.totalExp.toLocaleString()}</p>
                                        </div>
                                        <div className="p-4 bg-blue-50 rounded">
                                            <p className="text-xs text-blue-700 font-bold uppercase">Net Profit</p>
                                            <p className="text-xl font-bold text-blue-800">${metrics.netProfit.toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* INVENTORY REPORTS */}
                        {activeTab === 'inventory' && (
                            <>
                                <ReportChart title="Stock Value Share" type="pie" data={invData.valueShare} />
                                <div className="col-span-1 md:col-span-2">
                                    <ReportChart title="Low Stock Alerts" type="bar" data={invData.lowStock} />
                                </div>
                                <div className="col-span-full bg-white rounded-xl border p-4">
                                    <h4 className="font-bold mb-2">Stock Expiry Risk (Next 30 Days)</h4>
                                    <div className="space-y-2">
                                        {rawData.inventory.filter((i: any) => {
                                            if (!i.expiryDate) return false;
                                            const d = i.expiryDate.toDate ? i.expiryDate.toDate() : new Date(i.expiryDate);
                                            const days = (d.getTime() - new Date().getTime()) / (1000 * 3600 * 24);
                                            return days > 0 && days < 30;
                                        }).map((i: any) => (
                                            <div key={i.id} className="flex justify-between p-2 bg-amber-50 rounded border border-amber-200">
                                                <span className="font-bold text-amber-900">{i.name}</span>
                                                <span className="text-amber-700">Expires in {Math.ceil((new Date(i.expiryDate.toDate()).getTime() - new Date().getTime()) / (1000 * 3600 * 24))} days</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* OPERATIONAL REPORTS */}
                        {activeTab === 'operational' && (
                            <>
                                <div className="col-span-full">
                                    <ReportChart title="Technician Workload" type="bar" data={opsData.techLoad} />
                                </div>
                                <div className="col-span-full">
                                    <ReportChart title="Daily Sample Collections" type="line" data={opsData.dailyVol} />
                                </div>
                            </>
                        )}

                        {/* QUALITY REPORTS */}
                        {activeTab === 'quality' && (
                            <div className="col-span-full bg-white p-6 rounded-xl border">
                                <h4 className="font-bold mb-4">Audit & Rejection Log</h4>
                                <p className="text-sm text-slate-500 mb-4">Quality control metrics and system modification logs.</p>
                                <div className="space-y-2">
                                    {rawData.logs.slice(0, 10).map((l: any) => (
                                        <div key={l.id} className="text-sm p-3 bg-slate-50 rounded border flex justify-between items-center">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-700">{l.action}</span>
                                                <span className="text-xs text-slate-500">{l.details}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="block font-bold text-indigo-600">{l.userName}</span>
                                                <span className="text-xs text-slate-400">{formatTimeSafe(l.timestamp)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-8 text-center no-print border-t pt-6">
                        <p className="text-xs text-slate-400">Generated by LabPro Analytics Engine • Confidentially Report</p>
                    </div>
                </div>
            </div>

            {/* Print Footer */}
            <div className="print-footer print-only flex justify-between">
                <span>Generated by LabPro Analytics Engine</span>
                <span>Confidential Report • {new Date().toLocaleDateString()}</span>
            </div>
        </div>
    );
};

const AdminLogs: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    useEffect(() => { const u = db.collection('audit_logs').orderBy('timestamp', 'desc').limit(50).onSnapshot(s => setLogs(s.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog)))); return () => u(); }, []);
    return (<div className="h-full flex flex-col bg-slate-50">
        <AdminTopBar activeTab="logs" />
        <div className="px-6 pb-6 flex-1 flex flex-col">
            <div className="flex items-center gap-2 mb-6">
                <h2 className="text-2xl font-bold text-slate-800">System Audit Logs</h2>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 overflow-hidden flex flex-col"><div className="overflow-y-auto flex-1"><table className="w-full text-left text-sm"><thead className="bg-slate-50 border-b sticky top-0"><tr><th className="p-4">Time</th><th className="p-4">User</th><th className="p-4">Action</th><th className="p-4">Details</th></tr></thead><tbody className="divide-y divide-slate-50">{logs.map(l => (<tr key={l.id} className="hover:bg-slate-50"><td className="p-4 text-xs font-mono text-slate-500">{formatTimeSafe(l.timestamp)}</td><td className="p-4 font-bold text-slate-800">{l.userName}</td><td className="p-4 font-bold text-indigo-600">{l.action}</td><td className="p-4 text-slate-600">{l.details}</td></tr>))}</tbody></table></div></div>
        </div>
    </div>);
};

const AdminSettings: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    return (<div className="h-full flex flex-col bg-slate-50">
        <AdminTopBar activeTab="settings" />
        <div className="px-6">
            <div className="flex items-center gap-2 mb-6">
                <h2 className="text-2xl font-bold text-slate-800">System Settings</h2>
            </div>
            <h2 className="text-2xl font-bold text-slate-800">System Configuration</h2>
        </div><div className="bg-white p-8 rounded-xl border border-slate-200 max-w-2xl space-y-6"><div><label className="block font-bold text-slate-700 mb-2">Laboratory Name</label><input className="border border-slate-300 p-3 rounded-lg w-full outline-none focus:ring-2 focus:ring-indigo-500" defaultValue="LabPro Diagnostics" /></div><div><label className="block font-bold text-slate-700 mb-2">Address</label><input className="border border-slate-300 p-3 rounded-lg w-full outline-none focus:ring-2 focus:ring-indigo-500" defaultValue="123 Medical Plaza, NY" /></div><div><label className="block font-bold text-slate-700 mb-2">Contact Phone</label><input className="border border-slate-300 p-3 rounded-lg w-full outline-none focus:ring-2 focus:ring-indigo-500" defaultValue="+1 (555) 123-4567" /></div><div className="pt-4"><button className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-indigo-700 transition-colors">Save Changes</button></div></div></div>);
};

// --- Print Modal Components ---

const PrintReportModal: React.FC<{ data: Sample[] | Sample; onClose: () => void }> = ({ data, onClose }) => {
    const samples = Array.isArray(data) ? data : [data];
    const handlePrint = () => window.print();

    // Handle keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter') handlePrint();
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    if (!samples || samples.length === 0) return null;
    const firstSample = samples[0];

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1000] p-4 print:p-0 print:bg-white print:fixed print:inset-0 print:z-[9999]" onClick={onClose}>
            {/* Printable content wrapper */}
            <div className="print-modal-root bg-white w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] print:max-h-none print:shadow-none print:w-full print:max-w-none print:rounded-none print:h-full print:absolute print:top-0 print:left-0" onClick={e => e.stopPropagation()}>

                {/* Header - Hidden on print */}
                <div className="bg-slate-800 text-white p-4 flex justify-between items-center print:hidden shrink-0">
                    <h3 className="font-bold flex items-center gap-2"><FileText className="w-5 h-5" /> Report Preview</h3>
                    <div className="flex gap-2">
                        <button onClick={handlePrint} className="bg-indigo-500 hover:bg-indigo-600 px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-all" title="Press Enter to Print">Print Now</button>
                        <button onClick={onClose} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-all" title="Press Esc to Close">Close</button>
                    </div>
                </div>

                {/* Report Content */}
                <div className="printable-area p-8 overflow-y-auto font-serif text-slate-900 bg-white h-full print:p-8 print:overflow-visible">
                    {/* Header Section */}
                    <div className="border-b-4 border-slate-900 pb-6 mb-8 flex justify-between items-end">
                        <div className="w-2/3">
                            <h1 className="text-4xl font-black tracking-tight text-slate-900 uppercase">LabPro Diagnostics</h1>
                            <p className="text-sm font-medium text-slate-600 mt-2">123 Medical Plaza, Suite 400, New York, NY 10001</p>
                            <p className="text-sm font-medium text-slate-600">Phone: +1 (555) 123-4567 | Email: reports@labpro.com</p>
                            <p className="text-xs text-slate-500 mt-1">ISO 15189:2012 Certified Laboratory</p>
                        </div>
                        <div className="text-right w-1/3">
                            <h2 className="text-2xl font-bold uppercase tracking-widest text-slate-300">Medical Report</h2>
                            <p className="font-mono font-bold text-lg mt-1 text-slate-900">SID: {firstSample.sampleLabelId || firstSample.id.slice(0, 8).toUpperCase()}</p>
                            <p className="text-sm text-slate-500 font-medium">{formatDate(firstSample.reportedAt || new Date())}</p>
                        </div>
                    </div>

                    {/* Patient Details Grid */}
                    <div className="grid grid-cols-2 gap-x-12 gap-y-4 mb-8 bg-slate-50 p-6 rounded-lg border border-slate-100 print:bg-transparent print:p-0 print:border-0 print:border-b print:border-slate-200 print:pb-4 print:mb-8 print:rounded-none">
                        <div className="flex justify-between border-b border-slate-200 pb-1">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Patient Name</span>
                            <span className="font-bold text-slate-900 text-lg">{firstSample.patientName}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-200 pb-1">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Age / Gender</span>
                            <span className="font-bold text-slate-900">{firstSample.patientAge || '--'} Yrs / {firstSample.patientGender || '--'}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-200 pb-1">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Referred By</span>
                            <span className="font-bold text-slate-900">Dr. {firstSample.doctorName || 'Self'}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-200 pb-1">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Phone</span>
                            <span className="font-bold text-slate-900">{firstSample.patientPhone || '--'}</span>
                        </div>
                    </div>

                    {/* Tests Loop */}
                    <div className="space-y-10">
                        {samples.map((sample, index) => (
                            <div key={sample.id} className={index > 0 ? "pt-8 border-t-2 border-dashed border-slate-200 print:break-before-auto" : ""}>
                                <div className="mb-6 flex items-center gap-4">
                                    <h3 className="text-xl font-bold text-slate-900 uppercase border-b-2 border-slate-900 inline-block pb-1">{sample.testName}</h3>
                                    <span className="text-xs font-bold bg-slate-100 px-2 py-1 rounded text-slate-500 uppercase tracking-wider print:bg-transparent print:border print:border-slate-300">Sample: {sample.sampleType}</span>
                                </div>

                                <table className="w-full text-left mb-6">
                                    <thead className="border-b-2 border-slate-800">
                                        <tr>
                                            <th className="py-2 pl-2 font-bold uppercase text-xs text-slate-600 w-1/2">Investigation</th>
                                            <th className="py-2 font-bold uppercase text-xs text-slate-600 w-1/4">Result</th>
                                            <th className="py-2 font-bold uppercase text-xs text-slate-600 w-1/4 text-right pr-2">Reference Range</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {sample.results && Object.entries(sample.results).map(([key, val]: [string, any]) => {
                                            const value = typeof val === 'object' ? val.value : val;
                                            const unit = typeof val === 'object' ? val.unit : '';
                                            const flag = typeof val === 'object' ? val.flag : 'N';
                                            const isCritical = flag === 'CL' || flag === 'CH';
                                            const isAbnormal = flag === 'L' || flag === 'H';
                                            const flagLabel = { 'N': '', 'L': 'LOW', 'H': 'HIGH', 'CL': 'CRITICAL LOW', 'CH': 'CRITICAL HIGH' }[flag as string] || '';

                                            return (
                                                <tr key={key}>
                                                    <td className="py-3 pl-2 font-medium text-slate-800">{key}</td>
                                                    <td className="py-3">
                                                        <span className={`font-bold text-md ${isCritical ? 'text-red-600 print:text-black print:font-black' : isAbnormal ? 'text-amber-700 print:text-black print:font-bold' : 'text-slate-900'}`}>{value}</span>
                                                        <span className="text-slate-500 text-xs ml-1">{unit}</span>
                                                        {flagLabel && <span className={`text-[10px] ml-2 font-bold px-1.5 py-0.5 rounded ${isCritical ? 'bg-red-100 text-red-700 print:border print:border-black' : 'bg-amber-100 text-amber-700 print:italic'}`}>{flagLabel}</span>}
                                                    </td>
                                                    <td className="py-3 text-right pr-2 text-slate-500 text-sm">--</td>
                                                </tr>
                                            );
                                        })}
                                        {(!sample.results || Object.keys(sample.results).length === 0) && (
                                            <tr><td colSpan={3} className="py-4 text-center text-slate-400 italic">No quantitative results recorded.</td></tr>
                                        )}
                                    </tbody>
                                </table>

                                {(sample.conclusion || sample.pathologistRemarks) && (
                                    <div className="mb-4 bg-slate-50 p-4 rounded border border-slate-100 print:bg-transparent print:border print:border-slate-300">
                                        {sample.conclusion && (
                                            <div className="mb-2">
                                                <h4 className="font-bold text-xs uppercase text-slate-500 mb-1">Pathologist's Conclusion</h4>
                                                <p className="text-slate-900 text-sm font-medium">{sample.conclusion}</p>
                                            </div>
                                        )}
                                        {sample.pathologistRemarks && (
                                            <div>
                                                <h4 className="font-bold text-xs uppercase text-slate-500 mb-1">Remarks</h4>
                                                <p className="text-slate-800 text-sm">{sample.pathologistRemarks}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Footer / Signature */}
                    <div className="mt-16 pt-8 flex justify-end print:break-inside-avoid">
                        <div className="text-center w-56">
                            <div className="h-20 mb-2 border-b border-slate-900 flex items-end justify-center pb-2">
                                <span className="font-cursive text-2xl text-slate-600 italic">Dr. A. Pathologist</span>
                            </div>
                            <p className="font-bold text-sm text-slate-900 uppercase">Dr. Alice Pathologist</p>
                            <p className="text-xs text-slate-500">MD, Pathology (Reg: 12345)</p>
                            <p className="text-xs text-slate-400 mt-1">Chief Pathologist</p>
                        </div>
                    </div>

                    <div className="mt-8 pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400 flex justify-between">
                        <span>Generated by LabPro System</span>
                        <span>{new Date().toLocaleString()}</span>
                        <span>Page 1 of 1</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const PrintInvoiceModal: React.FC<{ data: PrintableInvoiceData; onClose: () => void }> = ({ data, onClose }) => {
    const handlePrint = () => window.print();

    // Handle keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter') handlePrint();
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    if (!data) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1000] p-4 print:p-0 print:bg-white print:fixed print:inset-0 print:z-[9999]" onClick={onClose}>
            {/* Printable content wrapper */}
            <div className="print-modal-root bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] print:max-h-none print:shadow-none print:w-full print:max-w-none print:rounded-none print:h-full print:absolute print:top-0 print:left-0" onClick={e => e.stopPropagation()}>

                {/* Header - Hidden on print */}
                <div className="bg-slate-800 text-white p-4 flex justify-between items-center print:hidden shrink-0">
                    <h3 className="font-bold flex items-center gap-2"><Printer className="w-5 h-5" /> Print Preview</h3>
                    <div className="flex gap-2">
                        <button onClick={handlePrint} className="bg-indigo-500 hover:bg-indigo-600 px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-all" title="Press Enter to Print">Print Now</button>
                        <button onClick={onClose} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-all" title="Press Esc to Close">Close</button>
                    </div>
                </div>

                {/* Invoice Content */}
                <div className="p-10 print:p-8 text-slate-900 font-serif h-full flex flex-col overflow-y-auto print:overflow-visible">
                    {/* Header */}
                    <div className="border-b-2 border-slate-800 pb-6 mb-6 flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">LabPro Diagnostics</h1>
                            <p className="text-sm text-slate-600 mt-2 leading-relaxed">123 Medical Plaza, Suite 400<br />New York, NY 10001<br />Phone: +1 (555) 123-4567</p>
                        </div>
                        <div className="text-right">
                            <h2 className="text-xl font-bold uppercase tracking-widest text-slate-400">Invoice</h2>
                            <p className="font-mono font-bold text-xl mt-1 text-slate-900">#{(data.orderId || data.invoiceId || 'N/A').slice(0, 8).toUpperCase()}</p>
                            <p className="text-sm text-slate-500 mt-1">{formatDate(data.date || new Date())}</p>
                        </div>
                    </div>

                    {/* Patient Details */}
                    <div className="flex justify-between mb-8 bg-slate-50 p-5 rounded-lg border border-slate-100 print:bg-transparent print:p-0 print:border-0">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Patient Details</p>
                            <p className="font-bold text-lg text-slate-800">{data.patientName || 'N/A'}</p>
                            <p className="text-sm text-slate-700">{data.patientAge || data.age || '--'} / {data.patientGender || data.gender || '--'}</p>
                            <p className="text-sm text-slate-700">{data.patientPhone || 'N/A'}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Referred By</p>
                            <p className="font-bold text-slate-800">{data.doctorName || data.doctor || 'Self'}</p>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-4 mb-1">Payment Mode</p>
                            <p className="uppercase font-bold text-slate-800">{data.paymentMethod || 'Cash'}</p>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="flex-1">
                        <table className="w-full text-left mb-8">
                            <thead className="border-b-2 border-slate-200">
                                <tr>
                                    <th className="py-2 text-sm font-bold uppercase text-slate-500">Test Description</th>
                                    <th className="py-2 text-right text-sm font-bold uppercase text-slate-500">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {(data.items || []).map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="py-3">
                                            <p className="font-bold text-slate-800">{item.testName || item.name || 'N/A'}</p>
                                            <p className="text-xs text-slate-500">{item.code || ''}</p>
                                        </td>
                                        <td className="py-3 text-right font-mono font-medium text-slate-700">${(item.price || 0).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Financial Summary */}
                    <div className="flex justify-end border-t border-slate-200 pt-6">
                        <div className="w-56 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500 font-medium">Subtotal:</span>
                                <span className="font-mono font-bold text-slate-700">${(data.subtotal || data.amount || 0).toFixed(2)}</span>
                            </div>
                            {(data.discount || 0) > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500 font-medium">Discount:</span>
                                    <span className="font-mono font-bold text-red-500">-${(data.discount || 0).toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-xl font-bold border-t border-slate-800 pt-3 mt-2 text-slate-900">
                                <span>Total:</span>
                                <span>${(data.total || ((data.amount || 0) - (data.discount || 0))).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm mt-4 pt-4 border-t border-slate-200">
                                <span className="text-slate-500 font-medium">Amount Paid:</span>
                                <span className="font-mono font-bold text-slate-700">${(data.paid || data.paidAmount || 0).toFixed(2)}</span>
                            </div>
                            {((data.due || 0) > 0 || (((data.total || data.amount || 0) - (data.discount || 0)) - (data.paid || data.paidAmount || 0)) > 0) && (
                                <div className="flex justify-between text-sm text-red-600 bg-red-50 p-2 rounded mt-2 print:bg-transparent print:p-0 print:text-red-600">
                                    <span className="font-bold">Balance Due:</span>
                                    <span className="font-mono font-bold">${(data.due || ((data.total || data.amount || 0) - (data.discount || 0) - (data.paid || data.paidAmount || 0))).toFixed(2)}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-12 pt-8 border-t border-slate-200 text-center text-xs text-slate-400">
                        <p>Thank you for choosing LabPro Diagnostics.</p>
                        <p>This is a computer generated invoice and does not require a signature.</p>
                        <p className="mt-2 font-mono">{data.orderId || data.invoiceId || 'N/A'}</p>
                    </div>
                </div>
            </div>
        </div>
    );
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
    const [viewPatientDetails, setViewPatientDetails] = useState<Patient | null>(null);

    const getDuration = (start: any, end: any) => {
        if (!start) return '--';
        const s = start.toDate ? start.toDate() : new Date(start);
        if (!end) return '--';
        const e = end.toDate ? end.toDate() : new Date(end);
        const diff = Math.max(0, e.getTime() - s.getTime());
        const hrs = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
    };

    const printTATLog = () => {
        const win = window.open('', '', 'width=800,height=600');
        win?.document.write(`
            <html><head><title>TAT Log</title><style>
                body { font-family: sans-serif; padding: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 12px; }
                th { background-color: #f0f0f0; }
                h2 { margin-bottom: 5px; }
                .meta { font-size: 12px; color: #666; margin-bottom: 20px; }
            </style></head>
            <body>
            <h2>Turnaround Time (TAT) Log</h2>
            <div class="meta">Printed: ${new Date().toLocaleString()} | Total Samples: ${trackerSamples.length}</div>
            <table>
                <thead><tr><th>Patient</th><th>Test</th><th>Booked At</th><th>Reported At</th><th>TAT</th></tr></thead>
                <tbody>
                ${trackerSamples.map(s => {
            const start = s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
            const end = s.reportedAt ? (s.reportedAt.toDate ? s.reportedAt.toDate() : new Date(s.reportedAt)) : null;
            const tat = s.status === 'reported' && end ? getDuration(s.createdAt, s.reportedAt) : 'Pending';
            return `<tr><td>${s.patientName}</td><td>${s.testName}</td><td>${start.toLocaleString()}</td><td>${end ? end.toLocaleString() : '--'}</td><td>${tat}</td></tr>`;
        }).join('')}
                </tbody>
            </table>
            <script>window.print(); window.close();</script>
            </body></html>
        `);
        win?.document.close();
    };
    const [viewReport, setViewReport] = useState<Sample[] | null>(null);
    const [patientForm, setPatientForm] = useState({ fullName: '', phone: '', age: '', ageUnit: 'Years', gender: 'male', address: '', referralType: 'self', doctorName: '', clinicName: '', existingId: '' });
    const [cart, setCart] = useState<Test[]>([]);
    const [payment, setPayment] = useState({ method: 'cash', paidAmount: '', discount: 0, discountReason: '' });
    const [testSearch, setTestSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [isUrgent, setIsUrgent] = useState(false);
    const totalAmount = cart.reduce((sum, t) => sum + t.price, 0);
    const urgentFee = isUrgent ? 50 : 0; // Flat urgent fee, or per-test logic
    const finalAmount = Math.max(0, totalAmount + urgentFee - payment.discount);
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
        if (phoneQuery.length < 3) {
            if (!isSilent) alert("Please enter a valid phone number.");
            return;
        }
        setLoading(true);
        try {
            const snap = await db.collection('patients').where('phone', '>=', phoneQuery).limit(1).get();
            if (!snap.empty) {
                const p = snap.docs[0].data() as Patient;
                // Check if we should load
                if (window.confirm(`Patient found: ${p.fullName} (${p.gender}, ${calculateAge(p.dob)} yrs).\n\nLoad existing patient record?`)) {
                    let ageVal = '', ageUnit = 'Years';
                    if (p.dob) { ageVal = calculateAge(p.dob).toString(); }
                    setPatientForm(prev => ({ ...prev, fullName: p.fullName, gender: p.gender as any, address: p.address || '', age: ageVal, existingId: snap.docs[0].id }));
                }
            } else {
                if (!isSilent) alert("Patient not found. You can register as new.");
            }
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

            let doctorName = 'Self'; let doctorId = null; let doctorPhone = ''; let commissionAmt = 0;
            if (patientForm.referralType === 'doctor' && selectedDoctorId) {
                const doc = doctors.find(d => d.id === selectedDoctorId);
                if (doc) {
                    doctorName = doc.name;
                    doctorId = doc.id;
                    doctorPhone = doc.phone;
                    commissionAmt = (finalAmount * (doc.commissionRate || 0)) / 100; // Note: Ensure urgent fee is included or excluded as per policy
                }
            } else if (patientForm.referralType === 'doctor' && patientForm.doctorName) {
                doctorName = patientForm.doctorName;
            }

            const payStatus = dueVal === 0 ? 'paid' : paidVal > 0 ? 'partial' : 'unpaid';
            const orderRef = await db.collection('orders').add({
                patientId,
                patientName: patientForm.fullName,
                doctorName,
                doctorId,
                doctorPhone,
                doctorCommission: commissionAmt,
                commissionPaid: false,
                totalAmount: finalAmount,
                status: 'ordered',
                paymentStatus: payStatus,
                testCount: cart.length,
                isUrgent,
                createdAt: firebase.firestore.Timestamp.now()
            });
            const invoiceRef = await db.collection('invoices').add({ orderId: orderRef.id, patientName: patientForm.fullName, amount: finalAmount, discount: payment.discount, paidAmount: paidVal, status: payStatus, createdAt: firebase.firestore.Timestamp.now(), payments: paidVal > 0 ? [{ amount: paidVal, method: payment.method, date: new Date() }] : [] });
            const batch = db.batch();
            cart.forEach(t => {
                const sRef = db.collection('samples').doc();
                batch.set(sRef, {
                    orderId: orderRef.id,
                    patientId,
                    patientName: patientForm.fullName,
                    patientAge: parseInt(patientForm.age), // Storing snapshot of age
                    patientGender: patientForm.gender,
                    patientPhone: patientForm.phone,
                    testId: t.id,
                    testName: t.name,
                    sampleType: t.sampleType,
                    status: 'ordered',
                    isUrgent,
                    doctorName,
                    doctorPhone,
                    createdAt: firebase.firestore.Timestamp.now()
                });
            });
            await batch.commit();
            setPrintData({
                orderId: invoiceRef.id,
                patientName: patientForm.fullName,
                patientPhone: patientForm.phone,
                patientAge: patientForm.age + ' ' + patientForm.ageUnit,
                patientGender: patientForm.gender,
                date: new Date(),
                doctorName: doctorName,
                items: cart.map(c => ({ testName: c.name, price: c.price, code: c.code })),
                amount: totalAmount,
                discount: payment.discount,
                paidAmount: paidVal,
                paymentMethod: payment.method
            });
            setCart([]); setPatientForm({ fullName: '', phone: '', age: '', ageUnit: 'Years', gender: 'male', address: '', referralType: 'self', doctorName: '', clinicName: '', existingId: '' }); setPayment({ method: 'cash', paidAmount: '', discount: 0, discountReason: '' }); setSelectedDoctorId(''); setIsUrgent(false);
        } catch (e) { console.error(e); alert("Failed to book order."); } finally { setLoading(false); }
    };

    const selectPatient = (p: Patient) => { let ageVal = '', ageUnit = 'Years'; if (p.dob) { ageVal = calculateAge(p.dob).toString(); } setPatientForm({ fullName: p.fullName, phone: p.phone, age: ageVal, ageUnit: 'Years', gender: p.gender as any, address: p.address || '', referralType: 'self', doctorName: '', clinicName: '', existingId: p.id }); setSubView('new-order'); };
    const handleRejectSample = async (sample: Sample) => { const reason = prompt("Enter rejection reason (e.g., Hemolyzed, Wrong Tube):"); if (!reason) return; try { await db.collection('samples').doc(sample.id).update({ status: 'ordered', notes: `RECOLLECTION REQUESTED: ${reason}`, rejectedAt: firebase.firestore.Timestamp.now(), rejectedBy: 'Receptionist' }); alert("Sample flagged for recollection."); } catch (e) { console.error(e); alert("Failed to reject sample"); } };

    const fetchAndShowPatientDetails = async (pid: string) => {
        if (!pid) return;
        try {
            const snap = await db.collection('patients').doc(pid).get();
            if (snap.exists) setViewPatientDetails({ id: snap.id, ...snap.data() } as Patient);
            else alert("Patient record not found.");
        } catch (e) { console.error(e); alert("Error fetching details"); }
    };

    const fetchAndPrintReport = async (orderId: string) => {
        try {
            const snap = await db.collection('samples').where('orderId', '==', orderId).where('status', '==', 'reported').get();
            if (snap.empty) { alert("No reported samples found for this order."); return; }
            const samples = snap.docs.map(d => ({ id: d.id, ...d.data() } as Sample));
            setViewReport(samples);
        } catch (e) { console.error(e); alert("Error loading report."); }
    };

    const renderNewOrder = () => (
        <div className="h-full flex flex-col md:flex-row overflow-hidden" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN }}>
            <div className="w-full md:w-1/3 border-r border-[#0a9396]/20 overflow-y-auto p-6 scrollbar-thin" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN }}>
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2" style={{ color: COLORS.CITRON }}><User className="w-5 h-5" style={{ color: COLORS.GAMBOGE }} /> Patient Details</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold uppercase mb-1" style={{ color: COLORS.TIFFANY_BLUE }}>Phone Number</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Phone className="w-4 h-4 absolute left-3 top-3" style={{ color: COLORS.TIFFANY_BLUE }} />
                                <input type="tel" value={patientForm.phone} onChange={e => setPatientForm({ ...patientForm, phone: e.target.value })} placeholder="Search or Enter Phone" className="w-full pl-9 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-[#ee9b00] outline-none transition-all" style={{ backgroundColor: COLORS.RICH_BLACK, borderColor: 'transparent', color: COLORS.CITRON }} />
                            </div>
                            <button onClick={() => handlePatientSearch()} className="p-2.5 rounded-lg transition-colors hover:opacity-80" style={{ backgroundColor: COLORS.PERSIAN_GREEN, color: COLORS.RICH_BLACK }}><Search className="w-4 h-4" /></button>
                        </div>
                    </div>
                    <div><label className="block text-xs font-bold uppercase mb-1" style={{ color: COLORS.TIFFANY_BLUE }}>Full Name</label><input value={patientForm.fullName} onChange={e => setPatientForm({ ...patientForm, fullName: e.target.value })} placeholder="Patient Name" className="w-full p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-[#ee9b00] outline-none" style={{ backgroundColor: COLORS.RICH_BLACK, borderColor: 'transparent', color: COLORS.CITRON }} /></div>
                    <div className="flex gap-3"><div className="flex-1"><label className="block text-xs font-bold uppercase mb-1" style={{ color: COLORS.TIFFANY_BLUE }}>Age</label><div className="flex"><input type="number" value={patientForm.age} onChange={e => setPatientForm({ ...patientForm, age: e.target.value })} className="w-full p-2.5 rounded-l-lg text-sm focus:ring-2 focus:ring-[#ee9b00] outline-none" style={{ backgroundColor: COLORS.RICH_BLACK, borderColor: 'transparent', color: COLORS.CITRON }} /><select value={patientForm.ageUnit} onChange={e => setPatientForm({ ...patientForm, ageUnit: e.target.value })} className="rounded-r-lg text-xs px-2 outline-none font-medium" style={{ backgroundColor: COLORS.RICH_BLACK, borderColor: 'transparent', color: COLORS.TIFFANY_BLUE }}><option>Years</option><option>Months</option><option>Days</option></select></div></div><div className="flex-1"><label className="block text-xs font-bold uppercase mb-1" style={{ color: COLORS.TIFFANY_BLUE }}>Gender</label><select value={patientForm.gender} onChange={e => setPatientForm({ ...patientForm, gender: e.target.value as any })} className="w-full p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-[#ee9b00] outline-none" style={{ backgroundColor: COLORS.RICH_BLACK, borderColor: 'transparent', color: COLORS.CITRON }}><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div></div>
                    <div>
                        <label className="block text-xs font-bold uppercase mb-1" style={{ color: COLORS.TIFFANY_BLUE }}>Referral By</label>
                        <div className="flex p-1 rounded-lg mb-2" style={{ backgroundColor: COLORS.RICH_BLACK }}>
                            <button onClick={() => setPatientForm({ ...patientForm, referralType: 'self' })} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${patientForm.referralType === 'self' ? 'shadow-sm' : 'opacity-50'}`} style={{ backgroundColor: patientForm.referralType === 'self' ? COLORS.MIDNIGHT_GREEN : 'transparent', color: patientForm.referralType === 'self' ? COLORS.CITRON : COLORS.TIFFANY_BLUE }}>Self</button>
                            <button onClick={() => setPatientForm({ ...patientForm, referralType: 'doctor' })} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${patientForm.referralType === 'doctor' ? 'shadow-sm' : 'opacity-50'}`} style={{ backgroundColor: patientForm.referralType === 'doctor' ? COLORS.MIDNIGHT_GREEN : 'transparent', color: patientForm.referralType === 'doctor' ? COLORS.CITRON : COLORS.TIFFANY_BLUE }}>Doctor</button>
                        </div>
                        {patientForm.referralType === 'doctor' && (<div className="animate-in fade-in slide-in-from-top-1 space-y-2"><select value={selectedDoctorId} onChange={(e) => { setSelectedDoctorId(e.target.value); if (e.target.value) setPatientForm({ ...patientForm, doctorName: '' }); }} className="w-full p-2.5 rounded-lg text-sm outline-none" style={{ backgroundColor: COLORS.RICH_BLACK, color: COLORS.CITRON }}><option value="">-- Select Registered Doctor --</option>{doctors.map(d => <option key={d.id} value={d.id}>{d.name} ({d.clinic})</option>)}</select><p className="text-center text-xs font-bold" style={{ color: COLORS.TIFFANY_BLUE }}>- OR -</p><input value={patientForm.doctorName} onChange={e => { setPatientForm({ ...patientForm, doctorName: e.target.value }); setSelectedDoctorId(''); }} placeholder="Enter Manual Name" className="w-full p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-[#ee9b00] outline-none" style={{ backgroundColor: COLORS.RICH_BLACK, color: COLORS.CITRON }} /></div>)}
                    </div>
                </div>
                <div className="mt-8 pt-6 border-t border-[#0a9396]/20">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2" style={{ color: COLORS.CITRON }}><CreditCard className="w-5 h-5" style={{ color: COLORS.GAMBOGE }} /> Payment</h3>
                    <div className="p-4 rounded-xl space-y-3" style={{ backgroundColor: COLORS.RICH_BLACK, border: `1px solid ${COLORS.MIDNIGHT_GREEN}` }}>
                        <div className="flex justify-between text-sm" style={{ color: COLORS.TIFFANY_BLUE }}><span>Subtotal ({cart.length} tests)</span><span className="font-mono font-bold" style={{ color: COLORS.CITRON }}>${totalAmount}</span></div>

                        {/* Urgent Checkbox */}
                        <div className="flex items-center justify-between py-2 border-b border-dashed border-slate-200">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={isUrgent} onChange={e => setIsUrgent(e.target.checked)} className="w-4 h-4 text-red-600 border-red-300 rounded focus:ring-red-500" />
                                <span className="text-sm font-bold text-red-600 flex items-center gap-1"><Zap className="w-4 h-4 fill-current" /> Urgent Processing</span>
                            </label>
                            <span className="font-mono font-bold text-red-600">+{urgentFee}</span>
                        </div>

                        <div className="flex justify-between items-center text-sm mb-2" style={{ color: COLORS.TIFFANY_BLUE }}><span>Discount</span><div className="flex items-center gap-1"><span className="font-bold opacity-50">-</span><input type="number" value={payment.discount} onChange={e => setPayment({ ...payment, discount: parseFloat(e.target.value) || 0 })} className="w-16 p-1 text-right border rounded font-mono text-xs outline-none focus:ring-1 focus:ring-[#ee9b00]" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, borderColor: COLORS.PERSIAN_GREEN, color: COLORS.CITRON }} /></div></div>
                        <div className="flex justify-between items-center text-lg font-bold pt-3 border-t border-dashed border-slate-700" style={{ color: COLORS.GAMBOGE }}><span>Total Payable</span><span>${finalAmount}</span></div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold uppercase mb-1" style={{ color: COLORS.TIFFANY_BLUE }}>Amount Paid</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 font-bold opacity-50" style={{ color: COLORS.TIFFANY_BLUE }}>$</span>
                                <input type="number" value={payment.paidAmount} onChange={e => setPayment({ ...payment, paidAmount: e.target.value })} className="w-full pl-6 pr-2 py-2 rounded-lg text-sm font-bold focus:ring-2 focus:ring-[#ee9b00] outline-none" style={{ backgroundColor: COLORS.RICH_BLACK, borderColor: 'transparent', color: COLORS.CITRON }} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase mb-1" style={{ color: COLORS.TIFFANY_BLUE }}>Method</label>
                            <select value={payment.method} onChange={e => setPayment({ ...payment, method: e.target.value })} className="w-full p-2 rounded-lg text-sm outline-none" style={{ backgroundColor: COLORS.RICH_BLACK, borderColor: 'transparent', color: COLORS.CITRON }}><option value="cash">Cash</option><option value="card">Card</option><option value="upi">UPI/Online</option></select>
                        </div>
                    </div>
                    <div className="mt-6">
                        <button onClick={handleBookOrder} disabled={loading || cart.length === 0 || !patientForm.fullName} className="w-full py-3.5 rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:shadow-none transition-all flex justify-center items-center gap-2" style={{ backgroundColor: COLORS.GAMBOGE, color: COLORS.RICH_BLACK }}>
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />} Confirm Order
                        </button>
                        {cart.length === 0 && <p className="text-xs text-center mt-2 opacity-50" style={{ color: COLORS.TIFFANY_BLUE }}>Add tests to proceed</p>}
                    </div>
                </div>
            </div>
            <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ backgroundColor: COLORS.RICH_BLACK }}>
                <div className="p-4 border-b border-[#0a9396]/20 shadow-sm z-10" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN }}>
                    <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                        <div><h3 className="font-bold text-lg" style={{ color: COLORS.CITRON }}>Test Catalog</h3><p className="text-xs opacity-70" style={{ color: COLORS.TIFFANY_BLUE }}>{cart.length} tests selected</p></div>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <div className="relative flex-1 sm:w-64"><Search className="w-4 h-4 absolute left-3 top-2.5 opacity-50" style={{ color: COLORS.TIFFANY_BLUE }} /><input value={testSearch} onChange={e => setTestSearch(e.target.value)} placeholder="Search test name or code..." className="w-full pl-9 pr-4 py-2 rounded-lg text-sm focus:ring-2 focus:ring-[#ee9b00] outline-none" style={{ backgroundColor: COLORS.RICH_BLACK, color: COLORS.CITRON }} /></div>
                            <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="p-2 rounded-lg text-sm outline-none max-w-[140px]" style={{ backgroundColor: COLORS.RICH_BLACK, color: COLORS.CITRON }}>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
                        </div>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filteredTests.map(t => {
                            const isSelected = cart.some(c => c.id === t.id);
                            return (
                                <div key={t.id} onClick={() => { if (isSelected) setCart(cart.filter(c => c.id !== t.id)); else setCart([...cart, t]); }} className={`p-4 rounded-xl border cursor-pointer transition-all group ${isSelected ? 'ring-1 ring-[#0a9396]' : 'hover:border-[#0a9396]/50 hover:shadow-md'}`} style={{ backgroundColor: isSelected ? COLORS.MIDNIGHT_GREEN : COLORS.RICH_BLACK, borderColor: isSelected ? COLORS.PERSIAN_GREEN : `${COLORS.PERSIAN_GREEN}30` }}>
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-sm line-clamp-2 leading-tight pr-2" style={{ color: COLORS.CITRON }}>{t.name}</h4>
                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${isSelected ? '' : 'bg-transparent'}`} style={{ borderColor: COLORS.TIFFANY_BLUE, backgroundColor: isSelected ? COLORS.PERSIAN_GREEN : 'transparent' }}>{isSelected && <Check className="w-3 h-3 text-white" />}</div>
                                    </div>
                                    <div className="flex flex-wrap gap-1 mb-3">
                                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ backgroundColor: `${COLORS.PERSIAN_GREEN}20`, color: COLORS.TIFFANY_BLUE }}>{t.code}</span>
                                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ backgroundColor: `${COLORS.PERSIAN_GREEN}20`, color: COLORS.TIFFANY_BLUE }}>{t.sampleType}</span>
                                    </div>
                                    <div className="flex justify-between items-end border-t pt-2 mt-auto" style={{ borderColor: `${COLORS.PERSIAN_GREEN}20` }}>
                                        <span className="text-[10px] font-medium opacity-50" style={{ color: COLORS.TIFFANY_BLUE }}>{t.category}</span>
                                        <span className="font-bold" style={{ color: COLORS.GAMBOGE }}>${t.price}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {filteredTests.length === 0 && (<div className="flex flex-col items-center justify-center h-64 text-slate-400"><FileText className="w-12 h-12 mb-3 opacity-20" /><p style={{ color: COLORS.TIFFANY_BLUE }}>No tests found matching your search.</p></div>)}
                </div>
            </div>
        </div>
    );

    const renderDashboard = () => (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in p-6">
            <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-5 rounded-xl shadow-sm flex items-center justify-between" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, border: `1px solid ${COLORS.PERSIAN_GREEN}30` }}>
                    <div><p className="text-xs font-bold uppercase mb-1" style={{ color: COLORS.TIFFANY_BLUE }}>Today's Orders</p><p className="text-2xl font-bold" style={{ color: COLORS.CITRON }}>{stats.todayOrders}</p></div>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${COLORS.PERSIAN_GREEN}20`, color: COLORS.PERSIAN_GREEN }}><ClipboardList className="w-5 h-5" /></div>
                </div>
                <div className="p-5 rounded-xl shadow-sm flex items-center justify-between" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, border: `1px solid ${COLORS.PERSIAN_GREEN}30` }}>
                    <div><p className="text-xs font-bold uppercase mb-1" style={{ color: COLORS.TIFFANY_BLUE }}>Pending Dues</p><p className="text-2xl font-bold" style={{ color: COLORS.ALLOY_ORANGE }}>3</p></div>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${COLORS.ALLOY_ORANGE}20`, color: COLORS.ALLOY_ORANGE }}><AlertCircle className="w-5 h-5" /></div>
                </div>
                <div className="p-5 rounded-xl shadow-sm flex items-center justify-between" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, border: `1px solid ${COLORS.PERSIAN_GREEN}30` }}>
                    <div><p className="text-xs font-bold uppercase mb-1" style={{ color: COLORS.TIFFANY_BLUE }}>Completed</p><p className="text-2xl font-bold" style={{ color: '#4ade80' }}>12</p></div>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-green-900/30">
                        <div className="bg-green-500 rounded-full p-1"><Check className="w-4 h-4 text-white font-bold" /></div>
                    </div>
                </div>
                <div className="p-5 rounded-xl shadow-sm flex items-center justify-between" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, border: `1px solid ${COLORS.PERSIAN_GREEN}30` }}>
                    <div><p className="text-xs font-bold uppercase mb-1" style={{ color: COLORS.TIFFANY_BLUE }}>Revenue Today</p><p className="text-2xl font-bold" style={{ color: COLORS.CITRON }}>${stats.todaySales.toLocaleString()}</p></div>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${COLORS.GAMBOGE}20`, color: COLORS.GAMBOGE }}><DollarSign className="w-5 h-5" /></div>
                </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <button onClick={() => setSubView('new-order')} className="p-6 rounded-xl shadow-lg transition-all text-left group hover:scale-[1.02]" style={{ backgroundColor: COLORS.GAMBOGE }}>
                        <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center mb-4"><Plus className="w-6 h-6 text-white" /></div>
                        <h3 className="font-bold text-lg text-white">Book New Order</h3>
                        <p className="text-white/80 text-sm mt-1">Register patient & tests</p>
                    </button>
                    <button onClick={() => setSubView('reports')} className="p-6 rounded-xl border transition-all text-left group hover:border-[#0a9396]/50" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, borderColor: `${COLORS.PERSIAN_GREEN}30` }}>
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: `${COLORS.PERSIAN_GREEN}20` }}><Printer className="w-6 h-6" style={{ color: COLORS.PERSIAN_GREEN }} /></div>
                        <h3 className="font-bold text-lg" style={{ color: COLORS.CITRON }}>Print Reports</h3>
                        <p className="text-sm mt-1 opacity-70" style={{ color: COLORS.TIFFANY_BLUE }}>View & Print Results</p>
                    </button>
                    <button onClick={() => setSubView('search-patients')} className="p-6 rounded-xl border transition-all text-left group hover:border-[#0a9396]/50" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, borderColor: `${COLORS.PERSIAN_GREEN}30` }}>
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: `${COLORS.ALLOY_ORANGE}20` }}><Search className="w-6 h-6" style={{ color: COLORS.ALLOY_ORANGE }} /></div>
                        <h3 className="font-bold text-lg" style={{ color: COLORS.CITRON }}>Patient Search</h3>
                        <p className="text-sm mt-1 opacity-70" style={{ color: COLORS.TIFFANY_BLUE }}>History & records</p>
                    </button>
                </div>

                <div className="p-5 rounded-xl border shadow-sm" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, borderColor: `${COLORS.PERSIAN_GREEN}30` }}>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold flex items-center gap-2" style={{ color: COLORS.CITRON }}><Activity className="w-5 h-5" style={{ color: COLORS.GAMBOGE }} /> Live Test Tracker</h3>
                        <button onClick={printTATLog} className="text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-white/5 transition-colors" style={{ color: COLORS.TIFFANY_BLUE, border: `1px solid ${COLORS.PERSIAN_GREEN}30` }}><Printer className="w-3 h-3" /> Print TAT Log</button>
                    </div>
                    <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                        {trackerSamples.map(s => {
                            let statusColor = `bg-[${COLORS.RICH_BLACK}] text-[${COLORS.TIFFANY_BLUE}] border border-[#0a9396]/20`;
                            let statusText = s.status;
                            let timeDisplay = '';

                            // TAT Calculation
                            const getDuration = (start: any, end: any) => {
                                if (!start) return '--';
                                const s = start.toDate ? start.toDate() : new Date(start);
                                if (!end && s.status === 'reported') return '--'; // Should have reportedAt
                                const e = end ? (end.toDate ? end.toDate() : new Date(end)) : new Date();
                                const diff = Math.max(0, e.getTime() - s.getTime());
                                const hrs = Math.floor(diff / 3600000);
                                const mins = Math.floor((diff % 3600000) / 60000);
                                return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
                            };

                            if (s.status === 'ordered') { statusText = 'Pending Collection'; statusColor = `bg-gray-100/10 text-gray-300 border border-gray-500/30`; }
                            else if (s.status === 'collected') { statusText = 'In Lab / Analyzing'; statusColor = `bg-[#0a9396]/10 text-[#0a9396] border border-[#0a9396]/30`; }
                            else if (s.status === 'reported') { statusText = 'Ready'; statusColor = `bg-green-600 text-white border border-green-700 font-bold`; }
                            else if (s.status === 'rejected') { statusText = 'Rejected'; statusColor = `bg-red-600 text-white border border-red-700 font-bold`; }

                            return (
                                <div key={s.id} className="p-3 rounded-lg transition-colors border-b last:border-0 group/row" style={{ borderColor: `${COLORS.PERSIAN_GREEN}20`, backgroundColor: 'transparent' }}>
                                    <div className="flex gap-4 items-start">
                                        <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-1" style={{ backgroundColor: `${COLORS.PERSIAN_GREEN}20`, color: COLORS.TIFFANY_BLUE }}>{s.patientName.slice(0, 2).toUpperCase()}</div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start">
                                                <div><p className="text-sm font-bold truncate" style={{ color: COLORS.CITRON }}>{s.patientName}</p><p className="text-xs truncate" style={{ color: COLORS.TIFFANY_BLUE }}>{s.testName}</p></div>
                                                <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full whitespace-nowrap ${statusColor}`}>{statusText}</span>
                                            </div>
                                            <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-mono p-1.5 rounded border" style={{ backgroundColor: COLORS.RICH_BLACK, borderColor: `${COLORS.PERSIAN_GREEN}20`, color: COLORS.TIFFANY_BLUE }}>
                                                <span title="Booking Time">📅 {formatTimeSafe(s.createdAt)}</span>
                                                {s.collectedAt && <span title="Time in Collection">➜ 💉 {getDuration(s.createdAt, s.collectedAt)}</span>}
                                                {s.analyzedAt && <span title="Time in Analysis">➜ 🔬 {getDuration(s.collectedAt, s.analyzedAt)}</span>}
                                                {s.reportedAt && <span title="Time in Approval">➜ ✅ {getDuration(s.analyzedAt, s.reportedAt)}</span>}
                                                {s.reportedAt && <span className="font-bold ml-auto" style={{ color: COLORS.GAMBOGE }} title="Total Turnaround Time">Total: {getDuration(s.createdAt, s.reportedAt)}</span>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}{trackerSamples.length === 0 && (<p className="text-center text-sm py-4 opacity-50" style={{ color: COLORS.TIFFANY_BLUE }}>No recent test activity.</p>)}</div></div></div>
            <div className="space-y-6">
                <div className="p-5 rounded-xl border" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, borderColor: `${COLORS.PERSIAN_GREEN}30` }}>
                    <h3 className="font-bold mb-2 flex items-center gap-2" style={{ color: COLORS.CITRON }}><Bell className="w-4 h-4" style={{ color: COLORS.GAMBOGE }} /> Notifications</h3>
                    <div className="space-y-3">
                        {notifications.length > 0 ? notifications.map((n, idx) => {
                            let notifClass = "";
                            let iconColor = "";
                            if (n.type === 'alert') {
                                notifClass = "bg-red-600 text-white border-red-700";
                                iconColor = "text-white";
                            } else if (n.type === 'warning' || n.type === 'info') {
                                notifClass = "bg-amber-400 text-slate-900 border-amber-500";
                                iconColor = "text-slate-900";
                            } else {
                                notifClass = "bg-slate-700 text-slate-200 border-slate-600";
                                iconColor = "text-blue-400";
                            }

                            return (
                                <div key={n.id || idx} className={`flex gap-3 items-center text-sm p-3 rounded-lg border shadow-sm ${notifClass}`}>
                                    {n.type === 'alert' ? <AlertTriangle className={`w-5 h-5 shrink-0 ${iconColor}`} /> : <CheckCircle2 className={`w-5 h-5 shrink-0 ${iconColor}`} />}
                                    <span className="leading-snug font-medium">{n.text}</span>
                                </div>
                            )
                        }) : (<p className="text-xs italic opacity-50" style={{ color: COLORS.TIFFANY_BLUE }}>No new notifications.</p>)}
                    </div>
                </div>
            </div>
        </div>
    );

    const [criticalSamples, setCriticalSamples] = useState<Sample[]>([]);

    useEffect(() => {
        // Listen for Critical Samples (reported or review) that are NOT yet fully communicated/closed if we had a 'closed' status, 
        // but here we just list all recent criticals for management.
        const unsubCritical = db.collection('samples').where('isCritical', '==', true).orderBy('createdAt', 'desc').limit(50).onSnapshot(s => setCriticalSamples(s.docs.map(d => ({ id: d.id, ...d.data() } as Sample))));

        // Listen to global notifications
        const unsubNotifs = db.collection('notifications').where('targetRole', '==', 'reception').orderBy('createdAt', 'desc').limit(20).onSnapshot(s => {
            setNotifications(s.docs.map(d => ({ id: d.id, ...d.data() } as any)));
        });

        return () => { unsubCritical(); unsubNotifs(); };
    }, []);

    const handleMarkCriticalReported = async (sample: Sample) => {
        const doctorName = prompt("Enter Doctor Name informed:", sample.doctorName || "");
        if (!doctorName) return;
        const method = prompt("Communication Method (Call/SMS/Email):", "Call");

        try {
            await db.collection('critical_logs').add({
                sampleId: sample.id,
                patientName: sample.patientName,
                testName: sample.testName,
                criticalValue: "Refer to Report", // Simplification, or parse results
                reportedBy: auth.currentUser?.email || 'Receptionist',
                reportedTo: doctorName,
                method: method,
                timestamp: firebase.firestore.Timestamp.now()
            });
            await db.collection('samples').doc(sample.id).update({
                criticalReported: true,
                criticalReportedAt: firebase.firestore.Timestamp.now(),
                criticalReportedBy: auth.currentUser?.email
            });
            alert("Marked as Reported.");
        } catch (e) { console.error(e); alert("Failed to log action."); }
    };

    const downloadCriticalLog = async () => {
        // Simple CSV export of critical_logs
        const snap = await db.collection('critical_logs').orderBy('timestamp', 'desc').limit(100).get();
        const rows = [["Date", "Patient", "Test", "Reported To", "Method", "Staff"]];
        snap.forEach(d => {
            const data = d.data();
            rows.push([data.timestamp?.toDate().toLocaleString() || '', data.patientName, data.testName, data.reportedTo, data.method, data.reportedBy]);
        });
        const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "critical_communication_log.csv");
        document.body.appendChild(link);
        link.click();
    };

    const renderCriticalReports = () => (
        <div className="h-full flex flex-col p-6" style={{ backgroundColor: `${COLORS.RICH_BLACK}` }}>
            <div className="flex justify-between items-center mb-6 bg-red-950/50 p-4 rounded-xl border border-red-900/50">
                <div><h3 className="text-2xl font-bold flex items-center gap-2 text-red-50"><AlertTriangle className="w-8 h-8 text-red-500" /> Critical Results Management</h3><p className="text-red-200 font-medium">Urgent action required for these patients.</p></div>
                <button onClick={downloadCriticalLog} className="border border-red-500 text-red-200 px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors hover:bg-red-900/40"><Download className="w-4 h-4" /> Download Log</button>
            </div>
            <div className="flex-1 overflow-y-auto rounded-xl shadow border border-red-900" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN }}>
                <table className="w-full text-left">
                    <thead className="bg-red-900/40 border-b border-red-900">
                        <tr><th className="p-4 text-red-100">Date/Time</th><th className="p-4 text-red-100">Patient</th><th className="p-4 text-red-100">Contact</th><th className="p-4 text-red-100">Test</th><th className="p-4 text-red-100">Status</th><th className="p-4 text-right text-red-100">Action</th></tr>
                    </thead>
                    <tbody className="divide-y divide-red-900/20">
                        {criticalSamples.map(s => {
                            const hasDoctor = s.doctorName && s.doctorName !== 'Self';
                            const contactName = hasDoctor ? `Dr. ${s.doctorName}` : 'Patient';
                            const contactPhone = hasDoctor ? s.doctorPhone : s.patientPhone;

                            return (
                                <tr key={s.id} className="hover:bg-red-900/10 transition-colors">
                                    <td className="p-4 text-sm font-medium opacity-70" style={{ color: COLORS.TIFFANY_BLUE }}>{formatDate(s.analyzedAt || s.createdAt)}</td>
                                    <td className="p-4 font-bold" style={{ color: COLORS.CITRON }}>{s.patientName}<div className="text-xs font-normal opacity-70" style={{ color: COLORS.TIFFANY_BLUE }}>{s.patientAge}Y / {s.patientGender}</div></td>
                                    <td className="p-4 text-sm">
                                        <div className="font-bold" style={{ color: COLORS.CITRON }}>{contactName}</div>
                                        <div className="text-xs flex items-center gap-1 opacity-70" style={{ color: COLORS.TIFFANY_BLUE }}><Phone className="w-3 h-3" /> {contactPhone || 'No Phone'}</div>
                                    </td>
                                    <td className="p-4" style={{ color: COLORS.CITRON }}>{s.testName} {s.isUrgent && <span className="bg-red-600 text-white text-[10px] px-1 rounded uppercase font-bold ml-1">URGENT</span>}</td>
                                    <td className="p-4">
                                        {s.criticalReported ? <span className="bg-green-600 text-white px-2 py-1 rounded text-xs font-bold flex items-center gap-1 w-fit"><CheckCircle2 className="w-3 h-3" /> Reported</span> : <span className="bg-red-600 text-white border-2 border-white px-2 py-1 rounded text-xs font-bold animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.6)]">PENDING ACTION</span>}
                                    </td>
                                    <td className="p-4 text-right">
                                        {!s.criticalReported && <button onClick={() => handleMarkCriticalReported(s)} className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-500 hover:scale-105 transition-all shadow-lg shadow-red-900/50">Mark Reported</button>}
                                        {s.criticalReported && <span className="text-xs italic opacity-50" style={{ color: COLORS.TIFFANY_BLUE }}>By {s.criticalReportedBy}</span>}
                                    </td>
                                </tr>
                            );
                        })}
                        {criticalSamples.length === 0 && <tr><td colSpan={6} className="p-8 text-center opacity-50" style={{ color: COLORS.TIFFANY_BLUE }}>No critical results found.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const handleModuleBack = () => {
        if (subView !== 'dashboard') {
            setSubView('dashboard');
        } else if (onBack) {
            onBack();
        }
    };

    return (
        <div className="h-full flex flex-col" style={{ backgroundColor: COLORS.RICH_BLACK }}>
            {printData && <PrintInvoiceModal data={printData} onClose={() => setPrintData(null)} />}

            {viewReport && <PrintReportModal data={viewReport} onClose={() => setViewReport(null)} />}
            {viewPatientDetails && <PatientDetailsModal patient={viewPatientDetails} onClose={() => setViewPatientDetails(null)} />}
            <div className="flex items-center justify-between px-6 py-3 border-b shadow-sm z-30 shrink-0" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, borderColor: `${COLORS.PERSIAN_GREEN}30` }}>
                <div className="flex items-center gap-4">
                    {onBack && <button onClick={handleModuleBack} className="p-2 rounded-full hover:bg-white/10" style={{ color: COLORS.CITRON }}><ArrowRight className="w-5 h-5 rotate-180" /></button>}
                    <h2 className="text-2xl font-bold" style={{ color: COLORS.CITRON }}>Reception Desk</h2>
                    <div className="hidden md:flex p-1 rounded-lg" style={{ backgroundColor: COLORS.RICH_BLACK }}>
                        {['dashboard', 'new-order', 'history', 'reports', 'critical-reports', 'search-patients'].map(v => (
                            <button key={v} onClick={() => setSubView(v as any)} className={`px-4 py-1.5 rounded-md text-sm font-bold capitalize transition-all ${subView === v ? 'shadow-sm' : 'hover:opacity-80'}`} style={{ backgroundColor: subView === v ? COLORS.GAMBOGE : 'transparent', color: subView === v ? COLORS.RICH_BLACK : COLORS.TIFFANY_BLUE }}>
                                {v.replace('-', ' ')}
                            </button>
                        ))}
                    </div>
                </div>
                {subView === 'dashboard' && (<button onClick={() => setSubView('new-order')} className="px-4 py-2 rounded-lg flex items-center gap-2 font-bold shadow hover:opacity-90 transition-opacity" style={{ backgroundColor: COLORS.GAMBOGE, color: COLORS.RICH_BLACK }}><Plus className="w-4 h-4" /> New Order</button>)}
            </div>
            <div className="flex-1 min-h-0 overflow-hidden relative">
                {subView === 'dashboard' && <div className="overflow-y-auto h-full pb-20 custom-scrollbar">{renderDashboard()}</div>}
                {subView === 'new-order' && renderNewOrder()}
                {subView === 'history' && <div className="overflow-y-auto h-full p-6 pb-20 custom-scrollbar"><OrderHistoryTable onViewDetails={fetchAndShowPatientDetails} onPrintReport={fetchAndPrintReport} /></div>}
                {subView === 'reports' && <div className="overflow-y-auto h-full p-6 pb-20 custom-scrollbar"><ReceptionReportsTable onPrint={(s) => setViewReport(s)} /></div>}
                {subView === 'critical-reports' && renderCriticalReports()}
                {subView === 'search-patients' && <PatientSearchPanel onSelect={selectPatient} onViewDetails={(p) => setViewPatientDetails(p)} />}
            </div>
        </div>
    );
};

const PhlebotomyModule: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
    const [samples, setSamples] = useState<Sample[]>([]);
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null);
    const [selectedVisit, setSelectedVisit] = useState<{ orderId: string; tests: Sample[] } | null>(null);
    const [consumedItems, setConsumedItems] = useState<{ itemId: string, itemName: string, quantity: number }[]>([]);

    useEffect(() => {
        const unsubQueue = db.collection('samples').where('status', '==', 'ordered').onSnapshot(s => setSamples(s.docs.map(d => ({ id: d.id, ...d.data() } as Sample))));
        const unsubInv = db.collection('inventory_items').where('status', '!=', 'out_of_stock').onSnapshot(s => setInventoryItems(s.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem))));
        return () => { unsubQueue(); unsubInv(); };
    }, []);

    // Group samples by patient visit (orderId)
    const patientVisits = useMemo(() => {
        const visitMap: Record<string, { orderId: string; patientName: string; patientPhone?: string; tests: Sample[]; isUrgent: boolean; createdAt: any }> = {};
        samples.forEach(s => {
            const key = s.orderId || s.patientId;
            if (!visitMap[key]) {
                visitMap[key] = {
                    orderId: s.orderId,
                    patientName: s.patientName,
                    patientPhone: s.patientPhone,
                    tests: [],
                    isUrgent: s.isUrgent || false,
                    createdAt: s.createdAt
                };
            }
            visitMap[key].tests.push(s);
        });
        return Object.values(visitMap).sort((a, b) => {
            if (a.isUrgent && !b.isUrgent) return -1;
            if (!a.isUrgent && b.isUrgent) return 1;
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date();
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date();
            return dateA.getTime() - dateB.getTime();
        });
    }, [samples]);

    const openCollectionModal = async (visit: typeof patientVisits[0]) => {
        setSelectedVisit({ orderId: visit.orderId, tests: visit.tests });

        // Aggregate inventory requirements from all tests
        const allReqs: { itemId: string, itemName: string, quantity: number }[] = [];
        for (const sample of visit.tests) {
            try {
                const testSnap = await db.collection('tests').doc(sample.testId).get();
                if (testSnap.exists) {
                    const testData = testSnap.data() as Test;
                    if (testData.inventoryRequirements) {
                        testData.inventoryRequirements.forEach(req => {
                            const existing = allReqs.find(r => r.itemId === req.itemId);
                            if (existing) {
                                existing.quantity += req.quantity;
                            } else {
                                allReqs.push({ ...req });
                            }
                        });
                    }
                }
            } catch (e) {
                console.error("Error fetching test requirements", e);
            }
        }
        setConsumedItems(allReqs);
    };

    const handleConfirmCollection = async () => {
        if (!selectedVisit) return;

        try {
            const batch = db.batch();

            // Mark all tests in visit as collected
            selectedVisit.tests.forEach((sample, idx) => {
                const label = generateSampleLabel(selectedVisit.orderId, idx + 1);
                const sampleRef = db.collection('samples').doc(sample.id);
                batch.update(sampleRef, {
                    status: 'collected',
                    collectedAt: firebase.firestore.Timestamp.now(),
                    sampleLabelId: label,
                    collectorName: auth.currentUser?.email || 'Phlebotomist',
                    collectorId: auth.currentUser?.uid
                });
            });

            // Deduct inventory items (aggregated)
            consumedItems.forEach(item => {
                if (item.quantity > 0) {
                    const invItem = inventoryItems.find(i => i.id === item.itemId);
                    if (invItem) {
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
                            reason: `Batch Sample Collection: Order ${selectedVisit.orderId}`,
                            relatedSampleId: selectedVisit.tests.map(t => t.id).join(','),
                            timestamp: firebase.firestore.Timestamp.now()
                        });
                    }
                }
            });

            await batch.commit();
            setSelectedVisit(null);
            setConsumedItems([]);
        } catch (e) {
            console.error('Collection failed:', e);
            alert('Failed to confirm collection: ' + (e instanceof Error ? e.message : String(e)));
        }
    };

    const renderCollectionModal = () => {
        if (!selectedVisit) return null;
        const visit = patientVisits.find(v => v.orderId === selectedVisit.orderId);
        if (!visit) return null;

        return (
            <div className="fixed inset-0 bg-black/80 z-[1001] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedVisit(null)}>
                <div className="rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]" style={{ backgroundColor: COLORS.RICH_BLACK, border: `1px solid ${COLORS.PERSIAN_GREEN}40` }} onClick={e => e.stopPropagation()}>
                    <div className="p-5 border-b flex justify-between items-center shrink-0" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, borderColor: `${COLORS.PERSIAN_GREEN}40` }}>
                        <h3 className="font-bold text-lg" style={{ color: COLORS.CITRON }}>Batch Collection - {visit.tests.length} Test(s)</h3>
                        <button onClick={() => setSelectedVisit(null)}><X className="w-5 h-5 opacity-70 hover:opacity-100" style={{ color: COLORS.TIFFANY_BLUE }} /></button>
                    </div>

                    <div className="p-6 overflow-y-auto space-y-6">
                        {/* Patient Info */}
                        <div className="p-4 rounded-lg border" style={{ backgroundColor: `${COLORS.PERSIAN_GREEN}20`, borderColor: `${COLORS.PERSIAN_GREEN}40` }}>
                            <p className="font-bold text-lg" style={{ color: COLORS.CITRON }}>{visit.patientName}</p>
                            <p className="text-sm" style={{ color: COLORS.TIFFANY_BLUE }}>Order ID: {visit.orderId}</p>
                            {visit.isUrgent && <span className="inline-block mt-2 bg-red-600 text-white text-xs px-2 py-1 rounded font-bold uppercase">URGENT</span>}
                        </div>

                        {/* Tests List */}
                        <div>
                            <h4 className="font-bold text-sm mb-3 flex items-center gap-2" style={{ color: COLORS.CITRON }}>
                                <TestTube className="w-4 h-4" /> Tests to Collect
                            </h4>
                            <div className="space-y-2">
                                {visit.tests.map((test, idx) => (
                                    <div key={test.id} className="flex items-center gap-3 p-3 rounded border" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, borderColor: `${COLORS.PERSIAN_GREEN}20` }}>
                                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: `${COLORS.PERSIAN_GREEN}30`, color: COLORS.CITRON }}>{idx + 1}</span>
                                        <div className="flex-1">
                                            <p className="font-medium text-sm" style={{ color: COLORS.CITRON }}>{test.testName}</p>
                                            <p className="text-xs" style={{ color: COLORS.TIFFANY_BLUE }}>{test.sampleType}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Consumables */}
                        <div>
                            <h4 className="font-bold text-sm mb-2 flex items-center gap-2" style={{ color: COLORS.CITRON }}>
                                <Package className="w-4 h-4" /> Total Consumables
                            </h4>
                            <div className="space-y-2 mb-4">
                                {consumedItems.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-2 p-2 rounded border" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, borderColor: `${COLORS.PERSIAN_GREEN}20` }}>
                                        <span className="flex-1 text-sm font-medium" style={{ color: COLORS.TIFFANY_BLUE }}>{item.itemName}</span>
                                        <input type="number" className="w-20 p-1 border rounded text-right text-sm outline-none focus:ring-1 focus:ring-[#ee9b00]" style={{ backgroundColor: COLORS.RICH_BLACK, color: COLORS.CITRON, borderColor: `${COLORS.PERSIAN_GREEN}40` }} value={item.quantity} onChange={(e) => { const newItems = [...consumedItems]; newItems[idx].quantity = parseFloat(e.target.value) || 0; setConsumedItems(newItems); }} />
                                        <button onClick={() => setConsumedItems(consumedItems.filter((_, i) => i !== idx))} className="text-red-400 hover:bg-red-900/20 p-1 rounded"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                ))}
                                {consumedItems.length === 0 && <p className="text-xs italic" style={{ color: COLORS.TIFFANY_BLUE }}>No consumables required.</p>}
                            </div>
                            <div className="flex gap-2">
                                <select id="phleb-inv-select" className="flex-1 p-2 border rounded text-sm outline-none" style={{ backgroundColor: COLORS.RICH_BLACK, color: COLORS.CITRON, borderColor: `${COLORS.PERSIAN_GREEN}40` }}>
                                    <option value="">Add Item...</option>
                                    {inventoryItems.map(i => <option key={i.id} value={i.id}>{i.name} (Stock: {i.quantity})</option>)}
                                </select>
                                <button onClick={() => { const sel = document.getElementById('phleb-inv-select') as HTMLSelectElement; const item = inventoryItems.find(i => i.id === sel.value); if (item) { setConsumedItems([...consumedItems, { itemId: item.id, itemName: item.name, quantity: 1 }]); sel.value = ''; } }} className="px-3 py-2 rounded text-sm font-bold shadow-md hover:opacity-90 transition-opacity" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, color: COLORS.CITRON }}>Add</button>
                            </div>
                        </div>
                    </div>

                    <div className="p-5 border-t flex justify-end gap-3 shrink-0" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, borderColor: `${COLORS.PERSIAN_GREEN}40` }}>
                        <button onClick={() => setSelectedVisit(null)} className="px-4 py-2 font-bold text-sm" style={{ color: COLORS.TIFFANY_BLUE }}>Cancel</button>
                        <button onClick={handleConfirmCollection} className="text-white px-6 py-2 rounded-lg font-bold shadow-lg flex items-center gap-2 hover:opacity-90 transition-opacity" style={{ backgroundColor: COLORS.GAMBOGE, color: COLORS.RICH_BLACK }}>
                            <QrCode className="w-4 h-4" /> Collect All ({visit.tests.length})
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-6 space-y-6 h-full flex flex-col">
            {renderCollectionModal()}

            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    {onBack && <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-colors"><ArrowLeft className="w-5 h-5" style={{ color: COLORS.GAMBOGE }} /></button>}
                    <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: COLORS.CITRON }}><Syringe className="w-6 h-6" style={{ color: COLORS.GAMBOGE }} /> Sample Collection</h2>
                </div>
                <div className="px-3 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: `${COLORS.GAMBOGE}20`, color: COLORS.GAMBOGE }}>{patientVisits.length} Patient(s) | {samples.length} Sample(s)</div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="space-y-3">
                    {patientVisits.map(visit => (
                        <div key={visit.orderId} className="rounded-xl border shadow-sm transition-all overflow-hidden" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, borderColor: `${COLORS.PERSIAN_GREEN}40` }}>
                            {/* Visit Header - Clickable */}
                            <div className="p-4 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => setExpandedVisitId(expandedVisitId === visit.orderId ? null : visit.orderId)}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4 flex-1">
                                        <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg" style={{ backgroundColor: `${COLORS.PERSIAN_GREEN}20`, color: COLORS.TIFFANY_BLUE }}>
                                            {visit.patientName.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-lg" style={{ color: COLORS.CITRON }}>{visit.patientName}</h4>
                                                {visit.isUrgent && <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded font-bold uppercase animate-pulse">URGENT</span>}
                                            </div>
                                            <p className="text-sm" style={{ color: COLORS.TIFFANY_BLUE }}>
                                                {visit.tests.length} Test{visit.tests.length > 1 ? 's' : ''} • Order #{visit.orderId.slice(0, 8)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button onClick={(e) => { e.stopPropagation(); openCollectionModal(visit); }} className="px-4 py-2 rounded-lg font-bold text-sm transition-colors shadow-sm flex items-center gap-2 hover:opacity-90" style={{ backgroundColor: COLORS.PERSIAN_GREEN, color: COLORS.RICH_BLACK }}>
                                            <CheckCircle2 className="w-4 h-4" /> Collect
                                        </button>
                                        <ChevronRight className={`w-5 h-5 transition-transform ${expandedVisitId === visit.orderId ? 'rotate-90' : ''}`} style={{ color: COLORS.TIFFANY_BLUE }} />
                                    </div>
                                </div>
                            </div>

                            {/* Expanded Test List */}
                            {expandedVisitId === visit.orderId && (
                                <div className="border-t px-4 py-3 space-y-2" style={{ backgroundColor: `${COLORS.RICH_BLACK}50`, borderColor: `${COLORS.PERSIAN_GREEN}20` }}>
                                    {visit.tests.map((test, idx) => (
                                        <div key={test.id} className="flex items-center gap-3 p-2 rounded" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN }}>
                                            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: `${COLORS.PERSIAN_GREEN}20`, color: COLORS.TIFFANY_BLUE }}>{idx + 1}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm truncate" style={{ color: COLORS.CITRON }}>{test.testName}</p>
                                                <p className="text-xs" style={{ color: COLORS.TIFFANY_BLUE }}>{test.sampleType}</p>
                                            </div>
                                            {test.notes && test.notes.includes("RECOLLECTION") && (
                                                <span className="text-[10px] px-2 py-1 rounded font-bold border flex-shrink-0" style={{ backgroundColor: '#7f1d1d20', color: '#fca5a5', borderColor: '#ef444440' }}>
                                                    REDO
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}

                    {patientVisits.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-dashed" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, borderColor: `${COLORS.PERSIAN_GREEN}30`, color: COLORS.TIFFANY_BLUE }}>
                            <CheckCircle2 className="w-12 h-12 mb-2 opacity-20" />
                            <p>All samples collected. Great work!</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const LabTechModule: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
    const [samples, setSamples] = useState<Sample[]>([]);
    const [testsMap, setTestsMap] = useState<Record<string, Test>>({});
    const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null);
    const [selectedVisit, setSelectedVisit] = useState<{ orderId: string; tests: Sample[] } | null>(null);
    const [currentTestIndex, setCurrentTestIndex] = useState(0);
    const [resultsForm, setResultsForm] = useState<Record<string, { value: string, flag: 'N' | 'L' | 'H' | 'CL' | 'CH', unit: string }>>({});
    const { showToast, showAlert, showConfirm } = useDialog();

    useEffect(() => {
        const unsubSamples = db.collection('samples').where('status', 'in', ['collected', 'analyzing']).onSnapshot(s => setSamples(s.docs.map(d => ({ id: d.id, ...d.data() } as Sample))));
        const unsubTests = db.collection('tests').onSnapshot(s => { const map: Record<string, Test> = {}; s.docs.forEach(d => { map[d.id] = { id: d.id, ...d.data() } as Test; }); setTestsMap(map); });
        return () => { unsubSamples(); unsubTests(); };
    }, []);

    // Group samples by patient visit
    const patientVisits = useMemo(() => {
        const visitMap: Record<string, { orderId: string; patientName: string; patientAge: number; patientGender: string; tests: Sample[]; isUrgent: boolean; createdAt: any; completedCount: number }> = {};
        samples.forEach(s => {
            const key = s.orderId || s.patientId;
            if (!visitMap[key]) {
                visitMap[key] = {
                    orderId: s.orderId,
                    patientName: s.patientName,
                    patientAge: s.patientAge,
                    patientGender: s.patientGender,
                    tests: [],
                    isUrgent: s.isUrgent || false,
                    createdAt: s.createdAt,
                    completedCount: 0
                };
            }
            visitMap[key].tests.push(s);
            if (s.status === 'analyzing' || s.status === 'review') {
                visitMap[key].completedCount++;
            }
        });
        return Object.values(visitMap).sort((a, b) => {
            if (a.isUrgent && !b.isUrgent) return -1;
            if (!a.isUrgent && b.isUrgent) return 1;
            return a.createdAt?.toDate().getTime() - b.createdAt?.toDate().getTime();
        });
    }, [samples]);

    const getFlag = (value: number, ranges: ReferenceRange[], gender: string, age: number): 'N' | 'L' | 'H' | 'CL' | 'CH' => {
        let range = ranges.find(r => r.type === 'age' && age >= (r.ageMin || 0) && age <= (r.ageMax || 150));
        if (!range) range = ranges.find(r => r.type === 'gender' && r.gender === gender);
        if (!range) range = ranges.find(r => r.type === 'general');
        if (!range) return 'N';
        if (range.criticalMin !== undefined && value <= range.criticalMin) return 'CL';
        if (range.criticalMax !== undefined && value >= range.criticalMax) return 'CH';
        if (range.min !== undefined && value < range.min) return 'L';
        if (range.max !== undefined && value > range.max) return 'H';
        return 'N';
    };

    const openBatchResultsEntry = (visit: typeof patientVisits[0]) => {
        setSelectedVisit({ orderId: visit.orderId, tests: visit.tests });
        setCurrentTestIndex(0);
        loadTestResults(visit.tests[0]);
    };

    const loadTestResults = (sample: Sample) => {
        const testDef = testsMap[sample.testId];
        if (sample.results) {
            setResultsForm(sample.results as any);
        } else if (testDef && testDef.parameters) {
            const initialForm: Record<string, any> = {};
            testDef.parameters.forEach(p => {
                initialForm[p.name] = { value: '', flag: 'N', unit: p.unit };
            });
            setResultsForm(initialForm);
        } else {
            setResultsForm({});
        }
    };

    const handleResultChange = (paramName: string, value: string, param: TestParameter) => {
        if (!selectedVisit) return;
        const currentSample = selectedVisit.tests[currentTestIndex];
        let flag: 'N' | 'L' | 'H' | 'CL' | 'CH' = 'N';
        if (param.type === 'numeric' && value !== '') {
            const numVal = parseFloat(value);
            flag = getFlag(numVal, param.refRanges, currentSample.patientGender || 'male', currentSample.patientAge || 30);
        }
        setResultsForm(prev => ({
            ...prev,
            [paramName]: { value, flag, unit: param.unit }
        }));
    };

    const saveCurrentTest = async () => {
        if (!selectedVisit) return false;
        const currentSample = selectedVisit.tests[currentTestIndex];

        // Validation
        const criticals: string[] = [];
        const unsafe: string[] = [];
        const testDef = testsMap[currentSample.testId];

        if (testDef && testDef.parameters) {
            testDef.parameters.forEach(param => {
                const res = resultsForm[param.name];
                if (res && res.value && param.type === 'numeric') {
                    if (res.flag === 'CL' || res.flag === 'CH') {
                        criticals.push(`${param.name} (${res.value} ${param.unit})`);
                    }
                    const numVal = parseFloat(res.value);
                    let range = param.refRanges.find(r => r.type === 'age' && currentSample.patientAge >= (r.ageMin || 0) && currentSample.patientAge <= (r.ageMax || 150));
                    if (!range) range = param.refRanges.find(r => r.type === 'gender' && r.gender === currentSample.patientGender);
                    if (!range) range = param.refRanges.find(r => r.type === 'general');
                    if (range && ((range.safeMin !== undefined && numVal < range.safeMin) || (range.safeMax !== undefined && numVal > range.safeMax))) {
                        unsafe.push(`${param.name} (Value: ${numVal}, Safe: ${range.safeMin}-${range.safeMax})`);
                    }
                }
            });
        }

        if (unsafe.length > 0) {
            const confirmUnsafe = await showConfirm(
                `Safe Range Violation detected:\n${unsafe.join('\n')}\n\nProceed?`,
                { title: 'Warning', confirmText: 'Confirm & Save', type: 'danger' }
            );
            if (!confirmUnsafe) return false;
        }

        if (criticals.length > 0) {
            showAlert('warning', `CRITICAL VALUES:\n${criticals.join('\n')}\n\nNotify doctor immediately.`, 'Critical Alert');
        }

        try {
            await db.collection('samples').doc(currentSample.id).update({
                status: 'analyzing',
                results: resultsForm,
                analyzedAt: firebase.firestore.Timestamp.now(),
                isCritical: criticals.length > 0
            });
            return true;
        } catch (e) {
            console.error('Save failed:', e);
            showAlert('error', 'Failed to save results');
            return false;
        }
    };

    const navigateTest = async (direction: 'prev' | 'next') => {
        if (!selectedVisit) return;

        // Save current test before navigating
        const saved = await saveCurrentTest();
        if (!saved) return;

        const newIndex = direction === 'next' ? currentTestIndex + 1 : currentTestIndex - 1;
        if (newIndex >= 0 && newIndex < selectedVisit.tests.length) {
            setCurrentTestIndex(newIndex);
            loadTestResults(selectedVisit.tests[newIndex]);
        }
    };

    const submitAllForReview = async () => {
        if (!selectedVisit) return;

        // Save current test first
        const saved = await saveCurrentTest();
        if (!saved) return;

        const confirmed = await showConfirm(
            `Submit all ${selectedVisit.tests.length} tests for pathologist review?`,
            { title: 'Submit Batch', confirmText: 'Submit All' }
        );
        if (!confirmed) return;

        try {
            const batch = db.batch();
            selectedVisit.tests.forEach(test => {
                const ref = db.collection('samples').doc(test.id);
                batch.update(ref, {
                    status: 'review',
                    submittedForReviewAt: firebase.firestore.Timestamp.now()
                });
            });
            await batch.commit();
            showToast('success', `All ${selectedVisit.tests.length} tests submitted for review!`);
            setSelectedVisit(null);
        } catch (e) {
            console.error('Batch submit failed:', e);
            showAlert('error', 'Failed to submit tests');
        }
    };

    const renderBatchResultsModal = () => {
        if (!selectedVisit) return null;
        const currentSample = selectedVisit.tests[currentTestIndex];
        const testDef = testsMap[currentSample.testId];
        if (!testDef) return null;

        const progress = ((currentTestIndex + 1) / selectedVisit.tests.length) * 100;

        return (
            <div className="fixed inset-0 bg-black/80 z-[1001] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedVisit(null)}>
                <div className="rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[95vh]" style={{ backgroundColor: COLORS.RICH_BLACK, border: `1px solid ${COLORS.PERSIAN_GREEN}40` }} onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="p-5 border-b flex justify-between items-center shrink-0" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, borderColor: `${COLORS.PERSIAN_GREEN}40` }}>
                        <div>
                            <h3 className="font-bold text-lg" style={{ color: COLORS.CITRON }}>Batch Results Entry</h3>
                            <p className="text-sm" style={{ color: COLORS.TIFFANY_BLUE }}>{selectedVisit.tests[0].patientName} • Test {currentTestIndex + 1} of {selectedVisit.tests.length}</p>
                        </div>
                        <button onClick={() => setSelectedVisit(null)}><X className="w-5 h-5" style={{ color: COLORS.TIFFANY_BLUE }} /></button>
                    </div>

                    {/* Progress Bar */}
                    <div className="px-5 py-3 border-b" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, borderColor: `${COLORS.PERSIAN_GREEN}40` }}>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold" style={{ color: COLORS.TIFFANY_BLUE }}>Progress</span>
                            <span className="text-xs font-bold" style={{ color: COLORS.GAMBOGE }}>{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: `${COLORS.RICH_BLACK}` }}>
                            <div className="h-full transition-all duration-300" style={{ width: `${progress}%`, backgroundColor: COLORS.GAMBOGE }}></div>
                        </div>
                        <div className="flex gap-1 mt-3">
                            {selectedVisit.tests.map((test, idx) => (
                                <div key={test.id} className={`flex-1 h-1 rounded ${idx === currentTestIndex ? 'ring-2 ring-offset-1' : ''}`} style={{
                                    backgroundColor: test.status === 'analyzing' || test.status === 'review' ? COLORS.SUCCESS : idx < currentTestIndex ? COLORS.GAMBOGE : `${COLORS.PERSIAN_GREEN}30`,
                                    ringColor: COLORS.GAMBOGE
                                }} title={test.testName}></div>
                            ))}
                        </div>
                    </div>

                    {/* Current Test */}
                    <div className="p-6 overflow-y-auto flex-1">
                        <div className="mb-6 p-4 rounded-lg border" style={{ backgroundColor: `${COLORS.PERSIAN_GREEN}20`, borderColor: `${COLORS.PERSIAN_GREEN}40` }}>
                            <h4 className="font-bold text-xl mb-1" style={{ color: COLORS.CITRON }}>{currentSample.testName}</h4>
                            <p className="text-sm" style={{ color: COLORS.TIFFANY_BLUE }}>Sample ID: {currentSample.sampleLabelId} • Type: {currentSample.sampleType}</p>
                        </div>

                        {/* Parameters */}
                        <div className="space-y-4">
                            {testDef.parameters && testDef.parameters.map(param => {
                                const current = resultsForm[param.name] || { value: '', flag: 'N', unit: param.unit };
                                const flagColors = { N: 'text-slate-500', L: 'text-yellow-500', H: 'text-yellow-500', CL: 'text-red-600', CH: 'text-red-600' };
                                const flagLabels = { N: '', L: 'LOW', H: 'HIGH', CL: '⚠ CRITICAL LOW', CH: '⚠ CRITICAL HIGH' };
                                const flagColor = flagColors[current.flag as keyof typeof flagColors];
                                const flagLabel = flagLabels[current.flag as keyof typeof flagLabels];

                                return (
                                    <div key={param.name} className="p-3 rounded-lg border" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, borderColor: `${COLORS.PERSIAN_GREEN}30` }}>
                                        <label className="block text-sm font-bold mb-2" style={{ color: COLORS.CITRON }}>{param.name}</label>
                                        {param.type === 'numeric' && (
                                            <div className="relative">
                                                <input type="number" step="any" className="w-full p-2 pr-24 border rounded-lg outline-none focus:ring-2 focus:ring-[#ee9b00]" style={{ backgroundColor: COLORS.RICH_BLACK, color: COLORS.CITRON, borderColor: `${COLORS.PERSIAN_GREEN}40` }} value={current.value} onChange={e => handleResultChange(param.name, e.target.value, param)} />
                                                {current.value && <span className={`absolute right-3 top-2.5 text-xs font-bold ${flagColor}`}>{flagLabel}</span>}
                                            </div>
                                        )}
                                        {param.type === 'text' && (
                                            <input type="text" className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-[#ee9b00]" style={{ backgroundColor: COLORS.RICH_BLACK, color: COLORS.CITRON, borderColor: `${COLORS.PERSIAN_GREEN}40` }} value={current.value} onChange={e => handleResultChange(param.name, e.target.value, param)} />
                                        )}
                                        {param.type === 'numeric' && (
                                            <div className="mt-1 flex gap-2 text-[10px]" style={{ color: COLORS.TIFFANY_BLUE }}>
                                                {param.refRanges.map((r, idx) => (
                                                    <span key={idx} className="whitespace-nowrap border px-1 rounded" style={{ borderColor: `${COLORS.PERSIAN_GREEN}30` }}>
                                                        {r.type}: {r.min}-{r.max}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-5 border-t flex justify-between items-center shrink-0" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, borderColor: `${COLORS.PERSIAN_GREEN}40` }}>
                        <button onClick={() => navigateTest('prev')} disabled={currentTestIndex === 0} className="px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 disabled:opacity-30 hover:opacity-80" style={{ color: COLORS.TIFFANY_BLUE }}>
                            <ArrowLeft className="w-4 h-4" /> Previous
                        </button>
                        <div className="flex gap-3">
                            {currentTestIndex < selectedVisit.tests.length - 1 ? (
                                <button onClick={() => navigateTest('next')} className="px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:opacity-90 shadow-lg" style={{ backgroundColor: COLORS.GAMBOGE, color: COLORS.RICH_BLACK }}>
                                    Save & Next <ArrowRight className="w-4 h-4" />
                                </button>
                            ) : (
                                <button onClick={submitAllForReview} className="px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:opacity-90 shadow-lg" style={{ backgroundColor: COLORS.SUCCESS, color: 'white' }}>
                                    Submit All for Review <CheckCircle2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-6 space-y-6 h-full flex flex-col">
            {renderBatchResultsModal()}

            <div className="flex items-center gap-2">
                {onBack && <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-colors"><ArrowLeft className="w-5 h-5" style={{ color: COLORS.GAMBOGE }} /></button>}
                <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: COLORS.CITRON }}><Microscope className="w-6 h-6" style={{ color: COLORS.GAMBOGE }} /> Lab Processing</h2>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="space-y-3">
                    {patientVisits.map(visit => (
                        <div key={visit.orderId} className="rounded-xl border shadow-sm transition-all overflow-hidden" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, borderColor: `${COLORS.PERSIAN_GREEN}40` }}>
                            <div className="p-4 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => setExpandedVisitId(expandedVisitId === visit.orderId ? null : visit.orderId)}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4 flex-1">
                                        <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg" style={{ backgroundColor: `${COLORS.PERSIAN_GREEN}20`, color: COLORS.TIFFANY_BLUE }}>
                                            {visit.patientName.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-lg" style={{ color: COLORS.CITRON }}>{visit.patientName}</h4>
                                                {visit.isUrgent && <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded font-bold uppercase animate-pulse">URGENT</span>}
                                            </div>
                                            <p className="text-sm" style={{ color: COLORS.TIFFANY_BLUE }}>
                                                {visit.tests.length} Test{visit.tests.length > 1 ? 's' : ''} • {visit.completedCount}/{visit.tests.length} Analyzed • Order #{visit.orderId.slice(0, 8)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button onClick={(e) => { e.stopPropagation(); openBatchResultsEntry(visit); }} className="px-4 py-2 rounded-lg font-bold text-sm transition-colors shadow-sm flex items-center gap-2 hover:opacity-90" style={{ backgroundColor: COLORS.GAMBOGE, color: COLORS.RICH_BLACK }}>
                                            <Microscope className="w-4 h-4" /> Enter Results
                                        </button>
                                        <ChevronRight className={`w-5 h-5 transition-transform ${expandedVisitId === visit.orderId ? 'rotate-90' : ''}`} style={{ color: COLORS.TIFFANY_BLUE }} />
                                    </div>
                                </div>
                            </div>

                            {expandedVisitId === visit.orderId && (
                                <div className="border-t px-4 py-3 space-y-2" style={{ backgroundColor: `${COLORS.RICH_BLACK}50`, borderColor: `${COLORS.PERSIAN_GREEN}20` }}>
                                    {visit.tests.map((test, idx) => (
                                        <div key={test.id} className="flex items-center gap-3 p-2 rounded" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN }}>
                                            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: `${COLORS.PERSIAN_GREEN}20`, color: COLORS.TIFFANY_BLUE }}>{idx + 1}</span>
                                            <div className="flex-1">
                                                <p className="font-medium text-sm" style={{ color: COLORS.CITRON }}>{test.testName}</p>
                                                <p className="text-xs" style={{ color: COLORS.TIFFANY_BLUE }}>{test.sampleType} • {test.sampleLabelId}</p>
                                            </div>
                                            {(test.status === 'analyzing' || test.status === 'review') ? (
                                                <span className="text-xs px-2 py-1 rounded font-bold" style={{ backgroundColor: `${COLORS.SUCCESS}20`, color: COLORS.SUCCESS }}>Done</span>
                                            ) : (
                                                <span className="text-xs px-2 py-1 rounded font-bold" style={{ backgroundColor: `${COLORS.GAMBOGE}20`, color: COLORS.GAMBOGE }}>Pending</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}

                    {patientVisits.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-dashed" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, borderColor: `${COLORS.PERSIAN_GREEN}30`, color: COLORS.TIFFANY_BLUE }}>
                            <Microscope className="w-12 h-12 mb-2 opacity-20" />
                            <p>No samples to process.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


const PathologistModule: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
    const [samples, setSamples] = useState<Sample[]>([]);
    const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null);
    const [selectedVisit, setSelectedVisit] = useState<{ orderId: string; tests: Sample[] } | null>(null);
    const [conclusion, setConclusion] = useState('');
    const [remarks, setRemarks] = useState('');
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const [loadingAction, setLoadingAction] = useState(false);
    const [previewData, setPreviewData] = useState<Sample[] | null>(null);
    const { showAlert, showConfirm, showToast } = useDialog();

    useEffect(() => {
        const unsubReview = db.collection('samples').where('status', '==', 'review').onSnapshot(snap => setSamples(snap.docs.map(d => ({ id: d.id, ...d.data() } as Sample))));
        return () => unsubReview();
    }, []);

    // Group samples by patient visit
    const patientVisits = useMemo(() => {
        const visitMap: Record<string, { orderId: string; patientName: string; patientAge: number; patientGender: string; tests: Sample[]; isUrgent: boolean; hasCritical: boolean; createdAt: any }> = {};
        samples.forEach(s => {
            const key = s.orderId || s.patientId;
            if (!visitMap[key]) {
                visitMap[key] = {
                    orderId: s.orderId,
                    patientName: s.patientName,
                    patientAge: s.patientAge,
                    patientGender: s.patientGender,
                    tests: [],
                    isUrgent: s.isUrgent || false,
                    hasCritical: false,
                    createdAt: s.createdAt
                };
            }
            visitMap[key].tests.push(s);
            if (s.isCritical || (s.results && Object.values(s.results).some((r: any) => r.flag === 'CL' || r.flag === 'CH'))) {
                visitMap[key].hasCritical = true;
            }
        });
        return Object.values(visitMap).sort((a, b) => {
            if (a.hasCritical && !b.hasCritical) return -1;
            if (!a.hasCritical && b.hasCritical) return 1;
            if (a.isUrgent && !b.isUrgent) return -1;
            if (!a.isUrgent && b.isUrgent) return 1;
            return a.createdAt?.toDate().getTime() - b.createdAt?.toDate().getTime();
        });
    }, [samples]);

    const openReviewModal = (visit: typeof patientVisits[0]) => {
        setSelectedVisit({ orderId: visit.orderId, tests: visit.tests });
        setConclusion('');
        setRemarks('');
    };

    const generateAIConclusion = async () => {
        if (!selectedVisit) return;
        setIsGeneratingAI(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

            // Aggregate all test results for AI context
            const allResults = selectedVisit.tests.map(test => {
                const formattedResults = Object.entries(test.results || {}).map(([key, val]: [string, any]) => {
                    const v = typeof val === 'object' ? val.value : val;
                    const u = typeof val === 'object' ? val.unit : '';
                    const f = typeof val === 'object' ? val.flag : 'N';
                    return `${key}: ${v} ${u} (${f})`;
                }).join(', ');
                return `${test.testName}: ${formattedResults}`;
            }).join(' | ');

            const prompt = `Act as a clinical pathologist. Review ALL test results for patient visit. Tests: ${allResults}. Patient: ${selectedVisit.tests[0].patientAge}y/${selectedVisit.tests[0].patientGender}. Provide ONE professional, concise medical conclusion for the ENTIRE visit (max 4 sentences). Format: JSON with key "conclusion".`;

            const result = await ai.models.generateContent({ model: 'gemini-2.0-flash-exp', contents: prompt });
            const text = (result as any).response.text();
            try {
                const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
                const data = JSON.parse(jsonStr);
                if (data.conclusion) setConclusion(data.conclusion);
            } catch {
                setConclusion(text);
            }
        } catch (error) {
            console.error("AI Error:", error);
            showAlert('error', 'AI generation failed. Please type manually.');
        } finally {
            setIsGeneratingAI(false);
        }
    };

    const handleApproveAll = async () => {
        if (!selectedVisit) return;

        const confirmed = await showConfirm(
            `Approve ALL ${selectedVisit.tests.length} tests for ${selectedVisit.tests[0].patientName}?\n\nThis will publish the combined report.`,
            { title: 'Batch Approval', confirmText: 'Approve All', type: 'primary' }
        );
        if (!confirmed) return;

        setLoadingAction(true);
        try {
            const batch = db.batch();

            // Mark all tests as reported with shared conclusion
            selectedVisit.tests.forEach(test => {
                const ref = db.collection('samples').doc(test.id);
                batch.update(ref, {
                    status: 'reported',
                    reportedAt: firebase.firestore.Timestamp.now(),
                    verifiedBy: auth.currentUser?.email || 'Pathologist',
                    pathologistRemarks: remarks,
                    conclusion: conclusion
                });
            });

            // Update order status
            if (selectedVisit.orderId) {
                const orderRef = db.collection('orders').doc(selectedVisit.orderId);
                batch.update(orderRef, {
                    status: 'completed',
                    completedAt: firebase.firestore.Timestamp.now()
                });
            }

            await batch.commit();
            showToast('success', `All ${selectedVisit.tests.length} tests approved and published!`);
            setSelectedVisit(null);
        } catch (e) {
            console.error('Approval failed:', e);
            showAlert('error', 'Failed to approve tests');
        } finally {
            setLoadingAction(false);
        }
    };

    const handleRejectAll = async () => {
        if (!selectedVisit) return;

        const reason = window.prompt('Enter rejection reason for this visit:');
        if (!reason) return;

        setLoadingAction(true);
        try {
            const batch = db.batch();
            selectedVisit.tests.forEach(test => {
                const ref = db.collection('samples').doc(test.id);
                batch.update(ref, {
                    status: 'analyzing',
                    rejectedAt: firebase.firestore.Timestamp.now(),
                    rejectedBy: auth.currentUser?.email,
                    notes: `REJECTED BY PATHOLOGIST: ${reason}`
                });
            });
            await batch.commit();
            showToast('success', `Visit rejected. All tests sent back to lab.`);
            setSelectedVisit(null);
        } catch (e) {
            console.error('Rejection failed:', e);
            showAlert('error', 'Failed to reject tests');
        } finally {
            setLoadingAction(false);
        }
    };

    const handlePreview = () => {
        if (!selectedVisit) return;
        // Apply conclusion to all tests for preview
        const testsWithConclusion = selectedVisit.tests.map(t => ({
            ...t,
            conclusion,
            pathologistRemarks: remarks
        }));
        setPreviewData(testsWithConclusion);
    };

    const renderReviewModal = () => {
        if (!selectedVisit) return null;
        const visit = patientVisits.find(v => v.orderId === selectedVisit.orderId);
        if (!visit) return null;

        return (
            <div className="fixed inset-0 z-[1001] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedVisit(null)}>
                <div className="rounded-xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[95vh]" style={{ backgroundColor: COLORS.RICH_BLACK, border: `1px solid ${COLORS.PERSIAN_GREEN}40` }} onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="p-5 border-b flex justify-between items-center shrink-0" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, borderColor: `${COLORS.PERSIAN_GREEN}40` }}>
                        <div>
                            <h3 className="font-bold text-lg" style={{ color: COLORS.CITRON }}>Batch Review: {visit.patientName}</h3>
                            <p className="text-sm" style={{ color: COLORS.TIFFANY_BLUE }}>{visit.tests.length} Test(s) • Order #{visit.orderId.slice(0, 8)}</p>
                        </div>
                        <button onClick={() => setSelectedVisit(null)}><X className="w-5 h-5" style={{ color: COLORS.TIFFANY_BLUE }} /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Left: All Test Results */}
                        <div className="space-y-4">
                            <h4 className="font-bold flex items-center gap-2" style={{ color: COLORS.CITRON }}>
                                <List className="w-4 h-4" /> All Test Results
                            </h4>

                            {visit.tests.map((test, idx) => (
                                <div key={test.id} className="p-4 rounded-lg border" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, borderColor: `${COLORS.PERSIAN_GREEN}30` }}>
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: `${COLORS.PERSIAN_GREEN}30`, color: COLORS.CITRON }}>{idx + 1}</span>
                                        <h5 className="font-bold text-sm" style={{ color: COLORS.CITRON }}>{test.testName}</h5>
                                        {test.isCritical && <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded font-bold uppercase animate-pulse">CRITICAL</span>}
                                    </div>

                                    <table className="w-full text-xs">
                                        <tbody className="divide-y" style={{ divideColor: `${COLORS.PERSIAN_GREEN}20` }}>
                                            {test.results && Object.entries(test.results).map(([key, val]: [string, any]) => {
                                                const value = typeof val === 'object' ? val.value : val;
                                                const unit = typeof val === 'object' ? val.unit : '';
                                                const flag = typeof val === 'object' ? val.flag : 'N';
                                                const isCritical = flag === 'CL' || flag === 'CH';
                                                const isAbnormal = flag === 'L' || flag === 'H';

                                                return (
                                                    <tr key={key}>
                                                        <td className="py-1 font-medium" style={{ color: COLORS.TIFFANY_BLUE }}>{key}</td>
                                                        <td className="py-1 text-right">
                                                            <span className={`font-bold ${isCritical ? 'text-red-500' : isAbnormal ? 'text-yellow-500' : ''}`} style={!isCritical && !isAbnormal ? { color: COLORS.CITRON } : {}}>
                                                                {value} <span className="text-[10px] opacity-70">{unit}</span>
                                                            </span>
                                                            {flag !== 'N' && <span className={`ml-2 text-[9px] font-bold ${isCritical ? 'text-red-400' : 'text-yellow-400'}`}>{flag}</span>}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>

                                    <div className="mt-2 text-[10px] space-y-0.5" style={{ color: COLORS.TIFFANY_BLUE }}>
                                        <p>Sample: {test.sampleType} • {test.sampleLabelId}</p>
                                        <p>Collected: {formatDate(test.collectedAt)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Right: Clinical Evaluation */}
                        <div className="space-y-4 flex flex-col">
                            <div className="flex justify-between items-center">
                                <h4 className="font-bold" style={{ color: COLORS.CITRON }}>Clinical Evaluation</h4>
                                <button onClick={generateAIConclusion} disabled={isGeneratingAI} className="text-xs px-2 py-1 rounded border font-bold flex items-center gap-1 hover:opacity-80" style={{ backgroundColor: '#6d28d930', color: '#c4b5fd', borderColor: '#8b5cf640' }}>
                                    {isGeneratingAI ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Auto-Generate
                                </button>
                            </div>

                            <div className="p-4 rounded-lg border" style={{ backgroundColor: `${COLORS.PERSIAN_GREEN}10`, borderColor: `${COLORS.PERSIAN_GREEN}30` }}>
                                <p className="text-xs font-bold mb-2" style={{ color: COLORS.TIFFANY_BLUE }}>Patient Demographics</p>
                                <div className="text-xs space-y-1" style={{ color: COLORS.CITRON }}>
                                    <p>Name: {visit.patientName}</p>
                                    <p>Age/Gender: {visit.patientAge}/{visit.patientGender}</p>
                                    <p>Tests: {visit.tests.length}</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase mb-2" style={{ color: COLORS.TIFFANY_BLUE }}>
                                    Consolidated Conclusion / Impression
                                </label>
                                <textarea
                                    className="w-full p-3 border rounded-lg text-sm outline-none resize-none focus:ring-2 focus:ring-[#00b4d8]"
                                    style={{ backgroundColor: COLORS.RICH_BLACK, borderColor: `${COLORS.PERSIAN_GREEN}40`, color: COLORS.CITRON, height: '200px' }}
                                    placeholder="Enter overall medical conclusion for all tests..."
                                    value={conclusion}
                                    onChange={e => setConclusion(e.target.value)}
                                />
                                <p className="text-[10px] mt-1 italic" style={{ color: COLORS.TIFFANY_BLUE }}>
                                    This conclusion will be applied to all {visit.tests.length} tests in the combined report.
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase mb-2" style={{ color: COLORS.TIFFANY_BLUE }}>
                                    Remarks (Optional)
                                </label>
                                <textarea
                                    className="w-full p-3 border rounded-lg text-sm outline-none h-20 resize-none focus:ring-2 focus:ring-[#00b4d8]"
                                    style={{ backgroundColor: COLORS.RICH_BLACK, borderColor: `${COLORS.PERSIAN_GREEN}40`, color: COLORS.CITRON }}
                                    placeholder="Any additional clinical notes..."
                                    value={remarks}
                                    onChange={e => setRemarks(e.target.value)}
                                />
                            </div>

                            <div className="mt-auto pt-4 border-t flex gap-3 justify-end" style={{ borderColor: `${COLORS.PERSIAN_GREEN}40` }}>
                                <button onClick={handleRejectAll} disabled={loadingAction} className="px-4 py-2 border rounded-lg font-bold text-sm hover:bg-red-900/20 transition-colors flex items-center gap-2" style={{ borderColor: '#ef4444', color: '#fca5a5' }}>
                                    <X className="w-4 h-4" /> Reject All
                                </button>
                                <button onClick={handlePreview} className="px-4 py-2 border rounded-lg font-bold text-sm hover:bg-white/5 flex items-center gap-2" style={{ borderColor: `${COLORS.PERSIAN_GREEN}40`, color: COLORS.TIFFANY_BLUE }}>
                                    <Eye className="w-4 h-4" /> Preview Report
                                </button>
                                <button onClick={handleApproveAll} disabled={loadingAction} className="px-6 py-2 rounded-lg font-bold text-sm hover:opacity-90 shadow-lg flex items-center gap-2" style={{ backgroundColor: COLORS.SUCCESS, color: 'white' }}>
                                    {loadingAction ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Approve All ({visit.tests.length})
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-6 space-y-6 h-full flex flex-col">
            {previewData && <PrintReportModal data={previewData} onClose={() => setPreviewData(null)} />}
            {renderReviewModal()}

            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    {onBack && <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-colors"><ArrowLeft className="w-5 h-5" style={{ color: COLORS.GAMBOGE }} /></button>}
                    <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: COLORS.CITRON }}><FileCheck className="w-6 h-6" style={{ color: COLORS.GAMBOGE }} /> Pathologist Verification</h2>
                </div>
                <div className="px-3 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: `${COLORS.GAMBOGE}20`, color: COLORS.GAMBOGE }}>
                    {patientVisits.length} Visit(s) | {samples.length} Test(s)
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="space-y-3">
                    {patientVisits.map(visit => (
                        <div key={visit.orderId} className={`rounded-xl border shadow-sm transition-all overflow-hidden ${visit.hasCritical ? 'border-l-4 border-l-red-500' : ''}`} style={{ backgroundColor: visit.hasCritical ? '#7f1d1d20' : COLORS.MIDNIGHT_GREEN, borderColor: `${COLORS.PERSIAN_GREEN}40` }}>
                            <div className="p-4 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => setExpandedVisitId(expandedVisitId === visit.orderId ? null : visit.orderId)}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4 flex-1">
                                        <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg" style={{ backgroundColor: `${COLORS.PERSIAN_GREEN}20`, color: COLORS.TIFFANY_BLUE }}>
                                            {visit.patientName.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-lg" style={{ color: COLORS.CITRON }}>{visit.patientName}</h4>
                                                {visit.hasCritical && <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded font-bold uppercase animate-pulse">CRITICAL VALUES</span>}
                                                {visit.isUrgent && <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded font-bold uppercase">URGENT</span>}
                                            </div>
                                            <p className="text-sm" style={{ color: COLORS.TIFFANY_BLUE }}>
                                                {visit.tests.length} Test{visit.tests.length > 1 ? 's' : ''} Awaiting Approval • Order #{visit.orderId.slice(0, 8)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button onClick={(e) => { e.stopPropagation(); openReviewModal(visit); }} className="px-4 py-2 rounded-lg font-bold text-sm transition-colors shadow-sm flex items-center gap-2 hover:opacity-90" style={{ backgroundColor: COLORS.SUCCESS, color: 'white' }}>
                                            <FileCheck className="w-4 h-4" /> Review & Approve
                                        </button>
                                        <ChevronRight className={`w-5 h-5 transition-transform ${expandedVisitId === visit.orderId ? 'rotate-90' : ''}`} style={{ color: COLORS.TIFFANY_BLUE }} />
                                    </div>
                                </div>
                            </div>

                            {expandedVisitId === visit.orderId && (
                                <div className="border-t px-4 py-3 space-y-2" style={{ backgroundColor: `${COLORS.RICH_BLACK}50`, borderColor: `${COLORS.PERSIAN_GREEN}20` }}>
                                    {visit.tests.map((test, idx) => {
                                        const hasCriticalValues = test.results && Object.values(test.results).some((r: any) => r.flag === 'CL' || r.flag === 'CH');
                                        return (
                                            <div key={test.id} className="flex items-center gap-3 p-2 rounded" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN }}>
                                                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: `${COLORS.PERSIAN_GREEN}20`, color: COLORS.TIFFANY_BLUE }}>{idx + 1}</span>
                                                <div className="flex-1">
                                                    <p className="font-medium text-sm flex items-center gap-2" style={{ color: COLORS.CITRON }}>
                                                        {test.testName}
                                                        {hasCriticalValues && <span className="bg-red-600 text-white text-[9px] px-1 py-0.5 rounded font-bold">CRITICAL</span>}
                                                    </p>
                                                    <p className="text-xs" style={{ color: COLORS.TIFFANY_BLUE }}>{test.sampleType} • {test.sampleLabelId}</p>
                                                </div>
                                                <span className="text-xs px-2 py-1 rounded font-bold" style={{ backgroundColor: `${COLORS.GAMBOGE}20`, color: COLORS.GAMBOGE }}>Ready</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ))}

                    {patientVisits.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-dashed" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, borderColor: `${COLORS.PERSIAN_GREEN}30`, color: COLORS.TIFFANY_BLUE }}>
                            <FileCheck className="w-12 h-12 mb-2 opacity-20" />
                            <p>No visits pending review. Great work!</p>
                        </div>
                    )}
                </div>
            </div>
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

// --- Protected Route Component ---
const ProtectedRoute: React.FC<{
    user: any;
    role: Role | null;
    redirectPath?: string;
    children?: React.ReactNode;
}> = ({ user, role, redirectPath = '/login', children }) => {
    if (!user) {
        return <Navigate to={redirectPath} replace />;
    }
    // Simple verification - more complex role checks can be done inside specific modules or wrappers
    return children ? <>{children}</> : <Outlet />;
};

// --- Main Layout Component ---
const MainLayout: React.FC<{
    user: any;
    role: Role | null;
    onLogout: () => void;
    isInventoryModalOpen: boolean;
    setIsInventoryModalOpen: (open: boolean) => void;
}> = ({ user, role, onLogout, isInventoryModalOpen, setIsInventoryModalOpen }) => {
    return (
        <div className="flex flex-col h-screen w-full font-sans overflow-hidden transition-colors duration-500" style={{ backgroundColor: COLORS.RICH_BLACK, color: COLORS.CITRON }}>
            <InventoryRequestModal isOpen={isInventoryModalOpen} onClose={() => setIsInventoryModalOpen(false)} userId={user.uid} userName={user.username || user.email || 'User'} userRole={role} />

            <TopBar user={user} onLogout={onLogout} />

            <main className="flex-1 h-full overflow-hidden relative flex flex-col">
                <div className="flex-1 overflow-auto p-0 relative custom-scrollbar">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

const DashboardHome: React.FC<{ user: any; role: Role | null; setIsInventoryModalOpen: (open: boolean) => void; }> = ({ user, role, setIsInventoryModalOpen }) => {
    const navigate = useNavigate();
    return (
        <div className="p-8 h-full overflow-y-auto">
            <div className="max-w-7xl mx-auto space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight" style={{ color: COLORS.TIFFANY_BLUE }}>Welcome back, <span style={{ color: COLORS.GAMBOGE }}>{user.username || 'User'}</span></h2>
                        <p className="opacity-60 mt-1">Select a workspace to begin.</p>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={() => setIsInventoryModalOpen(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all hover:scale-105 shadow-lg" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, color: COLORS.TIFFANY_BLUE }}>
                            <Truck className="w-5 h-5" /> Request Stock
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {PERMISSIONS[role!]?.map(view => {
                        if (view.startsWith('admin_')) return null;
                        const icons: any = { 'dashboard': LayoutDashboard, 'reception': ClipboardList, 'collection': Syringe, 'lab_tech': Microscope, 'lab_path': FileCheck, 'finance': DollarSign, 'inventory': Package };
                        const Icon = icons[view] || CheckCircle2;
                        const label = view.replace('_', ' ');

                        return (
                            <button
                                key={view}
                                onClick={() => navigate(`/${view === 'dashboard' ? '' : view}`)}
                                className="p-6 rounded-2xl flex flex-col items-start gap-4 transition-all hover:-translate-y-1 hover:shadow-2xl group border border-transparent text-left relative overflow-hidden"
                                style={{ backgroundColor: COLORS.MIDNIGHT_GREEN }}
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-2xl transition-all group-hover:bg-white/10"></div>
                                <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg" style={{ backgroundColor: COLORS.PERSIAN_GREEN }}>
                                    <Icon className="w-8 h-8 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold capitalize" style={{ color: COLORS.CITRON }}>{label}</h3>
                                    <p className="text-xs font-medium mt-1 opacity-60" style={{ color: COLORS.TIFFANY_BLUE }}>Access module</p>
                                </div>
                                <div className="mt-auto pt-4 w-full flex justify-end">
                                    <div className="p-2 rounded-full bg-black/20 group-hover:bg-black/30 transition-colors">
                                        <ArrowRight className="w-5 h-5 text-white/50 group-hover:text-white" />
                                    </div>
                                </div>
                            </button>
                        );
                    })}

                    {/* Admin Access Card */}
                    {(role === 'admin' || role === 'inventory_manager') && (
                        <button
                            onClick={() => navigate('/admin')}
                            className="p-6 rounded-2xl flex flex-col items-start gap-4 transition-all hover:-translate-y-1 hover:shadow-2xl group border border-transparent text-left relative overflow-hidden"
                            style={{ backgroundColor: COLORS.MIDNIGHT_GREEN }}
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-2xl transition-all group-hover:bg-white/10"></div>
                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg" style={{ backgroundColor: COLORS.GAMBOGE }}>
                                <Settings className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold capitalize" style={{ color: COLORS.CITRON }}>Administration</h3>
                                <p className="text-xs font-medium mt-1 opacity-60" style={{ color: COLORS.TIFFANY_BLUE }}>Manage system</p>
                            </div>
                            <div className="mt-auto pt-4 w-full flex justify-end">
                                <div className="p-2 rounded-full bg-black/20 group-hover:bg-black/30 transition-colors">
                                    <ArrowRight className="w-5 h-5 text-white/50 group-hover:text-white" />
                                </div>
                            </div>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- Admin Dashboard Component ---
const AdminDashboard: React.FC<{ user: any; role: Role | null; }> = ({ user, role }) => {
    const navigate = useNavigate();

    // Only verify admin access
    if (role !== 'admin' && role !== 'inventory_manager') {
        return <Navigate to="/dashboard" />;
    }

    return (
        <div className="h-full flex flex-col bg-slate-50">
            <AdminTopBar activeTab="dashboard" />
            <div className="p-6 md:p-8 h-full overflow-y-auto">
                <div className="max-w-7xl mx-auto space-y-8">
                    <h2 className="text-3xl font-bold tracking-tight text-slate-800">System Administration</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {PERMISSIONS[role!]?.filter(p => p.startsWith('admin_')).map(view => {
                            const icons: any = { 'admin_users': Users, 'admin_tests': FlaskConical, 'admin_finance': DollarSign, 'admin_reports': FileBarChart, 'admin_logs': Shield, 'admin_settings': Settings };
                            const Icon = icons[view] || Settings;
                            const label = view.replace('admin_', '').replace(/_/g, ' ');

                            return (
                                <button
                                    key={view}
                                    onClick={() => navigate(`/${view}`)}
                                    className="p-6 rounded-2xl flex flex-col items-start gap-4 transition-all hover:-translate-y-1 hover:shadow-2xl group border border-transparent text-left relative overflow-hidden"
                                    style={{ backgroundColor: COLORS.MIDNIGHT_GREEN }}
                                >
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-2xl transition-all group-hover:bg-white/10"></div>
                                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg" style={{ backgroundColor: COLORS.PERSIAN_GREEN }}>
                                        <Icon className="w-8 h-8 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold capitalize" style={{ color: COLORS.CITRON }}>{label}</h3>
                                        <p className="text-xs font-medium mt-1 opacity-60" style={{ color: COLORS.TIFFANY_BLUE }}>Manage {label}</p>
                                    </div>
                                    <div className="mt-auto pt-4 w-full flex justify-end">
                                        <div className="p-2 rounded-full bg-black/20 group-hover:bg-black/30 transition-colors">
                                            <ArrowRight className="w-5 h-5 text-white/50 group-hover:text-white" />
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};



// --- Navigate Wrapper Component ---
const NavigateWrapper: React.FC<{ Component: React.ElementType }> = ({ Component }) => {
    const navigate = useNavigate();
    const location = useLocation();

    // Enhanced Back Function with Fallback
    const handleBack = () => {
        if (window.history.state && window.history.state.idx > 0) {
            navigate(-1);
        } else {
            // Fallback to dashboard if no history
            navigate('/dashboard');
        }
    };

    return (
        <ErrorBoundary>
            <Component onBack={handleBack} />
        </ErrorBoundary>
    );
};

const App: React.FC = () => {
    // Initial state must be null to prevent flashing/redirects before auth check
    const [user, setUser] = useState<any>(null);
    const [role, setRole] = useState<Role | null>(null);
    const [loading, setLoading] = useState(true); // Start loading
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
        // Prevent Backspace Navigation (except in inputs)
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Backspace') {
                const target = e.target as HTMLElement;
                const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
                if (!isInput) {
                    e.preventDefault();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        // Synchronously restore UI session from LocalStorage if present.
        // This prevents redirect-to-login on browser refresh by ensuring
        // the app shows the same page immediately while Firebase auth
        // reconciliation happens in the background.
        const savedRole = localStorage.getItem('labpro_role') as Role;
        const savedUser = localStorage.getItem('labpro_user');
        if (savedRole && savedUser) {
            try {
                setUser(JSON.parse(savedUser));
                setRole(savedRole);
                // We can stop the initial loading spinner now because the UI
                // session is restored from LocalStorage.
                setLoading(false);
                console.log('Session restored synchronously from LocalStorage');
            } catch (e) {
                console.error('Failed to parse saved user from LocalStorage', e);
            }
        }

        // Listen for Firebase Auth changes and reconcile state.
        // If Firebase has a user we prefer it; if not, we may attempt
        // a silent anonymous sign-in so Firestore rules continue to work.
        const unsub = auth.onAuthStateChanged(async (u) => {
            if (!u) {
                const savedRoleInner = localStorage.getItem('labpro_role') as Role;
                const savedUserInner = localStorage.getItem('labpro_user');

                if (savedRoleInner && savedUserInner) {
                    console.log('onAuthStateChanged: restoring session from LocalStorage...');
                    try {
                        setUser(JSON.parse(savedUserInner));
                        setRole(savedRoleInner);
                        // Ensure firebase has an auth token for security rules
                        // Use anonymous sign-in silently if needed.
                        try {
                            await auth.signInAnonymously();
                        } catch (anonErr) {
                            console.warn('Anonymous sign-in failed during restore:', anonErr);
                        }
                    } catch (e) {
                        console.warn('Firebase Auth failed (using local credentials only):', e);
                    }
                } else {
                    // Genuine logout
                    setUser(null);
                    setRole(null);
                }
            } else {
                // Firebase has an authenticated user; prefer this source of truth
                const savedRoleInner = localStorage.getItem('labpro_role') as Role;
                const savedUserInner = localStorage.getItem('labpro_user');
                if (savedRoleInner && savedUserInner) {
                    try {
                        setUser(JSON.parse(savedUserInner));
                        setRole(savedRoleInner);
                    } catch (e) {
                        console.error('User Data Corrupt:', e);
                        setUser({ uid: u.uid, email: u.email, id: u.uid });
                    }
                } else {
                    console.warn('Restoring partial session from Firebase.');
                    setUser({ uid: u.uid, email: u.email || 'User', id: u.uid });
                    if (savedRoleInner) setRole(savedRoleInner);
                }
            }

            // Only stop loading if it hasn't already been stopped by the
            // synchronous LocalStorage restore above.
            setLoading(false);
        });

        return () => unsub();
    }, []);

    const handleLoginSuccess = (r: Role, u: any) => {
        setRole(r);
        setUser(u);
        localStorage.setItem('labpro_role', r);
        localStorage.setItem('labpro_user', JSON.stringify(u));
    };

    const handleLogout = () => {
        auth.signOut();
        localStorage.removeItem('labpro_role');
        localStorage.removeItem('labpro_user');
        setUser(null);
        setRole(null);
        // Router will handle redirect via ProtectedRoute
    };

    if (loading) return <div className="h-screen w-full flex items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 text-indigo-600 animate-spin" /></div>;

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

            <Router basename="/labman">
                <Routes>
                    <Route path="/login" element={!user ? <LandingPage onLoginSuccess={handleLoginSuccess} /> : <Navigate to="/dashboard" />} />

                    <Route path="/" element={<ProtectedRoute user={user} role={role}><MainLayout user={user} role={role} onLogout={handleLogout} isInventoryModalOpen={isInventoryModalOpen} setIsInventoryModalOpen={setIsInventoryModalOpen} /></ProtectedRoute>}>
                        <Route index element={<Navigate to="/dashboard" />} />
                        <Route path="dashboard" element={<DashboardHome user={user} role={role} setIsInventoryModalOpen={setIsInventoryModalOpen} />} />

                        {/* Admin Dashboard */}
                        <Route path="admin" element={<AdminDashboard user={user} role={role} />} />

                        <Route path="patients" element={<NavigateWrapper Component={PatientsModule} />} />
                        <Route path="reception" element={<NavigateWrapper Component={ReceptionModule} />} />
                        <Route path="collection" element={<NavigateWrapper Component={PhlebotomyModule} />} />
                        <Route path="lab_tech" element={<NavigateWrapper Component={LabTechModule} />} />
                        <Route path="lab_path" element={<NavigateWrapper Component={PathologistModule} />} />
                        <Route path="inventory" element={<NavigateWrapper Component={(props: any) => <InventoryModule {...props} role={role} />} />} />
                        <Route path="finance" element={<NavigateWrapper Component={FinanceModule} />} />
                        {/* Admin Routes */}
                        <Route path="admin_users" element={<NavigateWrapper Component={AdminUsers} />} />
                        <Route path="admin_tests" element={<NavigateWrapper Component={TestManagementModule} />} />
                        <Route path="admin_finance" element={<NavigateWrapper Component={AdminFinance} />} />
                        <Route path="admin_reports" element={<NavigateWrapper Component={AdminReports} />} />
                        <Route path="admin_logs" element={<NavigateWrapper Component={AdminLogs} />} />
                        <Route path="admin_settings" element={<NavigateWrapper Component={AdminSettings} />} />

                        {/* Fallback */}
                        <Route path="*" element={<Navigate to="/dashboard" />} />
                    </Route>
                </Routes>
            </Router>
        </DialogContext.Provider>
    );
};

export default App;

