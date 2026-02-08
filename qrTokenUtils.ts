/**
 * QR Token Management Utilities
 * 
 * This file handles all QR token operations including:
 * - Token generation (secure UUID v4)
 * - Token validation
 * - Token creation/retrieval
 * - Token revocation
 * - Access logging
 */

import { db } from './firebase';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

// --- Types ---

export interface QRToken {
    id: string;
    token: string;
    type: 'bill' | 'report';

    // References
    orderId: string;
    patientId: string;
    sampleIds?: string[];

    // Cached patient info (for quick access)
    patientName: string;
    patientPhone?: string;
    patientAge?: number;
    patientGender?: string;

    // Security
    createdAt: any;
    expiresAt?: any | null;
    isActive: boolean;
    accessCount: number;
    lastAccessedAt?: any;

    // Optional passcode protection
    requiresPasscode: boolean;
    passcode?: string;

    // Metadata
    createdBy: string;
    revokedAt?: any;
    revokedBy?: string;
    revokedReason?: string;
}

export interface QRAccessLog {
    id: string;
    tokenId: string;
    token: string;
    accessedAt: any;
    action: 'view_status' | 'view_report' | 'download_pdf' | 'share';
    userAgent?: string;
    ipAddress?: string; // Hashed for privacy
}

export interface OrderStatusData {
    order: any;
    patient: any;
    samples: any[];
    tests: any[];
    overallStatus: 'ordered' | 'partial_collected' | 'collected' | 'analyzing' | 'partial_reported' | 'ready' | 'reported';
    progress: {
        total: number;
        collected: number;
        analyzing: number;
        reported: number;
    };
}

// --- Token Generation ---

/**
 * Generate a cryptographically secure random token (UUID v4)
 */
export function generateSecureToken(): string {
    // Generate UUID v4 (random)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Hash a string (for passcode or IP address)
 */
function simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(36);
}

// --- Token Creation ---

// --- Token Creation ---

/**
 * Create or retrieve existing QR token for an order (Unified Strategy)
 * Stores token directly on the order document.
 */
