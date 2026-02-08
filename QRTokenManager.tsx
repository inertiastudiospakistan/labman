/**
 * QR Token Manager - Admin Dashboard
 * 
 * Allows administrators to view, manage, and revoke QR tokens
 * Shows access logs and analytics
 */

import React, { useState, useEffect } from 'react';
import {
    Search,
    Filter,
    Eye,
    XCircle,
    RefreshCw,
    Download,
    Copy,
    MoreVertical,
    CheckCircle2,
    AlertCircle,
    Calendar,
    User,
    Activity
} from 'lucide-react';
import {
    getQRTokens,
    revokeQRToken,
    regenerateQRToken,
    getAccessLogs,
    QRToken,
    QRAccessLog,
    maskPatientName
} from './qrTokenUtils';
import firebase from 'firebase/compat/app';

interface QRTokenManagerProps {
    user: any;
}

const QRTokenManager: React.FC<QRTokenManagerProps> = ({ user }) => {
    const [tokens, setTokens] = useState<QRToken[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'bill' | 'report'>('all');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'revoked'>('all');
    const [selectedToken, setSelectedToken] = useState<QRToken | null>(null);
    const [showAccessLogs, setShowAccessLogs] = useState(false);
    const [accessLogs, setAccessLogs] = useState<QRAccessLog[]>([]);
    const [showActions, setShowActions] = useState<string | null>(null);

    useEffect(() => {
        loadTokens();
    }, [filterType, filterStatus]);

    const loadTokens = async () => {
        try {
            setLoading(true);

            const filters: any = {};

            if (filterType !== 'all') {
                filters.type = filterType;
            }

            if (filterStatus === 'active') {
                filters.isActive = true;
            } else if (filterStatus === 'revoked') {
                filters.isActive = false;
            }

            filters.limit = 100;

            const data = await getQRTokens(filters);
            setTokens(data);

        } catch (error) {
            console.error('Error loading tokens:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleViewAccessLogs = async (token: QRToken) => {
        setSelectedToken(token);
        setShowAccessLogs(true);

        const logs = await getAccessLogs(token.id);
        setAccessLogs(logs);
    };

    const handleRevokeToken = async (token: QRToken) => {
        if (!confirm(`Are you sure you want to revoke this ${token.type} QR token for ${token.patientName}?`)) {
            return;
        }

        const reason = prompt('Reason for revocation (optional):');

        const success = await revokeQRToken(token.token, user.uid, reason || undefined);

        if (success) {
            alert('Token revoked successfully');
            loadTokens();
        } else {
            alert('Failed to revoke token');
        }
    };

    const handleRegenerateToken = async (token: QRToken) => {
        if (!confirm(`Regenerate QR token for ${token.patientName}? The old link will stop working.`)) {
            return;
        }

        const newToken = await regenerateQRToken(token.token, user.uid);

        if (newToken) {
            alert(`New token generated: ${newToken}\nOld token has been revoked.`);
            loadTokens();
        } else {
            alert('Failed to regenerate token');
        }
    };

    const handleCopyLink = (token: QRToken) => {
        const url = token.type === 'bill'
            ? `${window.location.origin}/labman/#/track/${token.token}`
            : `${window.location.origin}/labman/#/view-report/${token.token}`;

        navigator.clipboard.writeText(url);
        alert('Link copied to clipboard!');
    };

    const exportToCSV = () => {
        const csvData = filteredTokens.map(t => ({
            'Token': t.token.substring(0, 8) + '...',
            'Type': t.type,
            'Patient': t.patientName,
            'Order ID': t.orderId,
            'Created': t.createdAt.toDate().toLocaleDateString(),
            'Status': t.isActive ? 'Active' : 'Revoked',
            'Access Count': t.accessCount,
            'Last Accessed': t.lastAccessedAt ? t.lastAccessedAt.toDate().toLocaleDateString() : 'Never'
        }));

        const headers = Object.keys(csvData[0]);
        const csv = [
            headers.join(','),
            ...csvData.map(row => headers.map(h => `"${row[h as keyof typeof row]}"`).join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `qr-tokens-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    const filteredTokens = tokens.filter(t => {
        const searchLower = searchTerm.toLowerCase();
        return (
            t.patientName.toLowerCase().includes(searchLower) ||
            t.orderId.toLowerCase().includes(searchLower) ||
            t.token.toLowerCase().includes(searchLower)
        );
    });

    const stats = {
        total: tokens.length,
        active: tokens.filter(t => t.isActive).length,
        revoked: tokens.filter(t => !t.isActive).length,
        bills: tokens.filter(t => t.type === 'bill').length,
        reports: tokens.filter(t => t.type === 'report').length,
        totalAccesses: tokens.reduce((sum, t) => sum + t.accessCount, 0)
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">QR Token Management</h2>
                    <p className="text-gray-600 mt-1">View and manage all QR codes</p>
                </div>
                <button
                    onClick={loadTokens}
                    className="flex items-center gap-2 px-4 py-2 bg-sky-500 text-white rounded-lg font-semibold hover:bg-sky-600 transition-colors"
                >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-white rounded-xl shadow p-4">
                    <p className="text-xs text-gray-500 font-medium uppercase">Total Tokens</p>
                    <p className="text-2xl font-bold text-gray-800 mt-1">{stats.total}</p>
                </div>
                <div className="bg-green-50 rounded-xl shadow p-4">
                    <p className="text-xs text-green-600 font-medium uppercase">Active</p>
                    <p className="text-2xl font-bold text-green-700 mt-1">{stats.active}</p>
                </div>
                <div className="bg-red-50 rounded-xl shadow p-4">
                    <p className="text-xs text-red-600 font-medium uppercase">Revoked</p>
                    <p className="text-2xl font-bold text-red-700 mt-1">{stats.revoked}</p>
                </div>
                <div className="bg-blue-50 rounded-xl shadow p-4">
                    <p className="text-xs text-blue-600 font-medium uppercase">Bills</p>
                    <p className="text-2xl font-bold text-blue-700 mt-1">{stats.bills}</p>
                </div>
                <div className="bg-purple-50 rounded-xl shadow p-4">
                    <p className="text-xs text-purple-600 font-medium uppercase">Reports</p>
                    <p className="text-2xl font-bold text-purple-700 mt-1">{stats.reports}</p>
                </div>
                <div className="bg-orange-50 rounded-xl shadow p-4">
                    <p className="text-xs text-orange-600 font-medium uppercase">Total Views</p>
                    <p className="text-2xl font-bold text-orange-700 mt-1">{stats.totalAccesses}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Search */}
                    <div className="md:col-span-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by patient, order ID, or token..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                            />
                        </div>
                    </div>

                    {/* Type Filter */}
                    <div>
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value as any)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                        >
                            <option value="all">All Types</option>
                            <option value="bill">Bills Only</option>
                            <option value="report">Reports Only</option>
                        </select>
                    </div>

                    {/* Status Filter */}
                    <div>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value as any)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                        >
                            <option value="all">All Status</option>
                            <option value="active">Active Only</option>
                            <option value="revoked">Revoked Only</option>
                        </select>
                    </div>
                </div>

                <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-gray-600">
                        Showing <span className="font-semibold">{filteredTokens.length}</span> of <span className="font-semibold">{tokens.length}</span> tokens
                    </p>
                    <button
                        onClick={exportToCSV}
                        disabled={filteredTokens.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Download className="w-4 h-4" />
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Tokens Table */}
            <div className="bg-white rounded-xl shadow overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">Token</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">Patient</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">Order ID</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">Created</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">Views</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-600 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center">
                                        <div className="flex items-center justify-center gap-2 text-gray-500">
                                            <RefreshCw className="w-5 h-5 animate-spin" />
                                            <span>Loading tokens...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredTokens.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                                        No tokens found
                                    </td>
                                </tr>
                            ) : (
                                filteredTokens.map((token) => (
                                    <tr key={token.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                                                {token.token.substring(0, 8)}...
                                            </code>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div>
                                                <p className="font-semibold text-gray-800">{maskPatientName(token.patientName)}</p>
                                                {token.patientPhone && (
                                                    <p className="text-xs text-gray-500">{token.patientPhone.substring(0, 7)}...</p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <code className="text-xs text-gray-600">
                                                {token.orderId.slice(-8).toUpperCase()}
                                            </code>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${token.type === 'bill'
                                                    ? 'bg-blue-100 text-blue-800'
                                                    : 'bg-purple-100 text-purple-800'
                                                }`}>
                                                {token.type === 'bill' ? '📄 Bill' : '📋 Report'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {token.createdAt.toDate().toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center gap-1 text-sm font-semibold text-gray-700">
                                                <Eye className="w-4 h-4" />
                                                {token.accessCount}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {token.isActive ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    Active
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                                                    <XCircle className="w-3 h-3" />
                                                    Revoked
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="relative inline-block">
                                                <button
                                                    onClick={() => setShowActions(showActions === token.id ? null : token.id)}
                                                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                                                >
                                                    <MoreVertical className="w-5 h-5 text-gray-600" />
                                                </button>

                                                {showActions === token.id && (
                                                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border z-10">
                                                        <button
                                                            onClick={() => {
                                                                handleViewAccessLogs(token);
                                                                setShowActions(null);
                                                            }}
                                                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                                        >
                                                            <Activity className="w-4 h-4" />
                                                            View Access Logs
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                handleCopyLink(token);
                                                                setShowActions(null);
                                                            }}
                                                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                                        >
                                                            <Copy className="w-4 h-4" />
                                                            Copy Link
                                                        </button>
                                                        {token.isActive ? (
                                                            <>
                                                                <button
                                                                    onClick={() => {
                                                                        handleRegenerateToken(token);
                                                                        setShowActions(null);
                                                                    }}
                                                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                                                >
                                                                    <RefreshCw className="w-4 h-4" />
                                                                    Regenerate
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        handleRevokeToken(token);
                                                                        setShowActions(null);
                                                                    }}
                                                                    className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                                                                >
                                                                    <XCircle className="w-4 h-4" />
                                                                    Revoke Token
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <div className="px-4 py-2 text-xs text-gray-500 italic">
                                                                Token is revoked
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Access Logs Modal */}
            {showAccessLogs && selectedToken && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                        <div className="p-6 border-b">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800">Access Logs</h3>
                                    <p className="text-sm text-gray-600 mt-1">
                                        {selectedToken.patientName} - {selectedToken.type}
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowAccessLogs(false);
                                        setSelectedToken(null);
                                    }}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <XCircle className="w-6 h-6 text-gray-600" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            {accessLogs.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                    <p>No access logs yet</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {accessLogs.map((log) => (
                                        <div key={log.id} className="bg-gray-50 rounded-lg p-4">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <p className="font-semibold text-gray-800">{log.action.replace('_', ' ').toUpperCase()}</p>
                                                    <p className="text-sm text-gray-600 mt-1">
                                                        {log.accessedAt.toDate().toLocaleString()}
                                                    </p>
                                                    {log.userAgent && (
                                                        <p className="text-xs text-gray-500 mt-1 truncate max-w-md">
                                                            {log.userAgent.substring(0, 100)}...
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default QRTokenManager;
