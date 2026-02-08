import React, { useState, useEffect, useMemo, useRef, Component } from 'react';
import { createPortal } from 'react-dom';
import ReportDesigner, { PrintReportModal } from './ReportDesigner';
import BillDesigner from './BillDesigner';
import BillPrintModal from './BillPrintModal';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate, Outlet } from 'react-router-dom';
import firebase from 'firebase/compat/app';
import { db, auth } from './firebase';
import { deductInventoryAndMarkSamples } from './purchaseOrderUtils';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import './index.css'; // Global styles and cursor fixes

import { ReportPageRenderer, ReportData } from './ReportRendererCore';
import { ReportDesign } from './ReportSchema';
import { TEMPLATE_THERMAL_80 } from './ReportTemplateDefinitions';

// QR System Imports
import LiveStatusPage from './LiveStatusPage';
import ReportViewerPublic from './ReportViewerPublic';
import QRTokenManager from './QRTokenManager';
import QRCodeGenerator, { generateQRDataURL } from './QRCodeGenerator';
import { getOrCreateQRToken, generateSecureToken } from './qrTokenUtils';

// Purchase Order System Imports
import PurchaseOrderModal from './PurchaseOrderModal';
import CreatePOModal from './CreatePOModal';
import RequisitionModal from './RequisitionModal';
import POReturnModal from './POReturnModal';
import ReceiveItemsModal from './ReceiveItemsModal';
import { generatePurchaseOrderPDF } from './generatePurchaseOrderPDF';
import { generatePurchaseOrder, recordInventoryUsage, markPOAsPaid, receivePurchaseOrder, receivePurchaseOrderItems, closePurchaseOrder, approveRequisition, rejectRequisition, processPOReturn } from './purchaseOrderUtils';
import * as Icons from './InventoryIcons';

// Destructure icons for existing codebase compatibility
const {
    LayoutDashboard, Users, FileText, FlaskConical, CreditCard, Package, Settings, LogOut, Menu, Smartphone, Monitor, Home, SearchIcon, ChevronRight, MessageSquare, Activity, Shield, Trash, UserCircle, ClipboardList, TrendingDown, PieChart, CheckCircle, EyeOff, Maximize2, Save, RotateCcw, X, Plus, Trash2, Search, DollarSign, Calendar, Truck, ArrowLeft, AlertTriangle, AlertCircle, Bell, Check, XCircle, Edit2, Eye, Printer, FileBarChart, ScrollText, UserPlus, List, Clock, CheckCircle2, Filter, Download, ChevronDown, Unlock, History, Database, QrCode, Receipt, Stethoscope, Briefcase, PenTool, Sparkles, MinusCircle, GripVertical, CalendarClock, BarChart3, ArrowUpRight, ArrowDownRight, Zap, Armchair, Pen, Wallet, Landmark, FileSpreadsheet, FileCheck, Droplets, Microscope, Syringe, TestTube, MapPin, Phone, Loader2, ClipboardCheck, TrendingUp, Info, Globe, Lock, User, ArrowRight, Percent, Upload
} = Icons;

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
interface EBProps { children: React.ReactNode; }
interface EBState { hasError: boolean; }
class ErrorBoundary extends Component<EBProps, EBState> {
    state: EBState = { hasError: false };

    static getDerivedStateFromError(_: any) {
        return { hasError: true };
    }

    componentDidCatch(error: any, errorInfo: any) {
        console.error("ErrorBoundary caught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center p-12 text-center bg-red-950/20 rounded-xl border border-red-900/50">
                    <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
                    <h3 className="text-xl font-bold text-red-100 mb-2">Something went wrong</h3>
                    <p className="text-red-300/70 text-sm mb-6">An error occurred in this module's rendering engine.</p>
                    <button onClick={() => window.location.reload()} className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition-colors">
                        Refresh Page
                    </button>
                </div>
            );
        }

        return (this as any).props.children;
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
        unit: string; // pcs, ml, boxes, etc.
        itemType: 'solid' | 'liquid';
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
    commissionPaidAmount?: number; // New: Support for partial commission payments
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
    submittedForReviewAt?: any; // New: When sample was submitted for pathologist review
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
    trackToken?: string; // New: QR tracking token
    price?: number; // New: Test price
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
    itemType: 'solid' | 'liquid'; // Solid items use pcs/boxes, liquid items use ml
    unit: string;
    quantity: number; // Current total quantity (pcs for solid, ml for liquid)
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

    // PO Tracking for FIFO allocation
    activePurchaseOrders?: string[]; // PO IDs with remaining inventory

