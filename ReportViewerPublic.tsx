/**
 * Report Viewer Public Page
 * 
 * Allows patients to view and download their reports without authentication
 * Accessed via QR code scan on printed reports
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Activity,
    Download,
    Share2,
    Phone,
    AlertCircle,
    Loader2,
    Eye,
    CheckCircle2,
    ArrowLeft,
    Lock
} from 'lucide-react';
import {
    validateQRToken,
    getOrderDataByToken,
    logQRAccess,
    OrderStatusData,
    QRToken
} from './qrTokenUtils';
import { generateQRDataURL } from './QRCodeGenerator';
import { ReportPageRenderer, ReportData } from './ReportRendererCore';
import { ReportDesign } from './ReportSchema';
import { db } from './firebase';

const ReportViewerPublic: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [tokenData, setTokenData] = useState<QRToken | null>(null);
    const [orderData, setOrderData] = useState<OrderStatusData | null>(null);
    const [reportDesign, setReportDesign] = useState<ReportDesign | null>(null);
    const [reportData, setReportData] = useState<ReportData[]>([]);
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
            loadReportData();
            logQRAccess(token, 'view_report', navigator.userAgent);
        }
    }, [token]);

    const loadReportData = async () => {
        if (!token) return;

        try {
            setLoading(true);
            setError('');

            // Validate token
            const validatedToken = await validateQRToken(token);
            if (!validatedToken) {
                setError('Invalid or expired report link. Please contact the lab.');
                return;
            }

            setTokenData(validatedToken);

            // Get order data
            const data = await getOrderDataByToken(token);
            if (!data) {
                setError('Report not found. Please contact the lab.');
                return;
            }

            setOrderData(data);

            // Check if all reports are ready
            const allReported = data.samples.every((s: any) => s.status === 'reported');
            if (!allReported) {
                setError('Report is not yet ready. Please check back later.');
                return;
            }

            // Load report design (published template)
            // First try new templates collection
            const templateSnap = await db.collection('report_templates')
                .orderBy('updatedAt', 'desc')
                .limit(1)
                .get();

            if (!templateSnap.empty) {
                setReportDesign(templateSnap.docs[0].data() as ReportDesign);
            } else {
                // Fallback to settings (Legacy)
                const settingsDoc = await db.collection('settings').doc('report_design').get();
                if (settingsDoc.exists) {
                    const settings = settingsDoc.data();
                    if (settings?.publishedDesign) {
                        setReportDesign(settings.publishedDesign);
                    }
                }
            }

            // Generate QR Code for this report access
            const qrDataUrl = await generateQRDataURL(token, 150, 'bill');

            // Transform samples to report data format with category grouping
            const cats: Record<string, any[]> = {}; // Map of category -> Array of { testName, parameters }
            data.samples.forEach((sample: any) => {
                const test = data.tests.find((t: any) => t.id === sample.testId);
                const category = test?.category || 'General Diagnostics';
                if (!cats[category]) cats[category] = [];

                const parameters = Object.entries(sample.results || {}).map(([name, val]: [string, any]) => ({
                    name,
                    result: typeof val === 'object' ? val.value : val,
                    unit: typeof val === 'object' ? val.unit : '',
                    flag: typeof val === 'object' ? val.flag : 'N',
                    range: typeof val === 'object' ? val.range || '' : ''
                }));

                cats[category].push({
                    testName: test?.name || 'Diagnostic Test',
                    parameters
                });
            });

            const processed: ReportData = {
                patient: {
                    name: data.patient.fullName,
                    id: data.patient.id,
                    age: data.patient.age || 0,
                    gender: data.patient.gender,
                    phone: data.patient.phone,
                    address: data.patient.address
                },
                doctor: {
                    name: data.samples[0]?.doctorName || 'Self',
                    id: ''
                },
                report: {
                    date: data.samples[0]?.reportedAt ? new Date(data.samples[0].reportedAt.toDate()).toLocaleDateString() : new Date().toLocaleDateString(),
                    id: token.substring(0, 8),
                    title: 'Diagnostic Report'
                },
                testResults: Object.entries(cats).map(([category, groups]) => ({ category, groups })),
                remarks: data.samples[0]?.pathologistRemarks || data.samples[0]?.conclusion || '',
                qrToken: token,
                qrDataUrl: qrDataUrl
            };

            setReportData([processed]);

        } catch (err) {
            console.error('Error loading report:', err);
            setError('Failed to load report. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPDF = async () => {
        if (!token) return;
        // Use browser print (Save as PDF) for best fidelity
        window.print();
        logQRAccess(token, 'download_pdf', navigator.userAgent);
    };

    const handleShare = async () => {
        if (!token) return;

        try {
            logQRAccess(token, 'share', navigator.userAgent);

            const url = window.location.href;

            if (navigator.share) {
                await navigator.share({
                    title: 'Medical Test Report',
                    text: `View medical test report for ${orderData?.patient?.fullName}`,
                    url: url
                });
            } else {
                await navigator.clipboard.writeText(url);
                alert('Report link copied to clipboard!');
            }
        } catch (error) {
            console.error('Share error:', error);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-50 flex items-center justify-center p-4">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-sky-500 animate-spin mx-auto mb-4" />
                    <p className="text-gray-600 font-medium">Loading your report...</p>
                </div>
            </div>
        );
    }

    if (error || !orderData) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                    <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Error</h2>
                    <p className="text-gray-600 mb-6">{error}</p>
                    <div className="flex gap-3 justify-center flex-col sm:flex-row">
                        <button
                            onClick={() => navigate(`/track/${token}`)}
                            className="px-6 py-3 bg-sky-500 text-white rounded-lg font-semibold hover:bg-sky-600 transition-colors flex items-center justify-center gap-2"
                        >
                            <Eye className="w-4 h-4" />
                            Check Status
                        </button>
                        <a
                            href={`tel:${labInfo.phone}`}
                            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors flex items-center justify-center gap-2"
                        >
                            <Phone className="w-4 h-4" />
                            Call Lab
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    const isPreliminary = reportData.some(r => r.status === 'preliminary');

    return (
        <div className="min-h-screen bg-gray-50">
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    #report-preview, #report-preview * { visibility: visible; }
                    #report-preview { 
                        position: absolute; 
                        left: 0; 
                        top: 0; 
                        width: 100%; 
                        height: 100%;
                        margin: 0; 
                        padding: 0 !important; 
                        background: white !important;
                        box-shadow: none !important;
                        overflow: visible !important;
                    }
                    /* Hide scrollbars */
                    ::-webkit-scrollbar { display: none; }
                    @page { size: auto; margin: 0; }
                }
            `}</style>
            {/* Sticky Header */}
            <div className="sticky top-0 z-50 bg-white shadow-md">
                <div className="max-w-5xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => navigate(`/track/${token}`)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center">
                                    <Activity className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-lg font-bold text-gray-800">Medical Report</h1>
                                    <p className="text-xs text-gray-500">{labInfo.name}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleShare}
                                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                            >
                                <Share2 className="w-4 h-4" />
                                Share
                            </button>
                            <button
                                onClick={handleDownloadPDF}
                                className="flex items-center gap-2 px-4 py-2 bg-sky-500 text-white rounded-lg font-semibold hover:bg-sky-600 transition-colors"
                            >
                                <Download className="w-4 h-4" />
                                <span className="hidden sm:inline">Download PDF</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 py-6">
                {/* Security Notice */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start gap-3">
                    <Lock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold text-blue-900">Secure Private Link</p>
                        <p className="text-xs text-blue-700 mt-1">
                            This is your confidential medical report. Do not share this link with unauthorized persons.
                        </p>
                    </div>
                </div>

                {/* Preliminary Warning */}
                {isPreliminary && (
                    <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 mb-6 flex items-start gap-3">
                        <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0" />
                        <div>
                            <p className="text-sm font-bold text-amber-900">PRELIMINARY REPORT</p>
                            <p className="text-xs text-amber-700 mt-1">
                                This report is pending final verification. Please wait for the verified version.
                            </p>
                        </div>
                    </div>
                )}

                {/* Report Preview */}
                <div id="report-preview" className="bg-white rounded-xl shadow-lg overflow-hidden mb-6">
                    {reportDesign && reportData.length > 0 ? (
                        <div className="p-8">
                            {reportData.map((data, index) => (
                                <div key={index} className="mb-8 last:mb-0">
                                    <ReportPageRenderer
                                        design={reportDesign}
                                        data={data}
                                        isPreview={true}
                                    />
                                    {isPreliminary && (
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
                                            <p className="text-9xl font-bold text-red-500 -rotate-45">PRELIMINARY</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-12 text-center">
                            <Eye className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-500 font-medium">Report design not available</p>
                            <p className="text-sm text-gray-400 mt-2">Please contact the lab for your report</p>
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button
                            onClick={handleDownloadPDF}
                            className="flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-xl font-bold hover:from-sky-600 hover:to-blue-700 transition-all shadow-lg"
                        >
                            <Download className="w-5 h-5" />
                            Download PDF Report
                        </button>

                        <button
                            onClick={handleShare}
                            className="flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg"
                        >
                            <Share2 className="w-5 h-5" />
                            Share with Doctor
                        </button>
                    </div>

                    <div className="pt-4 border-t text-center">
                        <p className="text-sm text-gray-600 mb-3">Or check your test status</p>
                        <button
                            onClick={() => navigate(`/track/${token}`)}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Test Status
                        </button>
                    </div>
                </div>

                {/* Footer Info */}
                <div className="mt-6 bg-white rounded-xl shadow-lg p-6 text-center">
                    <div className="flex items-center justify-center gap-2 text-green-600 mb-3">
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="font-semibold">Report Verified & Approved</span>
                    </div>

                    {orderData.samples[0]?.verifiedBy && (
                        <p className="text-sm text-gray-600">
                            Verified by: <span className="font-semibold">{orderData.samples[0].verifiedBy}</span>
                        </p>
                    )}

                    {orderData.samples[0]?.reportedAt && (
                        <p className="text-xs text-gray-500 mt-1">
                            Report Date: {new Date(orderData.samples[0].reportedAt.toDate()).toLocaleString()}
                        </p>
                    )}

                    <div className="mt-6 pt-4 border-t">
                        <p className="text-sm font-semibold text-gray-700 mb-2">Need Help?</p>
                        <a
                            href={`tel:${labInfo.phone}`}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-sky-500 text-white rounded-xl font-semibold hover:bg-sky-600 transition-colors"
                        >
                            <Phone className="w-4 h-4" />
                            Contact Lab: {labInfo.phone}
                        </a>
                    </div>

                    <p className="text-xs text-gray-400 mt-6">
                        This is a secure, private link. Keep it confidential.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ReportViewerPublic;
