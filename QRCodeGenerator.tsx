/**
 * QR Code Generator Component
 * 
 * Generates QR codes for bills and reports
 * Supports both inline display and Data URL generation for PDFs
 */

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QRCodeGeneratorProps {
    token: string;
    size?: number;
    type?: 'bill' | 'report';
    includeLabel?: boolean;
    labelText?: string;
    className?: string;
}

/**
 * Generate QR code as Data URL (for embedding in PDFs/images)
 */
export async function generateQRDataURL(
    token: string,
    size: number = 150,
    type: 'bill' | 'report' = 'bill'
): Promise<string> {
    try {
        let baseUrl = window.location.origin;
        // Handle sub-path deployments (specifically lms/labman)
        if (window.location.pathname.includes('/labman')) {
            baseUrl += '/labman';
        }

        const url = type === 'bill'
            ? `${baseUrl}/#/track/${token}`
            : `${baseUrl}/#/view-report/${token}`;

        const dataUrl = await QRCode.toDataURL(url, {
            errorCorrectionLevel: 'H', // High error correction (30%)
            margin: 2,
            width: size,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });

        return dataUrl;

    } catch (error) {
        console.error('Error generating QR code:', error);
        throw error;
    }
}

/**
 * QR Code Display Component
 */
const QRCodeGenerator: React.FC<QRCodeGeneratorProps> = ({
    token,
    size = 150,
    type = 'bill',
    includeLabel = true,
    labelText,
    className = ''
}) => {
    const [qrDataURL, setQrDataURL] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        generateQR();
    }, [token, size, type]);

    const generateQR = async () => {
        try {
            setLoading(true);
            setError('');
            const dataUrl = await generateQRDataURL(token, size, type as 'bill' | 'report');
            setQrDataURL(dataUrl);
        } catch (err) {
            console.error('QR generation error:', err);
            setError('Failed to generate QR code');
        } finally {
            setLoading(false);
        }
    };

    const getDefaultLabel = () => {
        if (labelText) return labelText;
        return type === 'bill'
            ? 'Scan to Track Your Tests'
            : 'Scan for Online Report';
    };

    if (loading) {
        return (
            <div
                className={`flex flex-col items-center justify-center ${className}`}
                style={{ width: size, height: size + (includeLabel ? 30 : 0) }}
            >
                <div className="w-full h-full bg-gray-100 rounded animate-pulse flex items-center justify-center">
                    <span className="text-xs text-gray-400">Generating QR...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div
                className={`flex flex-col items-center justify-center ${className}`}
                style={{ width: size, height: size + (includeLabel ? 30 : 0) }}
            >
                <div className="w-full h-full bg-red-50 rounded flex items-center justify-center border-2 border-red-200 border-dashed">
                    <span className="text-xs text-red-600 px-2 text-center">{error}</span>
                </div>
            </div>
        );
    }

    return (
        <div className={`flex flex-col items-center ${className}`}>
            <div
                className="border-2 border-dashed border-gray-300 rounded p-2 bg-white"
                style={{ width: size + 8, height: size + 8 }}
            >
                <img
                    src={qrDataURL}
                    alt="QR Code"
                    width={size}
                    height={size}
                    className="w-full h-full"
                />
            </div>
            {includeLabel && (
                <p className="text-xs text-center mt-2 font-medium text-sky-600 max-w-[150px]">
                    {getDefaultLabel()}
                </p>
            )}
        </div>
    );
};

export default QRCodeGenerator;

/**
 * Printable QR Code Component (for invoice/report printing)
 */
export const PrintableQRCode: React.FC<{
    token: string;
    size?: number;
    type?: 'bill' | 'report';
    position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
    showLabel?: boolean;
}> = ({
    token,
    size = 150,
    type = 'bill',
    position = 'top-right',
    showLabel = true
}) => {
        const [qrDataURL, setQrDataURL] = useState<string>('');

        useEffect(() => {
            generateQRDataURL(token, size, type as 'bill' | 'report').then(setQrDataURL);
        }, [token, size, type]);

        const getPositionStyles = () => {
            const baseStyles = {
                position: 'absolute' as const,
                zIndex: 10
            };

            switch (position) {
                case 'top-right':
                    return { ...baseStyles, top: 10, right: 10 };
                case 'top-left':
                    return { ...baseStyles, top: 10, left: 10 };
                case 'bottom-right':
                    return { ...baseStyles, bottom: 10, right: 10 };
                case 'bottom-left':
                    return { ...baseStyles, bottom: 10, left: 10 };
                default:
                    return { ...baseStyles, top: 10, right: 10 };
            }
        };

        if (!qrDataURL) return null;

        return (
            <div style={getPositionStyles()}>
                <div style={{ textAlign: 'center' }}>
                    <img
                        src={qrDataURL}
                        alt="QR Code"
                        width={size}
                        height={size}
                        style={{
                            display: 'block',
                            border: '1px solid #e5e7eb',
                            padding: '4px',
                            background: 'white'
                        }}
                    />
                    {showLabel && (
                        <p style={{
                            fontSize: '8px',
                            color: '#0EA5E9',
                            marginTop: '4px',
                            fontWeight: 600,
                            maxWidth: `${size}px`
                        }}>
                            {type === 'bill' ? 'Scan to Track Tests' : 'View Report Online'}
                        </p>
                    )}
                </div>
            </div>
        );
    };