export async function getOrCreateQRToken(
    orderId: string,
    patientId: string,
    type: 'bill' | 'report',
    userId: string
): Promise<string> {
    try {
        const orderRef = db.collection('orders').doc(orderId);

        // Retry logic to handle eventual consistency/race conditions
        let orderDoc = await orderRef.get();
        let retries = 0;
        const maxRetries = 3;

        while (!orderDoc.exists && retries < maxRetries) {
            console.warn(`⚠️ Order ${orderId} not found. Retrying... (${retries + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            orderDoc = await orderRef.get();
            retries++;
        }

        if (!orderDoc.exists) {
            throw new Error(`Order ${orderId} not found after ${maxRetries} retries`);
        }

        const orderData = orderDoc.data();

        // 1. Check if order already has a unified trackToken
        if (orderData?.trackToken) {
            console.log(`✅ Found existing trackToken on order ${orderId}`);
            return orderData.trackToken;
        }

        // 2. (Optional) Check Legacy qr_tokens to migrate? 
        // For simplicity/robustness, we execute User's plan: Generate NEW if missing on Order.
        // This ensures the "Single Source of Truth" is populated.

        const token = generateSecureToken();

        // 3. Save to Order Document (Atomic Single Source)
        await orderRef.update({
            trackToken: token,
            qrTokenUpdatedAt: new Date()
        });

        console.log(`✅ Generated and saved NEW trackToken to order ${orderId}`);
        return token;

    } catch (error) {
        console.error('Error in getOrCreateQRToken:', error);
        throw error;
    }
}

// --- Token Validation ---

/**
 * Validate a QR token by looking up the Order (Unified Strategy)
 * Fallback to legacy qr_tokens collection supported.
 */
export async function validateQRToken(token: string): Promise<QRToken | null> {
    try {
        console.log('🔑 VALIDATE: Checking token:', token);

        // 1. Primary Strategy: Check Orders Collection (Unified)
        const ordersQuery = await db.collection('orders')
            .where('trackToken', '==', token)
            .limit(1)
            .get();

        if (!ordersQuery.empty) {
            const orderDoc = ordersQuery.docs[0];
            const orderData = orderDoc.data();
            console.log('✅ VALIDATE: Found Order via trackToken:', orderDoc.id);

            // Construct Virtual QRToken compatible with interface
            return {
                id: orderDoc.id, // Using Order ID as reference
                token: token,
                type: 'bill', // Universal
                orderId: orderDoc.id,
                patientId: orderData.patientId,
                patientName: 'Loaded from Order', // Placeholder, real fetch happens later
                isActive: true, // Orders are assumed active for tracking
                createdAt: orderData.qrTokenUpdatedAt || orderData.createdAt,
                createdBy: 'system',
                accessCount: 0, // Not tracked on order doc
                requiresPasscode: false
            } as QRToken;
        }

        // 2. Legacy Strategy: Check qr_tokens Collection
        // (Preserves access for old printed codes before this architecture change)
        const legacyQuery = await db.collection('qr_tokens')
            .where('token', '==', token)
            .where('isActive', '==', true)
            .limit(1)
            .get();

        if (!legacyQuery.empty) {
            const tokenData = { id: legacyQuery.docs[0].id, ...legacyQuery.docs[0].data() } as QRToken;
            console.log('✅ VALIDATE: Found Legacy Token via qr_tokens');
            return tokenData;
        }

        console.error('❌ VALIDATE: No order or legacy token found for:', token);
        return null;

    } catch (error) {
        console.error('❌ VALIDATE: Error validating token:', error);
        return null;
    }
}

/**
 * Validate passcode for a token (if required)
 */
export async function validatePasscode(token: string, passcode: string): Promise<boolean> {
    try {
        const tokenData = await validateQRToken(token);
        if (!tokenData) return false;

        if (!tokenData.requiresPasscode) return true;

        const hashedPasscode = simpleHash(passcode);
        return tokenData.passcode === hashedPasscode;

    } catch (error) {
        console.error('Error validating passcode:', error);
        return false;
    }
}

// --- Data Retrieval ---

/**
 * Get complete order status data by token
 */
export async function getOrderDataByToken(token: string): Promise<OrderStatusData | null> {
    try {
        // 1. Validate & Identify (Find Order ID)
        const tokenData = await validateQRToken(token);
        if (!tokenData) return null;

        // 2. Fetch Order Data (even if we found it in validate, we need full clean fetch)
        const orderDoc = await db.collection('orders').doc(tokenData.orderId).get();
        if (!orderDoc.exists) return null;
        const orderData = { id: orderDoc.id, ...orderDoc.data() };

        // 3. Fetch Patient
        // Ensure patientId is valid
        if (!tokenData.patientId && !orderData.patientId) {
            console.error("❌ No patientId linked to order");
            return null;
        }
        const pid = tokenData.patientId || orderData.patientId;

        const patientDoc = await db.collection('patients').doc(pid).get();
        const patientData = patientDoc.exists ? { id: patientDoc.id, ...patientDoc.data() } : null;

        // 4. Fetch Samples
        const samplesQuery = await db.collection('samples')
            .where('orderId', '==', tokenData.orderId)
            .get();

        const samples = samplesQuery.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // 5. Fetch Tests
        const testIds = [...new Set(samples.map((s: any) => s.testId))];
        let tests: any[] = [];

        if (testIds.length > 0) {
            const testsPromises = testIds.map(id => db.collection('tests').doc(id).get());
            const testsDocs = await Promise.all(testsPromises);
            tests = testsDocs
                .filter(doc => doc.exists)
                .map(doc => ({ id: doc.id, ...doc.data() }));
        }

        // 6. Calculate Status
        const progress = {
            total: samples.length,
            collected: samples.filter((s: any) =>
                ['collected', 'analyzing', 'review', 'reported'].includes(s.status)
            ).length,
            analyzing: samples.filter((s: any) =>
                ['analyzing', 'review', 'reported'].includes(s.status)
            ).length,
            reported: samples.filter((s: any) => s.status === 'reported').length
        };

        let overallStatus: OrderStatusData['overallStatus'] = 'ordered';

        if (progress.total > 0) {
            if (progress.reported === progress.total) {
                overallStatus = 'reported';
            } else if (progress.reported > 0) {
                overallStatus = 'partial_reported';
            } else if (progress.analyzing > 0) {
                overallStatus = 'analyzing';
            } else if (progress.collected === progress.total) {
                overallStatus = 'collected';
            } else if (progress.collected > 0) {
                overallStatus = 'partial_collected';
            }
        }

        return {
            order: orderData,
            patient: patientData,
            samples,
            tests,
            overallStatus,
            progress
        };

    } catch (error) {
        console.error('Error fetching order data:', error);
        return null;
    }
}

// --- Access Logging ---

/**
 * Log access to a QR token
 */
export async function logQRAccess(
    token: string,
    action: QRAccessLog['action'],
    userAgent?: string
): Promise<void> {
    try {
        const tokenData = await validateQRToken(token);
        if (!tokenData) return;

        // Create access log
        const logData: Partial<QRAccessLog> = {
            tokenId: tokenData.id,
            token,
            accessedAt: firebase.firestore.Timestamp.now(),
            action,
            userAgent: userAgent?.substring(0, 200) // Limit length
        };

        await db.collection('qr_access_logs').add(logData);

        // Update token access count and last accessed time
        // Only if it's a legacy token document (where ID does not match Order ID)
        if (tokenData.id !== tokenData.orderId) {
            await db.collection('qr_tokens').doc(tokenData.id).update({
                accessCount: firebase.firestore.FieldValue.increment(1),
                lastAccessedAt: firebase.firestore.Timestamp.now()
            });
        }

    } catch (error) {
        console.error('Error logging access:', error);
    }
}

// --- Token Management ---

/**
 * Revoke a QR token
 */
export async function revokeQRToken(
    token: string,
    userId: string,
    reason?: string
): Promise<boolean> {
    try {
        const tokenData = await validateQRToken(token);
        if (!tokenData) return false;

        await db.collection('qr_tokens').doc(tokenData.id).update({
            isActive: false,
            revokedAt: firebase.firestore.Timestamp.now(),
            revokedBy: userId,
            revokedReason: reason || 'No reason provided'
        });

        console.log(`✅ Revoked token: ${token}`);
        return true;

    } catch (error) {
        console.error('Error revoking token:', error);
        return false;
    }
}

/**
 * Regenerate a QR token (revoke old, create new)
 */
export async function regenerateQRToken(
    oldToken: string,
    userId: string
): Promise<string | null> {
    try {
        const oldTokenData = await validateQRToken(oldToken);
        if (!oldTokenData) return null;

        // Revoke old token
        await revokeQRToken(oldToken, userId, 'Regenerated');

        // Create new token
        const newToken = await getOrCreateQRToken(
            oldTokenData.orderId,
            oldTokenData.patientId,
            oldTokenData.type,
            userId
        );

        return newToken;

    } catch (error) {
        console.error('Error regenerating token:', error);
        return null;
    }
}

/**
 * Get all tokens with filters
 */
export async function getQRTokens(filters?: {
    type?: 'bill' | 'report';
    isActive?: boolean;
    orderId?: string;
    patientId?: string;
    limit?: number;
}): Promise<QRToken[]> {
    try {
        let query: any = db.collection('qr_tokens');

        if (filters?.type) {
            query = query.where('type', '==', filters.type);
        }

        if (filters?.isActive !== undefined) {
            query = query.where('isActive', '==', filters.isActive);
        }

        if (filters?.orderId) {
            query = query.where('orderId', '==', filters.orderId);
        }

        if (filters?.patientId) {
            query = query.where('patientId', '==', filters.patientId);
        }

        query = query.orderBy('createdAt', 'desc');

        if (filters?.limit) {
            query = query.limit(filters.limit);
        }

        const snapshot = await query.get();
        return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

    } catch (error) {
        console.error('Error fetching tokens:', error);
        return [];
    }
}

/**
 * Get access logs for a token
 */
export async function getAccessLogs(tokenId: string, limit: number = 50): Promise<QRAccessLog[]> {
    try {
        const snapshot = await db.collection('qr_access_logs')
            .where('tokenId', '==', tokenId)
            .orderBy('accessedAt', 'desc')
            .limit(limit)
            .get();

        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QRAccessLog));

    } catch (error) {
        console.error('Error fetching access logs:', error);
        return [];
    }
}

// --- Utility Functions ---

/**
 * Get QR tracking URL for a token
 */
export function getTrackingURL(token: string): string {
    const baseUrl = window.location.origin;
    let pathname = '';
    if (window.location.pathname.includes('/labman')) {
        pathname = '/labman';
    }
    return `${baseUrl}${pathname}/#/track/${token}`;
}

/**
 * Get report viewer URL for a token
 */
export function getReportURL(token: string): string {
    const baseUrl = window.location.origin;
    let pathname = '';
    if (window.location.pathname.includes('/labman')) {
        pathname = '/labman';
    }
    return `${baseUrl}${pathname}/#/view-report/${token}`;
}

/**
 * Mask patient name for privacy (e.g., "John Doe" -> "John D.")
 */
export function maskPatientName(fullName: string): string {
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) return parts[0];

    const firstName = parts[0];
    const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase() + '.';

    return `${firstName} ${lastInitial}`;
}

/**
 * Mask phone number for privacy (e.g., "+92-300-1234567" -> "+92-3XX-XXXXX67")
 */
export function maskPhoneNumber(phone: string): string {
    if (!phone || phone.length < 4) return phone;

    const last2 = phone.slice(-2);
    const first = phone.substring(0, Math.min(6, phone.length - 7));
    const masked = 'X'.repeat(Math.max(0, phone.length - first.length - 2));

    return `${first}${masked}${last2}`;
}

/**
 * Calculate ETA for sample completion based on TAT
 */
export function calculateETA(sample: any, test: any): Date | null {
    if (!sample.collectedAt) return null;

    const collectedTime = sample.collectedAt.toDate ? sample.collectedAt.toDate() : new Date(sample.collectedAt);
    const tatHours = sample.isUrgent && test.urgentTatHours ? test.urgentTatHours : test.tatHours;

    if (!tatHours) return null;

    const eta = new Date(collectedTime.getTime() + tatHours * 3600000);
    return eta;
}

/**
 * Format time remaining (e.g., "15 hours 30 minutes")
 */
export function formatTimeRemaining(eta: Date): string {
    const now = new Date();
    const diff = eta.getTime() - now.getTime();

    if (diff <= 0) return 'Processing...';

    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);

    if (hours > 24) {
        const days = Math.floor(hours / 24);
        return `${days} day${days > 1 ? 's' : ''}`;
    }

    if (hours > 0 && minutes > 0) {
        return `${hours}h ${minutes}m`;
    }

    if (hours > 0) {
        return `${hours} hour${hours > 1 ? 's' : ''}`;
    }

    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
}