    // FIFO Queue for usage allocation
    fifoQueue?: {
        poId: string;
        poNumber: string;
        batchNumber: string;
        quantityRemaining: number;
        unitPrice: number;
        purchaseDate: any;
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

    // PO Linkage for usage tracking
    relatedPOId?: string;
    relatedPONumber?: string;

    // FIFO allocations (one usage might span multiple POs)
    usageAllocations?: {
        poId: string;
        poNumber: string;
        quantityDeducted: number;
        valueDeducted: number;
    }[];
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

// Purchase Order with embedded financial tracking
interface PurchaseOrder {
    id: string;
    poNumber: string; // Format: PO-YYYYMMDD-XXXXX
    orderDate: any; // Firestore timestamp

    // Supplier Information
    supplierName: string;
    supplierPhone?: string;
    supplierAddress?: string;

    // Line Items with embedded usage tracking
    items: {
        itemId: string;
        itemName: string;
        description?: string;
        quantity: number;
        unit: string;
        unitPrice: number;
        totalPrice: number;
        batchNumber?: string;

        // Usage Tracking (per line item)
        quantityUsed: number;
        quantityRemaining: number;
        valueUsed: number;
        valueRemaining: number;
    }[];

    // Financial Calculations
    subtotal: number;
    taxPercentage: number; // Admin-defined (0-100)
    taxAmount: number; // Calculated: subtotal * (taxPercentage / 100)
    totalAmount: number; // subtotal + taxAmount

    // Payment Terms
    paymentTerms: string; // e.g., "Net 30", "Net 15", "Immediate"
    paymentDueDate: any; // Auto-calculated: orderDate + payment terms
    paymentStatus: 'unpaid' | 'paid';
    paidDate?: any;
    paidBy?: string;

    // Aggregate Usage Tracking
    totalValueUsed: number;
    totalValueRemaining: number;
    usagePercentage: number; // (totalValueUsed / totalAmount) * 100

    // Additional Details
    referenceNumber?: string;
    notes?: string;

    // Metadata
    createdBy: string;
    createdAt: any;
    updatedAt?: any;

    // Status
    status: 'active' | 'fully_used' | 'cancelled';

    // Audit Trail of Usage
    usageHistory: {
        timestamp: any;
        itemId: string;
        itemName: string;
        quantityUsed: number;
        valueUsed: number;
        relatedSampleId?: string;
        relatedTestId?: string;
        performedBy: string;
    }[];
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
    discountPercentage?: number; // New: Auto-apply discount for patients referred by this doctor
    status: 'active' | 'inactive';
}

interface PrintableInvoiceData {
    orderId?: string;
    patientId?: string;
    invoiceId?: string;
    patientName: string;
    patientPhone: string;
    patientAge?: string;
    patientGender?: string;
    age?: string;
    gender?: string;
    date: any;
    doctor?: string;
    doctorName?: string;
    items: any[];
    amount?: number;
    subtotal?: number;
    discount?: number;
    total?: number;
    paid?: number;
    paidAmount?: number;
    due?: number;
    paymentMethod?: string;
}

type ViewState = 'dashboard' | 'patients' | 'reception' | 'collection' | 'lab_tech' | 'lab_path' | 'finance' | 'inventory' | 'settings' |
    'admin_users' | 'admin_tests' | 'admin_finance' | 'admin_reports' | 'admin_logs' | 'admin_settings' | 'admin_report_designer' | 'admin_bill_designer';

type Role = 'admin' | 'receptionist' | 'phlebotomist' | 'technician' | 'pathologist' | 'accountant' | 'inventory_manager';

const PERMISSIONS: Record<Role, ViewState[]> = {
    admin: ['dashboard', 'admin_users', 'admin_tests', 'finance', 'admin_reports', 'inventory', 'admin_logs', 'admin_settings', 'admin_report_designer', 'admin_bill_designer', 'reception', 'collection', 'lab_tech', 'lab_path'],
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
                                    Rs.{d.value.toLocaleString()}
                                </div>
                            </div>
                        </div>
                        <div className="text-center w-full overflow-hidden">
                            <span className="text-[10px] text-slate-500 block truncate px-1" title={d.label}>{d.label}</span>
                            <span className={`text-[10px] font-bold block mt-0.5 ${d.value < 0 ? 'text-red-600' : 'text-slate-700'}`}>
                                {Math.abs(d.value) >= 1000 ? 'Rs.' + (d.value / 1000).toFixed(1) + 'k' : 'Rs.' + d.value}
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
                        All Rights Reserved Â© ABS BAHAWALPUR
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
            await logAction('ADD_EXPENSE', 'Finance', `Added expense: ${formData.title} (Rs.${formData.amount})`, auth.currentUser);
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
                                    <td className="p-4 text-right font-bold text-slate-800">Rs.{e.amount.toFixed(2)}</td>
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

const FinanceDoctorsPanel: React.FC<{ doctors: Doctor[], orders: Order[], expenses: Expense[] }> = ({ doctors, orders, expenses }) => {
    const { showAlert, showConfirm, showToast, showPrompt } = useDialog();
    const [showAdd, setShowAdd] = useState(false);
    const [formData, setFormData] = useState<Partial<Doctor>>({ status: 'active', commissionRate: 0, discountPercentage: 0 });
    const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);

    const handleSave = async () => {
        if (!formData.name) return;
        try { await db.collection('doctors').add(formData); setShowAdd(false); setFormData({ status: 'active', commissionRate: 0, discountPercentage: 0 }); } catch (e) { console.error(e); }
    };

    const handlePayCommission = async (doc: Doctor) => {
        const unpaidOrders = orders.filter(o => o.doctorId === doc.id && !o.commissionPaid).sort((a, b) => a.createdAt?.toMillis() - b.createdAt?.toMillis());
        if (unpaidOrders.length === 0) { showAlert('info', 'No unpaid commission found.'); return; }

        // Calculate actual outstanding (accounting for partials)
        const totalOutstanding = unpaidOrders.reduce((sum, o) => sum + ((o.doctorCommission || 0) - (o.commissionPaidAmount || 0)), 0);

        const amountStr = await showPrompt(
            `Total Outstanding: Rs.${totalOutstanding.toFixed(2)}\n\nEnter amount to pay:`,
            { title: `Pay Commission - ${doc.name}`, defaultValue: totalOutstanding.toString(), placeholder: 'Amount' }
        );

        if (!amountStr) return;
        const amount = parseFloat(amountStr);
        if (isNaN(amount) || amount <= 0) { showAlert('error', 'Invalid amount entered'); return; }
        if (amount > totalOutstanding + 1) { showAlert('error', 'Amount exceeds outstanding balance'); return; }

        try {
            const batch = db.batch();
            let remaining = amount;
            let paidCount = 0;

            // Log Expense
            const expRef = db.collection('expenses').doc();
            batch.set(expRef, {
                title: `Commission Payment - ${doc.name}`,
                category: 'Commission',
                amount: amount,
                status: 'paid',
                date: firebase.firestore.Timestamp.now(),
                paidAt: firebase.firestore.Timestamp.now(),
                paidBy: auth.currentUser?.email || 'admin',
                createdBy: 'system',
                doctorId: doc.id
            });

            // FIFO Payment Allocation
            for (const order of unpaidOrders) {
                if (remaining <= 0) break;

                const commission = order.doctorCommission || 0;
                const alreadyPaid = order.commissionPaidAmount || 0;
                const owe = commission - alreadyPaid;

                if (owe <= 0) continue;

                if (remaining >= owe) {
                    // Fully pay this order
                    batch.update(db.collection('orders').doc(order.id), {
                        commissionPaid: true,
                        commissionPaidAmount: commission
                    });
                    remaining -= owe;
                    paidCount++;
                } else {
                    // Partially pay
                    batch.update(db.collection('orders').doc(order.id), {
                        commissionPaid: false,
                        commissionPaidAmount: alreadyPaid + remaining
                    });
                    remaining = 0;
                }
            }

            await batch.commit();
            showToast('success', `Paid Rs.${amount} commission. Allocated to ${paidCount} orders.`);
        } catch (e) { console.error(e); showAlert('error', 'Payment failed'); }
    };

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-xl font-bold text-slate-800">Doctor Referral Program</h3>
                    {selectedDoctor && <button onClick={() => setSelectedDoctor(null)} className="text-sm text-indigo-600 hover:underline flex items-center gap-1">← Back to List</button>}
                </div>
                {!selectedDoctor && <button onClick={() => setShowAdd(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"><UserPlus className="w-4 h-4" /> Add Doctor</button>}
            </div>

            {/* Add Doctor Form */}
            {showAdd && !selectedDoctor && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                        <input className="p-2 border rounded" placeholder="Doctor Name" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                        <input className="p-2 border rounded" placeholder="Clinic / Hospital" value={formData.clinic || ''} onChange={e => setFormData({ ...formData, clinic: e.target.value })} />
                        <input className="p-2 border rounded" placeholder="Phone" value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                        <input className="p-2 border rounded" type="number" placeholder="Commission %" value={formData.commissionRate || ''} onChange={e => setFormData({ ...formData, commissionRate: parseFloat(e.target.value) })} />
                        <input className="p-2 border rounded bg-green-50" type="number" placeholder="Discount %" value={formData.discountPercentage || ''} onChange={e => setFormData({ ...formData, discountPercentage: parseFloat(e.target.value) || 0 })} title="Auto-apply discount for patients referred by this doctor" />
                    </div>
                    <div className="flex justify-end gap-2"><button onClick={() => setShowAdd(false)} className="px-4 py-2 text-slate-500">Cancel</button><button onClick={handleSave} className="bg-green-600 text-white px-4 py-2 rounded font-bold">Save Doctor</button></div>
                </div>
            )}

            {selectedDoctor ? (
                // Detailed View
                <div className="flex-1 flex flex-col min-h-0 space-y-4">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900">{selectedDoctor.name}</h2>
                            <p className="text-slate-500">{selectedDoctor.clinic} • {selectedDoctor.phone} • Rate: {selectedDoctor.commissionRate}%</p>
                        </div>
                        <div className="text-right">
                            {(() => {
                                const docOrders = orders.filter(o => o.doctorId === selectedDoctor.id);
                                const totalComm = docOrders.reduce((sum, o) => sum + (o.doctorCommission || 0), 0);
                                const paidComm = docOrders.reduce((sum, o) => sum + (o.commissionPaidAmount || (o.commissionPaid ? o.doctorCommission : 0) || 0), 0);
                                const pending = totalComm - paidComm;
                                return (
                                    <div>
                                        <p className="text-sm text-slate-500">Outstanding Balance</p>
                                        <p className="text-3xl font-bold text-indigo-600">Rs.{pending.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                        <button onClick={() => handlePayCommission(selectedDoctor)} disabled={pending <= 0} className="mt-2 text-sm bg-green-600 text-white px-4 py-2 rounded-lg font-bold shadow hover:bg-green-700 disabled:opacity-50 disabled:shadow-none">
                                            Pay Commission
                                        </button>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
                        {/* Patient Orders List */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                            <div className="p-4 border-b bg-slate-50 font-bold flex gap-4">
                                <span className="flex-1">Patient Details</span>
                                <span className="w-24 text-right">Comm.</span>
                                <span className="w-20 text-center">Status</span>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                {orders.filter(o => o.doctorId === selectedDoctor.id).sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()).map(order => {
                                    const comm = order.doctorCommission || 0;
                                    const paid = order.commissionPaidAmount || (order.commissionPaid ? comm : 0) || 0;
                                    const isFull = paid >= comm - 0.1;
                                    return (
                                        <div key={order.id} className="p-4 border-b flex gap-4 items-center hover:bg-slate-50 text-sm">
                                            <div className="flex-1">
                                                <p className="font-bold text-slate-800">{order.patientName}</p>
                                                <p className="text-xs text-slate-500">{formatDate(order.createdAt)}</p>
                                            </div>
                                            <div className="w-24 text-right">
                                                <p className="font-mono font-bold text-indigo-600">Rs.{comm.toFixed(0)}</p>
                                                {paid > 0 && paid < comm && <p className="text-[10px] text-green-600">Paid: {paid.toFixed(0)}</p>}
                                            </div>
                                            <div className="w-20 text-center">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold ${isFull ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                                                    {isFull ? 'PAID' : 'DUE'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Payment History */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                            <div className="p-4 border-b bg-slate-50 font-bold">Payment History</div>
                            <div className="flex-1 overflow-y-auto">
                                {expenses.filter(e => e.doctorId === selectedDoctor.id && e.category === 'Commission').sort((a, b) => b.date.toMillis() - a.date.toMillis()).map(exp => (
                                    <div key={exp.id} className="p-4 border-b hover:bg-slate-50">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-bold text-slate-700">{exp.title}</p>
                                                <p className="text-xs text-slate-500">{formatDate(exp.date)}</p>
                                                <p className="text-[10px] text-slate-400">Ref: {exp.id.slice(0, 8)}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-green-600 text-lg">Rs.{exp.amount.toLocaleString()}</p>
                                                <span className="text-[10px] bg-green-100 text-green-800 px-1.5 py-0.5 rounded uppercase">Paid</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {expenses.filter(e => e.doctorId === selectedDoctor.id).length === 0 && (
                                    <div className="p-8 text-center text-slate-400 text-sm">No payment history found</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                // List View
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-0">
                    <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="overflow-y-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 border-b sticky top-0"><tr><th className="p-4">Doctor</th><th className="p-4">Clinic</th><th className="p-4">Rates</th><th className="p-4 text-right">Revenue / Pending</th><th className="p-4"></th></tr></thead>
                                <tbody className="divide-y divide-slate-100">
                                    {doctors.map(doc => {
                                        const docOrders = orders.filter(o => o.doctorId === doc.id);
                                        const totalRev = docOrders.reduce((sum, o) => sum + o.totalAmount, 0);
                                        const totalComm = docOrders.reduce((sum, o) => sum + (o.doctorCommission || 0), 0);
                                        const paidComm = docOrders.reduce((sum, o) => sum + (o.commissionPaidAmount || (o.commissionPaid ? o.doctorCommission : 0) || 0), 0);
                                        const pending = totalComm - paidComm;

                                        return (
                                            <tr key={doc.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedDoctor(doc)}>
                                                <td className="p-4 font-bold text-slate-800">{doc.name}</td>
                                                <td className="p-4 text-slate-500">{doc.clinic}</td>
                                                <td className="p-4 text-xs font-mono">
                                                    <div className="text-indigo-600">Comm: {doc.commissionRate}%</div>
                                                    {doc.discountPercentage ? <div className="text-green-600">Disc: {doc.discountPercentage}%</div> : null}
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="font-bold text-slate-800">Rs.{totalRev.toLocaleString()}</div>
                                                    {pending > 0 && <div className="text-xs font-bold text-red-500">Due: Rs.{pending.toFixed(0)}</div>}
                                                </td>
                                                <td className="p-4 text-center text-slate-400">
                                                    <ChevronRight className="w-4 h-4" />
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    {/* Summary Card */}
                    <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100 h-fit">
                        <h4 className="font-bold text-indigo-900 mb-4">Program Overview</h4>
                        <div className="space-y-4">
                            <div className="bg-white p-4 rounded-lg shadow-sm">
                                <p className="text-xs text-slate-500 uppercase font-bold">Total Doctors</p>
                                <p className="text-2xl font-bold text-slate-800">{doctors.length}</p>
                            </div>
                            <div className="bg-white p-4 rounded-lg shadow-sm">
                                <p className="text-xs text-slate-500 uppercase font-bold">Total Pending Commission</p>
                                {(() => {
                                    const allUnpaid = orders.reduce((sum, o) => {
                                        if (!o.doctorId) return sum;
                                        const comm = o.doctorCommission || 0;
                                        const paid = o.commissionPaidAmount || (o.commissionPaid ? comm : 0) || 0;
                                        return sum + (comm - paid);
                                    }, 0);
                                    return <p className="text-2xl font-bold text-red-600">Rs.{allUnpaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>;
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
};

const FinanceDiscountPanel: React.FC<{ expenses: Expense[], orders: Order[], invoices: Invoice[] }> = ({ expenses, orders, invoices }) => {
    // Aggregate data
    const discounts = invoices.filter(inv => (inv.discount || 0) > 0).sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());

    // Categorize
    const todayStr = new Date().toDateString();
    const discountsToday = discounts.filter(d => new Date(d.createdAt?.toDate()).toDateString() === todayStr);
    const totalToday = discountsToday.reduce((sum, d) => sum + (d.discount || 0), 0);

    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const discountsWeek = discounts.filter(d => d.createdAt?.toDate() > weekAgo);
    const totalWeek = discountsWeek.reduce((sum, d) => sum + (d.discount || 0), 0);

    const monthAgo = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1);
    const discountsMonth = discounts.filter(d => d.createdAt?.toDate() > monthAgo);
    const totalMonth = discountsMonth.reduce((sum, d) => sum + (d.discount || 0), 0);

    // Grouping for Analysis
    const bySource = discounts.reduce((acc, d) => {
        const isDoc = d.discountReason?.startsWith('Doctor Referral:');
        const key = isDoc ? 'Doctor Referral' : 'Manual / Staff';
        acc[key] = (acc[key] || 0) + (d.discount || 0);
        return acc;
    }, {} as Record<string, number>);

    // Receptionist Performance (Manual Discounts)
    const byReceptionist = discounts.filter(d => !d.discountReason?.startsWith('Doctor Referral:')).reduce((acc, d) => {
        const name = d.creatorName || d.createdBy || 'Unknown';
        acc[name] = (acc[name] || 0) + (d.discount || 0);
        return acc;
    }, {} as Record<string, number>);

    // Doctor Performance (Auto Discounts)
    const byDoctor = discounts.filter(d => d.discountReason?.startsWith('Doctor Referral:')).reduce((acc, d) => {
        // Extract doctor name from reason "Doctor Referral: Dr. Name (10%)"
        const match = d.discountReason?.match(/Doctor Referral: (.*?) \(/);
        const name = match ? match[1] : 'Unknown Doctor';
        acc[name] = (acc[name] || 0) + (d.discount || 0);
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="h-full flex flex-col space-y-6">
            <h3 className="text-xl font-bold text-slate-800">Discount Analysis</h3>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-xs text-slate-500 font-bold uppercase">Given Today</p>
                    <p className="text-2xl font-bold text-slate-800">Rs.{totalToday.toLocaleString()}</p>
                    <p className="text-xs text-slate-400 mt-1">{discountsToday.length} invoices</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-xs text-slate-500 font-bold uppercase">Last 7 Days</p>
                    <p className="text-2xl font-bold text-indigo-600">Rs.{totalWeek.toLocaleString()}</p>
                    <p className="text-xs text-slate-400 mt-1">{discountsWeek.length} invoices</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-xs text-slate-500 font-bold uppercase">Last 30 Days</p>
                    <p className="text-2xl font-bold text-indigo-600">Rs.{totalMonth.toLocaleString()}</p>
                    <p className="text-xs text-slate-400 mt-1">{discountsMonth.length} invoices</p>
                </div>
            </div>

            {/* Analysis Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Receptionist Stats */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <h4 className="font-bold text-slate-700 mb-3 border-b pb-2">Manual Discounts by Staff</h4>
                    {Object.keys(byReceptionist).length === 0 ? <p className="text-xs text-slate-400 p-4 text-center">No manual discounts recorded.</p> : (
                        <div className="space-y-3">
                            {Object.entries(byReceptionist).sort((a, b) => Number(b[1]) - Number(a[1])).map(([name, amount]) => (
                                <div key={name} className="flex justify-between items-center text-sm">
                                    <span className="font-medium text-slate-600">{name}</span>
                                    <span className="font-mono font-bold text-red-500">Rs.{amount.toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Doctor Stats */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <h4 className="font-bold text-slate-700 mb-3 border-b pb-2">Referral Discounts by Doctor</h4>
                    {Object.keys(byDoctor).length === 0 ? <p className="text-xs text-slate-400 p-4 text-center">No referral discounts recorded.</p> : (
                        <div className="space-y-3">
                            {Object.entries(byDoctor).sort((a, b) => Number(b[1]) - Number(a[1])).map(([name, amount]) => (
                                <div key={name} className="flex justify-between items-center text-sm">
                                    <span className="font-medium text-slate-600">{name}</span>
                                    <span className="font-mono font-bold text-green-600">Rs.{amount.toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Detailed Log */}
            <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                <div className="p-4 border-b bg-slate-50 font-bold flex gap-4 text-sm text-slate-700">
                    <span className="w-24">Date</span>
                    <span className="flex-1">Patient</span>
                    <span className="flex-1">Reason / Ref</span>
                    <span className="w-32">Given By</span>
                    <span className="w-24 text-right">Discount</span>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {discounts.length === 0 && <div className="p-8 text-center text-slate-400">No discounts given yet</div>}
                    {discounts.map(inv => (
                        <div key={inv.id} className="p-4 border-b hover:bg-slate-50 flex gap-4 items-center text-sm">
                            <span className="w-24 text-slate-500 text-xs">{formatDate(inv.createdAt).split(',')[0]}</span>
                            <span className="flex-1 font-bold text-slate-700">{inv.patientName}</span>
                            <span className="flex-1 text-xs text-slate-500 truncate" title={inv.discountReason}>{inv.discountReason || 'Manual'}</span>
                            <span className="w-32 text-xs font-mono text-slate-500 truncate">{inv.creatorName || inv.createdBy || 'System'}</span>
                            <span className="w-24 text-right font-bold text-red-500">-Rs.{inv.discount}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const FinanceModule: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
    const { showToast, showPrompt } = useDialog();
    const [subView, setSubView] = useState<'dashboard' | 'sales' | 'expenses' | 'profit' | 'doctors' | 'discounts' | 'payroll' | 'inventory'>('dashboard');
    const [orders, setOrders] = useState<Order[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [inventoryVal, setInventoryVal] = useState(0);
    const [invTransactions, setInvTransactions] = useState<InventoryTransaction[]>([]);
    const [dateRange, setDateRange] = useState('week');
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [showPOModal, setShowPOModal] = useState(false);
    const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);

    useEffect(() => {
        const unsubOrders = db.collection('orders').orderBy('createdAt', 'desc').limit(200).onSnapshot(snap => setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order))));
        const unsubInvoices = db.collection('invoices').orderBy('createdAt', 'desc').limit(200).onSnapshot(snap => setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice))));
        const unsubExpenses = db.collection('expenses').orderBy('date', 'desc').limit(200).onSnapshot(snap => setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Expense))));
        const unsubDoctors = db.collection('doctors').onSnapshot(snap => setDoctors(snap.docs.map(d => ({ id: d.id, ...d.data() } as Doctor))));
        const unsubInventory = db.collection('inventory_items').onSnapshot(snap => {
            const val = snap.docs.reduce((acc, d) => { const item = d.data() as InventoryItem; return acc + (item.quantity * (item.purchasePrice || 0)); }, 0);
            setInventoryVal(val);
        });
        const unsubInvTx = db.collection('inventory_transactions').orderBy('timestamp', 'desc').limit(100).onSnapshot(snap => setInvTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryTransaction))));
        const unsubPOs = db.collection('purchase_orders').orderBy('createdAt', 'desc').limit(100).onSnapshot(snap => setPurchaseOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as PurchaseOrder))));

        return () => { unsubOrders(); unsubInvoices(); unsubExpenses(); unsubDoctors(); unsubInventory(); unsubInvTx(); unsubPOs(); };
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

    const filteredInvoices = useMemo(() => invoices.filter(i => filterDate(i.createdAt)), [invoices, dateRange]);
    const filteredOrders = useMemo(() => orders.filter(o => filterDate(o.createdAt)), [orders, dateRange]);
    const filteredPaidExpenses = useMemo(() => expenses.filter(e => e.status === 'paid' && filterDate(e.paidAt)), [expenses, dateRange]);
    const filteredInvTx = useMemo(() => invTransactions.filter(t => (t.type === 'issue' || t.type === 'deduction' || t.type === 'wastage') && filterDate(t.timestamp)), [invTransactions, dateRange]);

    const kpi = useMemo(() => {
        const revenue = filteredOrders.reduce((sum, o) => sum + o.totalAmount, 0);
        const paidExp = filteredPaidExpenses.reduce((sum, e) => sum + e.amount, 0);
        // Calculate inventory usage cost from transactions (assume negative quantity for usage)
        const invUsageCost = filteredInvTx.reduce((sum, t) => sum + (t.cost || 0), 0);
        const totalDiscount = filteredInvoices.reduce((sum, i) => sum + (i.discount || 0), 0);

        // Outstanding Commissions (Not an expense yet, but liability)
        const pendingCommissions = orders.filter(o => !o.commissionPaid).reduce((sum, o) => sum + (o.doctorCommission || 0), 0);

        // Profit = Revenue - Paid Expenses - Inventory Usage Cost 
        // Note: Revenue is already net of discount, so discount doesn't subtract from Profit again, 
        // but it represents "Revenue Leakage" or "Opportunity Cost".
        const profit = revenue - paidExp - invUsageCost;

        return { revenue, paidExpenses: paidExp, invUsageCost, pendingCommissions, profit, totalDiscount };
    }, [filteredOrders, filteredPaidExpenses, filteredInvoices, filteredInvTx, orders]);


    const handleModuleBack = () => {
        if (subView !== 'dashboard') {
            setSubView('dashboard');
        } else if (onBack) {
            onBack();
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-50">
            <PurchaseOrderModal
                isOpen={showPOModal}
                purchaseOrder={selectedPO}
                onClose={() => setShowPOModal(false)}
                onMarkPaid={async (id) => {
                    await markPOAsPaid(id, auth.currentUser?.email || 'Admin');
                    showToast('success', 'Marked as Paid');
                    setShowPOModal(false);
                }}
                onPrint={() => setTimeout(() => window.print(), 100)}
                onDownloadPDF={() => {
                    if (selectedPO) {
                        generatePurchaseOrderPDF(selectedPO);
                        showToast('success', 'PDF Downloaded');
                    }
                }}
                onReceive={async (id, receipts) => {
                    if (receipts && receipts.length > 0) {
                        await receivePurchaseOrderItems(id, receipts, auth.currentUser?.email || 'Admin');
                    } else {
                        await receivePurchaseOrder(id, auth.currentUser?.email || 'Admin');
                    }
                    showToast('success', 'Stock Received & Inventory Updated');
                    setShowPOModal(false);
                }}
                onCancel={async (id, remarks) => {
                    await closePurchaseOrder(id, remarks, auth.currentUser?.email || 'Admin');
                    showToast('success', 'Purchase Order closed.');
                    setShowPOModal(false);
                }}
                showPrompt={showPrompt}
            />
            <div className="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                    {onBack && <button onClick={handleModuleBack} className="p-2 rounded-full hover:bg-slate-100 transition-colors"><ArrowLeft className="w-5 h-5 text-indigo-600" /></button>}
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><DollarSign className="w-6 h-6 text-indigo-600" /> Financial Dashboard</h2>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    {[{ id: 'dashboard', label: 'Overview', icon: LayoutDashboard }, { id: 'sales', label: 'Sales', icon: FileText }, { id: 'expenses', label: 'Expenses', icon: Wallet }, { id: 'doctors', label: 'Referrals', icon: UserPlus }, { id: 'discounts', label: 'Discounts', icon: Percent }, { id: 'inventory', label: 'Inventory Finance', icon: Package }].map(tab => (
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
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <p className="text-slate-500 text-xs font-bold uppercase">Total Revenue</p>
                                <p className="text-3xl font-bold text-slate-800 mt-2">Rs.{kpi.revenue.toLocaleString()}</p>
                                <p className="text-xs text-green-600 mt-1 font-bold flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Income</p>
                            </div>
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <p className="text-slate-500 text-xs font-bold uppercase">Total Discounts</p>
                                <p className="text-3xl font-bold text-slate-800 mt-2">Rs.{kpi.totalDiscount.toLocaleString()}</p>
                                <p className="text-xs text-red-400 mt-1">Given to Patients</p>
                            </div>
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <p className="text-slate-500 text-xs font-bold uppercase">Paid Expenses</p>
                                <p className="text-3xl font-bold text-slate-800 mt-2">Rs.{kpi.paidExpenses.toLocaleString()}</p>
                                <p className="text-xs text-slate-400 mt-1">Operational & Paid Comms</p>
                            </div>
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <p className="text-slate-500 text-xs font-bold uppercase">Inventory Usage Cost</p>
                                <p className="text-3xl font-bold text-slate-800 mt-2">Rs.{kpi.invUsageCost.toLocaleString()}</p>
                                <p className="text-xs text-amber-600 mt-1 font-bold">Cost of Goods Sold</p>
                            </div>
                            <div className={`p-6 rounded-xl border shadow-lg text-white ${kpi.profit >= 0 ? 'bg-green-600 border-green-700 shadow-green-200' : 'bg-red-600 border-red-700 shadow-red-200'}`}>
                                <p className="text-white/80 text-xs font-bold uppercase">Net Profit</p>
                                <p className="text-3xl font-bold mt-2">Rs.{kpi.profit.toLocaleString()}</p>
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
                                            { label: 'Discount', value: kpi.totalDiscount, color: 'bg-indigo-300' },
                                            { label: 'Paid Exp', value: kpi.paidExpenses, color: 'bg-red-500' },
                                            { label: 'Inv. Usage', value: kpi.invUsageCost, color: 'bg-orange-500' },
                                            { label: 'Profit', value: kpi.profit, color: kpi.profit >= 0 ? 'bg-green-600' : 'bg-red-600' }
                                        ]} />
                                        <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                                            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded"></div><span className="text-slate-600">Revenue</span></div>
                                            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-indigo-300 rounded"></div><span className="text-slate-600">Discount</span></div>
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
                                                            <span className="text-slate-600">{k}: Rs.{(v as number).toFixed(0)}</span>
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
                                        `Total Sales: Rs.${dailyOrders.reduce((s, o) => s + o.totalAmount, 0).toFixed(2)}\n` +
                                        `Number of Orders: ${dailyOrders.length}\n\n` +
                                        `EXPENSES\n` +
                                        `Total Paid: Rs.${dailyExpenses.reduce((s, e) => s + e.amount, 0).toFixed(2)}\n` +
                                        `Number of Expenses: ${dailyExpenses.length}\n\n` +
                                        `NET: Rs.${(dailyOrders.reduce((s, o) => s + o.totalAmount, 0) - dailyExpenses.reduce((s, e) => s + e.amount, 0)).toFixed(2)}`;
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
                                <p className="text-sm text-amber-700">Pending Commissions: <b>Rs.{kpi.pendingCommissions.toLocaleString()}</b> • Due Expenses: <b>Rs.{expenses.filter(e => e.status !== 'paid').reduce((s, e) => s + e.amount, 0).toLocaleString()}</b></p>
                            </div>
                            <button onClick={() => setSubView('expenses')} className="px-4 py-2 bg-white text-amber-700 text-sm font-bold rounded shadow-sm hover:bg-amber-100">Manage Due Expenses</button>
                        </div>
                    </div>
                )}
                {subView === 'expenses' && <FinanceExpensesPanel expenses={filteredPaidExpenses.length > 0 ? filteredPaidExpenses : expenses} />}
                {subView === 'doctors' && <FinanceDoctorsPanel doctors={doctors} orders={filteredOrders} expenses={expenses} />}
                {subView === 'discounts' && <FinanceDiscountPanel expenses={expenses} orders={filteredOrders} invoices={invoices} />}
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
                                        <td className="p-4 text-right font-bold text-slate-800">Rs.{o.totalAmount}</td>
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
                                <p className="text-4xl font-bold text-indigo-600">Rs.{inventoryVal.toLocaleString()}</p>
                                <p className="text-sm text-indigo-400 mt-2">Valuation of current stock (Purchase Price Ã— Quantity).</p>
                            </div>
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <h3 className="font-bold text-slate-800 mb-4">Inventory Usage Cost ({dateRange})</h3>
                                <p className="text-4xl font-bold text-slate-800 mb-4">Rs.{kpi.invUsageCost.toLocaleString()}</p>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm"><span className="text-slate-500">Used in Tests</span><span className="font-bold">Rs.{filteredInvTx.filter(t => t.type === 'deduction').reduce((s, t) => s + (t.cost || 0), 0).toFixed(2)}</span></div>
                                    <div className="flex justify-between text-sm"><span className="text-slate-500">Issued to Staff</span><span className="font-bold">Rs.{filteredInvTx.filter(t => t.type === 'issue').reduce((s, t) => s + (t.cost || 0), 0).toFixed(2)}</span></div>
                                    <div className="flex justify-between text-sm"><span className="text-red-500">Expired/Discarded</span><span className="font-bold text-red-600">Rs.{filteredInvTx.filter(t => t.type === 'wastage').reduce((s, t) => s + (t.cost || 0), 0).toFixed(2)}</span></div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-6 animate-in fade-in">
                            <div className="p-4 border-b bg-slate-50 font-bold text-slate-700 flex justify-between items-center">
                                <span className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-indigo-600" /> Purchase Orders</span>
                                <span className="text-xs font-normal text-slate-500">Real-time usage tracking</span>
                            </div>
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 border-b">
                                    <tr>
                                        <th className="p-4">PO #</th>
                                        <th className="p-4">Date</th>
                                        <th className="p-4">Supplier</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4">Usage</th>
                                        <th className="p-4 text-right">Amount</th>
                                        <th className="p-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {purchaseOrders.map(po => (
                                        <tr key={po.id} className="hover:bg-slate-50">
                                            <td className="p-4 font-bold text-indigo-600">{po.poNumber}</td>
                                            <td className="p-4 text-xs text-slate-500">{formatDate(po.orderDate)}</td>
                                            <td className="p-4 font-medium">{po.supplierName}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${po.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {po.paymentStatus === 'paid' ? 'PAID' : 'UNPAID'}
                                                </span>
                                            </td>
                                            <td className="p-4 w-48">
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span>{po.usagePercentage.toFixed(0)}% Used</span>
                                                    <span className="text-slate-400">Rs.{po.totalValueRemaining.toFixed(0)} left</span>
                                                </div>
                                                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                                    <div className={`h-full transition-all duration-500 ${po.usagePercentage > 90 ? 'bg-red-500' : 'bg-indigo-500'}`} style={{ width: `${po.usagePercentage}%` }}></div>
                                                </div>
                                            </td>
                                            <td className="p-4 text-right font-bold">Rs.{po.totalAmount.toLocaleString()}</td>
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => { setSelectedPO(po); setShowPOModal(true); }}
                                                    className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-indigo-600 transition-colors"
                                                    title="View Details / Print"
                                                >
                                                    <Printer className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {purchaseOrders.length === 0 && (
                                        <tr><td colSpan={7} className="p-8 text-center text-slate-400">No purchase orders found</td></tr>
                                    )}
                                </tbody>
                            </table>
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
                                            <td className="p-4 text-right font-bold text-slate-800">Rs.{(t.cost || 0).toFixed(2)}</td>
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

const OrderHistoryTable: React.FC<{ onViewDetails?: (patientId: string) => void; onPrintReport?: (orderId: string) => void; onPrintBill?: (orderId: string) => void }> = ({ onViewDetails, onPrintReport, onPrintBill }) => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const unsubRef = useRef<(() => void) | null>(null);
    const { showAlert, showToast } = useDialog();

    const subscribeToRecentWeek = () => {
        const oneWeekAgo = new Date(); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        unsubRef.current = db.collection('orders').where('createdAt', '>=', firebase.firestore.Timestamp.fromDate(oneWeekAgo)).orderBy('createdAt', 'desc').limit(200).onSnapshot(snap => setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order))));
    };

    useEffect(() => { subscribeToRecentWeek(); return () => { if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; } }; }, []);
    const showAction = onViewDetails || onPrintReport;

    const handleSearch = async (q: string) => {
        const qTrim = (q || '').trim();
        setSearchQuery(qTrim);
        if (!qTrim) {
            // restore recent week
            if (!unsubRef.current) subscribeToRecentWeek();
            setSearching(false);
            return;
        }

        const isDigitsOnly = /^\d+$/.test(qTrim);
        if (isDigitsOnly) {
            if (qTrim.length !== 11) { showAlert('warning', 'Phone search requires exactly 11 digits.'); return; }
            setSearching(true);
            try {
                if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
                const snap = await db.collection('samples').where('patientPhone', '==', qTrim).limit(500).get();
                const orderIds = Array.from(new Set(snap.docs.map(d => (d.data() as any).orderId))).filter(Boolean);
                if (orderIds.length === 0) { setOrders([]); showToast('info', 'No records found for that phone.'); setSearching(false); return; }
                // fetch orders by documentId in chunks (Firestore 'in' supports 10 per query)
                const chunks: string[][] = [];
                for (let i = 0; i < orderIds.length; i += 10) chunks.push(orderIds.slice(i, i + 10));
                const results: Order[] = [];
                for (const chunk of chunks) {
                    const snapO = await db.collection('orders').where(firebase.firestore.FieldPath.documentId(), 'in', chunk).get();
                    snapO.docs.forEach(d => results.push({ id: d.id, ...d.data() } as Order));
                }
                // sort by date desc
                results.sort((a, b) => { const da = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0; const dbt = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0; return dbt - da; });
                setOrders(results);
                setSearching(false);
            } catch (e) { console.error('Phone search failed:', e); showAlert('error', 'Failed to search by phone.'); setSearching(false); }
            return;
        }

        // Name search - fetch recent larger set and filter
        setSearching(true);
        try {
            if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
            let snap;
            try {
                snap = await db.collection('orders').orderBy('createdAt', 'desc').limit(1000).get();
            } catch (e) {
                snap = await db.collection('orders').limit(1000).get();
            }
            const rows = snap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
            const filtered = rows.filter(r => (r.patientName || '').toLowerCase().includes(qTrim.toLowerCase()));
            setOrders(filtered);
            if (filtered.length === 0) showToast('info', 'No records found for that name.');
        } catch (e) { console.error('Name search failed:', e); showAlert('error', 'Failed to search by name.'); }
        setSearching(false);
    };

    return (
        <div className="rounded-xl border shadow-sm overflow-hidden" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, borderColor: `${COLORS.PERSIAN_GREEN}30` }}>
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: `${COLORS.PERSIAN_GREEN}10` }}>
                <div className="text-xs text-slate-400">Phone search requires full 11 digits (numbers only)</div>
                <div className="flex items-center gap-2">
                    <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(searchQuery); }} placeholder="Search by patient name or enter 11-digit phone" className="p-2 rounded-lg bg-white text-sm w-full max-w-md" />
                    <button onClick={() => handleSearch(searchQuery)} disabled={searching} className="px-3 py-2 rounded bg-blue-600 text-white text-sm font-bold">{searching ? 'Searching...' : 'Search'}</button>
                    <button onClick={() => { setSearchQuery(''); handleSearch(''); }} className="px-3 py-2 rounded bg-slate-200 text-sm">Clear</button>
                </div>
            </div>
            <table className="w-full text-left text-sm border-collapse">
                <thead style={{ backgroundColor: `${COLORS.RICH_BLACK}60`, borderBottom: `1px solid ${COLORS.PERSIAN_GREEN}20` }}>
                    <tr>
                        <th className="p-4 font-bold" style={{ color: COLORS.TIFFANY_BLUE }}>Date / Order ID</th>
                        <th className="p-4 font-bold" style={{ color: COLORS.TIFFANY_BLUE }}>Patient</th>
                        <th className="p-4 font-bold" style={{ color: COLORS.TIFFANY_BLUE }}>Amount</th>
                        <th className="p-4 font-bold" style={{ color: COLORS.TIFFANY_BLUE }}>Status</th>
                        {showAction && <th className="p-4 text-right font-bold" style={{ color: COLORS.TIFFANY_BLUE }}>Action</th>}
                    </tr>
                </thead>
                <tbody className="divide-y" style={{ divideColor: `${COLORS.PERSIAN_GREEN}10` }}>
                    {orders.map(o => (
                        <tr key={o.id} className="hover:bg-white/5 transition-colors">
                            <td className="p-4">
                                <div className="text-xs" style={{ color: COLORS.TIFFANY_BLUE }}>{formatDate(o.createdAt)}</div>
                                <div className="font-mono text-[10px] font-bold mt-1 opacity-70" style={{ color: COLORS.CITRON }}>#{o.id.slice(-8).toUpperCase()}</div>
                            </td>
                            <td className="p-4">
                                <div className="font-bold text-base" style={{ color: COLORS.CITRON }}>{o.patientName}</div>
                            </td>
                            <td className="p-4 font-bold" style={{ color: COLORS.GAMBOGE }}>
                                Rs.{o.totalAmount}
                                {o.discount > 0 && <span className="ml-1 text-[10px] opacity-70" style={{ color: COLORS.TIFFANY_BLUE }}>(-Rs.{o.discount})</span>}
                            </td>
                            <td className="p-4">
                                <span className="px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider" style={{
                                    backgroundColor: o.status === 'completed' ? `${COLORS.SUCCESS}20` : `${COLORS.GAMBOGE}20`,
                                    color: o.status === 'completed' ? COLORS.SUCCESS : COLORS.GAMBOGE,
                                    border: `1px solid ${o.status === 'completed' ? COLORS.SUCCESS : COLORS.GAMBOGE}40`
                                }}>
                                    {o.status}
                                </span>
                            </td>
                            {showAction && (
                                <td className="p-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        {onPrintBill && (
                                            <button onClick={() => onPrintBill(o.id)} className="p-2 text-white rounded-lg hover:opacity-80 transition-opacity bg-[#16a34a]" title="Print Bill">
                                                <Printer className="w-4 h-4" />
                                            </button>
                                        )}
                                        {onPrintReport && o.status === 'completed' && (
                                            <button onClick={() => onPrintReport(o.id)} className="p-2 text-white rounded-lg hover:opacity-80 transition-opacity bg-[#1d4ed8]" title="Print Final Report">
                                                <Printer className="w-4 h-4" />
                                            </button>
                                        )}
                                        {onViewDetails && (
                                            <button onClick={() => onViewDetails(o.patientId)} className="p-2 rounded-lg hover:bg-white/10 transition-colors" style={{ color: COLORS.TIFFANY_BLUE }} title="View Patient Details">
                                                <History className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            )}
                        </tr>
                    ))}
                    {orders.length === 0 && <tr><td colSpan={showAction ? 5 : 4} className="p-12 text-center opacity-40" style={{ color: COLORS.TIFFANY_BLUE }}>No recent orders found.</td></tr>}
                </tbody>
            </table>
        </div>
    );
};

const ReceptionReportsTable: React.FC<{ onPrint: (s: Sample[]) => void }> = ({ onPrint }) => {
    const [samples, setSamples] = useState<Sample[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const unsubRef = useRef<(() => void) | null>(null);
    const { showAlert, showToast } = useDialog();

    const subscribeToRecent = () => {
        unsubRef.current = db.collection('samples')
            .where('status', '==', 'reported')
            .orderBy('reportedAt', 'desc')
            .limit(50)
            .onSnapshot(snap => setSamples(snap.docs.map(d => ({ id: d.id, ...d.data() } as Sample))));
    };

    useEffect(() => {
        subscribeToRecent();
        return () => { if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; } };
    }, []);

    const handleSearchReports = async (q: string) => {
        const qTrim = (q || '').trim();
        setSearchQuery(qTrim);

        // If empty, restore subscription
        if (!qTrim) {
            setSearching(false);
            if (!unsubRef.current) subscribeToRecent();
            return;
        }

        const digitsOnly = qTrim.replace(/\D/g, '');
        // Phone search: must be exactly 11 digits
        const isDigitsOnly = /^\d+$/.test(qTrim);

        // Phone search ONLY when input is digits only
        if (isDigitsOnly) {
            if (qTrim.length !== 11) {
                showAlert('warning', 'Phone search requires exactly 11 digits.');
                return;
            }
            setSearching(true);
            try {
                // Stop live subscription while showing search results
                if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
                const snap = await db.collection('samples').where('status', '==', 'reported').where('patientPhone', '==', qTrim).orderBy('reportedAt', 'desc').limit(200).get();
                const rows = snap.docs.map(d => ({ id: d.id, ...d.data() } as Sample));
                setSamples(rows);
                if (rows.length === 0) showToast('info', 'No reported records found for that phone number.');
            } catch (e) {
                console.error('Phone search failed:', e);
                showAlert('error', 'Failed to search by phone.');
            }
            setSearching(false);
            return;
        }

        // Name search (client-side filtering). Try efficient query first; fallback to less strict query on failure
        setSearching(true);
        try {
            if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
            let snap;
            try {
                snap = await db.collection('samples').where('status', '==', 'reported').orderBy('reportedAt', 'desc').limit(500).get();
            } catch (e) {
                console.warn('OrderBy query failed, retrying without orderBy', e);
                snap = await db.collection('samples').where('status', '==', 'reported').limit(500).get();
            }
            const rows = snap.docs.map(d => ({ id: d.id, ...d.data() } as Sample));
            const filtered = rows.filter(r => (r.patientName || '').toLowerCase().includes(qTrim.toLowerCase()));
            setSamples(filtered);
            if (filtered.length === 0) showToast('info', 'No reported records found for that name.');
        } catch (e) {
            console.error('Name search failed:', e);
            // Fallback: restore subscription and filter current samples client-side
            try {
                subscribeToRecent();
                const fallback = samples.filter(r => (r.patientName || '').toLowerCase().includes(qTrim.toLowerCase()));
                setSamples(fallback);
                if (fallback.length === 0) showToast('info', 'No reported records found for that name.');
            } catch (e2) {
                console.error('Fallback name filter failed', e2);
                showAlert('error', 'Failed to search by name.');
            }
        }
        setSearching(false);
    };

    // Group by Order ID for Patient-Centric display
    const groupedSamples = useMemo(() => {
        const groups: Record<string, Sample[]> = {};
        samples.forEach(s => {
            const key = s.orderId || s.patientId;
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
        <div className="rounded-xl border shadow-sm overflow-hidden" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, borderColor: `${COLORS.PERSIAN_GREEN}30` }}>
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: `${COLORS.PERSIAN_GREEN}10` }}>
                <div className="text-xs text-slate-400">Phone search requires full 11 digits (numbers only)</div>
                <div className="flex items-center gap-2">
                    <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSearchReports(searchQuery); }} placeholder="Search by patient name or enter 11-digit phone" className="p-2 rounded-lg bg-white text-sm w-full max-w-md" />
                    <button onClick={() => handleSearchReports(searchQuery)} disabled={searching} className="px-3 py-2 rounded bg-blue-600 text-white text-sm font-bold">{searching ? 'Searching...' : 'Search'}</button>
                    <button onClick={() => { setSearchQuery(''); handleSearchReports(''); }} className="px-3 py-2 rounded bg-slate-200 text-sm">Clear</button>
                </div>
            </div>
            <table className="w-full text-left text-sm border-collapse">
                <thead style={{ backgroundColor: `${COLORS.RICH_BLACK}60`, borderBottom: `1px solid ${COLORS.PERSIAN_GREEN}20` }}>
                    <tr>
                        <th className="p-4 font-bold" style={{ color: COLORS.TIFFANY_BLUE }}>Reported Time</th>
                        <th className="p-4 font-bold" style={{ color: COLORS.TIFFANY_BLUE }}>Patient Details</th>
                        <th className="p-4 font-bold" style={{ color: COLORS.TIFFANY_BLUE }}>Batch Tests</th>
                        <th className="p-4 text-right font-bold" style={{ color: COLORS.TIFFANY_BLUE }}>Reports</th>
                    </tr>
                </thead>
                <tbody className="divide-y" style={{ divideColor: `${COLORS.PERSIAN_GREEN}10` }}>
                    {groupedSamples.map((group, idx) => {
                        const s = group[0];
                        return (
                            <tr key={idx} className="hover:bg-white/5 transition-colors">
                                <td className="p-4">
                                    <div className="text-xs" style={{ color: COLORS.TIFFANY_BLUE }}>{formatDate(s.reportedAt)}</div>
                                    <div className="text-[10px] opacity-60 mt-0.5" style={{ color: COLORS.TIFFANY_BLUE }}>{formatTimeSafe(s.reportedAt)}</div>
                                </td>
                                <td className="p-4">
                                    <div className="font-bold text-base" style={{ color: COLORS.CITRON }}>{s.patientName}</div>
                                    <div className="text-xs opacity-70" style={{ color: COLORS.TIFFANY_BLUE }}>{s.patientAge}Y / {s.patientGender}</div>
                                </td>
                                <td className="p-4">
                                    <div className="flex flex-wrap gap-1.5">
                                        {group.map(g => (
                                            <span key={g.id} className="text-[10px] px-1.5 py-0.5 rounded border" style={{ backgroundColor: `${COLORS.PERSIAN_GREEN}10`, borderColor: `${COLORS.PERSIAN_GREEN}30`, color: COLORS.CITRON }}>
                                                {g.testName}
                                            </span>
                                        ))}
                                    </div>
                                    <div className="text-[10px] mt-1.5 font-bold" style={{ color: COLORS.GAMBOGE }}>{group.length} Test(s) Unified</div>
                                </td>
                                <td className="p-4 text-right">
                                    <button onClick={() => onPrint(group)} className="px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 ml-auto shadow-lg hover:opacity-90 transition-opacity" style={{ backgroundColor: COLORS.PERSIAN_GREEN, color: COLORS.RICH_BLACK }}>
                                        <Printer className="w-4 h-4" /> Print Combined Report
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                    {groupedSamples.length === 0 && <tr><td colSpan={4} className="p-12 text-center opacity-40" style={{ color: COLORS.TIFFANY_BLUE }}>No reported visits found.</td></tr>}
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
                                            <p className="font-bold text-slate-800">Rs.{h.totalAmount}</p>
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
    const [subView, setSubViewState] = useState<'dashboard' | 'items' | 'requests' | 'wastage' | 'vendors' | 'financials'>(isManager ? 'dashboard' : 'requests');
    const subViewRef = React.useRef<string>(isManager ? 'dashboard' : 'requests');
    
    // Stable setSubView callback using useCallback
    const setSubView = React.useCallback((newView: 'dashboard' | 'items' | 'requests' | 'wastage' | 'vendors' | 'financials') => {
        console.log('[INVENTORY] setSubView called:', newView, 'stack:', new Error().stack?.split('\n').slice(1, 2).join(''));
        setSubViewState(newView);
    }, []);
    
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [requests, setRequests] = useState<InventoryRequest[]>([]);
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [wastages, setWastages] = useState<InventoryWastage[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
    const [formData, setFormData] = useState<Partial<InventoryItem>>({ category: 'General', unit: 'pcs', status: 'in_stock', itemType: 'solid' });
    const [poDetails, setPODetails] = useState({ taxPercentage: 0, paymentTerms: 'Net 30' });
    const [selectedRequest, setSelectedRequest] = useState<InventoryRequest | null>(null);
    
    // JSON Import Modal State for Inventory
    const [showJsonModal, setShowJsonModal] = useState(false);
    const [jsonInput, setJsonInput] = useState('');
    const [jsonError, setJsonError] = useState('');

    // Purchase More functionality
    const [showPurchaseModal, setShowPurchaseModal] = useState(false);
    const [purchasingItem, setPurchasingItem] = useState<InventoryItem | null>(null);
    const [purchaseData, setPurchaseData] = useState({
        quantity: 0,
        unitPrice: 0,
        vendorName: '',
        vendorPhone: '',
        invoiceNumber: '',
        batchCode: '',
        expiryDate: '',
        manufactureDate: '',
        remarks: '',
        taxPercentage: 0,
        paymentTerms: 'Net 30'
    });

    // (Initial stock UI removed per request)

    // Discard batch selection state
    const [showDiscardModal, setShowDiscardModal] = useState(false);
    const [discardingItem, setDiscardingItem] = useState<InventoryItem | null>(null);
    const [itemBatches, setItemBatches] = useState<any[]>([]);
    const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
    const [discardReason, setDiscardReason] = useState('Expired - Past expiry date');

    // Purchase Order state
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [showPOModal, setShowPOModal] = useState(false);
    const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
    const [showCreatePOModal, setShowCreatePOModal] = useState(false);
    const [showRequisitionModal, setShowRequisitionModal] = useState(false);
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [selectedReturnPO, setSelectedReturnPO] = useState<PurchaseOrder | null>(null);
    const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
    // Receiving Modal State
    const [showReceiveModal, setShowReceiveModal] = useState(false);
    const [selectedReceivePO, setSelectedReceivePO] = useState<PurchaseOrder | null>(null);

    const [financialStats, setFinancialStats] = useState({
        totalPurchases: 0,
        totalPaid: 0,
        totalUnpaid: 0,
        totalValueUsed: 0,
        totalValueRemaining: 0,
        usageRate: 0
    });

    // Keep subView ref in sync with state to prevent stale closures
    useEffect(() => {
        subViewRef.current = subView;
        console.log('[INVENTORY] subView updated to:', subView);
    }, [subView]);

    // Real-time data subscriptions
    useEffect(() => {
        const unsubItems = db.collection('inventory_items').onSnapshot(s => {
            console.log('[INVENTORY] Items snapshot update:', s.docs.length, 'items');
            setItems(s.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem)));
        });
        const unsubRequests = db.collection('inventory_requests').orderBy('createdAt', 'desc').limit(50).onSnapshot(s => setRequests(s.docs.map(d => ({ id: d.id, ...d.data() } as InventoryRequest))));
        const unsubVendors = db.collection('vendors').onSnapshot(s => setVendors(s.docs.map(d => ({ id: d.id, ...d.data() } as Vendor))));
        const unsubWastages = db.collection('inventory_wastages').orderBy('reportedAt', 'desc').limit(50).onSnapshot(s => setWastages(s.docs.map(d => ({ id: d.id, ...d.data() } as InventoryWastage))));

        // Purchase Orders listener with financial stats calculation
        const unsubPOs = db.collection('purchase_orders')
            .orderBy('createdAt', 'desc')
            .limit(200)
            .onSnapshot(snapshot => {
                const pos = snapshot.docs.map(d => ({
                    id: d.id,
                    ...d.data()
                } as PurchaseOrder));
                setPurchaseOrders(pos);

                // Calculate financial stats
                const stats = {
                    totalPurchases: pos.reduce((sum, po) => sum + (po.totalAmount || 0), 0),
                    totalPaid: pos.filter(po => po.paymentStatus === 'paid')
                        .reduce((sum, po) => sum + (po.totalAmount || 0), 0),
                    totalUnpaid: pos.filter(po => po.paymentStatus === 'unpaid')
                        .reduce((sum, po) => sum + (po.totalAmount || 0), 0),
                    totalValueUsed: pos.reduce((sum, po) => sum + (po.totalValueUsed || 0), 0),
                    totalValueRemaining: pos.reduce((sum, po) => sum + (po.totalValueRemaining || 0), 0),
                    usageRate: 0
                };
                stats.usageRate = stats.totalPurchases > 0
                    ? (stats.totalValueUsed / stats.totalPurchases) * 100
                    : 0;
                setFinancialStats(stats);
            });

        return () => { unsubItems(); unsubRequests(); unsubVendors(); unsubWastages(); unsubPOs(); };
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
                // Create new item
                // Override quantity to 0 for initial creation (pending PO receipt)
                const initialData = { ...data, quantity: 0, status: 'out_of_stock', createdAt: now };
                const docRef = await db.collection('inventory_items').add(initialData);

                await logAction('ADD_INVENTORY', 'Inventory', `Added new item: ${formData.name}`, auth.currentUser);

                // If item has initial stock defined in form, generate PO
                if ((formData.quantity || 0) > 0 && (formData.purchasePrice || 0) > 0) {
                    try {
                        const taxPercentage = poDetails.taxPercentage || 0;
                        const paymentTerms = poDetails.paymentTerms || "Net 30";

                        await generatePurchaseOrder(
                            [{
                                itemId: docRef.id,
                                itemName: formData.name!,
                                description: formData.description,
                                quantity: formData.quantity!,
                                unit: formData.unit!,
                                unitPrice: formData.purchasePrice!,
                                batchNumber: formData.batchNumber,
                                expiryDate: formData.expiryDate ? (formData.expiryDate.toDate ? formData.expiryDate.toDate() : new Date(formData.expiryDate as any)) : undefined
                            }],
                            {
                                name: formData.vendorName!,
                                phone: formData.vendorPhone || '',
                                address: formData.vendorAddress
                            },
                            taxPercentage,
                            paymentTerms,
                            auth.currentUser?.email || 'System',
                            {
                                referenceNumber: undefined,
                                notes: undefined
                            }
                        );
                        showToast('success', 'Item defined. Purchase Order generated (Pending Receipt).');
                    } catch (poError) {
                        console.error("Failed to generate PO:", poError);
                        showToast('warning', 'Item added but Purchase Order generation failed');
                    }
                } else {
                    showToast('success', 'Item defined (No stock added).');
                }
            }
            setShowModal(false);
            setEditingItem(null);
            setFormData({ category: 'General', unit: 'pcs', status: 'in_stock', itemType: 'solid' });
            setPODetails({ taxPercentage: 0, paymentTerms: 'Net 30' }); // Reset PO details
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

    const handleImportFromJson = async () => {
        if (!jsonInput.trim()) {
            setJsonError('Please paste JSON data');
            return;
        }

        try {
            setJsonError('');
            let parsedData = JSON.parse(jsonInput);

            // Support both single item object and array of items
            const itemsToImport: any[] = Array.isArray(parsedData) ? parsedData : [parsedData];

            if (itemsToImport.length === 0) {
                setJsonError('No items found in JSON');
                return;
            }

            // Validate each item has required fields
            for (const item of itemsToImport) {
                if (!item.name || !item.category || item.unit === undefined) {
                    setJsonError('Each item must have: name, category, and unit');
                    return;
                }
            }

            // Confirm before importing
            const confirmed = await showConfirm(
                'Import Items from JSON',
                `This will add ${itemsToImport.length} inventory item(s) to your database. Continue?`
            );
            if (!confirmed) return;

            showToast('info', 'Importing items... Please wait');

            // Use batch writes for better reliability
            const batch = db.batch();
            let added = 0;
            const poItemsForImport: any[] = [];

            for (const item of itemsToImport) {
                console.log(`Processing inventory item:`, item.name, `with fields:`, Object.keys(item));

                const itemRef = db.collection('inventory_items').doc();
                // Create inventory item placeholder — quantity stays 0 until received via QC/receiving
                const itemData: any = {
                    name: (item.name || '').trim(),
                    category: item.category || 'General',
                    unit: item.unit || 'pcs',
                    itemType: item.itemType || 'solid',
                    quantity: 0, // awaiting receipt
                    minLevel: parseFloat(item.minLevel) || 10,
                    status: item.status || 'pending_receive',
                    purchasePrice: parseFloat(item.purchasePrice) || 0,
                    vendorName: item.vendorName || 'Imported JSON',
                    batchNumber: item.batchNumber || 'B001',
                    createdAt: firebase.firestore.Timestamp.now(),
                    createdBy: auth.currentUser?.email || 'admin'
                };

                // Add optional fields if provided
                if (item.description) itemData.description = item.description;
                if (item.sku) itemData.sku = item.sku;
                if (item.barcode) itemData.barcode = item.barcode;
                if (item.reorderLevel !== undefined) itemData.reorderLevel = parseFloat(item.reorderLevel);
                if (item.vendorId) itemData.vendorId = item.vendorId;
                if (item.vendorPhone) itemData.vendorPhone = item.vendorPhone;
                if (item.vendorAddress) itemData.vendorAddress = item.vendorAddress;
                if (item.purchaseDate) itemData.purchaseDate = item.purchaseDate;
                if (item.expiryDate) itemData.expiryDate = item.expiryDate;
                if (item.location) itemData.location = item.location;
                if (item.testMappings && Array.isArray(item.testMappings)) itemData.testMappings = item.testMappings;

                console.log(`✓ Item ${added + 1}: ${itemData.name} - Quantity: ${itemData.quantity} ${itemData.unit}`);

                batch.set(itemRef, itemData);
                // Prepare PO line referencing the newly created inventory doc
                poItemsForImport.push({
                    itemId: itemRef.id,
                    itemName: itemData.name,
                    description: item.description || itemData.description || '',
                    quantity: parseFloat(item.quantity) || 0,
                    unit: itemData.unit,
                    unitPrice: parseFloat(item.purchasePrice) || 0,
                    batchNumber: item.batchNumber || ''
                });
                added++;
            }

            await batch.commit();

            // Create a Purchase Order so imported items appear in "Shipments Awaiting QC & Receiving"
            if (poItemsForImport.length > 0) {
                try {
                    await generatePurchaseOrder(
                        poItemsForImport,
                        { name: 'Imported JSON', phone: '' },
                        0, // tax
                        'immediate',
                        auth.currentUser?.email || 'system',
                        { status: 'paid_awaiting_delivery' }
                    );
                    showToast('success', `Imported ${added} item(s) and created a Purchase Order awaiting receipt.`);
                } catch (poErr) {
                    console.error('Error creating PO for imported items:', poErr);
                    showToast('warning', `Imported ${added} items but failed to create Purchase Order.`);
                }
            } else {
                showToast('success', `Successfully imported ${added} inventory item(s)!`);
            }

            setJsonInput('');
            setShowJsonModal(false);
        } catch (error: any) {
            console.error('Error parsing JSON:', error);
            if (error instanceof SyntaxError) {
                setJsonError('Invalid JSON format: ' + error.message);
            } else {
                setJsonError(error?.message || 'Failed to import items');
            }
        }
    };

    const openEdit = (item: InventoryItem) => {
        setEditingItem(item);
        setFormData(item);
        setShowModal(true);
    };

    // Purchase More functionality
    const openPurchaseMore = (item: InventoryItem) => {
        console.log('[INVENTORY] Opening Purchase More modal for item:', item.name, ', subView:', subView);
        setPurchasingItem(item);
        setPurchaseData({
            quantity: 0,
            unitPrice: item.purchasePrice || 0,
            vendorName: item.vendorName || '',
            vendorPhone: item.vendorPhone || '',
            invoiceNumber: '',
            batchCode: '',
            expiryDate: '',
            manufactureDate: '',
            remarks: '',
            taxPercentage: 0,
            paymentTerms: 'Net 30'
        });
        setShowPurchaseModal(true);
    };

    const handlePurchaseMore = async () => {
        if (!purchasingItem || purchaseData.quantity <= 0) {
            showAlert('error', 'Please enter a valid quantity', 'Invalid Input');
            return;
        }

        if (!purchaseData.batchCode?.trim()) {
            showAlert('error', 'Please enter a batch code', 'Missing Batch Code');
            return;
        }

        if (!purchaseData.vendorName?.trim()) {
            showAlert('error', 'Please enter vendor name', 'Missing Vendor');
            return;
        }

        try {
            // New Workflow: Only Generate PO. Stock update happens on Receipt.

            const taxPercentage = purchaseData.taxPercentage || 0;
            const paymentTerms = purchaseData.paymentTerms || "Net 30";
            const newBatchNumber = purchaseData.batchCode.trim();

            await generatePurchaseOrder(
                [{
                    itemId: purchasingItem.id,
                    itemName: purchasingItem.name,
                    description: purchasingItem.description,
                    quantity: purchaseData.quantity,
                    unit: purchasingItem.unit,
                    unitPrice: purchaseData.unitPrice,
                    batchNumber: newBatchNumber,
                    expiryDate: purchaseData.expiryDate ? new Date(purchaseData.expiryDate) : undefined,
                    manufactureDate: purchaseData.manufactureDate ? new Date(purchaseData.manufactureDate) : undefined
                }],
                {
                    name: purchaseData.vendorName,
                    phone: purchaseData.vendorPhone || '',
                    address: purchasingItem.vendorAddress
                },
                taxPercentage,
                paymentTerms,
                auth.currentUser?.email || 'System',
                {
                    referenceNumber: purchaseData.invoiceNumber,
                    notes: purchaseData.remarks
                }
            );

            showToast('success', `Purchase Order generated for Batch ${newBatchNumber}. Please receive stock to update inventory.`);
            console.log('[INVENTORY] Purchase more modal closing, subView:', subView);
            setShowPurchaseModal(false);
            setPurchasingItem(null);
            // Reset purchase data
            setPurchaseData({
                quantity: 0,
                unitPrice: 0,
                vendorName: '',
                vendorPhone: '',
                invoiceNumber: '',
                batchCode: '',
                expiryDate: '',
                manufactureDate: '',
                remarks: '',
                taxPercentage: 0,
                paymentTerms: 'Net 30'
            });

        } catch (e) {
            console.error(e);
            showAlert('error', 'Failed to generate PO: ' + (e instanceof Error ? e.message : String(e)), 'Error');
        }
    };

    // Initial stock handler removed

    // Open discard modal and fetch batches
    const handleDiscardExpired = async (item: InventoryItem) => {
        if (item.quantity <= 0) {
            showAlert('info', 'This item has no stock to discard', 'No Stock');
            return;
        }

        // Fetch batches for this item
        try {
            const batchesSnap = await db.collection('inventory_batches')
                .where('itemId', '==', item.id)
                .get();

            const batches = batchesSnap.docs.map(doc => {
                const data = doc.data();
                const expiryDate = data.expiryDate?.toDate ? data.expiryDate.toDate() : (data.expiryDate ? new Date(data.expiryDate) : null);
                const isExpired = expiryDate ? expiryDate < new Date() : false;
                return {
                    id: doc.id,
                    ...data,
                    expiryDate,
                    isExpired,
                    remainingQty: data.quantityPurchased || data.quantity || 0
                };
            }).filter(b => b.remainingQty > 0); // Only show batches with stock

            if (batches.length === 0) {
                // No batch records, use direct discard (legacy item)
                await directDiscardItem(item);
            } else if (batches.length === 1) {
                // Single batch, auto-select it
                console.log('[INVENTORY] Opening discard modal with 1 batch, subView:', subView);
                setDiscardingItem(item);
                setItemBatches(batches);
                setSelectedBatches([batches[0].id]);
                setDiscardReason('Expired - Past expiry date');
                setShowDiscardModal(true);
            } else {
                // Multiple batches, show selection
                console.log('[INVENTORY] Opening discard modal with', batches.length, 'batches, subView:', subView);
                setDiscardingItem(item);
                setItemBatches(batches);
                setSelectedBatches(batches.filter(b => b.isExpired).map(b => b.id)); // Pre-select expired
                setDiscardReason('Expired - Past expiry date');
                setShowDiscardModal(true);
            }
        } catch (e) {
            console.error('Failed to fetch batches:', e);
            // Fallback to direct discard
            await directDiscardItem(item);
        }
    };

    // Direct discard for items without batch records (legacy)
    const directDiscardItem = async (item: InventoryItem) => {
        const reason = await showPrompt(
            `Why are you discarding ${item.quantity} ${item.unit} of "${item.name}"?`,
            {
                title: 'Discard Reason',
                placeholder: 'e.g., Expired beyond use, Contaminated, Damaged packaging...',
                defaultValue: 'Expired - Past expiry date'
            }
        );

        if (!reason?.trim()) {
            showAlert('warning', 'A reason is required to discard items', 'Reason Required');
            return;
        }

        const confirmed = await showConfirm(
            `Confirm discarding ${item.quantity} ${item.unit} of "${item.name}"?\n\nReason: ${reason}\nValue: Rs.${((item.purchasePrice || 0) * item.quantity).toLocaleString()}\n\nThis will be recorded as wastage for finance and reporting.`,
            { title: 'Confirm Discard', confirmText: 'Discard', type: 'danger' }
        );

        if (!confirmed) return;

        try {
            const batch = db.batch();

            const wastageRef = db.collection('inventory_wastages').doc();
            batch.set(wastageRef, {
                id: wastageRef.id,
                itemId: item.id,
                itemName: item.name,
                category: item.category,
                quantity: item.quantity,
                unit: item.unit,
                type: 'expired',
                status: 'discarded',
                label: 'Expired, Discarded',
                reason: reason.trim(),
                batchNumber: item.batchNumber || 'N/A',
                purchasePrice: item.purchasePrice || 0,
                estimatedValue: (item.purchasePrice || 0) * item.quantity,
                vendorName: item.vendorName || '',
                reportedBy: auth.currentUser?.email || 'manager',
                reportedByUid: auth.currentUser?.uid || '',
                reportedAt: firebase.firestore.Timestamp.now(),
                expiryDate: item.expiryDate,
                isExpense: true,
                expenseCategory: 'Inventory Wastage',
                year: new Date().getFullYear(),
                month: new Date().getMonth() + 1,
                week: Math.ceil((new Date().getDate()) / 7)
            });

            const itemRef = db.collection('inventory_items').doc(item.id);
            batch.update(itemRef, {
                quantity: 0,
                status: 'out_of_stock',
                lastUpdated: firebase.firestore.Timestamp.now()
            });

            const transRef = db.collection('inventory_transactions').doc();
            batch.set(transRef, {
                id: transRef.id,
                itemId: item.id,
                itemName: item.name,
                type: 'wastage',
                quantity: -item.quantity,
                cost: (item.purchasePrice || 0) * item.quantity,
                performedBy: auth.currentUser?.uid || 'admin',
                performedByEmail: auth.currentUser?.email || '',
                reason: `Expired/Discarded: ${reason.trim()}`,
                timestamp: firebase.firestore.Timestamp.now(),
                isExpense: true
            });

            await batch.commit();
            await logAction('DISCARD_EXPIRED', 'Inventory', `Discarded ${item.quantity} ${item.unit} of ${item.name}. Reason: ${reason}.`, auth.currentUser);
            showToast('success', `Discarded ${item.quantity} ${item.unit} of ${item.name}. Recorded as wastage.`);
        } catch (e) {
            console.error(e);
            showAlert('error', 'Failed to discard item: ' + (e instanceof Error ? e.message : String(e)), 'Discard Failed');
        }
    };

    // Permanently remove an item and its batches from inventory (Manager action)
    const handleRemoveItem = async (item: InventoryItem) => {
        const confirmed = await showConfirm(
            `Permanently remove "${item.name}" from inventory? This will delete the item record and its associated batches.`,
            { title: 'Remove Item', confirmText: 'Remove', type: 'danger' }
        );
        if (!confirmed) return;

        try {
            // Query batches first
            const batchesSnap = await db.collection('inventory_batches').where('itemId', '==', item.id).get();
            const batch = db.batch();

            // Delete all related batches
            batchesSnap.docs.forEach(d => {
                batch.delete(db.collection('inventory_batches').doc(d.id));
            });

            // Delete the inventory item document
            batch.delete(db.collection('inventory_items').doc(item.id));

            await batch.commit();

            await logAction('REMOVE_ITEM', 'Inventory', `Removed item ${item.name} and ${batchesSnap.size} batch(es)`, auth.currentUser);
            showToast('success', `Removed ${item.name} from inventory.`);
        } catch (e) {
            console.error('Error removing item', e);
            showAlert('error', 'Failed to remove item: ' + (e instanceof Error ? e.message : String(e)), 'Remove Failed');
        }
    };

    // Process selected batches for discard
    const processDiscardBatches = async () => {
        if (!discardingItem || selectedBatches.length === 0) {
            showAlert('warning', 'Please select at least one batch to discard', 'No Selection');
            return;
        }

        if (!discardReason.trim()) {
            showAlert('warning', 'Please enter a reason for discarding', 'Reason Required');
            return;
        }

        const batchesToDiscard = itemBatches.filter(b => selectedBatches.includes(b.id));
        const totalQty = batchesToDiscard.reduce((sum, b) => sum + (b.remainingQty || 0), 0);
        const totalValue = batchesToDiscard.reduce((sum, b) => sum + ((b.unitPrice || discardingItem.purchasePrice || 0) * (b.remainingQty || 0)), 0);

        const confirmed = await showConfirm(
            `Confirm discarding ${batchesToDiscard.length} batch(es) of "${discardingItem.name}"?\n\nTotal Quantity: ${totalQty} ${discardingItem.unit}\nTotal Value: Rs.${totalValue.toLocaleString()}\nReason: ${discardReason}\n\nThis will be recorded as wastage.`,
            { title: 'Confirm Batch Discard', confirmText: 'Discard Selected', type: 'danger' }
        );

        if (!confirmed) return;

        try {
            const batch = db.batch();

            for (const batchData of batchesToDiscard) {
                // Create wastage record for each batch
                const wastageRef = db.collection('inventory_wastages').doc();
                batch.set(wastageRef, {
                    id: wastageRef.id,
                    itemId: discardingItem.id,
                    itemName: discardingItem.name,
                    category: discardingItem.category,
                    quantity: batchData.remainingQty,
                    unit: discardingItem.unit,
                    type: 'expired',
                    status: 'discarded',
                    label: 'Expired, Discarded',
                    reason: discardReason.trim(),
                    batchNumber: batchData.batchNumber || 'N/A',
                    batchId: batchData.id,
                    purchasePrice: batchData.unitPrice || discardingItem.purchasePrice || 0,
                    estimatedValue: (batchData.unitPrice || discardingItem.purchasePrice || 0) * batchData.remainingQty,
                    vendorName: batchData.vendorName || discardingItem.vendorName || '',
                    reportedBy: auth.currentUser?.email || 'manager',
                    reportedByUid: auth.currentUser?.uid || '',
                    reportedAt: firebase.firestore.Timestamp.now(),
                    expiryDate: batchData.expiryDate,
                    isExpense: true,
                    expenseCategory: 'Inventory Wastage',
                    year: new Date().getFullYear(),
                    month: new Date().getMonth() + 1,
                    week: Math.ceil((new Date().getDate()) / 7)
                });

                // Update batch quantity to 0
                const batchRef = db.collection('inventory_batches').doc(batchData.id);
                batch.update(batchRef, {
                    quantityPurchased: 0,
                    quantity: 0,
                    status: 'discarded',
                    discardedAt: firebase.firestore.Timestamp.now()
                });

                // Create transaction record
                const transRef = db.collection('inventory_transactions').doc();
                batch.set(transRef, {
                    id: transRef.id,
                    itemId: discardingItem.id,
                    itemName: discardingItem.name,
                    batchId: batchData.id,
                    batchNumber: batchData.batchNumber,
                    type: 'wastage',
                    quantity: -batchData.remainingQty,
                    cost: (batchData.unitPrice || discardingItem.purchasePrice || 0) * batchData.remainingQty,
                    performedBy: auth.currentUser?.uid || 'admin',
                    performedByEmail: auth.currentUser?.email || '',
                    reason: `Expired/Discarded: ${discardReason.trim()}`,
                    timestamp: firebase.firestore.Timestamp.now(),
                    isExpense: true
                });
            }

            // Update item total quantity
            const newTotalQty = discardingItem.quantity - totalQty;
            const itemRef = db.collection('inventory_items').doc(discardingItem.id);
            batch.update(itemRef, {
                quantity: Math.max(0, newTotalQty),
                status: newTotalQty <= 0 ? 'out_of_stock' : newTotalQty < discardingItem.minLevel ? 'low_stock' : 'in_stock',
                lastUpdated: firebase.firestore.Timestamp.now()
            });

            await batch.commit();
            await logAction('DISCARD_BATCHES', 'Inventory', `Discarded ${batchesToDiscard.length} batch(es) of ${discardingItem.name}. Qty: ${totalQty}, Value: Rs.${totalValue.toLocaleString()}. Reason: ${discardReason}`, auth.currentUser);

            console.log('[INVENTORY] Discard batches completed, closing modal, subView:', subView);
            showToast('success', `Discarded ${batchesToDiscard.length} batch(es). Total: ${totalQty} ${discardingItem.unit}`);
            setShowDiscardModal(false);
            setDiscardingItem(null);
            setItemBatches([]);
            setSelectedBatches([]);
        } catch (e) {
            console.error(e);
            showAlert('error', 'Failed to discard batches: ' + (e instanceof Error ? e.message : String(e)), 'Discard Failed');
        }
    };

    // Request Management
    const handleApproveRequest = async (req: InventoryRequest) => {
        const confirmed = await showConfirm(
            `Approve and release ${req.quantity} x "${req.itemName}" for ${req.requesterName}?`,
            { title: 'Approve Requisition', confirmText: 'Approve & Release', type: 'primary' }
        );
        if (!confirmed) return;

        try {
            await approveRequisition(req.id, auth.currentUser?.email || 'System');
            showToast('success', `Request approved! Items released from stock.`);
            await logAction('APPROVE_REQUISITION', 'Inventory', `Approved requisition ${req.id} for ${req.requesterName}`, auth.currentUser);
        } catch (e) {
            console.error(e);
            showAlert('error', 'Failed to approve request: ' + (e instanceof Error ? e.message : String(e)), 'Approval Failed');
        }
    };

    const handleRejectRequest = async (req: InventoryRequest) => {
        const reason = await showPrompt(
            `Reject requisition from ${req.requesterName}?`,
            { title: 'Rejection Reason', placeholder: 'Enter reason for rejection...', defaultValue: '' }
        );

        if (reason === null) return; // Cancelled
        if (!reason.trim()) {
            showAlert('warning', 'Reason is required to reject a requisition');
            return;
        }

        try {
            await rejectRequisition(req.id, auth.currentUser?.email || 'System', reason.trim());
            showToast('success', `Request rejected.`);
            await logAction('REJECT_REQUISITION', 'Inventory', `Rejected requisition ${req.id} for ${req.requesterName}`, auth.currentUser);
        } catch (e) {
            console.error(e);
            showAlert('error', 'Failed to reject request: ' + (e instanceof Error ? e.message : String(e)), 'Rejection Failed');
        }
    };

    const renderDashboard = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-6 rounded-xl border-2 shadow-md bg-white border-indigo-100">
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-xs font-bold uppercase text-slate-500">Total Items</p>
                        <Package className="w-5 h-5 text-indigo-600" />
                    </div>
                    <p className="text-3xl font-bold text-slate-900">{stats.totalItems}</p>
                </div>
                <div className="p-6 rounded-xl border-2 shadow-md bg-amber-50 border-amber-200">
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-xs font-bold uppercase text-amber-700">Low Stock</p>
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                    </div>
                    <p className="text-3xl font-bold text-amber-700">{stats.lowStock}</p>
                </div>
                <div className="p-6 rounded-xl border-2 shadow-md bg-red-50 border-red-200">
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-xs font-bold uppercase text-red-700">Expired Items</p>
                        <XCircle className="w-5 h-5 text-red-600" />
                    </div>
                    <p className="text-3xl font-bold text-red-700">{stats.expired}</p>
                </div>
                <div className="p-6 rounded-xl border-2 shadow-md bg-emerald-50 border-emerald-200">
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-xs font-bold uppercase text-emerald-700">Total Value</p>
                        <DollarSign className="w-5 h-5 text-emerald-600" />
                    </div>
                    <p className="text-3xl font-bold text-emerald-700">Rs.{stats.totalValue.toLocaleString()}</p>
                </div>
            </div>

            {/* Alerts */}
            {(stats.lowStock > 0 || stats.expired > 0 || stats.expiringSoon > 0) && (
                <div className="p-4 rounded-xl border" style={{ backgroundColor: '#dc2626', borderColor: '#ef4444' }}>
                    <h3 className="font-bold mb-3 flex items-center gap-2 text-white"><Bell className="w-4 h-4" /> Inventory Alerts</h3>
                    <div className="space-y-2">
                        {stats.lowStock > 0 && <p className="text-sm text-white">âš ï¸ {stats.lowStock} items below minimum stock level</p>}
                        {stats.expired > 0 && <p className="text-sm text-white font-bold">🚫 {stats.expired} items have expired</p>}
                        {stats.expiringSoon > 0 && <p className="text-sm text-white">â° {stats.expiringSoon} items expiring within 30 days</p>}
                    </div>
                    <button onClick={() => setSubView('items')} className="mt-3 text-sm font-bold hover:underline text-white">View Items â†’</button>
                </div>
            )}

            {/* Pending Requests */}
            {stats.pendingRequests > 0 && (
                <div className="p-4 rounded-xl border" style={{ backgroundColor: '#312e8130', borderColor: '#6366f140' }}>
                    <h3 className="font-bold mb-2 flex items-center gap-2" style={{ color: '#818cf8' }}><Truck className="w-4 h-4" /> Pending Requests</h3>
                    <p className="text-sm" style={{ color: '#c7d2fe' }}>{stats.pendingRequests} requests awaiting your approval</p>
                    <button onClick={() => setSubView('requests')} className="mt-2 text-sm font-bold hover:underline" style={{ color: '#818cf8' }}>Review Requests â†’</button>
                </div>
            )}
        </div>
    );

    // Render Items List (Manager Only)
    const renderItemsList = () => (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-xl font-bold" style={{ color: COLORS.CITRON }}>Stock Ledger</h3>
                    <p className="text-xs text-slate-500">Inventory levels are populated automatically via PO receipts.</p>
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={() => setShowJsonModal(true)} className="text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:opacity-90 transition-colors" style={{ backgroundColor: COLORS.PERSIAN_GREEN }}>
                        <Upload className="w-4 h-4" /> Import from JSON
                    </button>
                    <button onClick={() => setShowModal(true)} className="text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:opacity-90" style={{ backgroundColor: COLORS.GAMBOGE }}>
                        <Plus className="w-4 h-4" /> Add Item
                    </button>
                </div>
            </div>

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: '#00000080' }}>
                    <div className="rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, border: `1px solid ${COLORS.PERSIAN_GREEN}40` }}>
                        <h3 className="font-bold text-lg mb-4" style={{ color: COLORS.CITRON }}>{editingItem ? 'Edit Item' : 'Add New Item'}</h3>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="col-span-2"><label className="text-xs font-bold uppercase" style={{ color: COLORS.TIFFANY_BLUE }}>Item Name *</label><input className="w-full p-2 border rounded outline-none focus:ring-1 focus:ring-[#00b4d8]" style={{ backgroundColor: COLORS.RICH_BLACK, color: COLORS.CITRON, borderColor: `${COLORS.PERSIAN_GREEN}40` }} value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
                            <div><label className="text-xs font-bold uppercase" style={{ color: COLORS.TIFFANY_BLUE }}>Category</label><select className="w-full p-2 border rounded outline-none" style={{ backgroundColor: COLORS.RICH_BLACK, color: COLORS.CITRON, borderColor: `${COLORS.PERSIAN_GREEN}40` }} value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>{INVENTORY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                            <div>
                                <label className="text-xs font-bold uppercase" style={{ color: COLORS.TIFFANY_BLUE }}>Item Type</label>
                                <div className="flex mt-1 rounded overflow-hidden border" style={{ borderColor: `${COLORS.PERSIAN_GREEN}40` }}>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, itemType: 'solid', unit: 'pcs' })}
                                        className={`flex-1 py-2 text-sm font-bold transition-colors ${formData.itemType === 'solid' ? 'text-white' : ''}`}
                                        style={{ backgroundColor: formData.itemType === 'solid' ? COLORS.PERSIAN_GREEN : COLORS.RICH_BLACK, color: formData.itemType === 'solid' ? 'white' : COLORS.TIFFANY_BLUE }}
                                    >
                                        Solid (pcs)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, itemType: 'liquid', unit: 'ml' })}
                                        className={`flex-1 py-2 text-sm font-bold transition-colors ${formData.itemType === 'liquid' ? 'text-white' : ''}`}
                                        style={{ backgroundColor: formData.itemType === 'liquid' ? '#0ea5e9' : COLORS.RICH_BLACK, color: formData.itemType === 'liquid' ? 'white' : COLORS.TIFFANY_BLUE }}
                                    >
                                        Liquid (ml)
                                    </button>
                                </div>
                            </div>
                            <div><label className="text-xs font-bold uppercase" style={{ color: COLORS.TIFFANY_BLUE }}>Unit</label><input className="w-full p-2 border rounded outline-none focus:ring-1 focus:ring-[#00b4d8]" style={{ backgroundColor: COLORS.RICH_BLACK, color: COLORS.CITRON, borderColor: `${COLORS.PERSIAN_GREEN}40` }} placeholder={formData.itemType === 'liquid' ? 'ml' : 'pcs, boxes...'} value={formData.unit || ''} onChange={e => setFormData({ ...formData, unit: e.target.value })} /></div>
                            <div><label className="text-xs font-bold uppercase" style={{ color: COLORS.TIFFANY_BLUE }}>{formData.itemType === 'liquid' ? 'Volume (ml) *' : 'Quantity *'}</label><input type="number" className="w-full p-2 border rounded outline-none focus:ring-1 focus:ring-[#00b4d8]" style={{ backgroundColor: COLORS.RICH_BLACK, color: COLORS.CITRON, borderColor: `${COLORS.PERSIAN_GREEN}40` }} value={formData.quantity || ''} onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })} /></div>
                            <div><label className="text-xs font-bold uppercase" style={{ color: COLORS.TIFFANY_BLUE }}>Min Level ({formData.unit || 'units'})</label><input type="number" className="w-full p-2 border rounded outline-none focus:ring-1 focus:ring-[#00b4d8]" style={{ backgroundColor: COLORS.RICH_BLACK, color: COLORS.CITRON, borderColor: `${COLORS.PERSIAN_GREEN}40` }} value={formData.minLevel || ''} onChange={e => setFormData({ ...formData, minLevel: parseInt(e.target.value) || 0 })} /></div>
                            <div><label className="text-xs font-bold uppercase" style={{ color: COLORS.TIFFANY_BLUE }}>Purchase Price (Rs.{formData.itemType === 'liquid' ? '/ml' : '/unit'})</label><input type="number" step="0.01" className="w-full p-2 border rounded outline-none focus:ring-1 focus:ring-[#00b4d8]" style={{ backgroundColor: COLORS.RICH_BLACK, color: COLORS.CITRON, borderColor: `${COLORS.PERSIAN_GREEN}40` }} value={formData.purchasePrice || ''} onChange={e => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) || 0 })} /></div>
                            <div><label className="text-xs font-bold uppercase" style={{ color: COLORS.TIFFANY_BLUE }}>Batch Number</label><input className="w-full p-2 border rounded outline-none focus:ring-1 focus:ring-[#00b4d8]" style={{ backgroundColor: COLORS.RICH_BLACK, color: COLORS.CITRON, borderColor: `${COLORS.PERSIAN_GREEN}40` }} value={formData.batchNumber || ''} onChange={e => setFormData({ ...formData, batchNumber: e.target.value })} /></div>
                            <div><label className="text-xs font-bold uppercase" style={{ color: COLORS.TIFFANY_BLUE }}>Expiry Date</label><input type="date" className="w-full p-2 border rounded outline-none focus:ring-1 focus:ring-[#00b4d8]" style={{ backgroundColor: COLORS.RICH_BLACK, color: COLORS.CITRON, borderColor: `${COLORS.PERSIAN_GREEN}40` }} value={formData.expiryDate ? (formData.expiryDate.toDate ? formData.expiryDate.toDate().toISOString().split('T')[0] : '') : ''} onChange={e => setFormData({ ...formData, expiryDate: e.target.value ? firebase.firestore.Timestamp.fromDate(new Date(e.target.value)) : undefined })} /></div>
                            <div><label className="text-xs font-bold uppercase" style={{ color: COLORS.TIFFANY_BLUE }}>Barcode/SKU</label><input className="w-full p-2 border rounded outline-none focus:ring-1 focus:ring-[#00b4d8]" style={{ backgroundColor: COLORS.RICH_BLACK, color: COLORS.CITRON, borderColor: `${COLORS.PERSIAN_GREEN}40` }} value={formData.barcode || formData.sku || ''} onChange={e => setFormData({ ...formData, barcode: e.target.value })} /></div>
                            <div className="col-span-2"><label className="text-xs font-bold uppercase" style={{ color: COLORS.TIFFANY_BLUE }}>Vendor</label><input className="w-full p-2 border rounded outline-none focus:ring-1 focus:ring-[#00b4d8]" style={{ backgroundColor: COLORS.RICH_BLACK, color: COLORS.CITRON, borderColor: `${COLORS.PERSIAN_GREEN}40` }} value={formData.vendorName || ''} onChange={e => setFormData({ ...formData, vendorName: e.target.value })} /></div>
                            {!editingItem && (
                                <div className="col-span-2 grid grid-cols-2 gap-4 p-3 rounded" style={{ backgroundColor: `${COLORS.PERSIAN_GREEN}10` }}>
                                    <div className="col-span-2 text-xs font-bold uppercase text-indigo-400 mb-1">Initial Stock PO Details</div>
                                    <div>
                                        <label className="text-xs font-bold uppercase" style={{ color: COLORS.TIFFANY_BLUE }}>Tax %</label>
                                        <input type="number" className="w-full p-2 border rounded outline-none focus:ring-1 focus:ring-[#00b4d8]" style={{ backgroundColor: COLORS.RICH_BLACK, color: COLORS.CITRON, borderColor: `${COLORS.PERSIAN_GREEN}40` }} value={poDetails.taxPercentage} onChange={e => setPODetails({ ...poDetails, taxPercentage: parseFloat(e.target.value) || 0 })} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold uppercase" style={{ color: COLORS.TIFFANY_BLUE }}>Payment Terms</label>
                                        <select className="w-full p-2 border rounded outline-none" style={{ backgroundColor: COLORS.RICH_BLACK, color: COLORS.CITRON, borderColor: `${COLORS.PERSIAN_GREEN}40` }} value={poDetails.paymentTerms} onChange={e => setPODetails({ ...poDetails, paymentTerms: e.target.value })}>
                                            <option value="Net 30">Net 30</option>
                                            <option value="Net 15">Net 15</option>
                                            <option value="Net 60">Net 60</option>
                                            <option value="Due on Receipt">Due on Receipt</option>
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end gap-2 border-t pt-4" style={{ borderColor: `${COLORS.PERSIAN_GREEN}20` }}>
                            <button onClick={() => setShowModal(false)} className="px-4 py-2 hover:opacity-80" style={{ color: COLORS.TIFFANY_BLUE }}>Cancel</button>
                            <button onClick={handleSave} className="text-white px-4 py-2 rounded font-bold hover:opacity-90" style={{ backgroundColor: COLORS.GAMBOGE }}>Save</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Purchase More Modal */}
            {showPurchaseModal && purchasingItem && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 animate-in fade-in" onClick={() => setShowPurchaseModal(false)}>
                    <div className="rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN }} onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b" style={{ borderColor: `${COLORS.PERSIAN_GREEN}30` }}>
                            <h3 className="text-lg font-bold" style={{ color: COLORS.CITRON }}>Purchase More: {purchasingItem.name}</h3>
                            <p className="text-xs mt-1" style={{ color: COLORS.TIFFANY_BLUE }}>Current Stock: {purchasingItem.quantity} {purchasingItem.unit}</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold mb-1" style={{ color: COLORS.TIFFANY_BLUE }}>Quantity *</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={purchaseData.quantity || ''}
                                        onChange={e => setPurchaseData({ ...purchaseData, quantity: parseInt(e.target.value) || 0 })}
                                        className="w-full p-2 rounded border outline-none text-sm"
                                        style={{ backgroundColor: COLORS.RICH_BLACK, borderColor: `${COLORS.PERSIAN_GREEN}40`, color: COLORS.CITRON }}
                                        placeholder="Enter quantity"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold mb-1" style={{ color: COLORS.TIFFANY_BLUE }}>Unit Price (Rs.)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={purchaseData.unitPrice || ''}
                                        onChange={e => setPurchaseData({ ...purchaseData, unitPrice: parseFloat(e.target.value) || 0 })}
                                        className="w-full p-2 rounded border outline-none text-sm"
                                        style={{ backgroundColor: COLORS.RICH_BLACK, borderColor: `${COLORS.PERSIAN_GREEN}40`, color: COLORS.CITRON }}
                                        placeholder="Price per unit"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold mb-1" style={{ color: COLORS.TIFFANY_BLUE }}>Batch Code *</label>
                                <input
                                    type="text"
                                    value={purchaseData.batchCode}
                                    onChange={e => setPurchaseData({ ...purchaseData, batchCode: e.target.value })}
                                    className="w-full p-2 rounded border outline-none text-sm"
                                    style={{ backgroundColor: COLORS.RICH_BLACK, borderColor: `${COLORS.PERSIAN_GREEN}40`, color: COLORS.CITRON }}
                                    placeholder="e.g., B001, LOT-2024-001"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold mb-1" style={{ color: COLORS.TIFFANY_BLUE }}>Vendor Name *</label>
                                <input
                                    type="text"
                                    value={purchaseData.vendorName}
                                    onChange={e => setPurchaseData({ ...purchaseData, vendorName: e.target.value })}
                                    className="w-full p-2 rounded border outline-none text-sm"
                                    style={{ backgroundColor: COLORS.RICH_BLACK, borderColor: `${COLORS.PERSIAN_GREEN}40`, color: COLORS.CITRON }}
                                    placeholder="Supplier name"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold mb-1" style={{ color: COLORS.TIFFANY_BLUE }}>Vendor Phone</label>
                                    <input
                                        type="text"
                                        value={purchaseData.vendorPhone}
                                        onChange={e => setPurchaseData({ ...purchaseData, vendorPhone: e.target.value })}
                                        className="w-full p-2 rounded border outline-none text-sm"
                                        style={{ backgroundColor: COLORS.RICH_BLACK, borderColor: `${COLORS.PERSIAN_GREEN}40`, color: COLORS.CITRON }}
                                        placeholder="Phone number"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold mb-1" style={{ color: COLORS.TIFFANY_BLUE }}>Invoice Number</label>
                                    <input
                                        type="text"
                                        value={purchaseData.invoiceNumber}
                                        onChange={e => setPurchaseData({ ...purchaseData, invoiceNumber: e.target.value })}
                                        className="w-full p-2 rounded border outline-none text-sm"
                                        style={{ backgroundColor: COLORS.RICH_BLACK, borderColor: `${COLORS.PERSIAN_GREEN}40`, color: COLORS.CITRON }}
                                        placeholder="Invoice #"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold mb-1" style={{ color: COLORS.TIFFANY_BLUE }}>Manufacture Date</label>
                                    <input
                                        type="date"
                                        value={purchaseData.manufactureDate}
                                        onChange={e => setPurchaseData({ ...purchaseData, manufactureDate: e.target.value })}
                                        className="w-full p-2 rounded border outline-none text-sm"
                                        style={{ backgroundColor: COLORS.RICH_BLACK, borderColor: `${COLORS.PERSIAN_GREEN}40`, color: COLORS.CITRON }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold mb-1" style={{ color: COLORS.TIFFANY_BLUE }}>Expiry Date</label>
                                    <input
                                        type="date"
                                        value={purchaseData.expiryDate}
                                        onChange={e => setPurchaseData({ ...purchaseData, expiryDate: e.target.value })}
                                        className="w-full p-2 rounded border outline-none text-sm"
                                        style={{ backgroundColor: COLORS.RICH_BLACK, borderColor: `${COLORS.PERSIAN_GREEN}40`, color: COLORS.CITRON }}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold mb-1" style={{ color: COLORS.TIFFANY_BLUE }}>Remarks</label>
                                <textarea
                                    value={purchaseData.remarks}
                                    onChange={e => setPurchaseData({ ...purchaseData, remarks: e.target.value })}
                                    className="w-full p-2 rounded border outline-none text-sm resize-none"
                                    style={{ backgroundColor: COLORS.RICH_BLACK, borderColor: `${COLORS.PERSIAN_GREEN}40`, color: COLORS.CITRON }}
                                    rows={2}
                                    placeholder="Any notes about this purchase..."
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold mb-1" style={{ color: COLORS.TIFFANY_BLUE }}>Tax Percentage (%)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        className="w-full p-2 rounded border outline-none text-sm"
                                        style={{ backgroundColor: COLORS.RICH_BLACK, borderColor: `${COLORS.PERSIAN_GREEN}40`, color: COLORS.CITRON }}
                                        value={purchaseData.taxPercentage}
                                        onChange={e => setPurchaseData({ ...purchaseData, taxPercentage: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold mb-1" style={{ color: COLORS.TIFFANY_BLUE }}>Payment Terms</label>
                                    <select
                                        className="w-full p-2 rounded border outline-none text-sm"
                                        style={{ backgroundColor: COLORS.RICH_BLACK, borderColor: `${COLORS.PERSIAN_GREEN}40`, color: COLORS.CITRON }}
                                        value={purchaseData.paymentTerms}
                                        onChange={e => setPurchaseData({ ...purchaseData, paymentTerms: e.target.value })}
                                    >
                                        <option value="Net 30">Net 30</option>
                                        <option value="Net 15">Net 15</option>
                                        <option value="Net 60">Net 60</option>
                                        <option value="Due on Receipt">Due on Receipt</option>
                                    </select>
                                </div>
                            </div>
                            {purchaseData.quantity > 0 && purchaseData.unitPrice > 0 && (
                                <div className="p-3 rounded-lg" style={{ backgroundColor: `${COLORS.PERSIAN_GREEN}20` }}>
                                    <p className="text-sm font-bold" style={{ color: COLORS.CITRON }}>
                                        Total Cost: Rs.{(purchaseData.quantity * purchaseData.unitPrice).toLocaleString()}
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end gap-2 p-4 border-t" style={{ borderColor: `${COLORS.PERSIAN_GREEN}20` }}>
                            <button onClick={() => setShowPurchaseModal(false)} className="px-4 py-2 hover:opacity-80 text-sm font-bold" style={{ color: COLORS.TIFFANY_BLUE }}>Cancel</button>
                            <button onClick={handlePurchaseMore} className="text-white px-4 py-2 rounded font-bold text-sm hover:opacity-90 flex items-center gap-2" style={{ backgroundColor: '#22c55e' }}>
                                <Plus className="w-4 h-4" /> Record Purchase
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* JSON Import Modal for Inventory */}
            {showJsonModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                        {/* Header */}
                        <div className="flex justify-between items-center p-6 border-b border-slate-200">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">Import Inventory Items from JSON</h3>
                                <p className="text-sm text-slate-500 mt-1">Paste JSON array or object to bulk import inventory items</p>
                            </div>
                            <button onClick={() => { setShowJsonModal(false); setJsonError(''); setJsonInput(''); }} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {/* Sample Format */}
                            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2"><Info className="w-4 h-4" /> JSON Format Example (Complete with All Fields)</h4>
                                <pre className="bg-white p-3 rounded text-xs overflow-x-auto border border-blue-100 text-slate-600 max-h-48">{`[
  {
    "name": "Cotton Swabs",
    "category": "Consumable",
    "unit": "box",
    "itemType": "solid",
    "quantity": 50,
    "minLevel": 10,
    "purchasePrice": 250,
    "vendorName": "MediCare Supplies",
    "vendorPhone": "03001234567",
    "batchNumber": "B001",
    "sku": "CS-001",
    "description": "Sterile cotton swabs for lab use"
  },
  {
    "name": "Ethanol 70%",
    "category": "Test Reagent",
    "unit": "ml",
    "itemType": "liquid",
    "quantity": 1000,
    "minLevel": 200,
    "purchasePrice": 15,
    "vendorName": "Chemistry Hub",
    "reorderLevel": 500
  }
]`}</pre>
                            </div>

                            {/* Field Guide */}
                            <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
                                <h4 className="font-bold text-green-900 mb-3 flex items-center gap-2"><Check className="w-4 h-4" /> Field Guide</h4>
                                <div className="grid grid-cols-2 gap-3 text-xs text-green-800">
                                    <div>
                                        <p className="font-bold">Required:</p>
                                        <ul className="list-disc list-inside mt-1 space-y-1">
                                            <li><code className="bg-white px-1">name</code> - Item name</li>
                                            <li><code className="bg-white px-1">category</code> - Category</li>
                                            <li><code className="bg-white px-1">unit</code> - Unit (pcs, box, ml, etc)</li>
                                        </ul>
                                    </div>
                                    <div>
                                        <p className="font-bold">Optional but Important:</p>
                                        <ul className="list-disc list-inside mt-1 space-y-1">
                                            <li><code className="bg-white px-1">quantity</code> - Current stock</li>
                                            <li><code className="bg-white px-1">minLevel</code> - Min level</li>
                                            <li><code className="bg-white px-1">purchasePrice</code> - Price</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            {/* JSON Input */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-bold text-slate-700">Paste Your JSON</label>
                                    <button
                                        type="button"
                                        onClick={() => setJsonInput(`[
  {
    "name": "Cotton Swabs",
    "category": "Consumable",
    "unit": "box",
    "itemType": "solid",
    "quantity": 50,
    "minLevel": 10,
    "purchasePrice": 250,
    "vendorName": "MediCare Supplies",
    "batchNumber": "B001"
  }
]`)}
                                        className="text-xs text-indigo-600 hover:text-indigo-700 font-bold"
                                    >
                                        Load Sample
                                    </button>
                                </div>
                                <textarea
                                    value={jsonInput}
                                    onChange={(e) => {
                                        setJsonInput(e.target.value);
                                        setJsonError('');
                                    }}
                                    placeholder="Paste JSON array or single object here..."
                                    className="w-full h-48 p-3 border-2 border-slate-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 resize-none font-mono text-sm"
                                />
                            </div>

                            {/* Error Message */}
                            {jsonError && (
                                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
                                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-bold text-red-900">Error</p>
                                        <p className="text-sm text-red-700">{jsonError}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex gap-3 p-6 border-t border-slate-200 bg-slate-50">
                            <button
                                onClick={() => { setShowJsonModal(false); setJsonError(''); setJsonInput(''); }}
                                className="px-4 py-2 text-slate-600 hover:text-slate-800 font-bold"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleImportFromJson}
                                disabled={!jsonInput.trim()}
                                className={`px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-all ${
                                    jsonInput.trim()
                                        ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm hover:shadow-md'
                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                }`}
                            >
                                <Upload className="w-4 h-4" /> Import Items
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Discard Batch Selection Modal */}
            {showDiscardModal && discardingItem && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 animate-in fade-in" onClick={() => setShowDiscardModal(false)}>
                    <div className="rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b bg-red-50">
                            <h3 className="text-lg font-bold text-red-800 flex items-center gap-2">
                                <Trash2 className="w-5 h-5" /> Discard Batches: {discardingItem.name}
                            </h3>
                            <p className="text-sm text-red-600 mt-1">Select the batches you want to discard. Expired batches are pre-selected.</p>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* Batch List */}
                            <div className="space-y-2">
                                <p className="text-sm font-bold text-slate-700 mb-3">Available Batches ({itemBatches.length})</p>
                                {itemBatches.map(batch => {
                                    const isSelected = selectedBatches.includes(batch.id);
                                    const expiryStr = batch.expiryDate ? batch.expiryDate.toLocaleDateString() : 'No expiry';

                                    return (
                                        <div
                                            key={batch.id}
                                            onClick={() => {
                                                if (isSelected) {
                                                    setSelectedBatches(prev => prev.filter(id => id !== batch.id));
                                                } else {
                                                    setSelectedBatches(prev => [...prev, batch.id]);
                                                }
                                            }}
                                            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${isSelected
                                                ? 'border-red-500 bg-red-50'
                                                : 'border-slate-200 bg-white hover:border-slate-300'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => { }}
                                                        className="w-5 h-5 rounded border-slate-300 text-red-600 focus:ring-red-500"
                                                    />
                                                    <div>
                                                        <p className="font-bold text-slate-800">
                                                            Batch: {batch.batchNumber}
                                                            {batch.isExpired && (
                                                                <span className="ml-2 px-2 py-0.5 text-xs rounded bg-red-600 text-white">EXPIRED</span>
                                                            )}
                                                        </p>
                                                        <p className="text-sm text-slate-500">
                                                            Vendor: {batch.vendorName || 'N/A'} | Unit Price: Rs.{batch.unitPrice || 0}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-lg text-slate-800">{batch.remainingQty} <span className="text-sm font-normal">{discardingItem.unit}</span></p>
                                                    <p className={`text-sm ${batch.isExpired ? 'text-red-600 font-bold' : 'text-slate-500'}`}>
                                                        Expiry: {expiryStr}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Reason Input */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Reason for Discarding *</label>
                                <textarea
                                    value={discardReason}
                                    onChange={e => setDiscardReason(e.target.value)}
                                    className="w-full p-3 rounded-lg border border-slate-300 text-sm"
                                    rows={2}
                                    placeholder="Enter reason for discarding these batches..."
                                />
                            </div>

                            {/* Summary */}
                            {selectedBatches.length > 0 && (
                                <div className="p-4 rounded-lg bg-red-100 border border-red-300">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-bold text-red-800">Selected: {selectedBatches.length} batch(es)</p>
                                            <p className="text-sm text-red-600">
                                                Total Qty: {itemBatches.filter(b => selectedBatches.includes(b.id)).reduce((sum, b) => sum + (b.remainingQty || 0), 0)} {discardingItem.unit}
                                            </p>
                                        </div>
                                        <p className="text-2xl font-bold text-red-700">
                                            Rs.{itemBatches.filter(b => selectedBatches.includes(b.id)).reduce((sum, b) => sum + ((b.unitPrice || discardingItem.purchasePrice || 0) * (b.remainingQty || 0)), 0).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex justify-between items-center p-4 border-t">
                            <button
                                onClick={() => {
                                    setShowDiscardModal(false);
                                    setDiscardingItem(null);
                                    setItemBatches([]);
                                    setSelectedBatches([]);
                                }}
                                className="px-4 py-2 text-slate-600 hover:text-slate-800 font-bold"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={processDiscardBatches}
                                disabled={selectedBatches.length === 0 || !discardReason.trim()}
                                className={`px-6 py-2 rounded-lg font-bold flex items-center gap-2 ${selectedBatches.length === 0 || !discardReason.trim()
                                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                    : 'bg-red-600 text-white hover:bg-red-700'
                                    }`}
                            >
                                <Trash2 className="w-4 h-4" /> Discard {selectedBatches.length} Batch(es)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="rounded-xl border shadow-sm flex-1 overflow-hidden flex flex-col" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, borderColor: `${COLORS.PERSIAN_GREEN}40` }}>
                <div className="overflow-y-auto flex-1 custom-scrollbar">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead className="border-b sticky top-0 z-10" style={{ backgroundColor: '#F8FAFC', borderColor: `${COLORS.PERSIAN_GREEN}40` }}>
                            <tr>
                                <th className="p-4" style={{ color: COLORS.TIFFANY_BLUE }}>Item & Ledger Info</th>
                                <th className="p-4" style={{ color: COLORS.TIFFANY_BLUE }}>Category</th>
                                <th className="p-4" style={{ color: COLORS.TIFFANY_BLUE }}>Total Stock</th>
                                <th className="p-4" style={{ color: COLORS.TIFFANY_BLUE }}>Value (On Hand)</th>
                                <th className="p-4" style={{ color: COLORS.TIFFANY_BLUE }}>Status</th>
                                <th className="p-4 text-right" style={{ color: COLORS.TIFFANY_BLUE }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y" style={{ divideColor: `${COLORS.PERSIAN_GREEN}20` }}>
                            {items.map(i => {
                                const isExpired = i.expiryDate && (i.expiryDate.toDate ? i.expiryDate.toDate() : new Date(i.expiryDate)) < new Date();
                                const isExpanded = expandedItemId === i.id;
                                return (
                                    <React.Fragment key={i.id}>
                                        <tr
                                            className={`hover:bg-slate-50 transition-colors cursor-pointer ${isExpanded ? 'bg-indigo-50/30' : ''}`}
                                            onClick={() => setExpandedItemId(isExpanded ? null : i.id)}
                                        >
                                            <td className="p-4 font-bold" style={{ color: COLORS.CITRON }}>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-xs px-1.5 py-0.5 rounded ${i.itemType === 'liquid' ? 'bg-blue-100/40' : 'bg-green-100/40'}`}>
                                                        {i.itemType === 'liquid' ? '💧' : '📦'}
                                                    </span>
                                                    {i.name}
                                                </div>
                                                <div className="text-xs font-normal" style={{ color: COLORS.TIFFANY_BLUE }}>{i.vendorName || 'No vendor'}</div>
                                            </td>
                                            <td className="p-4" style={{ color: COLORS.TIFFANY_BLUE }}>{i.category}</td>
                                            <td className="p-4 font-mono font-bold" style={{ color: COLORS.CITRON }}>{i.quantity} <span className="text-xs font-normal" style={{ color: COLORS.TIFFANY_BLUE }}>{i.unit}</span></td>
                                            <td className="p-4 font-mono" style={{ color: COLORS.CITRON }}>Rs.{((i.purchasePrice || 0) * i.quantity).toLocaleString()}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${isExpired ? 'bg-red-100 text-red-600' : i.quantity === 0 ? 'bg-slate-100 text-slate-400' : i.quantity < i.minLevel ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
                                                    {isExpired ? 'Expired' : i.quantity === 0 ? 'Out' : i.quantity < i.minLevel ? 'Low' : 'OK'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                                                    <button onClick={() => setShowCreatePOModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors">
                                                        <Plus className="w-3.5 h-3.5" /> Purchase
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleRemoveItem(i); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors">
                                                        <Trash2 className="w-3.5 h-3.5" /> Remove
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr className="bg-slate-50/80">
                                                <td colSpan={6} className="p-4 border-l-4 border-indigo-500">
                                                    <div className="space-y-3">
                                                        <h4 className="text-[10px] font-bold text-slate-500 uppercase">Batch Ledger (FIFO)</h4>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                            {(!i.fifoQueue || i.fifoQueue.length === 0) ? (
                                                                <div className="col-span-full py-2 text-center text-slate-400 italic text-xs">No individual batch records.</div>
                                                            ) : (
                                                                (i.fifoQueue as any[]).map((batch, idx) => {
                                                                    const bExp = batch.expiryDate ? (batch.expiryDate.toDate ? batch.expiryDate.toDate() : new Date(batch.expiryDate)) : null;
                                                                    const bIsExp = bExp && bExp < new Date();
                                                                    return (
                                                                        <div key={idx} className={`p-3 rounded border bg-white shadow-sm flex flex-col gap-1 ${bIsExp ? 'border-red-200' : 'border-slate-200'}`}>
                                                                            <div className="flex justify-between items-start">
                                                                                <p className="text-xs font-bold text-slate-800">Batch #{batch.batchNumber || 'N/A'}</p>
                                                                                <span className={`text-[10px] font-bold ${bIsExp ? 'text-red-600' : 'text-indigo-600'}`}>{batch.quantityRemaining} {i.unit}</span>
                                                                            </div>
                                                                            <p className="text-[10px] text-slate-500">PO: {batch.poNumber || 'N/A'}</p>
                                                                            <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-50">
                                                                                <div className="flex items-center gap-1 text-[10px] text-slate-500"><Calendar className="w-3 h-3" /> {bExp ? bExp.toLocaleDateString() : 'No Exp'}</div>
                                                                                <button onClick={(e) => { e.stopPropagation(); handleDiscardExpired(i); }} className="text-[10px] text-red-600 font-bold hover:underline">Discard</button>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const renderRequests = () => {
        const userRequests = isManager ? requests : requests.filter(r => r.requesterId === (auth.currentUser?.uid || ''));
        const pendingForManager = isManager ? requests.filter(r => r.status === 'pending') : [];

        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800">{isManager ? 'All Requests' : 'My Request History'}</h3>
                    <button
                        onClick={() => setShowRequisitionModal(true)}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-md"
                    >
                        <Plus className="w-4 h-4" /> New Requisition
                    </button>
                </div>

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

    // Render Wastage Tab
    const renderWastage = () => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const currentWeek = Math.ceil((now.getDate()) / 7);

        // Calculate wastage statistics
        const wastageStats = {
            weekly: 0,
            monthly: 0,
            yearly: 0,
            total: 0,
            count: wastages.length
        };

        wastages.forEach(w => {
            const value = w.estimatedValue || 0;
            wastageStats.total += value;

            const reportedDate = w.reportedAt?.toDate ? w.reportedAt.toDate() : new Date(w.reportedAt);
            const wYear = reportedDate.getFullYear();
            const wMonth = reportedDate.getMonth() + 1;
            const wWeek = Math.ceil(reportedDate.getDate() / 7);

            if (wYear === currentYear) {
                wastageStats.yearly += value;
                if (wMonth === currentMonth) {
                    wastageStats.monthly += value;
                    if (wWeek === currentWeek) {
                        wastageStats.weekly += value;
                    }
                }
            }
        });

        return (
            <div className="space-y-6">
                {/* Wastage Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-red-50 p-5 rounded-xl border border-red-200">
                        <p className="text-xs font-bold uppercase text-red-600 mb-1">This Week</p>
                        <p className="text-2xl font-bold text-red-700">Rs.{wastageStats.weekly.toLocaleString()}</p>
                    </div>
                    <div className="bg-orange-50 p-5 rounded-xl border border-orange-200">
                        <p className="text-xs font-bold uppercase text-orange-600 mb-1">This Month</p>
                        <p className="text-2xl font-bold text-orange-700">Rs.{wastageStats.monthly.toLocaleString()}</p>
                    </div>
                    <div className="bg-amber-50 p-5 rounded-xl border border-amber-200">
                        <p className="text-xs font-bold uppercase text-amber-600 mb-1">This Year</p>
                        <p className="text-2xl font-bold text-amber-700">Rs.{wastageStats.yearly.toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-100 p-5 rounded-xl border border-slate-300">
                        <p className="text-xs font-bold uppercase text-slate-600 mb-1">Total Records</p>
                        <p className="text-2xl font-bold text-slate-800">{wastageStats.count}</p>
                    </div>
                </div>

                {/* Wastage Table */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b bg-red-50">
                        <h3 className="font-bold text-red-800 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5" />
                            Wastage & Discarded Items
                        </h3>
                        <p className="text-xs text-red-600 mt-1">Items that have been discarded due to expiry, damage, or other reasons</p>
                    </div>
                    {wastages.length === 0 ? (
                        <div className="p-12 text-center text-slate-400">
                            <Trash2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p className="font-medium">No wastage records yet</p>
                            <p className="text-sm mt-1">Discarded items will appear here</p>
                        </div>
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 border-b">
                                <tr>
                                    <th className="p-4 text-slate-600">Date</th>
                                    <th className="p-4 text-slate-600">Item</th>
                                    <th className="p-4 text-slate-600">Batch</th>
                                    <th className="p-4 text-slate-600">Qty</th>
                                    <th className="p-4 text-slate-600">Value Lost</th>
                                    <th className="p-4 text-slate-600">Type</th>
                                    <th className="p-4 text-slate-600">Reason</th>
                                    <th className="p-4 text-slate-600">Discarded By</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {wastages.map(w => (
                                    <tr key={w.id} className="hover:bg-red-50/30">
                                        <td className="p-4 text-xs text-slate-500">{formatDate(w.reportedAt)}</td>
                                        <td className="p-4">
                                            <span className="font-bold text-slate-800">{w.itemName}</span>
                                            {w.category && <span className="block text-xs text-slate-500">{w.category}</span>}
                                        </td>
                                        <td className="p-4 text-xs font-mono text-slate-600">{w.batchNumber || '-'}</td>
                                        <td className="p-4 font-mono font-bold text-slate-700">{w.quantity} <span className="text-xs font-normal">{w.unit}</span></td>
                                        <td className="p-4 font-bold text-red-600">Rs.{(w.estimatedValue || 0).toLocaleString()}</td>
                                        <td className="p-4">
                                            <span className="px-2 py-1 rounded text-xs font-bold uppercase bg-red-100 text-red-700">
                                                {w.label || w.type || 'Expired'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-xs text-slate-600 max-w-[200px] truncate" title={w.reason}>{w.reason || '-'}</td>
                                        <td className="p-4 text-xs text-slate-500">{w.reportedBy}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Summary Footer */}
                <div className="bg-red-100 p-4 rounded-xl border border-red-300">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-red-800">Total Value Lost to Wastage</p>
                            <p className="text-xs text-red-600">All time recorded wastage</p>
                        </div>
                        <p className="text-3xl font-bold text-red-700">Rs.{wastageStats.total.toLocaleString()}</p>
                    </div>
                </div>
            </div>
        );
    };

    // Render Financials Tab
    const renderFinancials = () => (
        <div className="space-y-6">
            {/* Financial Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Total Purchases</p>
                            <p className="text-2xl font-bold text-gray-900">
                                ${(financialStats.totalPurchases || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                        </div>
                        <DollarSign className="w-10 h-10 text-blue-500" />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Total Paid</p>
                            <p className="text-2xl font-bold text-green-700">
                                ${(financialStats.totalPaid || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                        </div>
                        <CheckCircle2 className="w-10 h-10 text-green-500" />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow border-l-4 border-red-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Total Unpaid</p>
                            <p className="text-2xl font-bold text-red-700">
                                Rs.{(financialStats.totalUnpaid || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                        </div>
                        <AlertCircle className="w-10 h-10 text-red-500" />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow border-l-4 border-purple-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Value Used</p>
                            <p className="text-2xl font-bold text-purple-700">
                                ${(financialStats.totalValueUsed || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                        </div>
                        <TrendingDown className="w-10 h-10 text-purple-500" />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow border-l-4 border-orange-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Value Remaining</p>
                            <p className="text-2xl font-bold text-orange-700">
                                ${(financialStats.totalValueRemaining || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                        </div>
                        <Package className="w-10 h-10 text-orange-500" />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow border-l-4 border-cyan-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Usage Rate</p>
                            <p className="text-2xl font-bold text-cyan-700">
                                {(financialStats.usageRate || 0).toFixed(1)}%
                            </p>
                        </div>
                        <PieChart className="w-10 h-10 text-cyan-500" />
                    </div>
                </div>
            </div>

            {/* Purchase Orders Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-900">Purchase Orders</h3>
                    <button
                        onClick={() => setShowCreatePOModal(true)}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-md"
                    >
                        <Plus className="w-4 h-4" /> Create Purchase Order
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO Number</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usage</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {purchaseOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                                        No Purchase Orders found
                                    </td>
                                </tr>
                            ) : (
                                purchaseOrders.map(po => {
                                    const orderDateStr = po.orderDate?.toDate
                                        ? po.orderDate.toDate().toLocaleDateString()
                                        : '--';

                                    return (
                                        <tr key={po.id} className="hover:bg-gray-50 cursor-pointer"
                                            onClick={() => {
                                                setSelectedPO(po);
                                                setShowPOModal(true);
                                            }}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {po.poNumber}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {orderDateStr}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {po.supplierName}
                                            </td>
                                            <td className="px-6 py-4 text-xs text-gray-600 max-w-[200px]">
                                                <div className="truncate" title={po.items.map(i => i.itemName).join(', ')}>
                                                    {po.items.map(i => i.itemName).join(', ')}
                                                </div>
                                                <span className="text-[10px] text-gray-400">{po.items.length} unique items</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                <div>${po.totalAmount.toFixed(2)}</div>
                                                <div className="text-xs text-gray-500">
                                                    Tax: ${po.taxAmount.toFixed(2)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap align-middle">
                                                <div className="flex flex-col gap-1 w-32">
                                                    <div className="flex justify-between text-xs text-gray-500">
                                                        <span>{Math.round(po.usagePercentage)}%</span>
                                                    </div>
                                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                                        <div
                                                            className="bg-purple-600 h-2 rounded-full"
                                                            style={{ width: `${Math.min(100, po.usagePercentage)}%` }}
                                                        ></div>
                                                    </div>
                                                    <div className="text-[10px] text-gray-500 truncate">
                                                        Rem: ${po.totalValueRemaining.toFixed(0)}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {po.paymentStatus === 'paid' ? (
                                                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 border border-green-200">
                                                        Paid
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 border border-red-200">
                                                        Unpaid
                                                    </span>
                                                )}
                                                <div className="text-xs text-gray-500 mt-1">
                                                    Due: {po.paymentDueDate?.toDate?.().toLocaleDateString() || '--'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                                    {po.paymentStatus === 'unpaid' && (
                                                        <button
                                                            onClick={async () => {
                                                                if (await showConfirm('Mark as Paid', `Mark PO ${po.poNumber} as Paid?`, { confirmText: 'Yes, Mark Paid', type: 'primary' })) {
                                                                    await markPOAsPaid(po.id, auth.currentUser?.email || 'System');
                                                                    showToast('success', 'Marked as Paid');
                                                                }
                                                            }}
                                                            className="text-green-600 hover:text-green-800 p-1 hover:bg-green-50 rounded"
                                                            title="Mark as Paid"
                                                        >
                                                            <CheckCircle2 className="w-5 h-5" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => {
                                                            setSelectedPO(po);
                                                            setShowPOModal(true);
                                                        }}
                                                        className="text-blue-600 hover:text-blue-800 p-1 hover:bg-blue-50 rounded"
                                                        title="View Details / Edit"
                                                    >
                                                        <Edit2 className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            const remarks = await showPrompt('Cancel Purchase Order', {
                                                                title: 'Cancel Order',
                                                                placeholder: 'Reason for cancellation...',
                                                                defaultValue: ''
                                                            });
                                                            if (remarks) {
                                                                await closePurchaseOrder(po.id, remarks, auth.currentUser?.email || 'Admin');
                                                                showToast('success', 'PO Cancelled');
                                                            }
                                                        }}
                                                        className="text-red-600 hover:text-red-800 p-1 hover:bg-red-50 rounded"
                                                        title="Cancel Order"
                                                    >
                                                        <XCircle className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedReturnPO(po);
                                                            setShowReturnModal(true);
                                                        }}
                                                        className="text-orange-600 hover:text-orange-800 p-1 hover:bg-orange-50 rounded"
                                                        title="Return Items"
                                                    >
                                                        <RotateCcw className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            generatePurchaseOrderPDF(po);
                                                        }}
                                                        className="text-gray-600 hover:text-gray-800 p-1 hover:bg-gray-50 rounded"
                                                        title="Download PDF"
                                                    >
                                                        <Printer className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const renderReceiving = () => {
        // Only include POs that actually require receiving/inspection.
        // Exclude 'active' which represents a PO already received/activated.
        const pendingPOs = purchaseOrders.filter(po => po.status === 'paid_awaiting_delivery' || po.status === 'partially_received' || po.status === 'pending_payment');

        return (
            <div className="space-y-6">
                <div className="bg-white p-6 rounded-xl border border-blue-200 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-slate-800">Shipments Awaiting QC & Receiving</h3>
                    </div>
                    {pendingPOs.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p>No shipments currently awaiting receipt.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {pendingPOs.map(po => (
                                <div key={po.id} className="border border-slate-200 rounded-xl p-4 hover:border-indigo-300 transition-colors bg-slate-50/50">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <p className="font-bold text-slate-900">{po.poNumber}</p>
                                            <p className="text-xs text-slate-500">{po.supplierName}</p>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${po.status === 'partially_received' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {po.status === 'partially_received' ? 'Partial' : 'Awaiting'}
                                        </span>
                                    </div>
                                    <div className="space-y-2 mb-4">
                                        {po.items.map((item, idx) => (
                                            <div key={idx} className="flex justify-between text-xs text-slate-600">
                                                <span>{item.itemName}</span>
                                                <span className="font-mono">{item.quantityReceived || 0}/{item.quantity}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => {
                                            setSelectedReceivePO(po);
                                            setShowReceiveModal(true);
                                        }}
                                        className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <CheckCircle2 className="w-4 h-4" /> Start Inspection
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };



    const handleReceiveItems = async (receipts: any[]) => {
        if (!selectedReceivePO) return;
        try {
            await receivePurchaseOrderItems(selectedReceivePO.id, receipts, auth.currentUser?.email || 'Inventory Manager');
            showToast('success', 'Items received and inventory updated successfully');
            setShowReceiveModal(false);
            setSelectedReceivePO(null);
        } catch (error) {
            console.error(error);
            showAlert('error', 'Failed to receive items: ' + (error instanceof Error ? error.message : String(error)), 'Receipt Error');
        }
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
            console.log('[INVENTORY] handleModuleBack triggered - resetting to dashboard from', subView, new Error().stack);
            setSubView('dashboard');
        } else if (onBack) {
            onBack();
        }
    };

    return (
        <div className="p-6 h-full flex flex-col">
            <ReceiveItemsModal
                isOpen={showReceiveModal}
                onClose={() => { setShowReceiveModal(false); setSelectedReceivePO(null); }}
                poItems={selectedReceivePO?.items || []}
                onConfirm={handleReceiveItems}
            />
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                    {onBack && <button onClick={handleModuleBack} className="p-2 rounded-full hover:bg-slate-200 transition-colors"><ArrowLeft className="w-6 h-6 text-slate-800" /></button>}
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Package className="w-6 h-6 text-indigo-600" /> Inventory Management</h2>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    {[
                        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
                        { id: 'ledger', label: 'Stock Ledger', icon: Package },
                        { id: 'procurement', label: 'Procurement', icon: DollarSign },
                        { id: 'receiving', label: 'Receiving/QC', icon: Truck },
                        { id: 'requisitions', label: 'Requisitions', icon: ClipboardCheck },
                        { id: 'wastage', label: 'Wastage', icon: AlertCircle }
                    ].map(tab => (
                        <button key={tab.id} onClick={() => { console.log('[INVENTORY] Tab clicked:', tab.id); setSubView(tab.id as any); }} className={`px-3 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${subView === tab.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}><tab.icon className="w-4 h-4" /> <span>{tab.label}</span></button>
                    ))}
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
                {subView === 'dashboard' && renderDashboard()}
                {subView === 'ledger' && renderItemsList()}
                {subView === 'procurement' && renderFinancials()}
                {subView === 'receiving' && renderReceiving()}
                {subView === 'requisitions' && renderRequests()}
                {subView === 'wastage' && renderWastage()}
            </div>

            <PurchaseOrderModal
                isOpen={showPOModal}
                purchaseOrder={selectedPO}
                onClose={() => setShowPOModal(false)}
                onMarkPaid={async (id) => {
                    await markPOAsPaid(id, auth.currentUser?.email || 'System');
                }}
                onPrint={() => window.print()}
                onDownloadPDF={() => {
                    if (selectedPO) generatePurchaseOrderPDF(selectedPO);
                }}
                onReceive={async (id, receipts) => {
                    if (receipts && receipts.length > 0) {
                        await receivePurchaseOrderItems(id, receipts, auth.currentUser?.email || 'Admin');
                    } else {
                        await receivePurchaseOrder(id, auth.currentUser?.email || 'Admin');
                    }
                    showToast('success', 'Stock Received & Inventory Updated');
                    setShowPOModal(false);
                }}
                onCancel={async (id, remarks) => {
                    await closePurchaseOrder(id, remarks, auth.currentUser?.email || 'Admin');
                    showToast('success', 'Purchase Order closed.');
                    setShowPOModal(false);
                }}
                showPrompt={showPrompt}
            />

            <CreatePOModal
                isOpen={showCreatePOModal}
                onClose={() => setShowCreatePOModal(false)}
                inventoryItems={items}
                currentUser={auth.currentUser?.email || 'System'}
                onSuccess={() => {
                    console.log('[INVENTORY] CreatePOModal onSuccess - navigating to procurement');
                    showToast('success', 'New Purchase Order created (Pending Payment)');
                    setSubView('procurement');
                }}
                showPrompt={showPrompt}
                showAlert={showAlert}
            />

            <RequisitionModal
                isOpen={showRequisitionModal}
                onClose={() => setShowRequisitionModal(false)}
                inventoryItems={items}
                currentUser={{
                    name: auth.currentUser?.email?.split('@')[0] || 'Technician',
                    email: auth.currentUser?.email || '',
                    department: role || 'Staff'
                }}
                onSuccess={() => {
                    console.log('[INVENTORY] RequisitionModal onSuccess - navigating to requisitions');
                    showToast('success', 'Requisition submitted for approval');
                    setSubView('requisitions');
                }}
            />

            <POReturnModal
                isOpen={showReturnModal}
                purchaseOrder={selectedReturnPO}
                currentUser={auth.currentUser?.email || 'System'}
                onClose={() => setShowReturnModal(false)}
                onSuccess={() => {
                    console.log('[INVENTORY] POReturnModal onSuccess - navigating to procurement');
                    showToast('success', 'Items returned and stock adjusted successfully');
                    setSubView('procurement');
                }}
            />
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

    // JSON Paste Modal State
    const [showJsonModal, setShowJsonModal] = useState(false);
    const [jsonInput, setJsonInput] = useState('');
    const [jsonError, setJsonError] = useState('');

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
                    { id: "wbc", name: "White Blood Cells (WBC)", unit: "10Â³/Î¼L", type: "numeric", refRanges: [{ type: "general", min: 4.0, max: 11.0, criticalMin: 2.0, criticalMax: 30.0 }] },
                    { id: "rbc", name: "Red Blood Cells (RBC)", unit: "10â¶/Î¼L", type: "numeric", refRanges: [{ type: "gender", gender: "male", min: 4.5, max: 5.9 }, { type: "gender", gender: "female", min: 4.1, max: 5.1 }] },
                    { id: "hgb", name: "Hemoglobin", unit: "g/dL", type: "numeric", refRanges: [{ type: "gender", gender: "male", min: 13.5, max: 17.5 }, { type: "gender", gender: "female", min: 12.0, max: 15.5 }] },
                    { id: "plt", name: "Platelets", unit: "10Â³/Î¼L", type: "numeric", refRanges: [{ type: "general", min: 150, max: 400 }] }
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
                    { id: "tsh", name: "TSH", unit: "Î¼IU/mL", type: "numeric", refRanges: [{ type: "general", min: 0.4, max: 4.0 }] }
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

    const handleImportFromJson = async () => {
        if (!jsonInput.trim()) {
            setJsonError('Please paste JSON data');
            return;
        }

        try {
            setJsonError('');
            let parsedData = JSON.parse(jsonInput);

            // Support both single test object and array of tests
            const testsToImport: any[] = Array.isArray(parsedData) ? parsedData : [parsedData];

            console.log('🔍 JSON PARSED:');
            console.log('  - Is Array:', Array.isArray(parsedData));
            console.log('  - Tests Count:', testsToImport.length);
            console.log('  - First test name:', testsToImport[0]?.name);
            if (testsToImport.length > 1) {
                console.log('  - Last test name:', testsToImport[testsToImport.length - 1]?.name);
            }

            if (testsToImport.length === 0) {
                setJsonError('No tests found in JSON');
                return;
            }

            // Validate each test has required fields
            for (const test of testsToImport) {
                if (!test.name || !test.code || test.price === undefined) {
                    setJsonError('Each test must have: name, code, and price');
                    return;
                }
            }

            // Confirm before importing
            const confirmed = await showConfirm(
                'Import Tests from JSON',
                `This will add ${testsToImport.length} test(s) to your database. Continue?`
            );
            if (!confirmed) return;

            showToast('info', `Importing ${testsToImport.length} tests... Please wait`);

            // Firestore batch limit is 500 operations, so split into chunks if needed
            const BATCH_SIZE = 450; // Leave some buffer
            let totalAdded = 0;
            const batches = [];

            for (let i = 0; i < testsToImport.length; i += BATCH_SIZE) {
                const chunk = testsToImport.slice(i, i + BATCH_SIZE);
                const batch = db.batch();
                let chunkCount = 0;

                for (const test of chunk) {
                    try {
                        // Transform parameters from user schema to system schema
                        let transformedParams: any[] = [];
                        
                        console.log(`Processing test ${totalAdded + chunkCount + 1}/${testsToImport.length}: ${test.name}, parameters count:`, test.parameters?.length || 0);
                        
                        if (test.parameters && Array.isArray(test.parameters) && test.parameters.length > 0) {
                            transformedParams = test.parameters.map((param: any, index: number) => {
                                try {
                                    const id = param.id || Math.random().toString(36).substr(2, 9);
                                    const paramName = param.parameterName || param.name || '';
                                    const unit = param.unit || '';
                                    
                                    if (!paramName) {
                                        console.warn(`Test: ${test.name} - Parameter ${index} has no name, skipping`);
                                        return null;
                                    }
                                    
                                    // Parse reference range(s) - handle multiple formats
                                    let refRanges: any[] = [];
                                    
                                    // Format 1: referenceRange as string
                                    if (param.referenceRange && typeof param.referenceRange === 'string') {
                                        refRanges.push({
                                            type: 'general',
                                            textVal: param.referenceRange
                                        });
                                    }
                                    
                                    // Format 2: refRanges as array (already in system format)
                                    if (param.refRanges && Array.isArray(param.refRanges) && param.refRanges.length > 0) {
                                        refRanges = param.refRanges;
                                    }
                                    
                                    // Format 3: minValue and maxValue
                                    if (param.minValue !== undefined && param.maxValue !== undefined) {
                                        refRanges.push({
                                            type: 'general',
                                            textVal: `${param.minValue}-${param.maxValue}`
                                        });
                                    }
                                    
                                    // Ensure we always have refRanges
                                    if (refRanges.length === 0) {
                                        refRanges = [{ type: 'general', textVal: '' }];
                                    }
                                    
                                    const transformed = {
                                        id,
                                        name: paramName,
                                        unit: unit || '',
                                        type: param.type || 'numeric',
                                        refRanges: refRanges,
                                        isMandatory: param.isMandatory !== false,
                                        ...(param.criticalMin !== undefined && { criticalMin: parseFloat(param.criticalMin) }),
                                        ...(param.criticalMax !== undefined && { criticalMax: parseFloat(param.criticalMax) })
                                    };
                                    
                                    return transformed;
                                } catch (e) {
                                    console.error(`Error transforming parameter ${index}:`, e);
                                    return null;
                                }
                            }).filter((p: any) => p !== null);
                            
                            console.log(`✓ Test ${totalAdded + chunkCount + 1}: Transformed ${transformedParams.length}/${test.parameters.length} parameters for: ${test.name}`);
                        } else {
                            console.log(`ℹ Test ${totalAdded + chunkCount + 1}: No parameters for: ${test.name}`);
                        }

                        const testRef = db.collection('tests').doc();
                        const testData: any = {
                            name: (test.name || '').trim(),
                            code: (test.code || '').toString().toUpperCase(),
                            price: parseFloat(test.price) || 0,
                            category: test.category || 'General',
                            sampleType: test.sampleType || 'Blood',
                            isActive: test.isActive !== false,
                            applyTat: test.applyTat !== false,
                            discountAllowed: test.discountAllowed !== false,
                            createdAt: firebase.firestore.Timestamp.now()
                        };

                        // Add optional fields if provided
                        if (test.labCost) testData.labCost = parseFloat(test.labCost);
                        if (test.turnaroundTime) testData.turnaroundTime = test.turnaroundTime;
                        if (test.tatHours) testData.tatHours = parseFloat(test.tatHours);
                        if (test.urgentTatHours) testData.urgentTatHours = parseFloat(test.urgentTatHours);
                        if (test.gracePeriod !== undefined) testData.gracePeriod = parseFloat(test.gracePeriod);
                        if (test.description) testData.description = test.description;
                        if (test.urgentPrice) testData.urgentPrice = parseFloat(test.urgentPrice);
                        if (test.homeCollectionPrice) testData.homeCollectionPrice = parseFloat(test.homeCollectionPrice);
                        if (test.inventoryRequirements) testData.inventoryRequirements = test.inventoryRequirements;
                        if (test.aiTemplate) testData.aiTemplate = test.aiTemplate;
                        
                        // Always include parameters array (even if empty)
                        testData.parameters = transformedParams;

                        batch.set(testRef, testData);
                        chunkCount++;
                    } catch (e) {
                        console.error(`Error processing test "${test.name}":`, e);
                        setJsonError(`Error processing test "${test.name}": ${e instanceof Error ? e.message : String(e)}`);
                        return;
                    }
                }

                console.log(`📝 Batch ${batches.length + 1}: Prepared ${chunkCount} tests for commit`);
                batches.push({ batch, count: chunkCount });
                totalAdded += chunkCount;
            }

            // Commit all batches sequentially to ensure no overwrites
            let commitCount = 0;
            for (let i = 0; i < batches.length; i++) {
                const { batch, count } = batches[i];
                await batch.commit();
                commitCount += count;
                console.log(`✅ Batch ${i + 1} committed: ${count} tests (Total: ${commitCount}/${testsToImport.length})`);
            }

            showToast('success', `✅ Successfully imported ${totalAdded} test(s)!`);
            console.log(`🎉 IMPORT COMPLETE: ${totalAdded} tests imported successfully`);
            setJsonInput('');
            setShowJsonModal(false);
        } catch (error: any) {
            console.error('Error parsing JSON:', error);
            if (error instanceof SyntaxError) {
                setJsonError('Invalid JSON format: ' + error.message);
            } else {
                setJsonError(error?.message || 'Failed to import tests');
            }
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
                        <div className="relative"><span className="absolute left-3 top-2.5 text-slate-400 font-bold">Rs.</span><input type="number" className="w-full pl-8 p-2.5 border border-slate-200 rounded-lg font-bold text-slate-800" value={formData.price || ''} onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) })} /></div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Urgent Fee (Optional)</label>
                        <div className="relative"><span className="absolute left-3 top-2.5 text-slate-400 font-bold">Rs.</span><input type="number" className="w-full pl-8 p-2.5 border border-slate-200 rounded-lg" value={formData.urgentPrice || ''} onChange={e => setFormData({ ...formData, urgentPrice: parseFloat(e.target.value) })} placeholder="0.00" /></div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Home Collection Fee (Optional)</label>
                        <div className="relative"><span className="absolute left-3 top-2.5 text-slate-400 font-bold">Rs.</span><input type="number" className="w-full pl-8 p-2.5 border border-slate-200 rounded-lg" value={formData.homeCollectionPrice || ''} onChange={e => setFormData({ ...formData, homeCollectionPrice: parseFloat(e.target.value) })} placeholder="0.00" /></div>
                    </div>
                </div>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 col-span-2 md:col-span-1">
                <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Wallet className="w-4 h-4" /> Cost Analysis</h4>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Lab Cost (Internal)</label>
                        <div className="relative"><span className="absolute left-3 top-2.5 text-slate-400 font-bold">Rs.</span><input type="number" className="w-full pl-8 p-2.5 border border-slate-200 rounded-lg" value={formData.labCost || ''} onChange={e => setFormData({ ...formData, labCost: parseFloat(e.target.value) })} placeholder="0.00" /></div>
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
                inventoryRequirements: [...(formData.inventoryRequirements || []), { itemId: '', itemName: '', quantity: 1, unit: 'pcs', itemType: 'solid' as const }]
            });
        };

        const updateRequirement = (index: number, field: string, value: any) => {
            const reqs = [...(formData.inventoryRequirements || [])];
            reqs[index] = { ...reqs[index], [field]: value };

            // If item changed, update name, unit, and itemType
            if (field === 'itemId') {
                const item = inventoryItems.find(i => i.id === value);
                if (item) {
                    reqs[index].itemName = item.name;
                    reqs[index].unit = item.unit || 'pcs';
                    reqs[index].itemType = item.itemType || 'solid';
                }
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
                                            <option key={item.id} value={item.id}>
                                                {item.name} ({item.unit}) {item.itemType === 'liquid' ? '💧' : '📦'}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="w-36">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                        {selectedItem?.itemType === 'liquid' ? 'Volume (ml)' : 'Quantity'}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step={selectedItem?.itemType === 'liquid' ? '0.1' : '1'}
                                            min="0"
                                            className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-bold pr-12"
                                            value={req.quantity}
                                            onChange={e => updateRequirement(idx, 'quantity', parseFloat(e.target.value))}
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">
                                            {req.unit || selectedItem?.unit || 'pcs'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex-1">
                                    {selectedItem && (
                                        <div className="p-2 bg-slate-50 rounded border border-slate-200">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-xs px-2 py-0.5 rounded font-bold ${selectedItem.itemType === 'liquid'
                                                    ? 'bg-blue-100 text-blue-700'
                                                    : 'bg-green-100 text-green-700'
                                                    }`}>
                                                    {selectedItem.itemType === 'liquid' ? '💧 Liquid' : '📦 Solid'}
                                                </span>
                                            </div>
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
                            <button onClick={() => setShowJsonModal(true)} className="px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow transition-all bg-blue-600 text-white hover:bg-blue-700"><Upload className="w-4 h-4" /> Import from JSON</button>
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
                                        <td className="p-4 font-bold text-slate-800">Rs.{t.price}</td>
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

            {/* JSON Import Modal */}
            {showJsonModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                        {/* Header */}
                        <div className="flex justify-between items-center p-6 border-b border-slate-200">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">Import Tests from JSON</h3>
                                <p className="text-sm text-slate-500 mt-1">Paste JSON array or object to bulk import tests</p>
                            </div>
                            <button onClick={() => { setShowJsonModal(false); setJsonError(''); setJsonInput(''); }} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {/* Sample Format */}
                            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2"><Info className="w-4 h-4" /> JSON Format Example (Complete with Parameters)</h4>
                                <pre className="bg-white p-3 rounded text-xs overflow-x-auto border border-blue-100 text-slate-600 max-h-48">{`[
  {
    "name": "Complete Blood Count",
    "code": "CBC",
    "price": 800,
    "labCost": 400,
    "category": "Hematology",
    "sampleType": "Blood",
    "tatHours": 6,
    "urgentTatHours": 4,
    "description": "Complete blood test with WBC differential",
    "isActive": true,
    "parameters": [
      {
        "name": "RBC",
        "unit": "million/µL",
        "referenceRange": "4.0-5.5",
        "isMandatory": true
      },
      {
        "name": "WBC",
        "unit": "thousand/µL",
        "referenceRange": "4.5-11.0",
        "isMandatory": true
      },
      {
        "name": "Hemoglobin",
        "unit": "g/dL",
        "referenceRange": "12.0-16.0",
        "isMandatory": true
      }
    ]
  }
]`}</pre>
                            </div>

                            {/* Field Guide */}
                            <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
                                <h4 className="font-bold text-green-900 mb-3 flex items-center gap-2"><Check className="w-4 h-4" /> Field Guide</h4>
                                <div className="grid grid-cols-2 gap-3 text-xs text-green-800">
                                    <div>
                                        <p className="font-bold">Required:</p>
                                        <ul className="list-disc list-inside mt-1 space-y-1">
                                            <li><code className="bg-white px-1">name</code> - Test name</li>
                                            <li><code className="bg-white px-1">code</code> - Test code (e.g., CBC)</li>
                                            <li><code className="bg-white px-1">price</code> - Price in Rs</li>
                                        </ul>
                                    </div>
                                    <div>
                                        <p className="font-bold">Optional but Important:</p>
                                        <ul className="list-disc list-inside mt-1 space-y-1">
                                            <li><code className="bg-white px-1">parameters</code> - Test parameters array</li>
                                            <li><code className="bg-white px-1">tatHours</code> - Turnaround time (hours)</li>
                                            <li><code className="bg-white px-1">category</code> - Test category</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            {/* JSON Input */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-bold text-slate-700">Paste Your JSON</label>
                                    <button
                                        type="button"
                                        onClick={() => setJsonInput(`[
  {
    "name": "Complete Blood Count",
    "code": "CBC",
    "price": 800,
    "labCost": 400,
    "category": "Hematology",
    "sampleType": "Blood",
    "tatHours": 6,
    "urgentTatHours": 4,
    "description": "Complete blood test with WBC differential",
    "isActive": true,
    "parameters": [
      {
        "name": "RBC",
        "unit": "million/µL",
        "referenceRange": "4.0-5.5",
        "isMandatory": true
      },
      {
        "name": "WBC",
        "unit": "thousand/µL",
        "referenceRange": "4.5-11.0",
        "isMandatory": true
      },
      {
        "name": "Hemoglobin",
        "unit": "g/dL",
        "referenceRange": "12.0-16.0",
        "isMandatory": true
      }
    ]
  }
]`)}
                                        className="text-xs text-indigo-600 hover:text-indigo-700 font-bold"
                                    >
                                        Load Sample
                                    </button>
                                </div>
                                <textarea
                                    value={jsonInput}
                                    onChange={(e) => {
                                        setJsonInput(e.target.value);
                                        setJsonError('');
                                    }}
                                    placeholder="Paste JSON array or single object here..."
                                    className="w-full h-48 p-3 border-2 border-slate-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 resize-none font-mono text-sm"
                                />
                            </div>

                            {/* Error Message */}
                            {jsonError && (
                                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
                                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-bold text-red-900">Error</p>
                                        <p className="text-sm text-red-700">{jsonError}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex gap-3 p-6 border-t border-slate-200 bg-slate-50">
                            <button
                                onClick={() => { setShowJsonModal(false); setJsonError(''); setJsonInput(''); }}
                                className="px-4 py-2 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleImportFromJson}
                                disabled={!jsonInput.trim()}
                                className="ml-auto px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <Upload className="w-4 h-4" />
                                Import Tests
                            </button>
                        </div>
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
                    ['Total Revenue', `Rs.${metrics.totalRev.toLocaleString()}`],
                    ['Total Tests', metrics.totalTests],
                    ['Total Patients', metrics.fPatients.length],
                    ['Total Expenses', `Rs.${metrics.totalExp.toLocaleString()}`],
                    ['Net Profit', `Rs.${metrics.netProfit.toLocaleString()}`]
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
                    body: salesData.topTests.map(t => [t.label, `Rs.${t.value.toLocaleString()}`]),
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
                    `Rs.${i.purchasePrice || 0}`
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
                                <ReportChart title="Net Profit" type="kpi" data={[{ label: 'Net Earnings', value: 'Rs.' + metrics.netProfit.toLocaleString() }]} color={COLORS.ALLOY_ORANGE} />
                                <ReportChart title="Inventory Worth" type="kpi" data={[{ label: 'Current Assets', value: 'Rs.' + rawData.inventory.reduce((s: number, i: any) => s + (i.quantity * i.purchasePrice || 0), 0).toLocaleString() }]} color={COLORS.PERSIAN_GREEN} />

                                <div className="col-span-1 md:col-span-2 lg:col-span-3">
                                    <ReportChart
                                        title="Revenue Trend"
                                        type="line"
                                        subtitle="Income over selected period"
                                        data={Object.entries(metrics.fOrders.reduce((acc: any, o: any) => {
                                            const d = formatDate(o.createdAt).split(',')[0];
                                            acc[d] = (acc[d] || 0) + (Number(o.totalAmount) || 0);
                                            return acc;
                                        }, {} as Record<string, number>)).map(([k, v]) => ({ label: k, value: v }))}
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
                                                <tr key={o.id} className="border-b last:border-0">
                                                    <td className="py-2 text-xs">{formatDate(o.createdAt)}</td>
                                                    <td className="py-2 font-medium">{o.patientName}</td>
                                                    <td className="py-2 text-xs text-slate-500">{(o.tests?.length || 0)} Tests</td>
                                                    <td className="py-2 text-right font-bold text-emerald-600">${o.totalAmount}</td>
                                                </tr>
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
                                        {invData.inventory.filter((i: any) => i.expiryDate && new Date(i.expiryDate.toDate ? i.expiryDate.toDate() : i.expiryDate).getTime() < new Date().getTime() + 30 * 24 * 3600 * 1000).map((i: any) => {
                                            const d = new Date(i.expiryDate.toDate ? i.expiryDate.toDate() : i.expiryDate);
                                            return (
                                                <div key={i.id} className="flex justify-between items-center text-sm p-3 bg-amber-50 rounded border border-amber-100">
                                                    <span className="font-bold text-slate-700">{i.name}</span>
                                                    <span className="text-amber-700">Expires in {Math.ceil((d.getTime() - new Date().getTime()) / (1000 * 3600 * 24))} days</span>
                                                </div>
                                            );
                                        })}
                                        {invData.inventory.filter((i: any) => i.expiryDate && new Date(i.expiryDate.toDate ? i.expiryDate.toDate() : i.expiryDate).getTime() < new Date().getTime() + 30 * 24 * 3600 * 1000).length === 0 && (
                                            <p className="text-sm text-slate-400 p-4 text-center">No immediate expiry risks found.</p>
                                        )}
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
                        <p className="text-xs text-slate-400">Generated by LabPro Analytics Engine • Confidential Report</p>
                    </div>
                </div>

                {/* Print Footer */}
                <div className="print-footer print-only flex justify-between">
                    <span>Generated by LabPro Analytics Engine</span>
                    <span>Confidential Report • {new Date().toLocaleDateString()}</span>
                </div>
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
    const [view, setView] = useState<'general' | 'designer'>('general');
    const [settings, setSettings] = useState({
        name: 'LabPro Diagnostics', address: '123 Medical Plaza, NY', phone: '+1 (555) 123-4567', email: 'reports@labpro.com',
        pathologistName: 'Dr. Alice Pathologist', pathologistQual: 'MD, Pathology (Reg: 12345)',
        pathologistDesig: 'Chief Pathologist', pathologistSig: 'Dr. A. Pathologist'
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        db.collection('settings').doc('lab_info').get().then(doc => {
            if (doc.exists) setSettings(prev => ({ ...prev, ...doc.data() }));
        });
    }, []);

    const handleSave = async () => {
        setLoading(true);
        try {
            await db.collection('settings').doc('lab_info').set(settings, { merge: true });
            alert("Settings saved successfully!");
        } catch (e) { console.error(e); alert("Failed to save settings."); }
        setLoading(false);
    };

    return (
        <div className="h-full flex flex-col bg-slate-50">
            <AdminTopBar activeTab="settings" />
            <div className="px-6 border-b bg-white">
                <div className="flex gap-6">
                    <button onClick={() => setView('general')} className={`py-4 font-bold border-b-2 px-2 ${view === 'general' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>General Configuration</button>
                    <button onClick={() => setView('designer')} className={`py-4 font-bold border-b-2 px-2 ${view === 'designer' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Report Designer</button>
                </div>
            </div>

            {view === 'designer' ? <ReportDesigner /> : (
                <>
                    <div className="px-6 pt-6">
                        <div className="flex items-center gap-2 mb-6">
                            <h2 className="text-2xl font-bold text-slate-800">System Settings</h2>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800">System Configuration</h2>
                    </div>
                    <div className="bg-white p-8 rounded-xl border border-slate-200 max-w-2xl space-y-6 m-6">
                        <div><label className="block font-bold text-slate-700 mb-2">Laboratory Name</label><input className="border border-slate-300 p-3 rounded-lg w-full outline-none focus:ring-2 focus:ring-indigo-500" value={settings.name} onChange={e => setSettings({ ...settings, name: e.target.value })} /></div>
                        <div><label className="block font-bold text-slate-700 mb-2">Address</label><input className="border border-slate-300 p-3 rounded-lg w-full outline-none focus:ring-2 focus:ring-indigo-500" value={settings.address} onChange={e => setSettings({ ...settings, address: e.target.value })} /></div>
                        <div><label className="block font-bold text-slate-700 mb-2">Contact Phone</label><input className="border border-slate-300 p-3 rounded-lg w-full outline-none focus:ring-2 focus:ring-indigo-500" value={settings.phone} onChange={e => setSettings({ ...settings, phone: e.target.value })} /></div>
                        <div><label className="block font-bold text-slate-700 mb-2">Email</label><input className="border border-slate-300 p-3 rounded-lg w-full outline-none focus:ring-2 focus:ring-indigo-500" value={settings.email} onChange={e => setSettings({ ...settings, email: e.target.value })} /></div>

                        <div className="border-t pt-4 mt-2"><h3 className="font-bold text-slate-800 mb-4">Pathologist Configuration</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block font-bold text-slate-700 mb-2">Full Name</label><input className="border border-slate-300 p-3 rounded-lg w-full outline-none focus:ring-2 focus:ring-indigo-500" value={settings.pathologistName} onChange={e => setSettings({ ...settings, pathologistName: e.target.value })} /></div>
                                <div><label className="block font-bold text-slate-700 mb-2">Signature Text</label><input className="border border-slate-300 p-3 rounded-lg w-full outline-none focus:ring-2 focus:ring-indigo-500" value={settings.pathologistSig} onChange={e => setSettings({ ...settings, pathologistSig: e.target.value })} /></div>
                                <div><label className="block font-bold text-slate-700 mb-2">Qualification</label><input className="border border-slate-300 p-3 rounded-lg w-full outline-none focus:ring-2 focus:ring-indigo-500" value={settings.pathologistQual} onChange={e => setSettings({ ...settings, pathologistQual: e.target.value })} /></div>
                                <div><label className="block font-bold text-slate-700 mb-2">Designation</label><input className="border border-slate-300 p-3 rounded-lg w-full outline-none focus:ring-2 focus:ring-indigo-500" value={settings.pathologistDesig} onChange={e => setSettings({ ...settings, pathologistDesig: e.target.value })} /></div>
                            </div></div>

                        <div className="pt-4"><button onClick={handleSave} disabled={loading} className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50">{loading ? 'Saving...' : 'Save Changes'}</button></div>
                    </div>
                </>
            )}
        </div>
    );
};

// --- Print Modal Components ---



const PrintInvoiceModal: React.FC<{ data: PrintableInvoiceData; onClose: () => void }> = ({ data, onClose }) => {
    const [labInfo, setLabInfo] = useState({ name: 'LabPro Diagnostics', address: '123 Medical Plaza, Suite 400, New York, NY 10001', phone: '+1 (555) 123-4567' });
    const [template, setTemplate] = useState<ReportDesign | null>(null);
    const [loading, setLoading] = useState(true);
    const [qrData, setQrData] = useState<{ token: string; dataUrl: string } | null>(null);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                // Load Lab Info
                const infoSnap = await db.collection('settings').doc('lab_info').get();
                if (infoSnap.exists) setLabInfo(prev => ({ ...prev, ...infoSnap.data() }));

                // Load Bill Template - ONLY published ones for live use
                let snap = await db.collection('bill_templates').where('isPublished', '==', true).get();
                let templateLoaded = false;

                console.log(`📋 [BILL PRINT] Found ${snap.size} templates in bill_templates`);

                // Try to find a valid template (type: invoice or receipt)
                for (const doc of snap.docs) {
                    let loaded = doc.data() as any;
                    console.log(`  - Template: "${loaded.name}", type: "${loaded.type}", pageFormat: "${loaded.pageFormat}"`);
                    
                    // Validate this is actually a bill/invoice template, not a report template
                    // STRICT: type MUST be 'invoice' or 'receipt' (reject 'report' or undefined)
                    const isValidBillType = loaded.type === 'invoice' || loaded.type === 'receipt';
                    
                    if (!isValidBillType) {
                        console.warn(`    ⚠️ Skipping invalid template type: "${loaded.type}"`);
                        continue;
                    }
                    
                    console.log(`    ✅ Using this template!`);

                    // Migration / Safety checks
                    if (!loaded.layers && loaded.elements) {
                        loaded.layers = loaded.elements;
                    }
                    if (!loaded.pageFormat) loaded.pageFormat = 'Thermal80'; // Default bills to thermal

                    // FORCE Auto-Layout for the new professional rendering engine
                    loaded.isAutoLayout = true;

                    setTemplate(loaded as ReportDesign);
                    templateLoaded = true;
                    break; // Found valid template, stop looking
                }
                
                if (!templateLoaded) {
                    console.log(`📋 [BILL PRINT] No valid bill template found. Using fallback thermal layout.`);
                    console.log(`📋 [BILL PRINT] Fallback will have pageFormat: Thermal80`);
                    // Standard Professional Thermal Fallback
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
                    setTemplate(fallbackDesign);
                }

                // Generate QR Token
                if (data.orderId) {
                    console.log('‹ BILL QR: Generating for orderId:', data.orderId, 'patientId:', data.patientId);
                    try {
                        const token = await getOrCreateQRToken(
                            data.orderId,
                            data.patientId || data.patient?.id || 'unknown_patient',
                            'bill',
                            auth.currentUser?.uid || 'system'
                        );
                        console.log('‹ BILL QR: Generated token:', token);
                        const dataUrl = await generateQRDataURL(token);
                        console.log('‹ BILL QR: QR URL will be:', window.location.origin + '/labman/track/' + token);
                        setQrData({ token, dataUrl });
                    } catch (err) {
                        console.error("âŒ BILL QR: Failed to generate", err);
                    }
                } else {
                    console.error('âŒ BILL QR: No orderId provided!', data);
                }
            } catch (e) {
                console.error("!!! ERROR LOADING BILL TEMPLATE !!!", e);
                // Use fallback on error
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
                setTemplate(fallbackDesign);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const handlePrint = async () => {
        // Wait for all images to load before printing
        const images = document.querySelectorAll('img');
        await Promise.all(Array.from(images).map(img => {
            return new Promise((resolve) => {
                if (img.complete) {
                    resolve(true);
                } else {
                    img.onload = () => resolve(true);
                    img.onerror = () => resolve(false);
                }
            });
        }));

        // Use iframe for reliable thermal printing
        const printWindow = document.createElement('iframe');
        printWindow.style.display = 'none';
        document.body.appendChild(printWindow);

        const printContent = document.querySelector('.print-modal-root-parent');
        if (!printContent) return;

        const doc = printWindow.contentDocument;
        if (!doc) return;

        // Write HTML with thermal CSS
        doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    @page {
                        size: 80mm 297mm;
                        margin: 0;
                    }
                    body {
                        width: 80mm;
                        margin: 0;
                        padding: 0;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .no-print { display: none !important; }
                </style>
            </head>
            <body>
                ${printContent.innerHTML}
            </body>
            </html>
        `);

        doc.close();
        
        // Wait for content to render, then print
        await new Promise(resolve => setTimeout(resolve, 500));
        
        printWindow.contentWindow?.print();
        
        // Clean up after print
        setTimeout(() => {
            document.body.removeChild(printWindow);
        }, 1000);
    };

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

    const parseDateInput = (val: any) => {
        if (!val) return new Date();
        if (val instanceof Date) return val;
        if (val?.toDate && typeof val.toDate === 'function') return val.toDate();
        const d = new Date(val);
        return isNaN(d.getTime()) ? new Date() : d;
    };

    const invoiceDate = parseDateInput(data.date);

    // Prepare data for dynamic renderer
    const reportData: ReportData = {
        qrToken: qrData?.token,
        qrDataUrl: qrData?.dataUrl,
        patient: {
            name: data.patientName || '',
            id: '',
            age: parseInt(data.age || data.patientAge || '0'),
            gender: data.patientGender || data.gender || '',
            phone: data.patientPhone || '',
            address: '',
        },
        doctor: {
            name: data.doctorName || data.doctor || 'Self',
            id: '',
        },
        invoice: {
            id: data.orderId || data.invoiceId || 'N/A',
            date: invoiceDate.toLocaleDateString(),
            items: (data.items || []).map(i => ({
                name: i.testName || i.name || 'Test',
                price: Number(i.price) || 0, // Revert to base price
                qty: 1,
                total: Number(i.price) || 0, // Revert to base price
                isUrgent: i.isUrgent,
                basePrice: Number(i.price) || 0,
                urgentFee: Number(i.urgentFee) || 0
            })),
            subtotal: Number(data.subtotal || data.amount || 0),
            tax: 0,
            discount: Number(data.discount || 0),
            // Total should explicitly match the finalAmount from booking
            total: Number(data.total || data.amount || 0),
            paid: Number(data.paid || data.paidAmount || 0),
            due: Number(data.due || ((data.total || data.amount || 0) - (data.paid || data.paidAmount || 0))),
            method: String(data.paymentMethod || 'Cash').toUpperCase()
        },
        report: {
            date: formatDate(data.date || new Date()),
            id: data.orderId || 'N/A',
            title: 'INVOICE'
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1000] p-4 print:p-0 print:bg-white print:static" onClick={onClose}>
            <style>{`
                @media print {
                    body { visibility: hidden !important; background: white !important; }
                    .print-modal-root-parent { 
                        visibility: visible !important; 
                        position: absolute !important; 
                        left: 0 !important; 
                        top: 0 !important; 
                        width: 80mm !important; 
                        height: auto !important; 
                        display: block !important; 
                        overflow: visible !important;
                        z-index: 99999 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .print-modal-root-parent * { 
                        visibility: visible !important; 
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    @page { 
                        size: 80mm 297mm !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .no-print { display: none !important; }
                }
            `}</style>

            <div className="print-modal-root-parent bg-white w-full max-w-5xl rounded-xl shadow-2xl overflow-hidden flex flex-col h-[90vh] print:max-h-none print:shadow-none print:w-full print:max-w-none print:rounded-none print:h-auto print:static" onClick={e => e.stopPropagation()}>

                {/* Header - Hidden on print */}
                <div className="bg-slate-800 text-white p-4 flex justify-between items-center no-print shrink-0">
                    <h3 className="font-bold flex items-center gap-2">
                        <Printer className="w-5 h-5" />
                        Print Preview {loading && <span className="text-xs opacity-50">(Loading...)</span>}
                    </h3>
                    <div className="flex gap-2">
                        <button onClick={handlePrint} className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-all" title="Press Enter to Print">
                            Print Now
                        </button>
                        <button onClick={onClose} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-all" title="Press Esc to Close">
                            Close
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-auto bg-slate-100 flex justify-center print:bg-white print:p-0 print:block print:overflow-visible">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                        </div>
                    ) : (
                        <div className="print:block print:w-full">
                            {template && (
                                <div>
                                    <div style={{display: 'none'}}>{console.log('🖨️ [BILL PRINT] Rendering template with pageFormat:', template.pageFormat)}</div>
                                    <ReportPageRenderer design={template} data={reportData} />
                                </div>
                            )}
                            {!template && <div className="p-12 text-center text-slate-400">No template loaded</div>}
                        </div>
                    )}
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
    const [tatFromDate, setTatFromDate] = useState<string>(() => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    const [tatToDate, setTatToDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
    const [notifications, setNotifications] = useState<{ id: string, text: string, type: 'alert' | 'info' }[]>([]);
    const [printData, setPrintData] = useState<PrintableInvoiceData | null>(null);
    const [viewPatientDetails, setViewPatientDetails] = useState<Patient | null>(null);
    const { showAlert, showConfirm, showToast, showPrompt } = useDialog();

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

    const downloadTATCSV = async () => {
        try {
            // Get date range
            const fromDate = new Date(tatFromDate);
            fromDate.setHours(0, 0, 0, 0);
            const toDate = new Date(tatToDate);
            toDate.setHours(23, 59, 59, 999);

            // Fetch all samples in the date range
            const snapshot = await db.collection('samples')
                .where('createdAt', '>=', fromDate)
                .where('createdAt', '<=', toDate)
                .get();

            const allSamples = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Sample));

            // Prepare comprehensive TAT data for CSV
            const tatData = allSamples.map(s => {
                const createdAt = s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
                const collectedAt = s.collectedAt ? (s.collectedAt.toDate ? s.collectedAt.toDate() : new Date(s.collectedAt)) : null;
                const submittedForReviewAt = s.submittedForReviewAt ? (s.submittedForReviewAt.toDate ? s.submittedForReviewAt.toDate() : new Date(s.submittedForReviewAt)) : null;
                const reportedAt = s.reportedAt ? (s.reportedAt.toDate ? s.reportedAt.toDate() : new Date(s.reportedAt)) : null;

                // Calculate TAT at each step
                const tatCollection = collectedAt ? getDuration(s.createdAt, s.collectedAt) : '--';
                const tatAnalysis = submittedForReviewAt ? getDuration(collectedAt || s.createdAt, s.submittedForReviewAt) : '--';
                const tatReview = reportedAt && submittedForReviewAt ? getDuration(s.submittedForReviewAt, s.reportedAt) : '--';
                const tatTotal = reportedAt ? getDuration(s.createdAt, s.reportedAt) : '--';

                return {
                    'Order ID': s.orderId || '--',
                    'Patient Name': s.patientName || '--',
                    'Phone': s.patientPhone || '--',
                    'Test Name': s.testName || '--',
                    'Booked At': createdAt.toLocaleString(),
                    'Sample Collected At': collectedAt ? collectedAt.toLocaleString() : '--',
                    'Collection TAT': tatCollection,
                    'Submitted for Review At': submittedForReviewAt ? submittedForReviewAt.toLocaleString() : '--',
                    'Analysis TAT': tatAnalysis,
                    'Report Ready At': reportedAt ? reportedAt.toLocaleString() : '--',
                    'Review TAT': tatReview,
                    'Total TAT': tatTotal,
                    'Status': s.status || '--'
                };
            });

            if (!tatData.length) {
                showToast('info', 'No samples found in the selected date range');
                return;
            }

            downloadCSV(tatData, `tat_log_${tatFromDate}_to_${tatToDate}.csv`);
            showToast('success', `TAT Log exported with ${tatData.length} samples (${tatFromDate} to ${tatToDate})`);
        } catch (error) {
            console.error('Error downloading TAT CSV:', error);
            showToast('error', 'Failed to export TAT log. Please try again.');
        }
    };

    const printTATLog = () => {
        const win = window.open('', '', 'width=1200,height=800');
        win?.document.write(`
            <html><head><title>TAT Log</title><style>
                body { font-family: sans-serif; padding: 20px; background: #f9fafb; }
                h2 { color: #1f2937; margin-bottom: 10px; }
                .meta { font-size: 12px; color: #666; margin-bottom: 20px; border-bottom: 2px solid #ddd; padding-bottom: 10px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
                th { background-color: #3b82f6; color: white; padding: 12px; text-align: left; font-size: 11px; font-weight: 600; }
                td { border-bottom: 1px solid #e5e7eb; padding: 10px 12px; font-size: 11px; }
                tr:hover { background-color: #f3f4f6; }
                .status-reported { color: #16a34a; font-weight: 600; }
                .status-pending { color: #ea580c; }
                .tat-value { font-weight: 600; color: #1f2937; }
                @media print { body { background: white; } table { box-shadow: none; } }
            </style></head>
            <body>
            <h2>📊 Turnaround Time (TAT) Analysis Report</h2>
            <div class="meta">
                <div><strong>Generated:</strong> ${new Date().toLocaleString()}</div>
                <div><strong>Total Samples:</strong> ${trackerSamples.length}</div>
                <div><strong>Reported:</strong> ${trackerSamples.filter(s => s.status === 'reported').length} | <strong>Pending:</strong> ${trackerSamples.filter(s => s.status !== 'reported').length}</div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Patient</th>
                        <th>Test Name</th>
                        <th>Booked</th>
                        <th>Collection TAT</th>
                        <th>Analysis TAT</th>
                        <th>Review TAT</th>
                        <th>Total TAT</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                ${trackerSamples.map(s => {
            const createdAt = s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
            const collectedAt = s.collectedAt ? (s.collectedAt.toDate ? s.collectedAt.toDate() : new Date(s.collectedAt)) : null;
            const submittedForReviewAt = s.submittedForReviewAt ? (s.submittedForReviewAt.toDate ? s.submittedForReviewAt.toDate() : new Date(s.submittedForReviewAt)) : null;
            const reportedAt = s.reportedAt ? (s.reportedAt.toDate ? s.reportedAt.toDate() : new Date(s.reportedAt)) : null;

            const tatCollection = collectedAt ? getDuration(s.createdAt, s.collectedAt) : '--';
            const tatAnalysis = submittedForReviewAt ? getDuration(collectedAt || s.createdAt, s.submittedForReviewAt) : '--';
            const tatReview = reportedAt && submittedForReviewAt ? getDuration(s.submittedForReviewAt, s.reportedAt) : '--';
            const tatTotal = reportedAt ? getDuration(s.createdAt, s.reportedAt) : '--';
            const isReported = s.status === 'reported';

            return `<tr>
                <td>${s.patientName || '--'}</td>
                <td>${s.testName || '--'}</td>
                <td>${createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</td>
                <td><span class="tat-value">${tatCollection}</span></td>
                <td><span class="tat-value">${tatAnalysis}</span></td>
                <td><span class="tat-value">${tatReview}</span></td>
                <td><span class="tat-value">${tatTotal}</span></td>
                <td><span class="${isReported ? 'status-reported' : 'status-pending'}">${isReported ? '✓ Reported' : 'Pending'}</span></td>
            </tr>`;
        }).join('')}
                </tbody>
            </table>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #ddd; text-align: center; color: #666; font-size: 11px;">
                <p>This TAT report includes collection, analysis, review, and total turnaround times for each test.</p>
                <button onclick="downloadTATCSVFromPrint()" style="margin-top: 10px; padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">📥 Download as CSV</button>
                <button onclick="window.print()" style="margin-left: 10px; padding: 8px 16px; background: #6b7280; color: white; border: none; border-radius: 4px; cursor: pointer;">🖨️ Print</button>
                <button onclick="window.close()" style="margin-left: 10px; padding: 8px 16px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer;">Close</button>
            </div>
            <script>
                function downloadTATCSVFromPrint() {
                    window.opener.downloadTATCSV();
                    window.close();
                }
            </script>
            </body></html>
        `);
        win?.document.close();
    };
    const [viewReport, setViewReport] = useState<Sample[] | null>(null);
    const [patientForm, setPatientForm] = useState({ fullName: '', phone: '', age: '', ageUnit: 'Years', gender: 'male', address: '', referralType: 'self', doctorName: '', clinicName: '', existingId: '' });

    // Cart state - no longer tracking individual urgent status here
    const [cart, setCart] = useState<Test[]>([]);
    const [payment, setPayment] = useState({ method: 'cash', paidAmount: '', discount: 0, discountReason: '' });
    const [isOrderUrgent, setIsOrderUrgent] = useState(false); // New global urgent state
    const [testSearch, setTestSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');

    // Calculate total amount and urgent fees
    const totalAmount = cart.reduce((sum, t) => sum + t.price, 0);

    // Calculate total urgent fee: Sum of urgent prices of ALL tests if order is urgent
    const urgentFee = isOrderUrgent
        ? cart.reduce((sum, t) => sum + (t.urgentPrice || 50), 0)
        : 0;

    // Calculate discount: percentage-based on subtotal
    const discountAmount = Math.round((totalAmount * payment.discount) / 100);
    const finalAmount = Math.max(0, totalAmount + urgentFee - discountAmount);
    const paidVal = parseFloat(payment.paidAmount) || 0;
    const dueVal = Math.max(0, finalAmount - paidVal);

    useEffect(() => { setPayment(p => ({ ...p, paidAmount: finalAmount.toString() })); }, [finalAmount]);
    useEffect(() => {
        const unsubTests = db.collection('tests').where('isActive', '==', true).onSnapshot(s => setTests(s.docs.map(d => ({ id: d.id, ...d.data() } as Test))));
        const unsubDocs = db.collection('doctors').where('status', '==', 'active').onSnapshot(s => setDoctors(s.docs.map(d => ({ id: d.id, ...d.data() } as Doctor))));
        const today = new Date(); today.setHours(0, 0, 0, 0); const startOfDay = firebase.firestore.Timestamp.fromDate(today);
        const unsubOrders = db.collection('orders').where('createdAt', '>=', startOfDay).onSnapshot(s => { const totalSales = s.docs.reduce((acc, doc) => acc + (doc.data().totalAmount || 0), 0); setStats(prev => ({ ...prev, todayOrders: s.size, todaySales: totalSales })); });

        // Global Enter key: When in new-order subView, attempt to Confirm Order
        const onGlobalKey = (e: KeyboardEvent) => {
            if (e.key !== 'Enter') return;
            if (subView !== 'new-order') return;
            if (printData) return;
            // Ignore Enter when active element is a textarea (multi-line) or when Alt/Ctrl/Meta pressed
            if (e.altKey || e.ctrlKey || e.metaKey) return;
            const active = document.activeElement as HTMLElement | null;
            if (active && active.tagName === 'TEXTAREA') return;
            // Ensure validations
            if (!loading && cart.length > 0 && patientForm.fullName && patientForm.phone && patientForm.phone.length === 11) {
                e.preventDefault();
                handleBookOrder();
            }
        };
        window.addEventListener('keydown', onGlobalKey);

        return () => { unsubTests(); unsubOrders(); unsubDocs(); window.removeEventListener('keydown', onGlobalKey); };
    }, [subView, printData, loading, cart, patientForm]);
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

    // Auto-apply doctor discount when doctor is selected
    useEffect(() => {
        if (patientForm.referralType === 'doctor' && selectedDoctorId) {
            const selectedDoctor = doctors.find(d => d.id === selectedDoctorId);
            if (selectedDoctor && selectedDoctor.discountPercentage) {
                // Calculate discount based on subtotal + urgent fee
                const discountAmount = ((totalAmount + urgentFee) * selectedDoctor.discountPercentage) / 100;
                setPayment(prev => ({
                    ...prev,
                    discount: Math.round(discountAmount),
                    discountReason: `Doctor Referral: ${selectedDoctor.name} (${selectedDoctor.discountPercentage}%)`
                }));
            }
        } else if (patientForm.referralType === 'self') {
            // Clear auto-discount if switching to self
            if (payment.discountReason?.startsWith('Doctor Referral:')) {
                setPayment(prev => ({ ...prev, discount: 0, discountReason: '' }));
            }
        }
    }, [selectedDoctorId, patientForm.referralType, totalAmount, urgentFee, doctors]);

    const handlePatientSearch = async (isSilent = false) => {
        const phoneQuery = patientForm.phone.trim();

        // Normalize phone number - remove spaces, dashes, parentheses
        const normalizedQuery = phoneQuery.replace(/[\s\-()]/g, '');

        if (normalizedQuery.length < 3) {
            // Silently return - no popup
            return;
        }

        setLoading(true);
        try {
            // EXACT MATCH - search for normalized phone number
            const snap = await db.collection('patients').where('phone', '==', normalizedQuery).limit(1).get();

            if (!snap.empty) {
                const p = snap.docs[0].data() as Patient;
                // Auto-populate form WITHOUT popup
                let ageVal = '', ageUnit = 'Years';
                if (p.dob) {
                    ageVal = calculateAge(p.dob).toString();
                }
                setPatientForm(prev => ({
                    ...prev,
                    fullName: p.fullName,
                    gender: p.gender as any,
                    address: p.address || '',
                    age: ageVal,
                    ageUnit: 'Years',
                    existingId: snap.docs[0].id
                }));
            }
            // If not found, silently do nothing - allow new patient registration
        } catch (e) {
            console.error('Patient search error:', e);
            // No popup - just log error
        } finally {
            setLoading(false);
        }
    };

    const filteredTests = tests.filter(t => { const matchSearch = t.name.toLowerCase().includes(testSearch.toLowerCase()) || t.code.toLowerCase().includes(testSearch.toLowerCase()); const matchCat = selectedCategory === 'All' || t.category === selectedCategory; return matchSearch && matchCat; });
    const categories = ['All', ...Array.from(new Set(tests.map(t => t.category || 'General')))];

    const handleBookOrder = async () => {
        if (!patientForm.fullName || cart.length === 0) { showAlert('warning', 'Please enter patient details and select at least one test.'); return; }
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

            const trackToken = generateSecureToken(); // Generate unified token at registration
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
                hasUrgentTests: cart.some(t => t.isUrgent), // Track if any tests are urgent
                trackToken, // Unified tracking token
                createdAt: firebase.firestore.Timestamp.now(),
                createdBy: auth.currentUser?.uid || 'unknown',
                creatorName: auth.currentUser?.email || 'System'
            });
            // Build itemized list for invoice (persisted for accurate reprints)
            const invoiceItems = cart.map(c => ({ testId: c.id, name: c.name, price: Number(c.price) || 0, qty: 1, amount: Number(c.price) || 0 }));
            const invoiceRef = await db.collection('invoices').add({
                orderId: orderRef.id,
                patientName: patientForm.fullName,
                items: invoiceItems,
                subtotal: totalAmount,
                amount: finalAmount,
                total: finalAmount,
                discount: discountAmount,
                discountPercentage: payment.discount,
                discountReason: payment.discountReason,
                paidAmount: paidVal,
                status: payStatus,
                trackToken, // Also store in invoice for convenience
                createdAt: firebase.firestore.Timestamp.now(),
                payments: paidVal > 0 ? [{ amount: paidVal, method: payment.method, date: new Date() }] : [],
                createdBy: auth.currentUser?.uid || 'unknown',
                creatorName: auth.currentUser?.email || 'System'
            });

            // Generate QR token and data URL for fast printing (run in background)
            (async () => {
                try {
                    const token = await getOrCreateQRToken(orderRef.id, patientId || 'unknown_patient', 'bill', auth.currentUser?.uid || 'system');
                    const dataUrl = await generateQRDataURL(token);
                    try {
                        await db.collection('invoices').doc(invoiceRef.id).update({ qrToken: token, qrDataUrl: dataUrl });
                    } catch (e) {
                        console.warn('Failed to update invoice with QR info', e);
                    }
                    // If modal already open for this printData, attach QR data immediately
                    setPrintData(prev => prev && prev.orderId === orderRef.id ? { ...prev, qrDataUrl: dataUrl } : prev);
                } catch (e) {
                    console.warn('Background QR generation failed', e);
                }
            })();
            const batch = db.batch();
            cart.forEach(t => {
                const sRef = db.collection('samples').doc();
                console.log('[SAMPLE CREATION] Preparing sample for test:', t.name, 'docId:', sRef.id);
                batch.set(sRef, {
                    orderId: orderRef.id,
                    patientId,
                    trackToken, // Propagate token to samples for reports
                    patientName: patientForm.fullName,
                    patientAge: parseInt(patientForm.age), // Storing snapshot of age
                    patientGender: patientForm.gender,
                    patientPhone: patientForm.phone,
                    testId: t.id,
                    testName: t.name,
                    sampleType: t.sampleType,
                    status: 'ordered',
                    isUrgent: t.isUrgent || false, // Per-test urgent flag
                    doctorName,
                    doctorPhone,
                    price: t.price || 0,
                    createdAt: firebase.firestore.Timestamp.now()
                });
            });
            await batch.commit();
            console.log('[SAMPLE CREATION] batch.commit() completed for order:', orderRef.id, 'items:', cart.map(c=>c.name));
            setPrintData({
                orderId: orderRef.id,
                patientId: patientId,
                patientName: patientForm.fullName,
                patientPhone: patientForm.phone,
                patientAge: patientForm.age + ' ' + patientForm.ageUnit,
                qrDataUrl: null,
                patientGender: patientForm.gender,
                date: new Date(),
                doctorName: doctorName,
                // Include urgent details per item
                items: cart.map(c => ({
                    testName: c.name,
                    price: c.price,
                    code: c.code,
                    isUrgent: c.isUrgent,
                    urgentFee: c.isUrgent ? (c.urgentPrice || 50) : 0
                })),
                amount: finalAmount, // Final amount includes urgent fees
                subtotal: totalAmount, // Base subtotal
                discount: discountAmount,
                discountPercentage: payment.discount,
                paidAmount: paidVal,
                paymentMethod: payment.method,
                total: finalAmount // Explicit total
            });
            setCart([]); setPatientForm({ fullName: '', phone: '', age: '', ageUnit: 'Years', gender: 'male', address: '', referralType: 'self', doctorName: '', clinicName: '', existingId: '' }); setPayment({ method: 'cash', paidAmount: '', discount: 0, discountReason: '' }); setSelectedDoctorId('');
        } catch (e) { console.error(e); showAlert('error', 'Failed to book order.'); } finally { setLoading(false); }
    };

    const selectPatient = (p: Patient) => { let ageVal = '', ageUnit = 'Years'; if (p.dob) { ageVal = calculateAge(p.dob).toString(); } setPatientForm({ fullName: p.fullName, phone: p.phone, age: ageVal, ageUnit: 'Years', gender: p.gender as any, address: p.address || '', referralType: 'self', doctorName: '', clinicName: '', existingId: p.id }); setSubView('new-order'); };
    const handleRejectSample = async (sample: Sample) => { const reason = await showPrompt('Enter rejection reason (e.g., Hemolyzed, Wrong Tube):'); if (!reason) return; try { await db.collection('samples').doc(sample.id).update({ status: 'ordered', notes: `RECOLLECTION REQUESTED: ${reason}`, rejectedAt: firebase.firestore.Timestamp.now(), rejectedBy: 'Receptionist' }); showToast('success','Sample flagged for recollection.'); } catch (e) { console.error(e); showAlert('error','Failed to reject sample'); } };

    const fetchAndShowPatientDetails = async (pid: string) => {
        if (!pid) return;
        try {
            const snap = await db.collection('patients').doc(pid).get();
            if (snap.exists) setViewPatientDetails({ id: snap.id, ...snap.data() } as Patient);
            else showAlert('info','Patient record not found.');
        } catch (e) { console.error(e); showAlert('error','Error fetching details'); }
    };

    const fetchAndPrintReport = async (orderId: string) => {
        try {
            const snap = await db.collection('samples').where('orderId', '==', orderId).where('status', '==', 'reported').get();
            if (snap.empty) { showAlert('info','No reported samples found for this order.'); return; }
            const samples = snap.docs.map(d => ({ id: d.id, ...d.data() } as Sample));
            setViewReport(samples);
        } catch (e) { console.error(e); showAlert('error','Error loading report.'); }
    };

    // Fetch invoice + sample details and open bill print modal for reprinting older bills
    const fetchAndPrintInvoice = async (orderId: string) => {
        try {
            // Try to find an invoice document for the order
            let invoiceSnap = await db.collection('invoices').where('orderId', '==', orderId).limit(1).get();
            const invoiceDoc = invoiceSnap.docs[0]?.data() as any || null;

            // Fetch samples/tests for the order
            const sSnap = await db.collection('samples').where('orderId', '==', orderId).get();
            const samples = sSnap.docs.map(d => ({ id: d.id, ...d.data() } as Sample));

            // Prefer explicit invoice items if present (authoritative)
            let tests: { name: string; price: number }[] = [];
            if (invoiceDoc && (invoiceDoc.items || invoiceDoc.tests)) {
                const items = invoiceDoc.items || invoiceDoc.tests;
                tests = items.map((it: any) => ({ name: it.name || it.testName || 'Test', price: Number(it.price || it.amount || 0) }));
            } else {
                // Otherwise, try to resolve prices from the tests catalog using sample.testId
                const testIds = Array.from(new Set(samples.map(s => s.testId).filter(Boolean)));
                const testsMap: Record<string, any> = {};
                if (testIds.length > 0) {
                    try {
                        const promises = testIds.map(id => db.collection('tests').doc(id).get());
                        const docs = await Promise.all(promises);
                        docs.forEach(d => { if (d.exists) testsMap[d.id] = d.data(); });
                    } catch (e) {
                        console.warn('Failed to load test definitions for invoice reprint', e);
                    }
                }

                // Build tests array from samples with fallbacks to test catalog price
                tests = samples.map(s => {
                    const tDef = (s.testId && testsMap[s.testId]) ? testsMap[s.testId] : null;
                    return {
                        name: s.testName || tDef?.name || 'Test',
                        price: Number((s as any).price) || Number(tDef?.price) || 0
                    };
                });
            }

            // If still empty, add a fallback placeholder
            if (!tests || tests.length === 0) tests = [{ name: 'Test', price: 0 }];

            // Compute totals
            const subtotal = tests.reduce((sum, t) => sum + (Number(t.price) || 0), 0);
            const total = Number(invoiceDoc?.amount ?? subtotal) || subtotal;
            const discount = Number(invoiceDoc?.discount ?? 0) || 0;
            const paidAmount = Number(invoiceDoc?.paidAmount ?? invoiceDoc?.paid ?? 0) || 0;

            // Fetch order for patient info fallback
            const orderSnap = await db.collection('orders').doc(orderId).get();
            const orderData = orderSnap.exists ? orderSnap.data() as any : null;

            setPrintData({
                orderId,
                patientId: orderData?.patientId || invoiceDoc?.patientId || '',
                patientName: orderData?.patientName || invoiceDoc?.patientName || (samples[0]?.patientName || ''),
                patientPhone: orderData?.patientPhone || invoiceDoc?.patientPhone || (samples[0]?.patientPhone || ''),
                patientAge: orderData?.patientAge || invoiceDoc?.patientAge || '',
                patientGender: orderData?.patientGender || invoiceDoc?.patientGender || '',
                tests: tests.map(t => ({ name: t.name, price: t.price })),
                subtotal,
                discount,
                total,
                paid: paidAmount,
                paymentMethod: invoiceDoc?.paymentMethod || orderData?.paymentMethod || 'Cash',
                date: invoiceDoc?.createdAt?.toDate ? invoiceDoc.createdAt.toDate() : (orderData?.createdAt?.toDate ? orderData.createdAt.toDate() : new Date()),
                qrDataUrl: invoiceDoc?.qrDataUrl || null
            });
        } catch (e) { console.error('Error fetching invoice for reprint', e); showAlert('error', 'Error loading invoice.'); }
    };

    const renderNewOrder = () => (
        <div className="h-full flex flex-col md:flex-row overflow-hidden" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN }}>
            <div className="w-full md:w-1/3 border-r border-[#0a9396]/20 overflow-y-auto p-6 scrollbar-thin" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN }} onKeyDown={e => {
                    // If Enter pressed inside left column and bill preview is NOT open, attempt to confirm order
                    if (e.key === 'Enter' && !printData) {
                        const shouldConfirm = !loading && cart.length > 0 && patientForm.fullName && patientForm.phone && patientForm.phone.length === 11;
                        if (shouldConfirm) {
                            e.preventDefault();
                            handleBookOrder();
                        }
                    }
                }}>
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2" style={{ color: COLORS.CITRON }}><User className="w-5 h-5" style={{ color: COLORS.GAMBOGE }} /> Patient Details</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold uppercase mb-1" style={{ color: COLORS.TIFFANY_BLUE }}>Phone Number</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Phone className="w-4 h-4 absolute left-3 top-3" style={{ color: COLORS.RICH_BLACK, pointerEvents: 'none', zIndex: 10 }} />
                                <input
                                    type="tel"
                                    value={patientForm.phone}
                                    onChange={e => {
                                        // Only allow digits
                                        const digits = e.target.value.replace(/\D/g, '');
                                        if (digits.length <= 11) {
                                            setPatientForm({ ...patientForm, phone: digits });
                                            // Auto-search when 11 digits reached
                                            if (digits.length === 11) {
                                                setTimeout(() => handlePatientSearch(true), 300);
                                            }
                                        }
                                    }}
                                    onPaste={e => {
                                        // Only allow digits on paste
                                        const pasted = e.clipboardData.getData('Text').replace(/\D/g, '');
                                        e.preventDefault();
                                        if (pasted.length <= 11) {
                                            setPatientForm({ ...patientForm, phone: pasted });
                                            if (pasted.length === 11) {
                                                setTimeout(() => handlePatientSearch(true), 300);
                                            }
                                        }
                                    }}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            // Explicitly search when user presses Enter in phone field
                                            handlePatientSearch(false);
                                            // Stop propagation so parent Enter handler doesn't try to confirm
                                            e.stopPropagation();
                                        }
                                    }}
                                    maxLength={11}
                                    pattern="[0-9]{11}"
                                    inputMode="numeric"
                                    placeholder="Search or Enter Phone"
                                    className="w-full pl-9 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-[#ee9b00] outline-none transition-all placeholder:text-slate-400 force-light-input"
                                />
                                {patientForm.phone && patientForm.phone.length !== 11 && (
                                    <div className="text-xs text-red-500 mt-1">Phone number must be exactly 11 digits.</div>
                                )}
                            </div>
                            <button onClick={() => handlePatientSearch()} className="p-2.5 rounded-lg transition-colors hover:opacity-80" style={{ backgroundColor: COLORS.PERSIAN_GREEN, color: COLORS.RICH_BLACK }}><Search className="w-4 h-4" /></button>
                        </div>
                    </div>
                    <div><label className="block text-xs font-bold uppercase mb-1" style={{ color: COLORS.TIFFANY_BLUE }}>Full Name</label><input value={patientForm.fullName} onChange={e => setPatientForm({ ...patientForm, fullName: e.target.value })} placeholder="Patient Name" className="w-full p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-[#ee9b00] outline-none placeholder:text-slate-400 force-light-input" /></div>
                    <div><label className="block text-xs font-bold uppercase mb-1" style={{ color: COLORS.TIFFANY_BLUE }}>Address</label><input value={patientForm.address || ''} onChange={e => setPatientForm({ ...patientForm, address: e.target.value })} placeholder="Patient Address" className="w-full p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-[#ee9b00] outline-none placeholder:text-slate-400 force-light-input" /></div>
                    <div className="flex gap-3"><div className="flex-1"><label className="block text-xs font-bold uppercase mb-1" style={{ color: COLORS.TIFFANY_BLUE }}>Age</label><div className="flex"><input type="number" value={patientForm.age} onChange={e => setPatientForm({ ...patientForm, age: e.target.value })} className="w-full p-2.5 rounded-l-lg text-sm focus:ring-2 focus:ring-[#ee9b00] outline-none placeholder:text-slate-400 force-light-input" /><select value={patientForm.ageUnit} onChange={e => setPatientForm({ ...patientForm, ageUnit: e.target.value })} className="rounded-r-lg text-xs px-2 outline-none font-medium force-light-input" style={{ borderLeft: '1px solid #e2e8f0' }}><option>Years</option><option>Months</option><option>Days</option></select></div></div><div className="flex-1"><label className="block text-xs font-bold uppercase mb-1" style={{ color: COLORS.TIFFANY_BLUE }}>Gender</label><select value={patientForm.gender} onChange={e => setPatientForm({ ...patientForm, gender: e.target.value as any })} className="w-full p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-[#ee9b00] outline-none force-light-input"><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div></div>
                    <div>
                        <label className="block text-xs font-bold uppercase mb-1" style={{ color: COLORS.TIFFANY_BLUE }}>Referral By</label>
                        <div className="flex p-1 rounded-lg mb-2" style={{ backgroundColor: COLORS.RICH_BLACK }}>
                            <button onClick={() => setPatientForm({ ...patientForm, referralType: 'self' })} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${patientForm.referralType === 'self' ? 'shadow-sm' : 'opacity-50'}`} style={{ backgroundColor: patientForm.referralType === 'self' ? COLORS.MIDNIGHT_GREEN : 'transparent', color: patientForm.referralType === 'self' ? COLORS.CITRON : COLORS.TIFFANY_BLUE }}>Self</button>
                            <button onClick={() => setPatientForm({ ...patientForm, referralType: 'doctor' })} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${patientForm.referralType === 'doctor' ? 'shadow-sm' : 'opacity-50'}`} style={{ backgroundColor: patientForm.referralType === 'doctor' ? COLORS.MIDNIGHT_GREEN : 'transparent', color: patientForm.referralType === 'doctor' ? COLORS.CITRON : COLORS.TIFFANY_BLUE }}>Doctor</button>
                        </div>
                        {patientForm.referralType === 'doctor' && (<div className="animate-in fade-in slide-in-from-top-1 space-y-2"><select value={selectedDoctorId} onChange={(e) => { setSelectedDoctorId(e.target.value); if (e.target.value) setPatientForm({ ...patientForm, doctorName: '' }); }} className="w-full p-2.5 rounded-lg text-sm outline-none force-light-input"><option value="">-- Select Registered Doctor --</option>{doctors.map(d => <option key={d.id} value={d.id}>{d.name} ({d.clinic})</option>)}</select><p className="text-center text-xs font-bold" style={{ color: COLORS.TIFFANY_BLUE }}>- OR -</p><input value={patientForm.doctorName} onChange={e => { setPatientForm({ ...patientForm, doctorName: e.target.value }); setSelectedDoctorId(''); }} placeholder="Enter Manual Name" className="w-full p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-[#ee9b00] outline-none placeholder:text-slate-400 force-light-input" /></div>)}
                    </div>
                </div>
                <div className="mt-8 pt-6 border-t border-[#0a9396]/20">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2" style={{ color: COLORS.CITRON }}><CreditCard className="w-5 h-5" style={{ color: COLORS.GAMBOGE }} /> Payment</h3>
                    <div className="p-4 rounded-xl space-y-3" style={{ backgroundColor: COLORS.RICH_BLACK, border: `1px solid ${COLORS.MIDNIGHT_GREEN}` }}>
                        <div className="flex justify-between text-sm" style={{ color: COLORS.TIFFANY_BLUE }}><span>Subtotal ({cart.length} tests)</span><span className="font-mono font-bold" style={{ color: COLORS.CITRON }}>Rs.{totalAmount}</span></div>

                        {/* Urgent Fee Toggle - Global */}
                        <div className="py-2 border-b border-dashed border-slate-200">
                            <label className="flex items-center justify-between cursor-pointer group">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={isOrderUrgent}
                                        onChange={e => setIsOrderUrgent(e.target.checked)}
                                        className="w-4 h-4 text-red-600 rounded focus:ring-red-500 border-gray-300"
                                    />
                                    <span className={`text-sm font-bold flex items-center gap-1 ${isOrderUrgent ? 'text-red-600' : 'text-slate-500'}`}>
                                        <Zap className="w-4 h-4 fill-current" /> Urgent Processing
                                    </span>
                                </div>
                                {urgentFee > 0 && (
                                    <span className="font-mono font-bold text-red-600 text-sm">+Rs.{urgentFee}</span>
                                )}
                            </label>
                            {isOrderUrgent && (
                                <p className="text-[10px] text-red-400 mt-1 pl-6">
                                    Applies urgent fee to all {cart.length} tests in order.
                                </p>
                            )}
                        </div>

                        <div className="py-2 border-b border-dashed border-slate-200">
                            <div className="flex justify-between items-center text-sm mb-1" style={{ color: COLORS.TIFFANY_BLUE }}>
                                <span className="flex items-center gap-1">
                                    Discount %
                                    {payment.discountReason?.startsWith('Doctor Referral:') && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-bold">AUTO</span>
                                    )}
                                </span>
                                <div className="flex items-center gap-1">
                                    <span className="font-bold opacity-50">-</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={payment.discount}
                                        onChange={e => {
                                            const pct = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                                            setPayment({ ...payment, discount: pct, discountReason: '' });
                                        }}
                                        disabled={payment.discountReason?.startsWith('Doctor Referral:')}
                                        className="w-16 p-1 text-right border rounded font-mono text-xs outline-none focus:ring-1 focus:ring-[#ee9b00] disabled:opacity-60 disabled:cursor-not-allowed force-light-input"
                                    />
                                    <span className="font-bold opacity-50">%</span>
                                </div>
                            </div>
                            <div className="text-[10px] text-right" style={{ color: COLORS.TIFFANY_BLUE, opacity: 0.7 }}>Saves: Rs.{Math.round((totalAmount * payment.discount) / 100)}</div>
                            {payment.discountReason && (
                                <p className="text-[10px] text-right" style={{ color: COLORS.TIFFANY_BLUE, opacity: 0.7 }}>{payment.discountReason}</p>
                            )}
                        </div>
                        <div className="flex justify-between items-center text-lg font-bold pt-3 border-t border-dashed border-slate-700" style={{ color: COLORS.GAMBOGE }}><span>Total Payable</span><span>Rs.{finalAmount}</span></div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold uppercase mb-1" style={{ color: COLORS.TIFFANY_BLUE }}>Amount Paid</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 font-bold opacity-50" style={{ color: COLORS.RICH_BLACK }}>Rs.</span>
                                <input type="number" value={payment.paidAmount} onChange={e => setPayment({ ...payment, paidAmount: e.target.value })} className="w-full pl-12 pr-2 py-2 rounded-lg text-sm font-bold focus:ring-2 focus:ring-[#ee9b00] outline-none force-light-input" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase mb-1" style={{ color: COLORS.TIFFANY_BLUE }}>Method</label>
                            <select value={payment.method} onChange={e => setPayment({ ...payment, method: e.target.value })} className="w-full p-2 rounded-lg text-sm outline-none force-light-input"><option value="cash">Cash</option><option value="card">Card</option><option value="upi">UPI/Online</option></select>
                        </div>
                    </div>
                    <div className="mt-6">
                        <button
                            onClick={handleBookOrder}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !loading && cart.length > 0 && patientForm.fullName && patientForm.phone.length === 11) {
                                    e.preventDefault();
                                    handleBookOrder();
                                }
                            }}
                            disabled={loading || cart.length === 0 || !patientForm.fullName || patientForm.phone.length !== 11}
                            className="w-full py-3.5 rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:shadow-none transition-all flex justify-center items-center gap-2"
                            style={{ backgroundColor: COLORS.GAMBOGE, color: COLORS.RICH_BLACK }}
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />} Confirm Order (Enter)
                        </button>
                        {cart.length === 0 && <p className="text-xs text-center mt-2 opacity-50" style={{ color: COLORS.TIFFANY_BLUE }}>Add tests to proceed</p>}
                        {patientForm.phone.length < 11 && <p className="text-xs text-center mt-2 opacity-50" style={{ color: COLORS.TIFFANY_BLUE }}>Enter 11-digit phone number</p>}
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
                            const cartItem = cart.find(c => c.id === t.id);
                            const isSelected = !!cartItem;
                            const isUrgent = cartItem?.isUrgent || false;

                            return (
                                <div
                                    key={t.id}
                                    onClick={() => { if (isSelected) setCart(cart.filter(c => c.id !== t.id)); else setCart([...cart, t]); }}
                                    className={`p-4 rounded-xl border cursor-pointer transition-all group ${isSelected ? 'ring-1 ring-[#0a9396]' : 'hover:border-[#0a9396]/50 hover:shadow-md'}`}
                                    style={{ backgroundColor: isSelected ? COLORS.MIDNIGHT_GREEN : COLORS.RICH_BLACK, borderColor: isSelected ? COLORS.PERSIAN_GREEN : `${COLORS.PERSIAN_GREEN}30` }}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-sm line-clamp-2 leading-tight pr-2 flex-1" style={{ color: COLORS.CITRON }}>{t.name}</h4>
                                        <div className="flex items-center gap-1">
                                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${isSelected ? '' : 'bg-transparent'}`} style={{ borderColor: COLORS.TIFFANY_BLUE, backgroundColor: isSelected ? COLORS.PERSIAN_GREEN : 'transparent' }}>{isSelected && <Check className="w-3 h-3 text-white" />}</div>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-1 mb-3">
                                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ backgroundColor: `${COLORS.PERSIAN_GREEN}20`, color: COLORS.TIFFANY_BLUE }}>{t.code}</span>
                                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ backgroundColor: `${COLORS.PERSIAN_GREEN}20`, color: COLORS.TIFFANY_BLUE }}>{t.sampleType}</span>
                                    </div>
                                    <div className="flex justify-between items-end border-t pt-2 mt-auto" style={{ borderColor: `${COLORS.PERSIAN_GREEN}20` }}>
                                        <span className="text-[10px] font-medium opacity-50" style={{ color: COLORS.TIFFANY_BLUE }}>{t.category}</span>
                                        <span className="font-bold" style={{ color: COLORS.GAMBOGE }}>Rs.{t.price}</span>
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
                    <div><p className="text-xs font-bold uppercase mb-1" style={{ color: COLORS.TIFFANY_BLUE }}>Revenue Today</p><p className="text-2xl font-bold" style={{ color: COLORS.CITRON }}>Rs.{stats.todaySales.toLocaleString()}</p></div>
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
                        <div className="flex items-center gap-2 flex-wrap">
                            <input type="date" value={tatFromDate} onChange={(e) => setTatFromDate(e.target.value)} className="text-xs px-2 py-1.5 rounded-lg" style={{ backgroundColor: `${COLORS.PERSIAN_GREEN}20`, color: COLORS.TIFFANY_BLUE, border: `1px solid ${COLORS.PERSIAN_GREEN}30` }} />
                            <span style={{ color: COLORS.TIFFANY_BLUE }}>to</span>
                            <input type="date" value={tatToDate} onChange={(e) => setTatToDate(e.target.value)} className="text-xs px-2 py-1.5 rounded-lg" style={{ backgroundColor: `${COLORS.PERSIAN_GREEN}20`, color: COLORS.TIFFANY_BLUE, border: `1px solid ${COLORS.PERSIAN_GREEN}30` }} />
                            <button onClick={downloadTATCSV} className="text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-white/5 transition-colors" style={{ color: COLORS.TIFFANY_BLUE, border: `1px solid ${COLORS.PERSIAN_GREEN}30` }}><Download className="w-3 h-3" /> Export CSV</button>
                        </div>
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
                                            <div className="mt-3 space-y-2">
                                                <div className="flex flex-wrap gap-3 text-[11px] font-mono p-2 rounded border" style={{ backgroundColor: COLORS.RICH_BLACK, borderColor: `${COLORS.PERSIAN_GREEN}20`, color: COLORS.TIFFANY_BLUE }}>
                                                    <span title="Booking Time" className="flex items-center gap-1">📋 {formatTimeSafe(s.createdAt)}</span>
                                                    {s.collectedAt && <span title="Collection" className="flex items-center gap-1" style={{ color: s.collectedAt ? COLORS.GAMBOGE : COLORS.TIFFANY_BLUE }}>🧬 {getDuration(s.createdAt, s.collectedAt)}</span>}
                                                    {s.analyzedAt && <span title="Analysis" className="flex items-center gap-1" style={{ color: s.analyzedAt ? COLORS.GAMBOGE : COLORS.TIFFANY_BLUE }}>🔬 {getDuration(s.collectedAt, s.analyzedAt)}</span>}
                                                    {s.reportedAt && <span title="Approval" className="flex items-center gap-1" style={{ color: COLORS.GAMBOGE }}>✅ {getDuration(s.analyzedAt, s.reportedAt)}</span>}
                                                </div>
                                                {s.reportedAt && <div className="text-[11px] font-bold px-2 py-1 rounded" style={{ backgroundColor: `${COLORS.GAMBOGE}20`, color: COLORS.GAMBOGE, border: `1px solid ${COLORS.GAMBOGE}40` }} title="Total Turnaround Time">⏱️ Total TAT: {getDuration(s.createdAt, s.reportedAt)}</div>}
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
    const [detailsSample, setDetailsSample] = useState<Sample | null>(null);
    const [olderSearchOpen, setOlderSearchOpen] = useState(false);
    const [olderSearchQuery, setOlderSearchQuery] = useState('');
    const [olderSearchResults, setOlderSearchResults] = useState<Sample[]>([]);
    const [searchingOlder, setSearchingOlder] = useState(false);

    useEffect(() => {
        // Listen for Critical Samples - Memory sorted to avoid composite index requirements
        const unsubCritical = db.collection('samples').where('isCritical', '==', true).limit(200).onSnapshot(s => {
            const data = s.docs.map(d => ({ id: d.id, ...d.data() } as Sample));
            data.sort((a, b) => {
                const da = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
                const db = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
                return db - da;
            });
            // Hide reported items older than 15 days from default view
            const cutoff = Date.now() - 15 * 24 * 60 * 60 * 1000;
            const filtered = data.filter(smp => {
                if (!smp.criticalReported) return true;
                if (!smp.criticalReportedAt?.toDate) return true;
                return smp.criticalReportedAt.toDate().getTime() >= cutoff;
            });
            setCriticalSamples(filtered.slice(0, 50));
        });

        // Listen to global notifications - Memory sorted
        const unsubNotifs = db.collection('notifications').where('targetRole', '==', 'reception').limit(50).onSnapshot(s => {
            const data = s.docs.map(d => ({ id: d.id, ...d.data() } as any));
            data.sort((a, b) => {
                const da = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
                const db = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
                return db - da;
            });
            setNotifications(data.slice(0, 20));
        });

        return () => { unsubCritical(); unsubNotifs(); };
    }, []);

    const getCriticalParams = (sample: Sample) => {
        const params = [] as { name: string; value: string; flag?: string; unit?: string }[];
        if (sample.results) {
            Object.entries(sample.results).forEach(([name, val]: any) => {
                if (val.flag === 'CL' || val.flag === 'CH' || val.flag === 'L' || val.flag === 'H') {
                    params.push({ name, value: val.value, flag: val.flag, unit: val.unit });
                }
            });
        }
        return params;
    };

    // Reporting dialog states (replace browser prompts with in-app dialog)
    const [reportDialogOpen, setReportDialogOpen] = useState(false);
    const [reportingSample, setReportingSample] = useState<Sample | null>(null);
    const [reportDoctorName, setReportDoctorName] = useState('');
    const [reportMethod, setReportMethod] = useState('Call');
    const [reporting, setReporting] = useState(false);

    const initiateMarkReported = (sample: Sample) => {
        setReportingSample(sample);
        setReportDoctorName(sample.doctorName || sample.patientName || '');
        setReportMethod('Call');
        setReportDialogOpen(true);
    };

    const confirmMarkReported = async () => {
        if (!reportingSample) return;
        setReporting(true);
        const sample = reportingSample;
        const doctorName = reportDoctorName?.trim();
        const method = reportMethod || 'Call';
        if (!doctorName) { showAlert('error','Please enter the name of the person informed.'); setReporting(false); return; }

        const critParams = getCriticalParams(sample);
        const criticalValue = critParams.length ? critParams.map(p => `${p.name}: ${p.value}${p.unit ? ' ' + p.unit : ''} (${p.flag})`).join('; ') : 'Refer to Report';

        try {
            await db.collection('critical_logs').add({
                sampleId: sample.id,
                patientName: sample.patientName,
                testName: sample.testName,
                criticalValue: criticalValue,
                reportedBy: auth.currentUser?.email || 'Receptionist',
                reportedTo: doctorName,
                method: method,
                contactPhone: sample.doctorPhone || sample.patientPhone || '',
                timestamp: firebase.firestore.Timestamp.now()
            });
            await db.collection('samples').doc(sample.id).update({
                criticalReported: true,
                criticalReportedAt: firebase.firestore.Timestamp.now(),
                criticalReportedBy: auth.currentUser?.email
            });
            setReportDialogOpen(false);
            setDetailsSample(null);
            showToast('success', 'Marked as Reported.');
        } catch (e) { console.error(e); showToast('error', 'Failed to log action.'); }
        setReporting(false);
        setReportingSample(null);
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

    const handleSearchOlderReported = async (query: string) => {
        setSearchingOlder(true);
        try {
            const snap = await db.collection('samples').where('criticalReported', '==', true).orderBy('criticalReportedAt', 'desc').limit(200).get();
            const cutoff = Date.now() - 15 * 24 * 60 * 60 * 1000;
            const rows = snap.docs.map(d => ({ id: d.id, ...d.data() } as Sample)).filter(s => !(s.criticalReportedAt?.toDate && s.criticalReportedAt.toDate().getTime() >= cutoff));
            const q = (query || '').trim().toLowerCase();
            const filtered = q ? rows.filter(r => (r.patientName || '').toLowerCase().includes(q) || (r.testName || '').toLowerCase().includes(q)) : rows;
            setOlderSearchResults(filtered);
        } catch (e) { console.error(e); alert('Failed to search older reported entries.'); }
        setSearchingOlder(false);
    };

    const renderCriticalReports = () => (
        <div className="h-full flex flex-col p-6" style={{ backgroundColor: `${COLORS.RICH_BLACK}` }}>
            <div className="flex justify-between items-center mb-6 bg-red-950/50 p-4 rounded-xl border border-red-900/50">
                <div><h3 className="text-2xl font-bold flex items-center gap-2 text-red-50"><AlertTriangle className="w-8 h-8 text-red-500" /> Critical Results Management</h3><p className="text-red-200 font-medium">Urgent action required for these patients.</p></div>
                <div className="flex items-center gap-3">
                    <button onClick={() => setOlderSearchOpen(true)} className="border border-red-400 text-red-200 px-3 py-2 rounded-lg font-bold hover:bg-red-900/40">Search older reported</button>
                    <button onClick={downloadCriticalLog} className="border border-red-500 text-red-200 px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors hover:bg-red-900/40"><Download className="w-4 h-4" /> Download Log</button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto rounded-xl shadow border border-red-900" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN }}>
                <table className="w-full text-left">
                    <thead className="bg-red-900/40 border-b border-red-900">
                        <tr><th className="p-4 text-red-100">Date/Time</th><th className="p-4 text-red-100">Patient</th><th className="p-4 text-red-100">Status</th><th className="p-4 text-right text-red-100">Action</th></tr>
                    </thead>
                    <tbody className="divide-y divide-red-900/20">
                        {criticalSamples.map(s => (
                            <tr key={s.id} onClick={() => setDetailsSample(s)} className="hover:bg-red-900/10 transition-colors cursor-pointer">
                                <td className="p-4 text-sm font-medium opacity-70" style={{ color: COLORS.TIFFANY_BLUE }}>{formatDate(s.analyzedAt || s.createdAt)}</td>
                                <td className="p-4 font-bold" style={{ color: COLORS.CITRON }}>{s.patientName}<div className="text-xs font-normal opacity-70" style={{ color: COLORS.TIFFANY_BLUE }}>{s.patientAge}Y / {s.patientGender}</div></td>
                                <td className="p-4">
                                    {s.criticalReported ? <span className="bg-green-600 text-white px-2 py-1 rounded text-xs font-bold flex items-center gap-1 w-fit"><CheckCircle2 className="w-3 h-3" /> Reported</span> : <span className="bg-red-600 text-white border-2 border-white px-2 py-1 rounded text-xs font-bold animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.6)]">PENDING ACTION</span>}
                                </td>
                                <td className="p-4 text-right">
                                    <button onClick={(e) => { e.stopPropagation(); setDetailsSample(s); }} className="px-3 py-1.5 rounded bg-white text-red-700 border border-red-300 text-xs font-bold">Details</button>
                                </td>
                            </tr>
                        ))} 
                        {criticalSamples.length === 0 && <tr><td colSpan={4} className="p-8 text-center opacity-50" style={{ color: COLORS.TIFFANY_BLUE }}>No critical results found.</td></tr>}
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
        <div className="h-full flex flex-col" style={{ backgroundColor: COLORS.RICH_BLACK }} onKeyDown={e => {
            // Enter key: open bill preview from form or print from bill modal
            if (e.key === 'Enter' && printData) {
                e.preventDefault();
                const printBtn = document.querySelector('[data-print-bill]') as HTMLButtonElement;
                if (printBtn) printBtn.click();
            }
        }}>
            {printData && <BillPrintModal data={printData} onClose={() => setPrintData(null)} />}

            {viewReport && <PrintReportModal data={viewReport} onClose={() => setViewReport(null)} />}
            {viewPatientDetails && <PatientDetailsModal patient={viewPatientDetails} onClose={() => setViewPatientDetails(null)} />}

            {detailsSample && (
                <div className="fixed inset-0 flex items-center justify-center z-50">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setDetailsSample(null)}></div>
                    <div className="bg-white rounded-lg p-6 w-[720px] max-w-full z-10">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-xl font-bold">{detailsSample.patientName} — {detailsSample.testName}</h3>
                                <div className="text-sm text-slate-500">{detailsSample.patientAge}Y / {detailsSample.patientGender}</div>
                            </div>
                            <div className="text-right">
                                <div className="font-bold">{detailsSample.doctorName ? `Dr. ${detailsSample.doctorName}` : 'Patient'}</div>
                                <div className="text-sm"><a href={`tel:${detailsSample.doctorPhone || detailsSample.patientPhone || ''}`} className="text-amber-600 font-bold">{detailsSample.doctorPhone || detailsSample.patientPhone || 'No Phone'}</a></div>
                            </div>
                        </div>
                        <div className="mt-4">
                            <h4 className="font-bold mb-2">Parameters to report</h4>
                            <div className="space-y-2">
                                {Object.entries(detailsSample.results || {}).filter(([_, v]: any) => ['CL','CH','L','H'].includes(v.flag)).map(([name, v]: any, idx) => (
                                    <div key={idx} className="flex justify-between border rounded p-3 bg-slate-50">
                                        <div><div className="font-bold">{name}</div><div className="text-xs text-slate-500">{v.unit}</div></div>
                                        <div className="text-right"><div className="font-bold">{v.value}</div><div className="text-xs">{v.flag}</div></div>
                                    </div>
                                ))}
                                {(!detailsSample.results || Object.keys(detailsSample.results || {}).filter(k => ['CL','CH','L','H'].includes((detailsSample.results || {})[k]?.flag)).length === 0) && <div className="text-sm italic opacity-60">No flagged parameter details available. Open full report for details.</div>}
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-2">
                            <button onClick={() => { setDetailsSample(null); }} className="px-4 py-2 rounded bg-slate-200">Close</button>
                            {!detailsSample.criticalReported && <button onClick={() => initiateMarkReported(detailsSample as Sample)} className="px-4 py-2 rounded bg-red-600 text-white">Mark Reported</button>}
                        </div>
                    </div>
                </div>
            )}

            {/* Report Confirmation Dialog */}
            {reportDialogOpen && reportingSample && (
                <div className="fixed inset-0 flex items-center justify-center z-50">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setReportDialogOpen(false)}></div>
                    <div className="bg-white rounded-lg p-6 w-[520px] max-w-full z-10">
                        <h3 className="text-lg font-bold mb-3">Confirm Critical Result Reporting</h3>
                        <div className="text-sm text-slate-600 mb-3">Patient: <b>{reportingSample.patientName}</b> — Test: <b>{reportingSample.testName}</b></div>
                        <div className="mb-3">
                            <label className="block text-xs font-bold mb-1">Person Informed (Doctor / Patient)</label>
                            <input className="w-full border rounded px-3 py-2" value={reportDoctorName} onChange={(e) => setReportDoctorName(e.target.value)} />
                        </div>
                        <div className="mb-3">
                            <label className="block text-xs font-bold mb-1">Communication Method</label>
                            <select className="w-full border rounded px-3 py-2" value={reportMethod} onChange={(e) => setReportMethod(e.target.value)}>
                                <option>Call</option>
                                <option>SMS</option>
                                <option>Email</option>
                            </select>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => { setReportDialogOpen(false); setReportingSample(null); }} className="px-4 py-2 rounded bg-slate-200">Cancel</button>
                            <button onClick={confirmMarkReported} disabled={reporting} className="px-4 py-2 rounded bg-red-600 text-white">{reporting ? 'Reporting...' : 'Confirm & Mark Reported'}</button>
                        </div>
                    </div>
                </div>
            )}

            {olderSearchOpen && (
                <div className="fixed inset-0 flex items-center justify-center z-50">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setOlderSearchOpen(false)}></div>
                    <div className="bg-white rounded-lg p-6 w-[900px] max-w-full z-10">
                        <h3 className="text-lg font-bold mb-2">Search Older Reported (older than 15 days)</h3>
                        <div className="flex gap-2 mb-4">
                            <input value={olderSearchQuery} onChange={(e) => setOlderSearchQuery(e.target.value)} placeholder="Patient name or test name" className="flex-1 border rounded px-3 py-2" />
                            <button onClick={() => handleSearchOlderReported(olderSearchQuery)} className="px-4 py-2 rounded bg-red-600 text-white">Search</button>
                            <button onClick={() => { setOlderSearchQuery(''); setOlderSearchResults([]); }} className="px-4 py-2 rounded bg-slate-200">Clear</button>
                        </div>
                        <div className="max-h-[400px] overflow-y-auto">
                            {searchingOlder ? <div className="text-sm italic">Searching...</div> : (
                                olderSearchResults.length ? olderSearchResults.map(r => (
                                    <div key={r.id} className="p-3 border-b flex items-center justify-between">
                                        <div>
                                            <div className="font-bold">{r.patientName} — {r.testName}</div>
                                            <div className="text-xs text-slate-500">Reported At: {r.criticalReportedAt?.toDate ? r.criticalReportedAt.toDate().toLocaleString() : ''}</div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => setDetailsSample(r)} className="px-3 py-1.5 rounded bg-white text-red-700 border">Details</button>
                                        </div>
                                    </div>
                                )) : <div className="text-sm italic opacity-60">No older reported results found matching this query.</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between px-6 py-3 border-b shadow-sm z-30 shrink-0" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, borderColor: `${COLORS.PERSIAN_GREEN}30` }}>
                <div className="flex items-center gap-4">
                    {onBack && <button onClick={handleModuleBack} className="p-2 rounded-full hover:bg-white/10" style={{ color: COLORS.CITRON }}><ArrowRight className="w-5 h-5 rotate-180" /></button>}
                    <h2 className="text-2xl font-bold" style={{ color: COLORS.CITRON }}>Reception Desk</h2>
                    <div className="hidden md:flex p-1 rounded-lg" style={{ backgroundColor: COLORS.RICH_BLACK }}>
                        {['dashboard', 'new-order', 'bill-history', 'reports', 'critical-reports', 'search-patients'].map(v => (
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
                {subView === 'bill-history' && <div className="overflow-y-auto h-full p-6 pb-20 custom-scrollbar"><OrderHistoryTable onViewDetails={fetchAndShowPatientDetails} onPrintReport={fetchAndPrintReport} onPrintBill={fetchAndPrintInvoice} /></div>}
                {subView === 'reports' && <div className="overflow-y-auto h-full p-6 pb-20 custom-scrollbar"><ReceptionReportsTable onPrint={(s) => setViewReport(s)} /></div>}
                {subView === 'critical-reports' && renderCriticalReports()}
                {subView === 'search-patients' && <PatientSearchPanel onSelect={selectPatient} onViewDetails={(p) => setViewPatientDetails(p)} />}
            </div>
        </div>
    );
};

const PhlebotomyModule: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
    const { showToast } = useDialog();
    const [samples, setSamples] = useState<Sample[]>([]);
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null);
    const [selectedVisit, setSelectedVisit] = useState<{ orderId: string; tests: Sample[] } | null>(null);
    const [consumedItems, setConsumedItems] = useState<{ itemId: string, itemName: string, quantity: number }[]>([]);

    // Keyboard navigation state for phlebotomy
    const [keyboardVisitIdx, setKeyboardVisitIdx] = useState<number>(0);
    const [keyboardTestIdx, setKeyboardTestIdx] = useState<number>(0);
    const [modalSelectedTestIdx, setModalSelectedTestIdx] = useState<number>(0);
    const [singleCollectMode, setSingleCollectMode] = useState<boolean>(false);
    const [visitQuery, setVisitQuery] = useState<string>('');
    const [visitQueryInput, setVisitQueryInput] = useState<string>('');
    const searchInputRef = React.useRef<HTMLInputElement | null>(null);
    const lastSearchAppliedRef = React.useRef<number>(0);
    const [modalTestQuery, setModalTestQuery] = useState<string>('');
    const modalOpenedAtRef = React.useRef<number>(0);
    const modalFocusBlockedRef = React.useRef<number>(0);

    useEffect(() => {
        const unsubQueue = db.collection('samples').where('status', '==', 'ordered').onSnapshot(s => {
            console.log('[PHLEBOTOMY SNAPSHOT] received', s.size, 'ordered sample(s)');
            if (s.size > 0) console.log('[PHLEBOTOMY SNAPSHOT] sample docs:', s.docs.slice(0,5).map(d => ({ id: d.id, ...d.data() })));
            setSamples(s.docs.map(d => ({ id: d.id, ...d.data() } as Sample)));
        }, e => console.error('[PHLEBOTOMY SNAPSHOT] error', e));
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

    // Filter visits by search query (patient name, orderId, phone or test name/type)
    const filteredPatientVisits = useMemo(() => {
        const q = visitQuery.trim().toLowerCase();
        if (!q) return patientVisits;
        return patientVisits.filter(v => {
            if ((v.patientName || '').toLowerCase().includes(q)) return true;
            if ((v.patientPhone || '').toLowerCase().includes(q)) return true;
            if ((v.orderId || '').toLowerCase().includes(q)) return true;
            if (v.tests.some(t => ((t.testName || '').toLowerCase().includes(q) || (t.sampleType || '').toLowerCase().includes(q)))) return true;
            return false;
        });
    }, [patientVisits, visitQuery]);

    // Initialize keyboard focus when visits arrive
    // Note: do not auto-focus the list after a search apply; keep focus on search unless arrow is pressed.
    useEffect(() => {
        if (filteredPatientVisits.length > 0) {
            setKeyboardVisitIdx(0);
            setKeyboardTestIdx(0);
            // Expand but do not force focus here; focus will be moved when user presses arrow keys.
            setExpandedVisitId(filteredPatientVisits[0].orderId);
        }
    }, [filteredPatientVisits]);

    // Helper to move focus to a specific visit/test
    const focusTest = (vIdx: number, tIdx: number) => {
        // Ensure keyboard indexes are kept in sync
        setKeyboardVisitIdx(vIdx);
        setKeyboardTestIdx(tIdx);
        // Expand the target visit so its tests are rendered before focusing
        const targetVisit = filteredPatientVisits[vIdx];
        if (targetVisit) {
            setExpandedVisitId(targetVisit.orderId);
        }
        // Prefer data attributes so it works on both expanded list and modal
        // Give the DOM a bit more time to render after expanding
        setTimeout(() => {
            const el = document.querySelector(`[data-visit-index="${vIdx}"][data-test-index="${tIdx}"]`) as HTMLElement | null;
            if (el) el.focus();
        }, 80);
    };

    // Move focus next/prev across tests and visits (respecting filtered list)
    const moveNextTest = () => {
        if (filteredPatientVisits.length === 0) return;
        let v = keyboardVisitIdx;
        let t = keyboardTestIdx;
        const visit = filteredPatientVisits[v];
        if (!visit) return;
        if (t + 1 < visit.tests.length) {
            t++;
        } else if (v + 1 < filteredPatientVisits.length) {
            v++;
            t = 0;
            setExpandedVisitId(filteredPatientVisits[v].orderId);
        }
        focusTest(v, t);
    };
    const movePrevTest = () => {
        if (filteredPatientVisits.length === 0) return;
        let v = keyboardVisitIdx;
        let t = keyboardTestIdx;
        // If we're at the very first test (visit 0, test 0), move focus back to the search input
        if (v === 0 && t === 0) {
            setKeyboardVisitIdx(0);
            setKeyboardTestIdx(0);
            setExpandedVisitId(filteredPatientVisits[0]?.orderId || null);
            setTimeout(() => { searchInputRef.current?.focus(); }, 10);
            return;
        }
        if (t - 1 >= 0) {
            t--;
        } else if (v - 1 >= 0) {
            v--;
            const prev = filteredPatientVisits[v];
            t = Math.max(0, prev.tests.length - 1);
            setExpandedVisitId(filteredPatientVisits[v].orderId);
        }
        focusTest(v, t);
    };

    // Global key listener to navigate tests and open collection dialog
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            // If a collection modal is open, let modal handlers take priority
            if (selectedVisit) return;

            // Ignore when typing into inputs
            const active = document.activeElement as HTMLElement | null;
            if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable || active.tagName === 'SELECT')) return;

            if (e.key === 'ArrowDown') { e.preventDefault(); moveNextTest(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); movePrevTest(); }
            else if (e.key === 'Enter') { e.preventDefault();
                const visit = filteredPatientVisits[keyboardVisitIdx];
                if (visit) openCollectionForTest(visit, keyboardTestIdx);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [filteredPatientVisits, keyboardVisitIdx, keyboardTestIdx, expandedVisitId, selectedVisit]);

    // Keep keyboard indexes and expanded selection in-sync with filtering
    useEffect(() => {
        if (keyboardVisitIdx >= filteredPatientVisits.length) {
            setKeyboardVisitIdx(Math.max(0, filteredPatientVisits.length - 1));
            setKeyboardTestIdx(0);
        }
        if (expandedVisitId && !filteredPatientVisits.some(v => v.orderId === expandedVisitId)) {
            setExpandedVisitId(null);
        }
    }, [visitQuery, filteredPatientVisits]);


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

        // reset modal selection state
        setModalSelectedTestIdx(0);
        setSingleCollectMode(false);
        setModalTestQuery('');

        // mark modal open timestamp so we ignore the Enter that opened it
        modalOpenedAtRef.current = Date.now();
    };

    // Open collection dialog focused on a single test (keyboard-driven)
    const openCollectionForTest = async (visit: typeof patientVisits[0], testIndex: number) => {
        await openCollectionModal(visit);
        setModalSelectedTestIdx(testIndex);
        setSingleCollectMode(true);
        // mark modal opened (also helps prevent immediate Enter from double-triggering)
        modalOpenedAtRef.current = Date.now();
        setTimeout(() => {
            const el = document.querySelector(`.collection-test-item[data-test-index="${testIndex}"]`) as HTMLElement | null;
            if (el) el.focus();
        }, 80);
    };

    const editingConsumedIdxRef = useRef<number | null>(null);
    const isCollectingRef = useRef<boolean>(false);
    const [isCollecting, setIsCollecting] = useState<boolean>(false);
    const suppressFocusUntilRef = useRef<number>(0); // prevent accidental focus shifts for a short time after add/commit

    const addSelectedConsumable = () => {
        const sel = document.getElementById('phleb-inv-select') as HTMLSelectElement | null;
        if (!sel) return;
        const item = inventoryItems.find(i => i.id === sel.value);
        if (!item) return;
        const sessionUsed = consumedItems.filter(c => c.itemId === item.id).reduce((s, c) => s + (c.quantity || 0), 0);
        if (item.quantity - sessionUsed <= 0) {
            showToast('error', `Insufficient stock for ${item.name}`);
            return;
        }
        // Block modal auto-focus for a short time so we keep focus on newly added quantity input
        modalFocusBlockedRef.current = Date.now();
        // Also suppress any modal-level focus shifters briefly and mark the new input as actively editing
        const idxToFocus = consumedItems.length; // new index
        suppressFocusUntilRef.current = Date.now() + 1500;
        editingConsumedIdxRef.current = idxToFocus;

        // Add item and immediately schedule focusing the new quantity input (no intermediate sel.focus())
        setConsumedItems(prev => {
            const newArr = [...prev, { itemId: item.id, itemName: item.name, quantity: NaN }];
            // Use requestAnimationFrame to attempt immediate focus in next paint
            requestAnimationFrame(() => {
                const el = document.getElementById(`consumed-qty-${idxToFocus}`) as HTMLInputElement | null;
                if (el) {
                    el.focus();
                    el.select();
                }
                // clear block shortly after
                setTimeout(() => { modalFocusBlockedRef.current = 0; suppressFocusUntilRef.current = 0; }, 800);
            });
            return newArr;
        });
        sel.value = '';
        // Don't refocus the select immediately - keep focus on the newly added quantity input
        showToast('success', `${item.name} added`);
    };

    // Keep input focused while actively editing even if parent state causes re-renders
    useEffect(() => {
        const idx = editingConsumedIdxRef.current;
        if (idx === null || idx === undefined) return;
        setTimeout(() => {
            const el = document.getElementById(`consumed-qty-${idx}`) as HTMLInputElement | null;
            if (el && document.activeElement !== el) {
                el.focus();
                el.select();
            }
        }, 10);
    }, [consumedItems]);

    // Read committed consumable quantities directly from DOM inputs so we don't rely on possibly-unflushed React state
    const readCommittedConsumables = () => {
        const result: { itemId: string; quantity: number }[] = [];
        const inputs = Array.from(document.querySelectorAll('input[id^="consumed-qty-"]')) as HTMLInputElement[];
        for (const el of inputs) {
            // Prefer a data attribute on the input so we can read the itemId directly from the DOM (avoids relying on possibly-stale state)
            const itemId = (el.dataset && el.dataset.itemId) || (() => {
                const m = el.id.match(/^consumed-qty-(\d+)$/);
                if (m) {
                    const idx = parseInt(m[1], 10);
                    return consumedItems[idx]?.itemId || '';
                }
                return '';
            })();
            const raw = el.value;
            const v = parseFloat(raw);
            if (itemId && isFinite(v) && v > 0) {
                result.push({ itemId, quantity: Math.max(1, Math.round(v)) });
            }
        }
        console.log('[PHLEB] readCommittedConsumables', { fromState: consumedItems, inputsFound: inputs.map(i => ({ id: i.id, value: i.value, dataset: { ...i.dataset } })), read: result });
        return result;
    };

    const handleConfirmSingleCollection = async () => {
        if (!selectedVisit) return;
        const filtered = selectedVisit.tests.filter(t => {
            const q = modalTestQuery.trim().toLowerCase();
            if (!q) return true;
            return (t.testName || '').toLowerCase().includes(q) || (t.sampleType || '').toLowerCase().includes(q);
        });
        const sample = filtered[modalSelectedTestIdx];
        if (!sample) {
            showToast('error', 'Selected test not found (it may be filtered out).');
            return;
        }
        try {
            // Gather test inventory requirements
            const testSnap = await db.collection('tests').doc(sample.testId).get();
            const requirements: { itemId: string; quantity: number }[] = [];
            if (testSnap.exists) {
                const testData = testSnap.data() as Test;
                if (testData.inventoryRequirements) {
                    for (const req of testData.inventoryRequirements) {
                        if (req.quantity > 0) requirements.push({ itemId: req.itemId, quantity: req.quantity });
                    }
                }
            }

            // Reserve the collecting flag immediately (atomic-ish) to prevent concurrent entry
            isCollectingRef.current = true;
            setIsCollecting(true);

// Read committed manual consumables from DOM (ensures immediate user commits are respected)
                const manual = readCommittedConsumables();
                // If there are consumables in the form but the DOM-read returned none, prompt the user to commit quantities
                if (consumedItems.length > 0 && manual.length === 0) {
                    isCollectingRef.current = false;
                    setIsCollecting(false);
                    showToast('error', 'Please add and commit consumable quantities before confirming collection.');
                    setTimeout(() => { const el = document.getElementById('consumed-qty-0') as HTMLInputElement | null; if (el) { el.focus(); el.select(); } }, 10);
                    return;
                }

                // Validate DOM-read values
                const invalidConsIdx = manual.findIndex((i) => !isFinite(i.quantity) || i.quantity <= 0);
                if (invalidConsIdx !== -1) {
                    isCollectingRef.current = false;
                    setIsCollecting(false);
                    showToast('error', 'Please enter valid quantities for all consumables (press Enter to commit).');
                    setTimeout(() => { const el = document.getElementById(`consumed-qty-${invalidConsIdx}`) as HTMLInputElement | null; if (el) { el.focus(); el.select(); } }, 10);
                    return;
                }

                // Merge test requirements with any manually added consumables for this session
            const mergedMap: Record<string, number> = {};
            [...requirements, ...manual].forEach(d => { mergedMap[d.itemId] = (mergedMap[d.itemId] || 0) + (d.quantity || 0); });
            const mergedDeductions = Object.keys(mergedMap).map(k => ({ itemId: k, quantity: mergedMap[k] }));

            try {
                console.log('[PHLEB] single deduction requirements merged', { requirements, manual, mergedDeductions, sampleId: sample.id, visit: selectedVisit.orderId });
                await deductInventoryAndMarkSamples(mergedDeductions, [sample.id], auth.currentUser?.email || 'Phlebotomist', `${selectedVisit.orderId}|${sample.id}`);
                console.log('[PHLEB] single deduction completed for sample', sample.id, { mergedDeductions });
            } catch (invErr: any) {
                console.error('Inventory deduction failed for single sample (transactional):', invErr);
                showToast('error', `Failed to deduct inventory: ${invErr?.message || 'Unknown error'}. Collection aborted.`);
                return;
            } finally {
                isCollectingRef.current = false;
                setIsCollecting(false);
            }

            // Update local selectedVisit tests list so modal updates immediately
            const remaining = selectedVisit.tests.filter(t => t.id !== sample.id);
            if (remaining.length === 0) {
                setSelectedVisit(null);
                setSingleCollectMode(false);
            } else {
                setSelectedVisit({ orderId: selectedVisit.orderId, tests: remaining });
                setModalSelectedTestIdx(Math.min(modalSelectedTestIdx, remaining.length - 1));
            }

            showToast('success', 'Sample collected');
            // Refresh search to update the main list view
            setVisitQuery('');
            setVisitQueryInput('');
            // Keep focus on search input
            setTimeout(() => { searchInputRef.current?.focus(); }, 10);
        } catch (e) {
            console.error('Single collection failed:', e);
            showToast('error', 'Failed to collect sample');
        }
    };

    const handleConfirmCollection = async () => {
        if (!selectedVisit) return;

// Read committed consumables from DOM (fallback when state hasn't flushed yet)
            const manualFromDom = readCommittedConsumables();

            // Prepare deductions as itemId/quantity pairs
            const deductions = manualFromDom;

            // If the form had consumables but no deductions were constructed, abort — quantities were likely uncommitted
            if (consumedItems.length > 0 && deductions.length === 0) {
                showToast('error', 'Please add and commit consumable quantities before confirming collection.');
                // Focus first consumable quantity field
                setTimeout(() => { const el = document.getElementById('consumed-qty-0') as HTMLInputElement | null; if (el) { el.focus(); el.select(); } }, 10);
                return;
            }

        // If the form had consumables but no deductions were constructed, abort — quantities were likely uncommitted
        if (consumedItems.length > 0 && deductions.length === 0) {
            showToast('error', 'Please add and commit consumable quantities before confirming collection.');
            // Focus first consumable quantity field
            setTimeout(() => { const el = document.getElementById('consumed-qty-0') as HTMLInputElement | null; if (el) { el.focus(); el.select(); } }, 10);
            return;
        }

        if (isCollectingRef.current) {
            console.log('[PHLEB] Batch collection requested but another collection is in progress; ignoring.');
            return;
        }

        try {
            // Guard against duplicate submissions
            isCollectingRef.current = true;
            setIsCollecting(true);

            console.log('[PHLEB] Deductions prepared', deductions);

            // Run a single transactional call that deducts inventory and marks samples as collected atomically
            try {
                console.log('[PHLEB] Starting transactional deduction', { deductions, samples: selectedVisit.tests.map(t => t.id) });
                await deductInventoryAndMarkSamples(
                    deductions,
                    selectedVisit.tests.map(t => t.id),
                    auth.currentUser?.email || 'Phlebotomist',
                    `${selectedVisit.orderId}|${selectedVisit.tests.map(t => t.id).join(',')}`
                );
                console.log('[PHLEB] Transactional deduction completed');
            } catch (invError: any) {
                console.error('Inventory deduction failed (transactional):', invError);
                showToast('error', `Failed to deduct inventory: ${invError?.message || 'Unknown error'}. Collection aborted.`);
                return;
            }

            // Success
            setSelectedVisit(null);
            setConsumedItems([]);
            showToast('success', 'Collection confirmed');
            // Refresh search to reflect collected samples in main view
            setVisitQuery('');
            setVisitQueryInput('');
            setTimeout(() => { searchInputRef.current?.focus(); }, 10);
        } catch (e) {
            console.error('Collection failed:', e);
            alert('Failed to confirm collection: ' + (e instanceof Error ? e.message : String(e)));
        } finally {
            isCollectingRef.current = false;
            setIsCollecting(false);
        }
    };

    const renderCollectionModal = () => {
        if (!selectedVisit) return null;
        const visit = patientVisits.find(v => v.orderId === selectedVisit.orderId);
        if (!visit) return null;

        const filteredTests = visit.tests.filter(t => {
            const q = modalTestQuery.trim().toLowerCase();
            if (!q) return true;
            return (t.testName || '').toLowerCase().includes(q) || (t.sampleType || '').toLowerCase().includes(q);
        });

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
                            <div className="mb-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <h4 className="font-bold text-sm flex items-center gap-2" style={{ color: COLORS.CITRON }}>
                                        <TestTube className="w-4 h-4" /> Tests to Collect
                                    </h4>
                                    <div className="text-xs" style={{ color: COLORS.TIFFANY_BLUE }}>Showing {filteredTests.length} of {visit.tests.length}</div>
                                </div>
                                <input
                                    type="text"
                                    value={modalTestQuery}
                                    onChange={(e) => { setModalTestQuery(e.target.value); setModalSelectedTestIdx(0); }}
                                    placeholder="Search tests by name or sample type..."
                                    className="w-full p-2 rounded border text-sm"
                                    style={{ backgroundColor: COLORS.RICH_BLACK, color: COLORS.CITRON, borderColor: `${COLORS.PERSIAN_GREEN}20` }}
                                    aria-label="Search tests"
                                />
                            </div>
                            <div className="space-y-2">
                                {filteredTests.length ? filteredTests.map((test, idx) => (
                                    <div
                                        id={`visit-test-${patientVisits.indexOf(visit)}-${idx}`}
                                        data-visit-index={patientVisits.indexOf(visit)}
                                        data-test-index={idx}
                                        key={test.id}
                                        tabIndex={0}
                                        className={`collection-test-item flex items-center gap-3 p-3 rounded border ${modalSelectedTestIdx === idx && singleCollectMode ? 'ring-2 ring-offset-1 ring-indigo-600' : ''}`}
                                        style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, borderColor: `${COLORS.PERSIAN_GREEN}20` }}
                                        onClick={() => { setModalSelectedTestIdx(idx); setSingleCollectMode(true); }}
                                    >
                                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: `${COLORS.PERSIAN_GREEN}30`, color: COLORS.CITRON }}>{idx + 1}</span>
                                        <div className="flex-1">
                                            <p className="font-medium text-sm" style={{ color: COLORS.CITRON }}>{test.testName}</p>
                                            <p className="text-xs" style={{ color: COLORS.TIFFANY_BLUE }}>{test.sampleType}</p>
                                        </div>
                                    </div>
                                )) : <div className="text-sm italic" style={{ color: COLORS.TIFFANY_BLUE }}>No tests match this search.</div>}
                            </div>
                        </div>

                        {/* Consumables */}
                        <div>
                            <h4 className="font-bold text-sm mb-2 flex items-center gap-2" style={{ color: COLORS.CITRON }}>
                                <Package className="w-4 h-4" /> Total Consumables
                            </h4>
                            <div className="space-y-2 mb-4">
                                {consumedItems.map((item, idx) => (
                                    <div key={item.itemId || idx} className="flex items-center gap-2 p-2 rounded border" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, borderColor: `${COLORS.PERSIAN_GREEN}20` }}>
                                        <span className="flex-1 text-sm font-medium" style={{ color: COLORS.TIFFANY_BLUE }}>{item.itemName}</span>
                                        <input
                                            id={`consumed-qty-${idx}`}
                                            data-item-id={item.itemId}
                                            type="number"
                                            min={1}
                                            step={1}
                                            inputMode="numeric"
                                            className="w-20 p-1 border rounded text-right text-sm outline-none focus:ring-1 focus:ring-[#ee9b00]"
                                            style={{ backgroundColor: COLORS.RICH_BLACK, color: COLORS.CITRON, borderColor: `${COLORS.PERSIAN_GREEN}40` }}
                                            value={isNaN(item.quantity) ? '' : item.quantity}
                                            onFocus={() => { editingConsumedIdxRef.current = idx; console.log('[PHLEB] consumed focus set editingIdx', idx); suppressFocusUntilRef.current = 0; }}
                                            onChange={(e) => {
                                                const newItems = [...consumedItems];
                                                const raw = e.target.value;
                                                newItems[idx].quantity = raw === '' ? NaN : (parseFloat(raw) || NaN);
                                                setConsumedItems(newItems);
                                                console.log('[PHLEB] consumed input change', { idx, raw, parsed: newItems[idx].quantity, active: document.activeElement ? `${document.activeElement.tagName}#${(document.activeElement as any).id || ''}` : null });
                                            }}
                                            onKeyDown={(e) => {
                                                console.log('[PHLEB] consumed keydown', { idx, key: e.key, active: document.activeElement ? `${document.activeElement.tagName}#${(document.activeElement as any).id || ''}` : null });
                                                try { (e.nativeEvent as any).stopImmediatePropagation(); } catch (err) { /* ignore */ }
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    const el = e.target as HTMLInputElement;
                                                    const v = parseFloat(el.value);
                                                    const newItems = [...consumedItems];
                                                    if (!isFinite(v) || v <= 0) newItems[idx].quantity = 1; else newItems[idx].quantity = Math.max(1, Math.round(v));
                                                    setConsumedItems(newItems);
                                                    // Immediately prepare single-collect mode and focus the test synchronously so the next Enter will trigger collection
                                                    setSingleCollectMode(true);
                                                    const testEl = document.querySelector(`.collection-test-item[data-test-index="${modalSelectedTestIdx}"]`) as HTMLElement | null;
                                                    if (testEl) { testEl.focus(); }
                                                    return;
                                                }
                                                if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    return;
                                                }
                                                e.stopPropagation();
                                            }}
                                            onBlur={(e) => {
                                                console.log('[PHLEB] consumed blur', { idx, activeAfter: document.activeElement ? `${document.activeElement.tagName}#${(document.activeElement as any).id || ''}` : null });
                                                editingConsumedIdxRef.current = null;
                                                const v = parseFloat((e.target as HTMLInputElement).value);
                                                const newItems = [...consumedItems];
                                                if (!isFinite(v) || v <= 0) newItems[idx].quantity = 1; else newItems[idx].quantity = Math.max(1, Math.round(v));
                                                setConsumedItems(newItems);
                                            }}
                                        />
                                        <button onClick={() => setConsumedItems(consumedItems.filter((_, i) => i !== idx))} className="text-red-400 hover:bg-red-900/20 p-1 rounded"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                ))}
                                {consumedItems.length === 0 && <p className="text-xs italic" style={{ color: COLORS.TIFFANY_BLUE }}>No consumables required.</p>}
                            </div>
                            <div className="flex gap-2">
                                <select
                                    id="phleb-inv-select"
                                    className="flex-1 p-2 border rounded text-sm outline-none"
                                    style={{ backgroundColor: COLORS.RICH_BLACK, color: COLORS.CITRON, borderColor: `${COLORS.PERSIAN_GREEN}40` }}
                                    onKeyDown={(e) => {
                                        // Prevent native bubbling
                                        try { (e.nativeEvent as any).stopImmediatePropagation(); } catch (err) { }
                                        // Enter or Space should add the selected consumable. Defer slightly to let browser update selection from arrow keys.
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            // Short suppress to avoid modal Enter-handlers racing in
                                            suppressFocusUntilRef.current = Date.now() + 800;
                                            setTimeout(() => addSelectedConsumable(), 0);
                                        }
                                        // Prevent this from bubbling to global handlers
                                        e.stopPropagation();
                                    }}
                                    aria-label="Add consumable item"
                                >
                                    <option value="">Add Item...</option>
                                    {inventoryItems.map(i => {
                                        const sessionUsed = consumedItems.filter(c => c.itemId === i.id).reduce((s, c) => s + (c.quantity || 0), 0);
                                        const available = i.quantity - sessionUsed;
                                        const isOutOfStock = available <= 0;
                                        return (
                                            <option
                                                key={i.id}
                                                value={i.id}
                                                disabled={isOutOfStock}
                                                style={isOutOfStock ? { color: '#ef4444' } : {}}
                                            >
                                                {i.name} (Stock: {Math.max(0, available)}) {isOutOfStock ? 'âš ï¸ Out of Stock' : ''}
                                            </option>
                                        );
                                    })}
                                </select>
                                <button
                                    onClick={() => addSelectedConsumable()}
                                    className="px-3 py-2 rounded text-sm font-bold shadow-md hover:opacity-90 transition-opacity"
                                    style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, color: COLORS.CITRON }}
                                >
                                    Add
                                </button>
                            </div>

                            {/* Provide keyboard helpers inside the modal for selection and inventory navigation */}
                            <div className="text-xs italic mt-2" style={{ color: COLORS.TIFFANY_BLUE }}>
                                Tip: Use <strong>Arrow Up/Down</strong> to select tests, <strong>Enter</strong> to open selection and collect a focused test. Press <strong>Right</strong> to focus consumables select.
                            </div>

                            {/* Provide keyboard helpers inside the modal for selection and inventory navigation */}
                            <div className="text-xs italic mt-2" style={{ color: COLORS.TIFFANY_BLUE }}>
                                Tip: Use <strong>Arrow Up/Down</strong> to select tests, <strong>Enter</strong> to open selection and collect a focused test. Press <strong>Right</strong> to focus consumables select.
                            </div>
                        </div>
                    </div>

                    <div className="p-5 border-t flex justify-end gap-3 shrink-0" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, borderColor: `${COLORS.PERSIAN_GREEN}40` }}>
                        <button onClick={() => setSelectedVisit(null)} className="px-4 py-2 font-bold text-sm" style={{ color: COLORS.TIFFANY_BLUE }}>Cancel</button>
                        <button
                            onClick={handleConfirmCollection}
                            disabled={isCollecting || !(consumedItems.length === 0 || consumedItems.every(i => isFinite(i.quantity) && i.quantity > 0))}
                            className="text-white px-6 py-2 rounded-lg font-bold shadow-lg flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                            style={{ backgroundColor: COLORS.GAMBOGE, color: COLORS.RICH_BLACK }}
                        >
                            <QrCode className="w-4 h-4" /> {isCollecting ? 'Collecting...' : `Collect All (${visit.tests.length})`}
                        </button>
                        <button
                            onClick={handleConfirmSingleCollection}
                            disabled={!singleCollectMode || isCollecting}
                            className="text-white px-4 py-2 rounded-lg font-bold shadow-lg flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                            style={{ backgroundColor: singleCollectMode ? COLORS.PERSIAN_GREEN : '#444', color: COLORS.RICH_BLACK }}
                        >
                            {isCollecting ? 'Collecting...' : 'Collect Selected'}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    useEffect(() => {
        // Modal-level keyboard handling
        if (!selectedVisit) return;
        const onModalKey = (e: KeyboardEvent) => {
            const active = document.activeElement as HTMLElement | null;
            // Allow typing in inputs / selects (include SELECT) and let the native control handle arrows
            if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT' || active.isContentEditable)) return;

            const filtered = (selectedVisit?.tests || []).filter(t => {
                const q = modalTestQuery.trim().toLowerCase();
                if (!q) return true;
                return (t.testName || '').toLowerCase().includes(q) || (t.sampleType || '').toLowerCase().includes(q);
            });

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (filtered.length === 0) return;
                const next = Math.min(filtered.length - 1, modalSelectedTestIdx + 1);
                setModalSelectedTestIdx(next);
                setTimeout(() => {
                    const el = document.querySelector(`.collection-test-item[data-test-index="${next}"]`) as HTMLElement | null;
                    if (el) el.focus();
                }, 10);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (filtered.length === 0) return;
                const prev = Math.max(0, modalSelectedTestIdx - 1);
                setModalSelectedTestIdx(prev);
                setTimeout(() => {
                    const el = document.querySelector(`.collection-test-item[data-test-index="${prev}"]`) as HTMLElement | null;
                    if (el) el.focus();
                }, 10);
            } else if (e.key === 'ArrowRight') {
                // Focus inventory select
                const sel = document.getElementById('phleb-inv-select') as HTMLSelectElement | null;
                if (sel) { e.preventDefault(); sel.focus(); }
            } else if (e.key === 'Enter') {
                // If inventory select is focused, add selected item
                const sel = document.getElementById('phleb-inv-select') as HTMLSelectElement | null;
                if (document.activeElement === sel) {
                    e.preventDefault();
                    addSelectedConsumable();
                    return;
                }

                // Prevent immediate Enter (the one that opened the modal) from collecting immediately
                const justOpened = Date.now() - (modalOpenedAtRef.current || 0) < 350;
                const blocked = Date.now() - (modalFocusBlockedRef.current || 0) < 600 || Date.now() < (suppressFocusUntilRef.current || 0);
                if (justOpened || blocked) {
                    console.log('🧭 [PHLEB] Ignoring Enter due to justOpened/block/suppress (justOpened=' + justOpened + ', blocked=' + blocked + ', suppressUntil=' + suppressFocusUntilRef.current + ')');
                    return;
                }

                e.preventDefault();
                if (singleCollectMode) {
                    if (isCollectingRef.current) {
                        console.log('[PHLEB] Ignoring Enter - collection already in progress');
                        return;
                    }
                    // Pre-reserve collecting guard to avoid double submissions from very fast repeated Enter presses
                    isCollectingRef.current = true;
                    setIsCollecting(true);
                    // Call the handler (it will clear the guard in its finally)
                    handleConfirmSingleCollection();
                }
            }
        };
        window.addEventListener('keydown', onModalKey);

        // Focus tracing: log focus changes to help debug unexpected shifts
        const onFocusIn = (ev: FocusEvent) => {
            const a = document.activeElement as HTMLElement | null;
            if (!a) return;
            const desc = `${a.tagName}${a.id ? '#'+a.id : ''}${a.className ? '.'+a.className.split(' ').join('.') : ''}`;
            console.log('[PHLEB] focusin ->', desc, 'time=', Date.now());
        };
        window.addEventListener('focusin', onFocusIn);

        // When modal opens, ensure focus is moved into it (but skip if we recently blocked focus for consumable entry)
        setTimeout(() => {
            if (Date.now() - (modalFocusBlockedRef.current || 0) < 600) {
                console.log('🧭 [PHLEB] Skipping initial modal focus due to focus block');
                return;
            }
            const el = document.querySelector(`.collection-test-item[data-test-index="${modalSelectedTestIdx}"]`) as HTMLElement | null;
            if (el) el.focus();
        }, 50);

        return () => { window.removeEventListener('keydown', onModalKey); window.removeEventListener('focusin', onFocusIn); };
    }, [selectedVisit, modalSelectedTestIdx, singleCollectMode, modalTestQuery]); // NOTE: deliberately omit `consumedItems`/`inventoryItems` to avoid re-running focus logic while typing into quantity inputs (prevents accidental blur)

    return (
        <div className="p-6 space-y-6 h-full flex flex-col">
            {renderCollectionModal()}

            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    {onBack && <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-colors"><ArrowLeft className="w-5 h-5" style={{ color: COLORS.GAMBOGE }} /></button>}
                    <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: COLORS.CITRON }}><Syringe className="w-6 h-6" style={{ color: COLORS.GAMBOGE }} /> Sample Collection</h2>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl shadow-sm" style={{ backgroundColor: '#FFFFFF', border: `1px solid ${COLORS.PERSIAN_GREEN}20` }}>
                        <Search className="w-4 h-4" style={{ color: COLORS.TIFFANY_BLUE }} />
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={visitQueryInput}
                            onChange={(e) => setVisitQueryInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    setVisitQuery(visitQueryInput);
                                    lastSearchAppliedRef.current = Date.now();
                                    // keep focus on input after applying
                                    setTimeout(() => { searchInputRef.current?.focus(); }, 10);
                                } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    // Move focus to the first visit/test in filtered results
                                    if (filteredPatientVisits.length > 0) {
                                        focusTest(0, 0);
                                    }
                                }
                            }}
                            placeholder="Search patients or tests... (press Enter to apply)"
                            className="px-3 py-2 w-[340px] text-sm rounded outline-none"
                            style={{ backgroundColor: 'transparent', color: COLORS.CITRON, border: 'none' }}
                            aria-label="Search patients or tests"
                        />
                        {(visitQueryInput || visitQuery) && <button onClick={() => { setVisitQueryInput(''); setVisitQuery(''); searchInputRef.current?.focus(); }} className="px-3 py-1 text-sm rounded border ml-2" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, color: COLORS.TIFFANY_BLUE }}>Clear</button>}
                    </div>

                    <div className="px-3 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: `${COLORS.GAMBOGE}20`, color: COLORS.GAMBOGE }}>{filteredPatientVisits.length} Patient(s) | {samples.length} Sample(s)</div>
                </div>
            </div> 

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="space-y-3">
                    {filteredPatientVisits.map((visit, idx) => (
                        <div key={visit.orderId} className="rounded-xl border shadow-sm transition-all overflow-hidden" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, borderColor: `${COLORS.PERSIAN_GREEN}40` }}>
                            {/* Visit Header - Clickable */}
                            <div className="p-4 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => {
                                            const newExpanded = expandedVisitId === visit.orderId ? null : visit.orderId;
                                            setExpandedVisitId(newExpanded);
                                            const vIdx = idx;
                                            setKeyboardVisitIdx(vIdx >= 0 ? vIdx : 0);
                                            setKeyboardTestIdx(0);
                                            setTimeout(() => {
                                                const el = document.getElementById(`visit-list-test-${vIdx}-0`) as HTMLElement | null;
                                                if (el) el.focus();
                                            }, 80);
                                        }}>
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
                                    {visit.tests.map((test, tIdx) => (
                                        <div
                                            id={`visit-list-test-${idx}-${tIdx}`}
                                            data-visit-index={idx}
                                            data-test-index={tIdx}
                                            key={test.id}
                                            tabIndex={0}
                                            onKeyDown={(e) => {
                                                // Prevent global handler from double-processing this event
                                                e.stopPropagation();
                                                // If modal is open, main list should not handle navigation
                                                if (selectedVisit) { return; }

                                                if (e.key === 'Enter') { e.preventDefault(); openCollectionForTest(visit, tIdx); }
                                                else if (e.key === 'ArrowDown') { e.preventDefault(); moveNextTest(); }
                                                else if (e.key === 'ArrowUp') { e.preventDefault(); movePrevTest(); }
                                            }}
                                            className="flex items-center gap-3 p-2 rounded outline-none focus:ring-2 focus:ring-indigo-600"
                                            style={{ backgroundColor: COLORS.MIDNIGHT_GREEN }}
                                        >
                                            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: `${COLORS.PERSIAN_GREEN}20`, color: COLORS.TIFFANY_BLUE }}>{tIdx + 1}</span>
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
    const [batchResults, setBatchResults] = useState<Record<string, Record<string, any>>>({});
    // Consumables State
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [consumedItems, setConsumedItems] = useState<{ itemId: string; itemName: string; quantity: number }[]>([]);

    // Lab Processing modal keyboard/search state and helpers
    const [procModalSelectedTestIdx, setProcModalSelectedTestIdx] = useState<number>(0);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const isSubmittingRef = useRef<boolean>(false);
    const procReadyToSubmitRef = useRef<boolean>(false);

    // Local search/navigation state for Lab Processing (keyboard-first search)
    const [procVisitQuery, setProcVisitQuery] = useState<string>('');
    const [procVisitQueryInput, setProcVisitQueryInput] = useState<string>('');
    const procSearchInputRef = React.useRef<HTMLInputElement | null>(null);
    const procLastSearchAppliedRef = React.useRef<number>(0);
    const [procKeyboardVisitIdx, setProcKeyboardVisitIdx] = useState<number>(0);

    // filteredProcVisits & keyboard helpers are declared after patientVisits (to ensure data is available)


    const addSelectedConsumableProc = () => {
        const sel = document.getElementById('tech-inv-select') as HTMLSelectElement | null;
        if (!sel) return;
        const item = inventoryItems.find(i => i.id === sel.value);
        if (!item) return;
        const sessionUsed = consumedItems.filter(c => c.itemId === item.id).reduce((s, c) => s + (c.quantity || 0), 0);
        if (item.quantity - sessionUsed <= 0) {
            showToast('error', `Insufficient stock for ${item.name}`);
            return;
        }
        const idxToFocus = consumedItems.length;
        // Add as draft (NaN) so user types and commits
        setConsumedItems(prev => [...prev, { itemId: item.id, itemName: item.name, quantity: NaN as any }]);
        // Focus new input next tick
        requestAnimationFrame(() => {
            const el = document.getElementById(`proc-consumed-qty-${idxToFocus}`) as HTMLInputElement | null;
            if (el) { el.focus(); el.select(); }
        });
        sel.value = '';
        showToast('success', `${item.name} added`);
    };

    const readCommittedConsumablesProc = () => {
        const result: { itemId: string; quantity: number }[] = [];
        const inputs = Array.from(document.querySelectorAll('input[id^="proc-consumed-qty-"]')) as HTMLInputElement[];
        for (const el of inputs) {
            const itemId = (el.dataset && el.dataset.itemId) || (() => {
                const m = el.id.match(/^proc-consumed-qty-(\d+)$/);
                if (m) {
                    const idx = parseInt(m[1], 10);
                    return consumedItems[idx]?.itemId || '';
                }
                return '';
            })();
            const raw = el.value;
            const v = parseFloat(raw);
            if (itemId && isFinite(v) && v > 0) {
                result.push({ itemId, quantity: Math.max(1, Math.round(v)) });
            }
        }
        console.log('[LAB] readCommittedConsumablesProc', { fromState: consumedItems, inputsFound: inputs.map(i => ({ id: i.id, value: i.value, dataset: { ...i.dataset } })), read: result });
        return result;
    };

    // Modal-level keyboard handling for Lab Processing results modal
    useEffect(() => {
        if (!selectedVisit) return;
        const onModalKey = (e: KeyboardEvent) => {
            const active = document.activeElement as HTMLElement | null;
            if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT' || active.isContentEditable)) return;

            const filtered = selectedVisit.tests || [];

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (filtered.length === 0) return;
                const next = Math.min(filtered.length - 1, procModalSelectedTestIdx + 1);
                setProcModalSelectedTestIdx(next);
                setTimeout(() => { const el = document.querySelector(`.batch-result-sample[data-test-index="${next}"]`) as HTMLElement | null; if (el) el.focus(); }, 10);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (filtered.length === 0) return;
                const prev = Math.max(0, procModalSelectedTestIdx - 1);
                setProcModalSelectedTestIdx(prev);
                setTimeout(() => { const el = document.querySelector(`.batch-result-sample[data-test-index="${prev}"]`) as HTMLElement | null; if (el) el.focus(); }, 10);
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                const sel = document.getElementById('tech-inv-select') as HTMLElement | null; if (sel) sel.focus();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                // Focus first input of selected sample
                const el = document.querySelector(`.batch-result-sample[data-test-index="${procModalSelectedTestIdx}"] input`) as HTMLElement | null;
                if (el) el.focus();
            }
        };
        window.addEventListener('keydown', onModalKey);
        return () => window.removeEventListener('keydown', onModalKey);
    }, [selectedVisit, procModalSelectedTestIdx]);

    const { showToast, showAlert, showConfirm } = useDialog();

    useEffect(() => {
        const unsubInventory = db.collection('inventory_items').onSnapshot(s => setInventoryItems(s.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem))));

        // Restore independent Tests listener to ensure definitions are loaded
        const unsubTests = db.collection('tests').onSnapshot(s => {
            const map: Record<string, Test> = {};
            s.docs.forEach(d => { map[d.id] = { id: d.id, ...d.data() } as Test; });
            setTestsMap(map);
        });

        const unsubSamples = db.collection('samples').where('status', 'in', ['analyzing', 'collected']).onSnapshot(snap => {
            setSamples(snap.docs.map(d => ({ id: d.id, ...d.data() } as Sample)));
        });

        return () => { unsubSamples(); unsubInventory(); unsubTests(); };
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
            const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
            const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
            return timeA - timeB;
        });
    }, [samples]);

    // Lab Processing local filtered visits + keyboard helpers
    const filteredProcVisits = useMemo(() => {
        const q = procVisitQuery.trim().toLowerCase();
        if (!q) return patientVisits;
        return patientVisits.filter(v => {
            if ((v.patientName || '').toLowerCase().includes(q)) return true;
            if ((v.orderId || '').toLowerCase().includes(q)) return true;
            for (const t of v.tests || []) {
                if ((t.testName || '').toLowerCase().includes(q)) return true;
                if ((t.sampleLabelId || '').toLowerCase().includes(q)) return true;
            }
            return false;
        });
    }, [patientVisits, procVisitQuery]);

    useEffect(() => {
        if (filteredProcVisits.length > 0) {
            setProcKeyboardVisitIdx(0);
            setExpandedVisitId(filteredProcVisits[0].orderId);
        }
    }, [filteredProcVisits]);

    // Autofocus the Lab Processing search when module loads (mirror collection behavior)
    useEffect(() => {
        setTimeout(() => { procSearchInputRef.current?.focus(); }, 50);
    }, []);

    const focusProcVisit = (vIdx: number) => {
        setProcKeyboardVisitIdx(vIdx);
        const visit = filteredProcVisits[vIdx];
        if (visit) setExpandedVisitId(visit.orderId);
        setTimeout(() => {
            const el = document.querySelector(`[data-proc-visit-index="${vIdx}"]`) as HTMLElement | null;
            if (el) el.focus();
        }, 80);
    };

    const moveNextProcVisit = () => { if (filteredProcVisits.length === 0) return; const next = Math.min(filteredProcVisits.length - 1, procKeyboardVisitIdx + 1); focusProcVisit(next); };
    const movePrevProcVisit = () => { if (filteredProcVisits.length === 0) return; const prev = Math.max(0, procKeyboardVisitIdx - 1); focusProcVisit(prev); };

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
        setConsumedItems([]); // Reset consumables

        // Initialize results for all tests in the visit
        const initialBatch: Record<string, any> = {};
        visit.tests.forEach(sample => {
            const testDef = testsMap[sample.testId];
            if (sample.results) {
                initialBatch[sample.id] = sample.results;
            } else if (testDef && testDef.parameters) {
                const initialForm: Record<string, any> = {};
                testDef.parameters.forEach(p => {
                    initialForm[p.name] = { value: '', flag: 'N', unit: p.unit };
                });
                initialBatch[sample.id] = initialForm;
            } else {
                initialBatch[sample.id] = {};
            }
        });
        setBatchResults(initialBatch);
    };

    const handleResultChange = (sampleId: string, paramName: string, value: string, param: TestParameter) => {
        if (!selectedVisit) return;
        const currentSample = selectedVisit.tests.find(s => s.id === sampleId);
        if (!currentSample) return;

        let flag: 'N' | 'L' | 'H' | 'CL' | 'CH' = 'N';
        if (param.type === 'numeric' && value !== '') {
            const numVal = parseFloat(value);
            flag = getFlag(numVal, param.refRanges, currentSample.patientGender || 'male', currentSample.patientAge || 30);
        }

        setBatchResults(prev => ({
            ...prev,
            [sampleId]: {
                ...(prev[sampleId] || {}),
                [paramName]: { value, flag, unit: param.unit }
            }
        }));
    };

    const saveBatchResults = async (asSubmit = false) => {
        if (!selectedVisit) return false;

        const resultsToUpdate: any[] = [];
        const criticalsDetected: string[] = [];
        const safetyViolations: string[] = [];

        selectedVisit.tests.forEach(sample => {
            const results = batchResults[sample.id];
            const testDef = testsMap[sample.testId];
            if (!results || !testDef) return;

            const currentSampleCriticals: string[] = [];

            testDef.parameters.forEach(param => {
                const res = results[param.name];
                if (res && res.value && param.type === 'numeric') {
                    if (res.flag === 'CL' || res.flag === 'CH') {
                        currentSampleCriticals.push(`${param.name}: ${res.value}`);
                        criticalsDetected.push(`${sample.testName} - ${param.name} (${res.value})`);
                    }

                    const numVal = parseFloat(res.value);
                    let range = param.refRanges.find(r => r.type === 'age' && sample.patientAge >= (r.ageMin || 0) && sample.patientAge <= (r.ageMax || 150));
                    if (!range) range = param.refRanges.find(r => r.type === 'gender' && r.gender === sample.patientGender);
                    if (!range) range = param.refRanges.find(r => r.type === 'general');

                    if (range && ((range.safeMin !== undefined && numVal < range.safeMin) || (range.safeMax !== undefined && numVal > range.safeMax))) {
                        safetyViolations.push(`${sample.testName}: ${param.name} (${numVal} outside safe ${range.safeMin}-${range.safeMax})`);
                    }
                }
            });

            resultsToUpdate.push({
                id: sample.id,
                results,
                isCritical: currentSampleCriticals.length > 0
            });
        });

        if (safetyViolations.length > 0 && asSubmit) {
            const confirmed = await showConfirm(
                `Safety violations detected:\n${safetyViolations.join('\n')}\n\nProceed with submission?`,
                { title: 'Safety Warning', confirmText: 'Confirm & Submit', type: 'danger' }
            );
            if (!confirmed) return false;
        }

        if (criticalsDetected.length > 0) {
            showAlert('warning', `CRITICAL VALUES DETECTED:\n${criticalsDetected.join('\n')}\n\nPlease ensure immediate notification.`, 'Critical Alert');
        }

        try {
            const batch = db.batch();
            resultsToUpdate.forEach(item => {
                const ref = db.collection('samples').doc(item.id);
                batch.update(ref, {
                    results: item.results,
                    isCritical: item.isCritical,
                    status: asSubmit ? 'review' : 'analyzing',
                    analyzedAt: firebase.firestore.Timestamp.now(),
                    ...(asSubmit ? { submittedForReviewAt: firebase.firestore.Timestamp.now() } : {})
                });
            });
            await batch.commit();

// Record Inventory Usage with FIFO (transactional, aggregated)
                if (asSubmit) {
                    try {
                        // Read manual consumables from DOM to ensure committed quantities
                        console.log('[LAB] submit attempt, consumedItems state', { consumedItemsCount: consumedItems.length, consumedItems });
                        console.log('[LAB] submit attempt, DOM consumable inputs found', document.querySelectorAll('input[id^="proc-consumed-qty-"]').length);
                        const manual = readCommittedConsumablesProc();

                        // If form had consumables but DOM-read returned none, abort and prompt user
                        if (consumedItems.length > 0 && manual.length === 0) {
                            showToast('error', 'Please add and commit consumable quantities before submitting results.');
                            setTimeout(() => { const el = document.getElementById('proc-consumed-qty-0') as HTMLInputElement | null; if (el) { el.focus(); el.select(); } }, 10);
                            return false;
                        }

                        // Aggregate auto requirements from test definitions
                        const autoReqs: { itemId: string; quantity: number }[] = [];
                        for (const sample of selectedVisit.tests) {
                            const testDef = testsMap[sample.testId];
                            if (testDef && testDef.inventoryRequirements) {
                                for (const req of testDef.inventoryRequirements) {
                                    if (req.itemId && req.quantity > 0) {
                                        autoReqs.push({ itemId: req.itemId, quantity: req.quantity });
                                    }
                                }
                            }
                        }

                        // Merge manual + auto
                        const mergedMap: Record<string, number> = {};
                        [...autoReqs, ...manual].forEach(d => { mergedMap[d.itemId] = (mergedMap[d.itemId] || 0) + (d.quantity || 0); });
                        const mergedDeductions = Object.keys(mergedMap).map(k => ({ itemId: k, quantity: mergedMap[k] }));

                        console.log('[LAB] aggregated deductions', { manual, autoReqs, mergedDeductions, visit: selectedVisit.orderId });

                        if (mergedDeductions.length > 0) {
                            // Use the transactional helper to deduct inventory; do NOT mark samples as collected (we already set status to 'review')
                            await deductInventoryAndMarkSamples(
                                mergedDeductions,
                                selectedVisit.tests.map(t => t.id),
                                auth.currentUser?.email || 'Lab Tech',
                                `${selectedVisit.orderId}|RESULTS`,
                                false /* markSamplesAsCollected */
                            );
                        }
                    } catch (invError) {
                        console.error('Inventory deduction failed (aggregated transactional):', invError);
                        showToast('warning', 'Results submitted but inventory deduction failed. Please review inventory.');
                }
            }

            showToast('success', asSubmit ? 'Batch results submitted for review!' : 'Progress saved successfully.');
            if (asSubmit) {
                setSelectedVisit(null);
                // Clear proc search like collection behavior and focus it
                setProcVisitQuery('');
                setProcVisitQueryInput('');
                setTimeout(() => { procSearchInputRef.current?.focus(); }, 10);
            }
            return true;
        } catch (e) {
            console.error('Batch save failed:', e);
            showAlert('error', 'Failed to save results.');
            return false;
        }
    };

    const renderBatchResultsModal = () => {
        if (!selectedVisit) return null;

        return (
            <div className="fixed inset-0 bg-black/80 z-[1001] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedVisit(null)}>
                <div className="rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[95vh]" style={{ backgroundColor: COLORS.RICH_BLACK, border: `1px solid ${COLORS.PERSIAN_GREEN}40` }} onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="p-5 border-b flex justify-between items-center shrink-0" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, borderColor: `${COLORS.PERSIAN_GREEN}40` }}>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold" style={{ backgroundColor: `${COLORS.PERSIAN_GREEN}20`, color: COLORS.TIFFANY_BLUE }}>
                                {selectedVisit.tests[0].patientName.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <h3 className="font-bold text-lg" style={{ color: COLORS.CITRON }}>Patient Results Entry</h3>
                                <p className="text-sm" style={{ color: COLORS.TIFFANY_BLUE }}>{selectedVisit.tests[0].patientName} • {selectedVisit.tests.length} Test(s)</p>
                            </div>
                        </div>


                        <button onClick={() => setSelectedVisit(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-5 h-5" style={{ color: COLORS.TIFFANY_BLUE }} /></button>
                    </div>

                    {/* Scrollable Content */}
                    <div className="p-6 overflow-y-auto flex-1 space-y-8 custom-scrollbar">
                        {(() => {
                            const filtered = selectedVisit.tests;
                            return filtered.map((sample, idx) => {
                                const testDef = testsMap[sample.testId];
                                if (!testDef) return null;
                                const results = batchResults[sample.id] || {};

                                return (
                                    <div key={sample.id} tabIndex={0} className="rounded-xl border overflow-hidden batch-result-sample" data-test-index={idx} onFocus={() => { setProcModalSelectedTestIdx(idx); procReadyToSubmitRef.current = false; }} onKeyDown={(e) => {
                                        try { (e.nativeEvent as any).stopImmediatePropagation(); } catch (err) {}

                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            // If user has just committed a consumable and pressed Enter, a follow-up Enter should trigger submit
                                            if (procReadyToSubmitRef.current) {
                                                const btn = document.getElementById('proc-submit-btn') as HTMLButtonElement | null;
                                                if (btn) { btn.click(); }
                                                procReadyToSubmitRef.current = false;
                                            } else {
                                                const el = (e.currentTarget as HTMLElement).querySelector('input') as HTMLElement | null;
                                                if (el) el.focus();
                                                procReadyToSubmitRef.current = true;
                                                setTimeout(() => { procReadyToSubmitRef.current = false; }, 1500);
                                            }
                                        } else if (e.key === 'ArrowDown') {
                                            e.preventDefault();
                                            const all = Array.from(document.querySelectorAll('.batch-result-sample')) as HTMLElement[];
                                            const i = parseInt(((e.currentTarget as HTMLElement).dataset['testIndex'] || '0'), 10);
                                            if (!isNaN(i) && i >= 0 && i < all.length - 1) { all[i+1].focus(); setProcModalSelectedTestIdx(i+1); }
                                        } else if (e.key === 'ArrowUp') {
                                            e.preventDefault();
                                            const all = Array.from(document.querySelectorAll('.batch-result-sample')) as HTMLElement[];
                                            const i = parseInt(((e.currentTarget as HTMLElement).dataset['testIndex'] || '0'), 10);
                                            if (!isNaN(i) && i > 0) { all[i-1].focus(); setProcModalSelectedTestIdx(i-1); }
                                        }
                                    }} style={{ backgroundColor: `${COLORS.MIDNIGHT_GREEN}40`, borderColor: `${COLORS.PERSIAN_GREEN}20` }}>
                                        <div className="p-4 flex items-center justify-between" style={{ backgroundColor: `${COLORS.PERSIAN_GREEN}10` }}>
                                            <div className="flex items-center gap-3">
                                                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: COLORS.PERSIAN_GREEN, color: COLORS.RICH_BLACK }}>{idx + 1}</span>
                                                <h4 className="font-bold text-base" style={{ color: COLORS.CITRON }}>{sample.testName}</h4>
                                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold opacity-70 border" style={{ color: COLORS.TIFFANY_BLUE, borderColor: `${COLORS.TIFFANY_BLUE}40` }}>{sample.sampleLabelId}</span>
                                            </div>
                                            <span className="text-xs font-medium" style={{ color: COLORS.TIFFANY_BLUE }}>{sample.sampleType}</span>
                                        </div>

                                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {testDef.parameters && testDef.parameters.map(param => {
                                                const current = results[param.name] || { value: '', flag: 'N', unit: param.unit };
                                                const flagColors = { N: 'opacity-40', L: 'text-yellow-500', H: 'text-yellow-500', CL: 'text-red-600', CH: 'text-red-600' };
                                                const flagLabels = { N: '', L: 'LOW', H: 'HIGH', CL: 'CRIT LOW', CH: 'CRIT HIGH' };

                                                return (
                                                    <div key={param.name} className="p-3 rounded-lg border transition-all" style={{ backgroundColor: COLORS.RICH_BLACK, borderColor: `${COLORS.PERSIAN_GREEN}20` }}>
                                                        <div className="flex justify-between items-start mb-1.5">
                                                            <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: COLORS.TIFFANY_BLUE }}>{param.name}</label>
                                                            {current.value && <span className={`text-[9px] font-black ${flagColors[current.flag as keyof typeof flagColors]}`}>{flagLabels[current.flag as keyof typeof flagLabels]}</span>}
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type={param.type === 'numeric' ? 'number' : 'text'}
                                                                step="any"
                                                                className="flex-1 bg-transparent border-b outline-none text-sm py-1 font-medium transition-colors focus:border-[#ee9b00]"
                                                                style={{ borderBottomColor: `${COLORS.PERSIAN_GREEN}40`, color: COLORS.CITRON }}
                                                                value={current.value}
                                                                onChange={e => handleResultChange(sample.id, param.name, e.target.value, param)}
                                                                placeholder="..."
                                                            />
                                                            <span className="text-[10px] opacity-50" style={{ color: COLORS.TIFFANY_BLUE }}>{param.unit}</span>
                                                        </div>

                                                        {param.type === 'numeric' && (
                                                            <div className="mt-2 text-[9px] flex gap-1.5 opacity-40 hover:opacity-100 transition-opacity" style={{ color: COLORS.TIFFANY_BLUE }}>
                                                                {param.refRanges.map((r, rIdx) => (
                                                                    <span key={rIdx}>{r.type.substring(0, 1)}: {r.min}-{r.max}</span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>



                    {/* Consumables Section */}
                    <div className="p-6 border-t border-b" style={{ backgroundColor: `${COLORS.RICH_BLACK}30`, borderColor: `${COLORS.PERSIAN_GREEN}20` }}>
                        <h4 className="font-bold text-sm mb-3 flex items-center gap-2" style={{ color: COLORS.CITRON }}>
                            <Package className="w-4 h-4" /> Total Consumables
                        </h4>
                        <div className="space-y-2 mb-4">
                            {consumedItems.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-2 p-2 rounded border" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, borderColor: `${COLORS.PERSIAN_GREEN}20` }}>
                                    <span className="flex-1 text-sm font-medium" style={{ color: COLORS.TIFFANY_BLUE }}>{item.itemName}</span>
                                    <input
                                        id={`proc-consumed-qty-${idx}`}
                                        data-item-id={item.itemId}
                                        type="number"
                                        min={1}
                                        step={1}
                                        inputMode="numeric"
                                        className="w-20 p-1 border rounded text-right text-sm outline-none focus:ring-1 focus:ring-[#ee9b00]"
                                        style={{ backgroundColor: COLORS.RICH_BLACK, color: COLORS.CITRON, borderColor: `${COLORS.PERSIAN_GREEN}40` }}
                                        value={isNaN(item.quantity) ? '' : item.quantity}
                                        onFocus={() => { console.log('[LAB] proc consumed focus set editingIdx', idx); }}
                                        onChange={(e) => {
                                            const newItems = [...consumedItems];
                                            const raw = e.target.value;
                                            newItems[idx].quantity = raw === '' ? NaN : (parseFloat(raw) || NaN);
                                            setConsumedItems(newItems);
                                            console.log('[LAB] proc consumed input change', { idx, raw, parsed: newItems[idx].quantity, active: document.activeElement ? `${document.activeElement.tagName}#${(document.activeElement as any).id || ''}` : null });
                                        }}
                                        onKeyDown={(e) => {
                                            console.log('[LAB] proc consumed keydown', { idx, key: e.key });
                                            try { (e.nativeEvent as any).stopImmediatePropagation(); } catch (err) {}
                                            if (e.key === 'Enter') {
                                                e.preventDefault(); e.stopPropagation();
                                                const el = e.target as HTMLInputElement; const v = parseFloat(el.value);
                                                const newItems = [...consumedItems];
                                                if (!isFinite(v) || v <= 0) newItems[idx].quantity = 1; else newItems[idx].quantity = Math.max(1, Math.round(v));
                                                setConsumedItems(newItems);
                                                // Focus first input of selected sample and mark ready-to-submit so a follow-up Enter will submit
                                                setTimeout(() => {
                                                    const testEl = document.querySelector(`.batch-result-sample[data-test-index="${procModalSelectedTestIdx}"] input`) as HTMLElement | null;
                                                    if (testEl) testEl.focus();
                                                    procReadyToSubmitRef.current = true;
                                                    setTimeout(() => { procReadyToSubmitRef.current = false; }, 1500);
                                                }, 10);
                                                return;
                                            }
                                            if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
                                                e.preventDefault(); e.stopPropagation(); return;
                                            }
                                            e.stopPropagation();
                                        }}
                                        onBlur={(e) => {
                                            console.log('[LAB] proc consumed blur', { idx, activeAfter: document.activeElement ? `${document.activeElement.tagName}#${(document.activeElement as any).id || ''}` : null });
                                            const v = parseFloat((e.target as HTMLInputElement).value);
                                            const newItems = [...consumedItems];
                                            if (!isFinite(v) || v <= 0) newItems[idx].quantity = 1; else newItems[idx].quantity = Math.max(1, Math.round(v));
                                            setConsumedItems(newItems);
                                        }}
                                    />
                                    <button onClick={() => setConsumedItems(consumedItems.filter((_, i) => i !== idx))} className="text-red-400 hover:bg-red-900/20 p-1 rounded"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            ))}
                            {consumedItems.length === 0 && <p className="text-xs italic" style={{ color: COLORS.TIFFANY_BLUE }}>No additional consumables recorded.</p>}
                        </div>
                        <div className="flex gap-2">
                            <select id="tech-inv-select" className="flex-1 p-2 border rounded text-sm outline-none" style={{ backgroundColor: COLORS.RICH_BLACK, color: COLORS.CITRON, borderColor: `${COLORS.PERSIAN_GREEN}40` }}>
                                <option value="">Add Item...</option>
                                {inventoryItems.map(i => {
                                    const sessionUsed = consumedItems.filter(c => c.itemId === i.id).reduce((s, c) => s + (c.quantity || 0), 0);
                                    const available = i.quantity - sessionUsed;
                                    const isOutOfStock = available <= 0;
                                    return (
                                        <option
                                            key={i.id}
                                            value={i.id}
                                            disabled={isOutOfStock}
                                            style={isOutOfStock ? { color: '#ef4444' } : {}}
                                        >
                                            {i.name} (Stock: {Math.max(0, available)}) {isOutOfStock ? 'âš ï¸  Out of Stock' : ''}
                                        </option>
                                    );
                                })}
                            </select>
                            <button
                                onClick={() => addSelectedConsumableProc()}
                                className="px-3 py-2 rounded text-sm font-bold shadow-md hover:opacity-90 transition-opacity"
                                style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, color: COLORS.CITRON }}
                            >
                                Add
                            </button>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-5 flex justify-between items-center shrink-0" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, borderColor: `${COLORS.PERSIAN_GREEN}40` }}>
                        <div className="text-xs" style={{ color: COLORS.TIFFANY_BLUE }}>
                            All changes are locally buffered until saved.
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => saveBatchResults(false)} className="px-5 py-2 rounded-lg font-bold text-sm border hover:bg-white/5 transition-all" style={{ borderColor: `${COLORS.PERSIAN_GREEN}40`, color: COLORS.TIFFANY_BLUE }}>
                                <Save className="w-4 h-4 inline mr-2" /> Save Progress
                            </button>
                            <button id="proc-submit-btn" onClick={() => saveBatchResults(true)} className="px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:opacity-90 shadow-lg transition-all" style={{ backgroundColor: COLORS.SUCCESS, color: 'white' }}>
                                <CheckCircle2 className="w-4 h-4" /> Submit All for Review
                            </button>
                        </div>
                    </div>
                </div>
            </div >
        );
    };

    return (
        <div className="p-6 space-y-6 h-full flex flex-col">
            {renderBatchResultsModal()}

            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    {onBack && <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-colors"><ArrowLeft className="w-5 h-5" style={{ color: COLORS.GAMBOGE }} /></button>}
                    <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: COLORS.CITRON }}><Microscope className="w-6 h-6" style={{ color: COLORS.GAMBOGE }} /> Lab Processing</h2>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl shadow-sm" style={{ backgroundColor: '#FFFFFF', border: `1px solid ${COLORS.PERSIAN_GREEN}20` }}>
                        <Search className="w-4 h-4" style={{ color: COLORS.TIFFANY_BLUE }} />
                        <input
                            ref={procSearchInputRef}
                            type="text"
                            value={procVisitQueryInput}
                            onChange={(e) => setProcVisitQueryInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    // Apply the search only (do not auto-open the dialog) — mirror collection behavior
                                    e.preventDefault();
                                    setProcVisitQuery(procVisitQueryInput);
                                    procLastSearchAppliedRef.current = Date.now();
                                    // keep focus on input after applying
                                    setTimeout(() => { procSearchInputRef.current?.focus(); }, 10);
                                    return;
                                } else if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    if (filteredProcVisits.length === 0) return;
                                    const firstTest = document.querySelector(`[data-proc-visit-index="0"] .proc-test-item[data-test-index="0"]`) as HTMLElement | null;
                                    if (firstTest) { firstTest.focus(); setProcKeyboardVisitIdx(0); return; }
                                    focusProcVisit(0);
                                } else if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    if (filteredProcVisits.length === 0) return;
                                    const last = Math.max(0, filteredProcVisits.length - 1);
                                    const visit = filteredProcVisits[last];
                                    const lastTestIdx = (visit && visit.tests) ? visit.tests.length - 1 : -1;
                                    if (lastTestIdx >= 0) {
                                        const lastTest = document.querySelector(`[data-proc-visit-index="${last}"] .proc-test-item[data-test-index="${lastTestIdx}"]`) as HTMLElement | null;
                                        if (lastTest) { lastTest.focus(); setProcKeyboardVisitIdx(last); return; }
                                    }
                                    focusProcVisit(last);
                                }
                            }}
                            placeholder="Search patients or tests... (press Enter to apply)"
                            className="px-3 py-2 w-[340px] text-sm rounded outline-none"
                            style={{ backgroundColor: 'transparent', color: COLORS.CITRON, border: 'none' }}
                        />
                        {(procVisitQueryInput || procVisitQuery) && <button onClick={() => { setProcVisitQueryInput(''); setProcVisitQuery(''); procSearchInputRef.current?.focus(); }} className="px-3 py-1 text-sm rounded border ml-2" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, color: COLORS.TIFFANY_BLUE }}>Clear</button>}
                    </div>
                    <div className="px-3 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: `${COLORS.GAMBOGE}20`, color: COLORS.GAMBOGE }}>{filteredProcVisits.length} Patient(s) | {samples.length} Sample(s)</div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="space-y-3">
                    {filteredProcVisits.map((visit, idx) => (
                        <div key={visit.orderId} data-proc-visit-index={idx} tabIndex={0} className="rounded-xl border shadow-sm transition-all overflow-hidden" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN, borderColor: `${COLORS.PERSIAN_GREEN}40` }} onClick={() => setExpandedVisitId(expandedVisitId === visit.orderId ? null : visit.orderId)} onFocus={() => { setProcKeyboardVisitIdx(idx); setExpandedVisitId(visit.orderId); }} onKeyDown={(e) => {
                                    try { (e.nativeEvent as any).stopImmediatePropagation(); } catch (err) {}
                                    if (e.key === 'Enter') { e.preventDefault(); openBatchResultsEntry(visit); }
                                    else if (e.key === 'ArrowDown') { e.preventDefault(); moveNextProcVisit(); }
                                    else if (e.key === 'ArrowUp') { e.preventDefault(); movePrevProcVisit(); }
                                }}>
                            <div className="p-4 cursor-pointer hover:bg-white/5 transition-colors">
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
                                        <div key={test.id} data-test-index={idx} tabIndex={0} className="proc-test-item flex items-center gap-3 p-2 rounded" style={{ backgroundColor: COLORS.MIDNIGHT_GREEN }} onClick={() => openBatchResultsEntry(visit)} onKeyDown={(e) => {
                                            try { (e.nativeEvent as any).stopImmediatePropagation(); } catch (err) {}
                                            if (e.key === 'Enter') {
                                                e.preventDefault(); openBatchResultsEntry(visit);
                                            } else if (e.key === 'ArrowDown') {
                                                e.preventDefault();
                                                const next = (e.currentTarget as HTMLElement).nextElementSibling as HTMLElement | null;
                                                if (next && next.classList.contains('proc-test-item')) { next.focus(); return; }
                                                moveNextProcVisit();
                                            } else if (e.key === 'ArrowUp') {
                                                e.preventDefault();
                                                const idxNum = idx;
                                                // Try previous test in same visit
                                                const parent = (e.currentTarget as HTMLElement).parentElement;
                                                let prev: HTMLElement | null = null;
                                                if (parent) prev = parent.querySelector(`.proc-test-item[data-test-index="${idxNum - 1}"]`) as HTMLElement | null;
                                                if (prev) { prev.focus(); return; }
                                                // If this is the first test in the visit, return focus to the search input
                                                if (idxNum === 0) { procSearchInputRef.current?.focus(); return; }
                                                // Otherwise, try previous visit's last test
                                                const visits = Array.from(document.querySelectorAll('[data-proc-visit-index]')) as HTMLElement[];
                                                const closestVisit = (e.currentTarget as HTMLElement).closest('[data-proc-visit-index]') as HTMLElement | null;
                                                const visitIdx = closestVisit ? parseInt(closestVisit.dataset['procVisitIndex'] || '0', 10) : NaN;
                                                if (!isNaN(visitIdx) && visitIdx > 0) {
                                                    const prevVisit = visits[visitIdx - 1];
                                                    if (prevVisit) {
                                                        const lastTest = prevVisit.querySelector('.proc-test-item:last-of-type') as HTMLElement | null;
                                                        if (lastTest) { lastTest.focus(); return; }
                                                    }
                                                }
                                                // Fallback to focusing search
                                                procSearchInputRef.current?.focus();
                                            }
                                        }}>
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


// --- Z.AI Configuration (Molded from appsettings.json logic) ---
const ZHIPU_AI_CONFIG = {
    API_KEY: "1742d0fea74a4b12a40caa54b8c6c8f0.KvhuyiUkzK87tWK7",
    BASE_URL: "https://api.z.ai/api/paas/v4/",
    MODEL: "glm-4.7-flash"
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
    const [pathSearchInput, setPathSearchInput] = useState<string>('');
    const [pathQuery, setPathQuery] = useState<string>('');
    const { showAlert, showConfirm, showToast } = useDialog();

    // Apply pathologist search when pathQuery changes (used in patientVisits computed below)


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
        const all = Object.values(visitMap).sort((a, b) => {
            if (a.hasCritical && !b.hasCritical) return -1;
            if (!a.hasCritical && b.hasCritical) return 1;
            if (a.isUrgent && !b.isUrgent) return -1;
            if (!a.isUrgent && b.isUrgent) return 1;
            return a.createdAt?.toDate().getTime() - b.createdAt?.toDate().getTime();
        });
        if (pathQuery && pathQuery.trim()) {
            const q = pathQuery.trim().toLowerCase();
            return all.filter(v => (v.patientName || '').toLowerCase().includes(q) || (v.orderId || '').toLowerCase().includes(q));
        }
        return all;
    }, [samples]);

    const openReviewModal = (visit: typeof patientVisits[0]) => {
        setSelectedVisit({ orderId: visit.orderId, tests: visit.tests });
        setConclusion('');
        setRemarks('');
    };

    const generateAIConclusion = async () => {
        if (!selectedVisit) return;
        setIsGeneratingAI(true);
        console.log("AI Task: Generating clinical conclusion using Z.AI...", selectedVisit.orderId);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        try {
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

            const prompt = `Analyze these lab results and provide a clinical conclusion. 
Tests: ${allResults}. 
Patient: ${selectedVisit.tests[0].patientAge}y/${selectedVisit.tests[0].patientGender}. 
Provide ONE professional, concise medical conclusion for the ENTIRE visit (max 4 sentences). 
CRITICAL: Format your response as a JSON object with a single key "conclusion".`;

            const endpoint = `${ZHIPU_AI_CONFIG.BASE_URL.replace(/\/$/, '')}/chat/completions`;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${ZHIPU_AI_CONFIG.API_KEY}`
                },
                body: JSON.stringify({
                    model: ZHIPU_AI_CONFIG.MODEL,
                    messages: [
                        { role: 'system', content: 'You are a medical AI assistant specializing in lab result analysis and clinical pathology.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.3,
                    max_tokens: 1500
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            console.log("Response received. Status:", response.status);

            if (!response.ok) {
                const errorBody = await response.text();
                if (response.status === 429) throw new Error("Rate limit exceeded (429). Please wait a moment.");
                throw new Error(`API Error ${response.status}`);
            }

            const data = await response.json();
            console.log('AI Data Received:', data);

            const message = data?.choices?.[0]?.message;
            const conclusion = (message?.content?.trim() || message?.reasoning?.trim());

            if (!conclusion) {
                console.error('AI response contained no usable text:', message);
                throw new Error('AI returned no usable content.');
            }

            const finalOutput = message?.content
                ? message.content
                : `AI Clinical Reasoning:\n${message.reasoning}`;

            try {
                // Handle possible markdown wrapping in response
                const jsonStr = finalOutput.replace(/```json/g, '').replace(/```/g, '').trim();
                const parsed = JSON.parse(jsonStr);
                setConclusion(parsed.conclusion || finalOutput);
            } catch (e) {
                setConclusion(finalOutput);
            }
        } catch (error) {
            console.error("AI Generation Failed:", error);
            const msg = error instanceof Error ?
                (error.name === 'AbortError' ? 'Z.AI request timed out' : error.message)
                : "Unknown error occurred";
            showAlert('error', 'AI Generation Failed: ' + msg);
        } finally {
            setIsGeneratingAI(false);
            clearTimeout(timeoutId);
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
                <div className="flex items-center gap-3">
                    <input
                        type="text"
                        placeholder="Search visits (press Enter)..."
                        className="p-2 rounded border text-sm"
                        style={{ backgroundColor: COLORS.RICH_BLACK, color: COLORS.CITRON, borderColor: `${COLORS.PERSIAN_GREEN}20` }}
                        value={pathSearchInput}
                        onChange={e => setPathSearchInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') setPathQuery(pathSearchInput); }}
                    />
                    <div className="px-3 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: `${COLORS.GAMBOGE}20`, color: COLORS.GAMBOGE }}>
                        {patientVisits.length} Visit(s) | {samples.length} Test(s)
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="space-y-3">
                    {patientVisits.map(visit => (
                        <div key={visit.orderId} className={`rounded-xl border shadow-sm transition-all overflow-hidden ${visit.hasCritical ? 'border-l-4 border-l-red-500' : ''} path-visit-item`} data-visit-id={visit.orderId} tabIndex={0} onKeyDown={(e) => {
                            try { (e.nativeEvent as any).stopImmediatePropagation(); } catch (err) {}
                            if (e.key === 'Enter') { e.preventDefault(); openReviewModal(visit); }
                            else if (e.key === 'ArrowDown') { e.preventDefault(); const all = Array.from(document.querySelectorAll('.path-visit-item')) as HTMLElement[]; const idx = all.findIndex(a => a.dataset.visitId === visit.orderId); if (idx >= 0 && idx < all.length - 1) { all[idx+1].focus(); } }
                            else if (e.key === 'ArrowUp') { e.preventDefault(); const all = Array.from(document.querySelectorAll('.path-visit-item')) as HTMLElement[]; const idx = all.findIndex(a => a.dataset.visitId === visit.orderId); if (idx > 0) { all[idx-1].focus(); } }
                        }} style={{ backgroundColor: visit.hasCritical ? '#7f1d1d20' : COLORS.MIDNIGHT_GREEN, borderColor: `${COLORS.PERSIAN_GREEN}40` }}>
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
                            const icons: any = { 'admin_users': Users, 'admin_tests': FlaskConical, 'admin_finance': DollarSign, 'admin_reports': FileBarChart, 'admin_logs': Shield, 'admin_settings': Settings, 'admin_report_designer': FileText, 'admin_bill_designer': Receipt };
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
const NavigateWrapper: React.FC<any> = ({ Component, ...rest }) => {
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
            <Component {...(rest as any)} onBack={handleBack} />
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
                    // Genuine logout or new visitor - ensure anonymous auth for public routes
                    setUser(null);
                    setRole(null);
                    try {
                        await auth.signInAnonymously();
                    } catch (e) {
                        console.warn('Auto-anon failed', e);
                    }
                }
            } else {
                if (u.isAnonymous) {
                    console.log('Public anonymous session active');
                    // Keep user null for public pages
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

            <HashRouter>
                <Routes>
                    {/* Public QR Routes - No authentication required */}
                    <Route path="/track/:token" element={<LiveStatusPage />} />
                    <Route path="/view-report/:token" element={<ReportViewerPublic />} />

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
                        <Route path="inventory" element={<NavigateWrapper Component={InventoryModule} role={role} />} />
                        <Route path="finance" element={<NavigateWrapper Component={FinanceModule} />} />
                        {/* Admin Routes */}
                        <Route path="admin_users" element={<NavigateWrapper Component={AdminUsers} />} />
                        <Route path="admin_tests" element={<NavigateWrapper Component={TestManagementModule} />} />
                        <Route path="admin_finance" element={<NavigateWrapper Component={AdminFinance} />} />
                        <Route path="admin_reports" element={<NavigateWrapper Component={AdminReports} />} />
                        <Route path="admin_logs" element={<NavigateWrapper Component={AdminLogs} />} />
                        <Route path="admin_settings" element={<NavigateWrapper Component={AdminSettings} />} />
                        <Route path="admin_report_designer" element={<NavigateWrapper Component={(props: any) => <ReportDesigner {...props} mode="report" />} />} />
                        <Route path="admin_bill_designer" element={<NavigateWrapper Component={(props: any) => <BillDesigner {...props} />} />} />
                        <Route path="admin_qr_tokens" element={<NavigateWrapper Component={(props: any) => <QRTokenManager {...props} user={user} />} />} />

                        {/* Fallback */}
                        <Route path="*" element={<Navigate to="/dashboard" />} />
                    </Route>
                </Routes>
            </HashRouter>
        </DialogContext.Provider>
    );
};

export default App;


