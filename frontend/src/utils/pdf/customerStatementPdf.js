import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrencyPK, formatDatePK, formatNumberPK, toInputDatePK } from '../pkFormat';

/**
 * Generate a professional customer account statement PDF
 * @param {Object} params
 * @param {Object} params.customer - Customer object with userId, customerCode, phone, address
 * @param {Array} params.statementRows - Array of transaction rows with date, description, debit, credit, runningBalance
 * @param {Object} params.summary - Summary object with sales, payments, totalFuel, openingBalance, closingBalance
 * @param {Object} params.filters - Date range filters {startDate, endDate}
 * @param {Object} params.totals - Totals object with sales and payments
 * @param {Object} params.company - Company info {name, phone}
 * @returns {void} - Downloads PDF to user's device
 */
export const generateCustomerStatementPdf = ({
  customer,
  statementRows = [],
  summary = {},
  filters = {},
  totals = {},
  company = {},
}) => {
  if (!customer) {
    throw new Error('Customer data is required');
  }

  // Sanitize and validate all inputs
  const customerCode = String(customer.customerCode || 'UNKNOWN').trim();
  const customerName = String(customer.userId?.name || 'Unknown Customer').trim();
  const customerPhone = String(customer.phone || '').trim();
  const customerAddress = String(customer.address || '').trim();
  const companyName = String(company.name || 'Adil Petroleum').trim();
  const companyPhone = String(company.phone || '').trim();

  // Ensure statement rows is an array
  const safeStatementRows = Array.isArray(statementRows) ? statementRows : [];
  const safeTotals = totals || {};
  const salesTotal = Number(safeTotals.sales) || 0;
  const paymentsTotal = Number(safeTotals.payments) || 0;

  // Initialize PDF
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - 2 * margin;

  // Color scheme
  const colors = {
    primary: '#1a202c',
    secondary: '#718096',
    success: '#48bb78',
    error: '#f56565',
    border: '#e2e8f0',
    headerBg: '#f7fafc',
  };

  // Formatters
  const formatMoney = (value) => formatCurrencyPK(Math.abs(Number(value) || 0));
  
  // Custom date formatter for PDF: "11th Aug, 25" format
  const formatDateCustom = (dateStr) => {
    if (!dateStr) return 'Beginning';
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = String(date.getFullYear()).slice(-2); // Last 2 digits of year
    
    // Add ordinal suffix to day (1st, 2nd, 3rd, 4th, etc.)
    let suffix = 'th';
    if (day % 10 === 1 && day !== 11) suffix = 'st';
    else if (day % 10 === 2 && day !== 12) suffix = 'nd';
    else if (day % 10 === 3 && day !== 13) suffix = 'rd';
    
    return `${day}${suffix} ${month}, ${year}`;
  };
  
  const formatDate = (dateStr) => formatDateCustom(dateStr);
  const getBalanceColor = (balance) => {
    const num = Number(balance || 0);
    return num > 0 ? colors.error : colors.success;
  };

  // Helper: Add header/footer to each page
  const addHeaderFooter = (pageNum, totalPages) => {
    try {
      // Header - on all pages
      pdf.setFont('Helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.setTextColor(colors.primary);
      pdf.text(String(companyName || 'Statement'), margin, margin + 5);

      // Subtitle - only on first page
      if (pageNum === 1) {
        pdf.setFont('Helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(colors.secondary);
        if (companyPhone) {
          pdf.text(String(companyPhone), margin, margin + 10);
        }
      }

      // Page divider - on all pages
      pdf.setDrawColor(colors.border);
      pdf.line(margin, margin + 13, pageWidth - margin, margin + 13);

      // Footer separator line - on all pages
      pdf.setDrawColor(colors.border);
      pdf.setLineWidth(0.5);
      pdf.line(margin, pageHeight - margin - 5, pageWidth - margin, pageHeight - margin - 5);

      // Footer text with gap - on all pages
      pdf.setFont('Helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(colors.secondary);
      
      // Left side: Company name and date
      pdf.text('Adil Petroleum', margin, pageHeight - margin - 2);

      // Right side: Page number - will be added after all content is rendered
      // (placeholder, actual page numbers added at the end)
    } catch (err) {
      console.warn('Header/footer rendering warning:', err.message);
    }
  };

  // Helper: Add page numbers after all content is rendered
  const addPageNumbers = () => {
    const totalPages = Math.max(1, pdf.internal.pages.length - 1);
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFont('Helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(colors.secondary);
      const pageText = `Page ${i} of ${totalPages}`;
      pdf.text(pageText, pageWidth - margin - 30, pageHeight - margin - 2);
    }
  };

  // Helper: Format currency with color
  const getCurrencyColor = (value) => {
    const num = Number(value || 0);
    if (num > 0) {
      return colors.error; // Debit in red
    } else if (num < 0) {
      return colors.success; // Credit in green
    }
    return colors.primary;
  };

  // Helper: Escape HTML in text
  const escapeText = (text) => {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  // ===== PAGE 1: Header and Summary =====
  const headerStartY = margin + 18;
  let currentY = headerStartY;

  // Title
  pdf.setFont('Helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.setTextColor(colors.primary);
  pdf.text('Customer Account Statement', margin, currentY);
  currentY += 8;

  // Customer details box
  pdf.setFont('Helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(colors.secondary);

  const detailsY = currentY;
  const colWidth = contentWidth / 2;

  // Left column: Account Holder
  pdf.setFont('Helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.text('ACCOUNT HOLDER', margin, detailsY);

  pdf.setFont('Helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(colors.primary);
  pdf.text(customerName, margin, detailsY + 5);

  pdf.setFont('Helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(colors.secondary);
  pdf.text(`Code: ${customerCode}`, margin, detailsY + 10);

  // Right column: Contact Information
  pdf.setFont('Helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(colors.secondary);
  pdf.text('CONTACT INFORMATION', margin + colWidth, detailsY);

  pdf.setFont('Helvetica', 'normal');
  pdf.setFontSize(8);
  let contactY = detailsY + 5;
  
  if (customerPhone) {
    pdf.text(`Phone: ${customerPhone}`, margin + colWidth, contactY);
    contactY += 5;
  }
  
  if (customerAddress) {
    const addressFullText = `Address: ${customerAddress}`;
    const addressLines = pdf.splitTextToSize(
      addressFullText,
      colWidth - 2
    );
    let addressLineY = contactY;
    for (let i = 0; i < addressLines.length; i++) {
      if (addressLineY < pdf.internal.pageSize.getHeight() - margin) {
        pdf.text(addressLines[i], margin + colWidth, addressLineY);
        addressLineY += 3.5;
      }
    }
  }

  currentY = detailsY + 18;

  // Separator line after customer details
  pdf.setDrawColor(colors.border);
  pdf.setLineWidth(0.5);
  pdf.line(margin, currentY - 1, pageWidth - margin, currentY - 1);

  // Statement period FIRST
  const periodY = currentY + 3;
  pdf.setFont('Helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(colors.secondary);
  pdf.text('STATEMENT PERIOD', margin, periodY);

  pdf.setFont('Helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(colors.primary);
  const today = toInputDatePK(); // Get today's date in YYYY-MM-DD format (Pakistan timezone)
  const periodStart = formatDate(filters.startDate || today);
  const periodEnd = formatDate(filters.endDate || today);
  pdf.text(`${periodStart} - ${periodEnd}`, margin, periodY + 5);

  // Separator line after statement period
  pdf.setDrawColor(colors.border);
  pdf.setLineWidth(0.5);
  pdf.line(margin, periodY + 8, pageWidth - margin, periodY + 8);

  // Separator line after statement period
  pdf.setDrawColor(colors.border);
  pdf.setLineWidth(0.5);
  pdf.line(margin, periodY + 8, pageWidth - margin, periodY + 8);

  // Summary - Partitioned layout with columns SECOND
  const summaryY = periodY + 12;
  const summaryColWidth = contentWidth / 3;
  const dividerX1 = margin + summaryColWidth;
  const dividerX2 = margin + 2 * summaryColWidth;

  // Draw vertical dividers
  pdf.setDrawColor(colors.border);
  pdf.line(dividerX1, summaryY - 2, dividerX1, summaryY + 14);
  pdf.line(dividerX2, summaryY - 2, dividerX2, summaryY + 14);

  // Column 1: Total Debit
  pdf.setFont('Helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(colors.secondary);
  pdf.text('Total Debit', margin + 2, summaryY);
  pdf.setFont('Helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(colors.primary);
  pdf.text(formatMoney(salesTotal), margin + 2, summaryY + 8);

  // Column 2: Total Credit
  pdf.setFont('Helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(colors.secondary);
  pdf.text('Total Credit', dividerX1 + 2, summaryY);
  pdf.setFont('Helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(colors.primary);
  pdf.text(formatMoney(paymentsTotal), dividerX1 + 2, summaryY + 8);

  // Column 3: Net Balance
  const closingBalance = salesTotal - paymentsTotal;
  pdf.setFont('Helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(colors.secondary);
  pdf.text('Net Balance', dividerX2 + 2, summaryY);
  pdf.setFont('Helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(colors.primary);
  pdf.text(formatMoney(closingBalance), dividerX2 + 2, summaryY + 8);

  currentY = summaryY + 16;

  currentY += 12;

  // ===== TRANSACTIONS TABLE =====
  const tableStartY = currentY;

  // Prepare table data
  const tableData = safeStatementRows.map((tx) => {
    try {
      const date = formatDate(tx.transactionDate || tx.date || '');
      const tafseel = escapeText(
        tx.transactionType === 'fuel_sale'
          ? 'Sale'
          : tx.transactionType === 'payment'
          ? 'Payment'
          : tx.notes || tx.description || '-'
      );
      const debitVal = Number(tx.debit) || 0;
      const creditVal = Number(tx.credit) || 0;
      const debit = debitVal > 0 ? formatMoney(debitVal) : '-';
      const credit = creditVal > 0 ? formatMoney(creditVal) : '-';
      const balanceVal = Number(tx.runningBalance || 0);
      const balance = formatMoney(Math.abs(balanceVal));

      return [
        { content: String(date), styles: { fontSize: 8 } },
        { content: String(tafseel), styles: { fontSize: 8 } },
        {
          content: String(debit),
          styles: {
            fontSize: 8,
            textColor: debitVal > 0 ? colors.error : colors.primary,
            halign: 'right',
          },
        },
        {
          content: String(credit),
          styles: {
            fontSize: 8,
            textColor: creditVal > 0 ? colors.success : colors.primary,
            halign: 'right',
          },
        },
        {
          content: String(balance),
          styles: {
            fontSize: 8,
            textColor: getBalanceColor(balanceVal),
            halign: 'right',
            fontStyle: 'bold',
          },
        },
      ];
    } catch (err) {
      console.warn('Error processing transaction row:', err.message);
      return [
        { content: 'Error', styles: { fontSize: 8 } },
        { content: 'Error processing row', styles: { fontSize: 8 } },
        { content: '-', styles: { fontSize: 8, halign: 'right' } },
        { content: '-', styles: { fontSize: 8, halign: 'right' } },
        { content: '-', styles: { fontSize: 8, halign: 'right' } },
      ];
    }
  });

  // Add table
  try {
    autoTable(pdf, {
      startY: tableStartY,
      margin: { top: 28, right: margin, bottom: 20, left: margin },
      head: [
        [
          { content: 'Date', styles: { fontSize: 8, fontStyle: 'bold', halign: 'left' } },
          { content: 'Details', styles: { fontSize: 8, fontStyle: 'bold', halign: 'left' } },
          { content: 'Debit (-)', styles: { fontSize: 8, fontStyle: 'bold', halign: 'right' } },
          { content: 'Credit (+)', styles: { fontSize: 8, fontStyle: 'bold', halign: 'right' } },
          { content: 'Balance', styles: { fontSize: 8, fontStyle: 'bold', halign: 'right' } },
        ],
      ],
      body: tableData.length > 0 ? tableData : [[{ content: 'No transactions found', colSpan: 5 }]],
      bodyStyles: {
        fillColor: undefined,
        textColor: colors.primary,
        lineColor: colors.border,
        lineWidth: 0.3,
      },
      headStyles: {
        fillColor: colors.headerBg,
        textColor: colors.secondary,
        lineColor: colors.border,
        lineWidth: 0.3,
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 35, halign: 'right' },
        3: { cellWidth: 35, halign: 'right' },
        4: { cellWidth: 35, halign: 'right' },
      },
      alternateRowStyles: {
        fillColor: [247, 250, 252], // #f7fafc
      },
      didDrawPage: (data) => {
        const pageNum = data.pageNumber;
        addHeaderFooter(pageNum);
      },
    });
  } catch (err) {
    console.error('Error generating PDF table:', err.message);
    // Add a simple fallback message
    pdf.setFont('Helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(colors.primary);
    pdf.text('Statement table could not be rendered.', margin, tableStartY + 20);
  }

  // Generate timestamp for final page
  try {
    const now = new Date();
    const dayNum = String(now.getDate()).padStart(2, '0');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = monthNames[now.getMonth()];
    const year = now.getFullYear();
    const generatedText = `Report Generated on ${dayNum} ${monthName}, ${year}`;

    const lastPage = pdf.internal.pages.length - 1;
    if (lastPage >= 0) {
      const finalPageHeight = pdf.internal.pages[lastPage].pageHeight || pageHeight;
      pdf.setFont('Helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(colors.secondary);
      pdf.text(generatedText, margin, finalPageHeight - 8);
    }
  } catch (err) {
    console.warn('Footer timestamp generation warning:', err.message);
  }

  // Generate filename
  const safeName = String(customerCode || 'customer')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  const now = new Date();
  const filename = `Customer_Statement_${safeName}_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.pdf`;

  // Add page numbers after all content is rendered
  addPageNumbers();

  // Download PDF
  pdf.save(filename);
};
