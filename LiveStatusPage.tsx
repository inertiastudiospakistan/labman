/**
 * Live Status Page - Public Test Tracking
 * 
 * This page allows patients to track their test status in real-time
 * Accessible via QR code scan without authentication
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Activity,
    CheckCircle2,
    Clock,
    Microscope,
    FileCheck,
    Download,
    Phone,
    RefreshCw,
    AlertCircle,
    Loader2,
    Share2,
    Calendar
} from 'lucide-react';
import {
    validateQRToken,
    getOrderDataByToken,
    logQRAccess,
    maskPatientName,
    maskPhoneNumber,
    calculateETA,
    formatTimeRemaining,
    OrderStatusData
} from './qrTokenUtils';
import { db } from './firebase';

const LiveStatusPage: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [data, setData] = useState<OrderStatusData | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [labInfo, setLabInfo] = useState({
        name: 'LabPro Diagnostics',
        phone: '+92-XXX-XXXXXXX',
        address: '',
        email: ''
    });

    // Load lab info from Firestore settings
    useEffect(() => {
        const loadLabInfo = async () => {
            try {
                const infoSnap = await db.collection('settings').doc('lab_info').get();
                if (infoSnap.exists) {
                    const info = infoSnap.data();
                    setLabInfo(prev => ({
                        ...prev,
                        name: info?.name || prev.name,
                        phone: info?.phone || prev.phone,
                        address: info?.address || prev.address,
                        email: info?.email || prev.email
                    }));
                }
            } catch (e) {
                console.warn('Failed to load lab info:', e);
            }
        };
        loadLabInfo();
    }, []);

    useEffect(() => {
        if (token) {
            loadStatusData();
            logQRAccess(token, 'view_status', navigator.userAgent);
        }
    }, [token]);

    // Auto-refresh every 30 seconds
    useEffect(() => {
        if (!autoRefresh || !token) return;

        const interval = setInterval(() => {
            loadStatusData(true);
        }, 30000); // 30 seconds

        return () => clearInterval(interval);
    }, [autoRefresh, token]);

    const loadStatusData = async (silent = false) => {
        if (!token) return;

        try {
            if (!silent) setLoading(true);
            setError('');

            console.log('🔍 TRACK PAGE: Loading data for token:', token);
            const orderData = await getOrderDataByToken(token);

            if (!orderData) {
                console.error('❌ TRACK PAGE: No order data returned for token:', token);
                setError('Invalid or expired tracking link. Please contact the lab.');
                return;
            }

            console.log('✅ TRACK PAGE: Successfully loaded order:', orderData.order.id);
            setData(orderData);
            setLastUpdated(new Date());

        } catch (err) {
            console.error('❌ TRACK PAGE: Error loading status:', err);
            setError('Failed to load test status. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const getStatusConfig = (status: string) => {
        const configs: Record<string, any> = {
            ordered: {
                label: 'Awaiting Sample Collection',
                icon: Clock,
                color: 'text-gray-500',
                bgColor: 'bg-gray-100',
                borderColor: 'border-gray-300'
            },
            collected: {
                label: 'Sample Collected',
                icon: CheckCircle2,
                color: 'text-blue-600',
                bgColor: 'bg-blue-50',
                borderColor: 'border-blue-300'
            },
            analyzing: {
                label: 'Test in Progress',
                icon: Microscope,
                color: 'text-orange-600',
                bgColor: 'bg-orange-50',
                borderColor: 'border-orange-300'
            },
            review: {
                label: 'Under Medical Review',
                icon: FileCheck,
                color: 'text-purple-600',
                bgColor: 'bg-purple-50',
                borderColor: 'border-purple-300'
            },
            reported: {
                label: 'Report Ready',
                icon: CheckCircle2,
                color: 'text-green-600',
                bgColor: 'bg-green-50',
                borderColor: 'border-green-300'
            }
        };

        return configs[status] || configs.ordered;
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getTimeSinceUpdate = () => {
        const seconds = Math.floor((new Date().getTime() - lastUpdated.getTime()) / 1000);
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        return `${hours}h ago`;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-50 flex items-center justify-center p-4">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-sky-500 animate-spin mx-auto mb-4" />
                    <p className="text-gray-600 font-medium">Loading test status...</p>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                    <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Error</h2>
                    <p className="text-gray-600 mb-6">{error}</p>
                    <div className="flex gap-3 justify-center">
                        <button
                            onClick={() => loadStatusData()}
                            className="px-6 py-2 bg-sky-500 text-white rounded-lg font-semibold hover:bg-sky-600 transition-colors"
                        >
                            Try Again
                        </button>
                        <a
                            href={`tel:${labInfo.phone}`}
                            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors flex items-center gap-2"
                        >
                            <Phone className="w-4 h-4" />
                            Call Lab
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    // Progress Stepper Steps
    const steps = [
        {
            id: 'registered',
            label: 'Tests Registered',
            completed: true,
            timestamp: data.order.createdAt,
            icon: CheckCircle2
        },
        {
            id: 'collected',
            label: 'Sample Collected',
            completed: data.progress.collected > 0,
            current: data.progress.collected > 0 && data.progress.collected < data.progress.total,
            timestamp: data.samples.find((s: any) => s.collectedAt)?.collectedAt,
            details: data.samples.find((s: any) => s.collectorName)?.collectorName,
            icon: CheckCircle2
        },
        {
            id: 'analyzing',
            label: 'In Analysis',
            completed: data.progress.analyzing === data.progress.total,
            current: data.progress.analyzing > 0 && data.progress.analyzing < data.progress.total,
            timestamp: data.samples.find((s: any) => s.status === 'analyzing' || s.status === 'review' || s.status === 'reported')?.collectedAt,
            icon: Microscope
        },
        {
            id: 'review',
            label: 'Pathologist Review',
            completed: data.progress.reported === data.progress.total,
            current: data.samples.some((s: any) => s.status === 'review'),
            timestamp: data.samples.find((s: any) => s.submittedForReviewAt)?.submittedForReviewAt,
            icon: FileCheck
        },
        {
            id: 'ready',
            label: 'Report Ready',
            completed: data.progress.reported === data.progress.total,
            timestamp: data.samples.find((s: any) => s.reportedAt)?.reportedAt,
            icon: CheckCircle2
        }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50">
            {/* Header */}
            <div className="bg-white shadow-md">
                <div className="max-w-2xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center shadow-lg">
                                <Activity className="w-7 h-7 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-800">{labInfo.name}</h1>
                                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Test Status Tracker</p>
                            </div>
                        </div>
                        <button
                            onClick={() => loadStatusData()}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Refresh"
                        >
                            <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
                {/* Order Info Card */}
                <div className="bg-white rounded-2xl shadow-lg p-6">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Order ID</p>
                            <p className="text-lg font-bold text-gray-800">#{data.order.id.slice(-8).toUpperCase()}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-gray-500 font-medium">Date</p>
                            <p className="text-lg font-bold text-gray-800">{formatDate(data.order.createdAt)}</p>
                        </div>
                    </div>

                    <div className="border-t pt-4">
                        <p className="text-sm text-gray-500 font-medium mb-1">Patient</p>
                        <p className="text-xl font-bold text-gray-800">{maskPatientName(data.patient.fullName)}</p>
                        {data.patient.phone && (
                            <p className="text-sm text-gray-600 mt-1">{maskPhoneNumber(data.patient.phone)}</p>
                        )}
                    </div>

                    {data.order.isUrgent && (
                        <div className="mt-4 bg-orange-50 border border-orange-200 rounded-lg px-4 py-2 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-orange-600" />
                            <span className="text-sm font-semibold text-orange-800">Urgent Processing</span>
                        </div>
                    )}
                </div>

                {/* Progress Stepper */}
                <div className="bg-white rounded-2xl shadow-lg p-6">
                    <h2 className="text-lg font-bold text-gray-800 mb-6">Test Progress</h2>

                    <div className="space-y-6">
                        {steps.map((step, index) => {
                            const StepIcon = step.icon;
                            const isLast = index === steps.length - 1;

                            return (
                                <div key={step.id} className="relative">
                                    <div className="flex items-start gap-4">
                                        {/* Icon */}
                                        <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center ${step.completed
                                            ? 'bg-green-500 shadow-lg shadow-green-200'
                                            : step.current
                                                ? 'bg-orange-500 shadow-lg shadow-orange-200 animate-pulse'
                                                : 'bg-gray-200'
                                            }`}>
                                            <StepIcon className={`w-5 h-5 ${step.completed || step.current ? 'text-white' : 'text-gray-400'
                                                }`} />
                                        </div>

                                        {/* Line connector */}
                                        {!isLast && (
                                            <div className={`absolute left-5 top-10 w-0.5 h-12 ${steps[index + 1].completed || steps[index + 1].current
                                                ? 'bg-green-300'
                                                : 'bg-gray-200'
                                                }`} />
                                        )}

                                        {/* Content */}
                                        <div className="flex-1">
                                            <h3 className={`font-bold ${step.completed || step.current
                                                ? 'text-gray-800'
                                                : 'text-gray-400'
                                                }`}>
                                                {step.label}
                                            </h3>

                                            {step.timestamp && (
                                                <p className="text-sm text-gray-600 mt-1">
                                                    {formatDate(step.timestamp)}
                                                </p>
                                            )}

                                            {step.details && (
                                                <p className="text-xs text-gray-500 mt-1">
                                                    By: {step.details}
                                                </p>
                                            )}

                                            {step.current && step.id === 'analyzing' && (
                                                <div className="mt-2">
                                                    <div className="flex items-center gap-2 text-sm text-orange-700">
                                                        <Clock className="w-4 h-4" />
                                                        <span>Processing in progress...</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Tests List */}
                <div className="bg-white rounded-2xl shadow-lg p-6">
                    <h2 className="text-lg font-bold text-gray-800 mb-4">Tests in this Order ({data.samples.length})</h2>

                    <div className="space-y-3">
                        {data.samples.map((sample: any) => {
                            const test = data.tests.find((t: any) => t.id === sample.testId);
                            const statusConfig = getStatusConfig(sample.status);
                            const StatusIcon = statusConfig.icon;

                            let eta = null;
                            if (sample.status === 'analyzing' || sample.status === 'collected') {
                                eta = calculateETA(sample, test);
                            }

                            return (
                                <div
                                    key={sample.id}
                                    className={`border-2 ${statusConfig.borderColor} rounded-xl p-4 ${statusConfig.bgColor}`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <h3 className="font-bold text-gray-800">{sample.testName}</h3>
                                            <div className="flex items-center gap-2 mt-2">
                                                <StatusIcon className={`w-4 h-4 ${statusConfig.color}`} />
                                                <span className={`text-sm font-semibold ${statusConfig.color}`}>
                                                    {statusConfig.label}
                                                </span>
                                            </div>
                                            {eta && (
                                                <p className="text-xs text-gray-600 mt-1">
                                                    Expected: ~{formatTimeRemaining(eta)} remaining
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Download Report Button (if ready) */}
                {data.progress.reported === data.progress.total && (
                    <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl shadow-xl p-6 text-white">
                        <div className="text-center">
                            <CheckCircle2 className="w-16 h-16 mx-auto mb-4" />
                            <h2 className="text-2xl font-bold mb-2">Your Report is Ready!</h2>
                            <p className="text-green-100 mb-6">All tests have been completed and verified</p>

                            <button
                                onClick={() => {
                                    logQRAccess(token!, 'view_report', navigator.userAgent);
                                    navigate(`/view-report/${token}`);
                                }}
                                className="w-full bg-white text-green-600 font-bold py-4 rounded-xl hover:bg-green-50 transition-colors flex items-center justify-center gap-2 shadow-lg"
                            >
                                <Download className="w-5 h-5" />
                                View & Download Report
                            </button>

                            <button
                                onClick={() => {
                                    const baseUrl = window.location.origin;
                                    const pathname = window.location.pathname.includes('/labman') ? '/labman' : '';
                                    const url = `${baseUrl}${pathname}/#/view-report/${token}`;
                                    if (navigator.share) {
                                        navigator.share({
                                            title: 'My Lab Report',
                                            text: 'View my medical test report',
                                            url: url
                                        });
                                    } else {
                                        navigator.clipboard.writeText(url);
                                        alert('Link copied to clipboard!');
                                    }
                                }}
                                className="w-full mt-3 bg-green-600 text-white font-semibold py-3 rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                            >
                                <Share2 className="w-4 h-4" />
                                Share Report Link
                            </button>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="bg-white rounded-2xl shadow-lg p-6">
                    <div className="text-center space-y-4">
                        <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                            <RefreshCw className="w-4 h-4" />
                            <span>Last updated: {getTimeSinceUpdate()}</span>
                        </div>

                        <div className="pt-4 border-t">
                            <p className="text-sm font-semibold text-gray-700 mb-2">Need Help?</p>
                            <a
                                href={`tel:${labInfo.phone}`}
                                className="inline-flex items-center gap-2 px-6 py-3 bg-sky-500 text-white rounded-xl font-semibold hover:bg-sky-600 transition-colors"
                            >
                                <Phone className="w-4 h-4" />
                                Call Us: {labInfo.phone}
                            </a>
                        </div>

                        <p className="text-xs text-gray-400 pt-4">
                            This page automatically refreshes every 30 seconds
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LiveStatusPage;
