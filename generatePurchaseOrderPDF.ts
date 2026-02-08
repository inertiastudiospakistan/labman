import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface PurchaseOrder {
    id: string;
    poNumber: string;
    orderDate: any;
    supplierName: string;
    supplierPhone?: string;
    supplierAddress?: string;
    items: {
        itemId: string;
        itemName: string;
        description?: string;
        quantity: number;
        unit: string;
        unitPrice: number;
        totalPrice: number;
        batchNumber?: string;
        quantityUsed: number;
        quantityRemaining: number;
        valueUsed: number;
        valueRemaining: number;
    }[];
    subtotal: number;
    taxPercentage: number;
    taxAmount: number;
    totalAmount: number;
    paymentTerms: string;
    paymentDueDate: any;
    paymentStatus: 'unpaid' | 'paid';
    paidDate?: any;
    paidBy?: string;
    totalValueUsed: number;
    totalValueRemaining: number;
    usagePercentage: number;
    referenceNumber?: string;
    notes?: string;
    createdBy: string;
    createdAt: any;
    status: 'active' | 'fully_used' | 'cancelled';
}

export const generatePurchaseOrderPDF = (po: PurchaseOrder) => {
    const doc = new jsPDF();

    const formatDate = (date: any) => {
        if (!date) return '--';
        try {
            const d = date.toDate ? date.toDate() : new Date(date);
            return d.toLocaleDateString();
        } catch (e) {
            return '--';
        }
    };

    const formatDateTime = (date: any) => {
        if (!date) return '--';
        try {
            const d = date.toDate ? date.toDate() : new Date(date);
            return d.toLocaleString();
        } catch (e) {
            return '--';
        }
    };

    // Colors
    const primaryColor: [number, number, number] = [59, 130, 246]; // Blue
    const textDark: [number, number, number] = [31, 41, 55]; // Gray 800
    const textLight: [number, number, number] = [107, 114, 128]; // Gray 500

    // Company Header
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 35, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('LABPRO PLUS', 15, 15);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Diagnostic OS', 15, 22);
    doc.text('Laboratory Management System', 15, 27);

    // Purchase Order Title & Number
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('PURCHASE ORDER', 140, 15);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`PO #: ${po.poNumber}`, 140, 22);
    doc.text(`Date: ${formatDate(po.orderDate)}`, 140, 28);

    let yPos = 45;

    // Supplier Details Box
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(15, yPos, 180, 25, 2, 2, 'FD');

    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('SUPPLIER DETAILS', 20, yPos + 6);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Name: ${po.supplierName}`, 20, yPos + 12);
    if (po.supplierPhone) {
        doc.text(`Phone: ${po.supplierPhone}`, 20, yPos + 18);
    }
    if (po.supplierAddress) {
        doc.text(`Address: ${po.supplierAddress}`, 110, yPos + 12, { maxWidth: 80 });
    }

    yPos += 32;

    // Line Items Table
    const tableData = po.items.map((item, index) => [
        (index + 1).toString(),
        item.itemName + (item.batchNumber ? `\n(Batch: ${item.batchNumber})` : ''),
        item.quantity.toString(),
        item.unit,
        `$${item.unitPrice.toFixed(2)}`,
        `$${item.totalPrice.toFixed(2)}`
    ]);

    (doc as any).autoTable({
        startY: yPos,
        head: [['#', 'Item Name', 'Qty', 'Unit', 'Unit Price', 'Total']],
        body: tableData,
        theme: 'grid',
        headStyles: {
            fillColor: primaryColor,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 10
        },
        styles: {
            fontSize: 9,
            cellPadding: 3
        },
        columnStyles: {
            0: { cellWidth: 10 },
            1: { cellWidth: 70 },
            2: { cellWidth: 20, halign: 'right' },
            3: { cellWidth: 20, halign: 'center' },
            4: { cellWidth: 30, halign: 'right' },
            5: { cellWidth: 30, halign: 'right' }
        }
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Totals Box
    const totalsX = 130;
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(totalsX, yPos, 65, 25, 2, 2, 'D');

    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.setFontSize(10);
    doc.text('Subtotal:', totalsX + 5, yPos + 6);
    doc.text(`$${po.subtotal.toFixed(2)}`, totalsX + 60, yPos + 6, { align: 'right' });

    doc.text(`Tax (${po.taxPercentage}%):`, totalsX + 5, yPos + 12);
    doc.text(`$${po.taxAmount.toFixed(2)}`, totalsX + 60, yPos + 12, { align: 'right' });

    doc.setDrawColor(textDark[0], textDark[1], textDark[2]);
    doc.line(totalsX + 5, yPos + 15, totalsX + 60, yPos + 15);

    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.roundedRect(totalsX, yPos + 17, 65, 8, 1, 1, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('TOTAL:', totalsX + 5, yPos + 22);
    doc.text(`$${po.totalAmount.toFixed(2)}`, totalsX + 60, yPos + 22, { align: 'right' });

    yPos += 32;

    // Payment Terms & Status
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(15, yPos, 85, 20, 2, 2, 'FD');
    doc.roundedRect(105, yPos, 90, 20, 2, 2, 'FD');

    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('PAYMENT TERMS', 20, yPos + 5);
    doc.setFont('helvetica', 'normal');
    doc.text(`Terms: ${po.paymentTerms}`, 20, yPos + 11);
    doc.text(`Due Date: ${formatDate(po.paymentDueDate)}`, 20, yPos + 16);

    doc.setFont('helvetica', 'bold');
    doc.text('PAYMENT STATUS', 110, yPos + 5);
    doc.setFont('helvetica', 'normal');

    if (po.paymentStatus === 'paid') {
        doc.setTextColor(21, 128, 61); // Green
        doc.setFont('helvetica', 'bold');
        doc.text('✓ PAID', 110, yPos + 11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(textLight[0], textLight[1], textLight[2]);
        doc.setFontSize(8);
        doc.text(`Paid on: ${formatDate(po.paidDate)}`, 110, yPos + 15);
        doc.text(`By: ${po.paidBy || '--'}`, 110, yPos + 18);
    } else {
        doc.setTextColor(185, 28, 28); // Red
        doc.setFont('helvetica', 'bold');
        doc.text('✗ UNPAID', 110, yPos + 11);
    }

    yPos += 27;

    // Usage Tracking
    doc.setDrawColor(147, 51, 234); // Purple
    doc.setFillColor(250, 245, 255); // Light purple
    doc.roundedRect(15, yPos, 180, 18, 2, 2, 'FD');

    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('INVENTORY USAGE TRACKING', 20, yPos + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Value Used: $${po.totalValueUsed.toFixed(2)}`, 20, yPos + 11);
    doc.text(`Value Remaining: $${po.totalValueRemaining.toFixed(2)}`, 80, yPos + 11);
    doc.text(`Usage Rate: ${po.usagePercentage.toFixed(1)}%`, 155, yPos + 11);

    // Usage progress bar
    const barWidth = 175;
    const barHeight = 3;
    const barX = 20;
    const barY = yPos + 13;

    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(229, 231, 235); // Gray background
    doc.roundedRect(barX, barY, barWidth, barHeight, 1, 1, 'FD');

    const progressWidth = (barWidth * po.usagePercentage) / 100;
    doc.setFillColor(147, 51, 234); // Purple
    doc.roundedRect(barX, barY, progressWidth, barHeight, 1, 1, 'F');

    yPos += 23;

    // Additional Details
    if (po.referenceNumber || po.notes) {
        doc.setDrawColor(200, 200, 200);
        doc.setFillColor(249, 250, 251);
        const detailsHeight = po.notes ? 15 : 10;
        doc.roundedRect(15, yPos, 180, detailsHeight, 2, 2, 'FD');

        doc.setTextColor(textDark[0], textDark[1], textDark[2]);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('ADDITIONAL DETAILS', 20, yPos + 5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        let detailY = yPos + 10;

        if (po.referenceNumber) {
            doc.text(`Reference #: ${po.referenceNumber}`, 20, detailY);
            detailY += 4;
        }

        if (po.notes) {
            doc.text(`Notes: ${po.notes}`, 20, detailY, { maxWidth: 170 });
        }

        yPos += detailsHeight + 5;
    }

    // Footer
    doc.setDrawColor(200, 200, 200);
    doc.line(15, yPos + 5, 195, yPos + 5);

    doc.setTextColor(textLight[0], textLight[1], textLight[2]);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated by: ${po.createdBy}`, 105, yPos + 10, { align: 'center' });
    doc.text(`Generated on: ${formatDateTime(po.createdAt)}`, 105, yPos + 14, { align: 'center' });

    // Save PDF
    doc.save(`${po.poNumber}.pdf`);
};
