// PATIENT-CENTRIC BATCH WORKFLOW - HELPER TYPES & COMPONENTS
// This file contains the refactored patient-centric workflow components

import React, { useState, useEffect, useMemo } from 'react';
import firebase from 'firebase/compat/app';

/**
 * PatientVisit represents a complete patient order with all associated tests
 * This is the PRIMARY unit of work across all modules
 */
interface PatientVisit {
    orderId: string;
    patientId: string;
    patientName: string;
    patientAge: number;
    patientGender: string;
    patientPhone?: string;
    doctorName?: string;
    isUrgent: boolean;
    createdAt: any;

    // Aggregated test information
    tests: Sample[];
    testCount: number;

    // Workflow status (derived from individual test statuses)
    overallStatus: 'ordered' | 'partial_collected' | 'collected' | 'analyzing' | 'partial_reported' | 'ready' | 'reported';

    // Collection progress
    collectedCount: number;
    pendingCollectionCount: number;

    // Analysis progress
    analyzedCount: number;
    pendingAnalysisCount: number;

    // Approval progress
    approvedCount: number;
    pendingApprovalCount: number;
}

/**
 * Helper function to group samples by orderId/patientVisit
 */
export function groupSamplesByVisit(samples: Sample[]): PatientVisit[] {
    const visitMap: Record<string, PatientVisit> = {};

    samples.forEach(sample => {
        const key = sample.orderId || sample.patientId; // Fallback to patientId

        if (!visitMap[key]) {
            visitMap[key] = {
                orderId: sample.orderId,
                patientId: sample.patientId,
                patientName: sample.patientName,
                patientAge: sample.patientAge,
                patientGender: sample.patientGender,
                patientPhone: sample.patientPhone,
                doctorName: sample.doctorName,
                isUrgent: sample.isUrgent || false,
                createdAt: sample.createdAt,
                tests: [],
                testCount: 0,
                overallStatus: 'ordered',
                collectedCount: 0,
                pendingCollectionCount: 0,
                analyzedCount: 0,
                pendingAnalysisCount: 0,
                approvedCount: 0,
                pendingApprovalCount: 0
            };
        }

        visitMap[key].tests.push(sample);
    });

    // Calculate aggregated status for each visit
    Object.values(visitMap).forEach(visit => {
        visit.testCount = visit.tests.length;

        // Count status
        visit.tests.forEach(test => {
            if (test.status === 'collected' || test.status === 'analyzing' || test.status === 'review' || test.status === 'reported') {
                visit.collectedCount++;
            } else {
                visit.pendingCollectionCount++;
            }

            if (test.status === 'analyzing' || test.status === 'review' || test.status === 'reported') {
                visit.analyzedCount++;
            } else if (test.status === 'collected') {
                visit.pendingAnalysisCount++;
            }

            if (test.status === 'reported') {
                visit.approvedCount++;
            } else if (test.status === 'review') {
                visit.pendingApprovalCount++;
            }
        });

        // Determine overall status
        if (visit.approvedCount === visit.testCount) {
            visit.overallStatus = 'reported';
        } else if (visit.pendingApprovalCount > 0) {
            visit.overallStatus = visit.approvedCount > 0 ? 'partial_reported' : 'ready';
        } else if (visit.analyzedCount > 0) {
            visit.overallStatus = 'analyzing';
        } else if (visit.collectedCount === visit.testCount) {
            visit.overallStatus = 'collected';
        } else if (visit.collectedCount > 0) {
            visit.overallStatus = 'partial_collected';
        } else {
            visit.overallStatus = 'ordered';
        }
    });

    return Object.values(visitMap).sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date();
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date();
        return dateB.getTime() - dateA.getTime();
    });
}

/**
 * Get status color and label for display
 */
export function getVisitStatusDisplay(status: PatientVisit['overallStatus']): { color: string; label: string; bgColor: string } {
    const statusMap = {
        'ordered': { color: 'text-gray-400', label: 'Pending Collection', bgColor: 'bg-gray-100' },
        'partial_collected': { color: 'text-yellow-600', label: 'Partial Collection', bgColor: 'bg-yellow-100' },
        'collected': { color: 'text-blue-600', label: 'Ready for Analysis', bgColor: 'bg-blue-100' },
        'analyzing': { color: 'text-indigo-600', label: 'In Analysis', bgColor: 'bg-indigo-100' },
        'partial_reported': { color: 'text-purple-600', label: 'Partial Approval', bgColor: 'bg-purple-100' },
        'ready': { color: 'text-orange-600', label: 'Awaiting Approval', bgColor: 'bg-orange-100' },
        'reported': { color: 'text-green-600', label: 'Completed', bgColor: 'bg-green-100' }
    };
    return statusMap[status] || statusMap['ordered'];
}
