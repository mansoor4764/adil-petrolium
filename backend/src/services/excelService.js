'use strict';

const ExcelJS = require('exceljs');
const logger = require('../utils/logger');
const Transaction = require('../models/Transaction');
const CustomerProfile = require('../models/CustomerProfile');

const PK_TIMEZONE = 'Asia/Karachi';

const FUEL_LABELS = { pmg: 'PMG', hsd: 'HSD', nr: 'NR' };
const TYPE_LABELS = {
  fuel_sale: 'Sales',
  payment: 'Receipts',
  adjustment: 'Adjustment',
  credit_note: 'Credit Note',
  opening_balance: 'Opening Balance',
};

const money = (value) => `Rs ${Number(value || 0).toLocaleString('en-PK', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;
const qty = (value) => Number(value || 0).toFixed(2);
const fmtDate = (value) => new Date(value).toLocaleDateString('en-PK', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: PK_TIMEZONE,
});
const fmtDateTime = (value) =>
  new Date(value).toLocaleString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: PK_TIMEZONE,
  });

/** Pakistan (UTC+5) calendar bounds as UTC instants — host TZ independent */
const parsePkDateStart = (dateStr) => {
  const [year, month, day] = String(dateStr).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, -5, 0, 0, 0));
};

const parsePkDateEnd = (dateStr) => {
  const [year, month, day] = String(dateStr).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 18, 59, 59, 999));
};

/** Accept YYYY-MM-DD string or Date (already parsed by caller). */
const coercePkRangeStart = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  return parsePkDateStart(value);
};

const coercePkRangeEnd = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  return parsePkDateEnd(value);
};

/** Debit/credit columns for ledger (credit notes use negative totalAmount). */
const ledgerDebitCredit = (tx) => {
  const total = Number(tx.totalAmount || 0);
  const payment = Number(tx.paymentReceived || 0);
  let debit = '';
  let credit = '';
  if (total > 0) debit = money(total);
  const creditAmount = payment + (total < 0 ? Math.abs(total) : 0);
  if (creditAmount > 0) credit = money(creditAmount);
  return { debit, credit };
};

const parsePkMonthStart = (year, month) =>
  new Date(Date.UTC(year, month - 1, 1, -5, 0, 0, 0));

const parsePkMonthEnd = (year, month) => {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1, lastDay, 18, 59, 59, 999));
};

const parsePkYearStart = (year) => new Date(Date.UTC(year, 0, 1, -5, 0, 0, 0));

const parsePkYearEnd = (year) => new Date(Date.UTC(year, 11, 31, 18, 59, 59, 999));

const safeSheetName = (value, fallback = 'Sheet') => {
  const cleaned = String(value || fallback)
    .replace(/[\\/\?\*\[\]:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, 31) || fallback;
};

const applyBorder = (row, from = 1, to = 9) => {
  for (let index = from; index <= to; index += 1) {
    row.getCell(index).border = {
      top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
    };
  }
};

const buildDetailText = (tx) => {
  if (tx.transactionType === 'fuel_sale') {
    const product = FUEL_LABELS[tx.fuelType] || 'Fuel';
    return `${product} sale${tx.referenceNo ? ` - Ref ${tx.referenceNo}` : ''}${tx.notes ? ` - ${tx.notes}` : ''}`;
  }

  if (tx.transactionType === 'payment') {
    return `Payment received${tx.referenceNo ? ` - Ref ${tx.referenceNo}` : ''}${tx.notes ? ` - ${tx.notes}` : ''}`;
  }

  if (tx.transactionType === 'opening_balance') {
    return `Opening balance${tx.notes ? ` - ${tx.notes}` : ''}`;
  }

  if (tx.transactionType === 'credit_note') {
    return `Credit note${tx.referenceNo ? ` - Ref ${tx.referenceNo}` : ''}${tx.notes ? ` - ${tx.notes}` : ''}`;
  }

  return `${TYPE_LABELS[tx.transactionType] || 'Entry'}${tx.notes ? ` - ${tx.notes}` : ''}`;
};

const createWorkbook = () => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Adil Petroleum';
  workbook.created = new Date();
  return workbook;
};

const getCustomerProfile = async (customerId) => {
  if (!customerId) return null;

  return CustomerProfile.findById(customerId)
    .populate('userId', 'name email')
    .lean();
};

const loadTransactions = async ({ startDate, endDate, customerId = null }) => {
  const query = {
    transactionDate: { $gte: startDate, $lte: endDate },
    isVoided: { $ne: true },
  };

  if (customerId) {
    query.customerId = customerId;
  }

  return Transaction.find(query)
    .populate({
      path: 'customerId',
      select: 'customerCode address phone currentBalance',
      populate: { path: 'userId', select: 'name email' },
    })
    .sort({ transactionDate: 1 })
    .lean();
};

const groupTransactions = (transactions) => {
  const groups = new Map();

  transactions.forEach((tx) => {
    const customer = tx.customerId || {};
    const key = String(customer._id || tx.customerId || 'unknown');

    if (!groups.has(key)) {
      groups.set(key, {
        customer,
        transactions: [],
      });
    }

    groups.get(key).transactions.push(tx);
  });

  return [...groups.values()].sort((left, right) => {
    const leftName = left.customer?.userId?.name || left.customer?.customerCode || 'ZZZ';
    const rightName = right.customer?.userId?.name || right.customer?.customerCode || 'ZZZ';
    return leftName.localeCompare(rightName);
  });
};

const summarizeTransactions = (transactions) => {
  const productTotals = { pmg: 0, hsd: 0, nr: 0 };
  let totalDebit = 0;
  let totalCredit = 0;
  let debitCount = 0;
  let creditCount = 0;
  let closingBalance = 0;

  transactions.forEach((tx) => {
    const total = Number(tx.totalAmount || 0);
    const payment = Number(tx.paymentReceived || 0);
    const balance = Number(tx.updatedBalance || 0);
    const fuelQty = Number(tx.fuelQuantity || 0);
    const creditAmount = payment + (total < 0 ? Math.abs(total) : 0);

    if (tx.fuelType && productTotals[tx.fuelType] !== undefined) {
      productTotals[tx.fuelType] += fuelQty;
    }

    if (total > 0) {
      debitCount += 1;
      totalDebit += total;
    }
    if (creditAmount > 0) {
      creditCount += 1;
      totalCredit += creditAmount;
    }
    closingBalance = balance;
  });

  return {
    productTotals,
    totalDebit,
    totalCredit,
    debitCount,
    creditCount,
    closingBalance,
  };
};

const writeLedgerHeader = ({ worksheet, title, customerName, customerCode, address, contactNo, dateFrom, dateTo, openingBalance }) => {
  worksheet.mergeCells('A1:I1');
  worksheet.getCell('A1').value = title;
  worksheet.getCell('A1').font = { size: 16, bold: true };
  worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

  worksheet.getCell('A3').value = `Account Name: ${customerName || '-'}`;
  worksheet.getCell('A4').value = `Account Code: ${customerCode || '-'}`;
  worksheet.getCell('A5').value = `Address: ${address || '-'}`;
  worksheet.getCell('A6').value = `Contact No: ${contactNo || '-'}`;

  worksheet.getCell('G3').value = `Date From: ${dateFrom}`;
  worksheet.getCell('G4').value = `Date To: ${dateTo}`;
  worksheet.getCell('G5').value = 'Account Nature: Customer';
  worksheet.getCell('G6').value = `Opening Balance: ${money(openingBalance)}`;

  ['A3', 'A4', 'A5', 'A6', 'G3', 'G4', 'G5', 'G6'].forEach((cellRef) => {
    worksheet.getCell(cellRef).font = { bold: true };
  });

  const headerRow = worksheet.getRow(8);
  headerRow.values = ['Date', 'Bill No', 'Particulars', 'Details', 'Qty', 'Rate', 'Debit', 'Credit', 'Balance'];
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEDEDED' },
  };
  applyBorder(headerRow);
};

const writeLedgerRows = (worksheet, transactions) => {
  let runningBalance = 0;
  
  // Get opening balance from first transaction's previousBalance
  if (transactions.length > 0) {
    runningBalance = Number(transactions[0].previousBalance || 0);
  }

  transactions.forEach((tx) => {
    const fuelQty = Number(tx.fuelQuantity || 0);
    const { debit, credit } = ledgerDebitCredit(tx);
    
    // Calculate running balance based on transaction amounts
    const totalAmount = Number(tx.totalAmount || 0);
    const paymentReceived = Number(tx.paymentReceived || 0);
    runningBalance = runningBalance + totalAmount - paymentReceived;
    
    // Normalize to 2 decimal places
    const balance = Math.round(runningBalance * 100) / 100;

    const row = worksheet.addRow([
      fmtDate(tx.transactionDate),
      tx.referenceNo || '-',
      TYPE_LABELS[tx.transactionType] || tx.transactionType,
      buildDetailText(tx),
      fuelQty ? qty(fuelQty) : '',
      tx.rate ? money(tx.rate) : '',
      debit,
      credit,
      money(balance),
    ]);

    row.alignment = { vertical: 'middle' };
    applyBorder(row);
  });

  return summarizeTransactions(transactions);
};

const writeLedgerFooter = (worksheet, summary) => {
  const startRow = worksheet.lastRow.number + 2;

  worksheet.getCell(`A${startRow}`).value = 'Product';
  worksheet.getCell(`B${startRow}`).value = 'Sales Qty';
  worksheet.getCell(`E${startRow}`).value = 'Transaction Detail';
  worksheet.getCell(`G${startRow}`).value = "No's";
  worksheet.getCell(`H${startRow}`).value = 'Amount';

  ['A', 'B', 'E', 'G', 'H'].forEach((col) => {
    worksheet.getCell(`${col}${startRow}`).font = { bold: true };
  });

  worksheet.getCell(`A${startRow + 1}`).value = 'PMG';
  worksheet.getCell(`B${startRow + 1}`).value = qty(summary.productTotals.pmg);

  worksheet.getCell(`A${startRow + 2}`).value = 'HSD';
  worksheet.getCell(`B${startRow + 2}`).value = qty(summary.productTotals.hsd);

  worksheet.getCell(`A${startRow + 3}`).value = 'NR';
  worksheet.getCell(`B${startRow + 3}`).value = qty(summary.productTotals.nr);

  worksheet.getCell(`E${startRow + 1}`).value = 'Total Dr. Transactions';
  worksheet.getCell(`G${startRow + 1}`).value = summary.debitCount;
  worksheet.getCell(`H${startRow + 1}`).value = money(summary.totalDebit);

  worksheet.getCell(`E${startRow + 2}`).value = 'Total Cr. Transactions';
  worksheet.getCell(`G${startRow + 2}`).value = summary.creditCount;
  worksheet.getCell(`H${startRow + 2}`).value = money(summary.totalCredit);

  worksheet.getCell(`E${startRow + 3}`).value = 'Closing Balance';
  worksheet.getCell(`H${startRow + 3}`).value = money(summary.closingBalance);
  worksheet.getCell(`H${startRow + 3}`).font = { bold: true, color: { argb: 'FF008000' } };
};

const writeLedgerSheet = async ({ workbook, sheetName, title, periodLabel, customerId = null, transactions }) => {
  const worksheet = workbook.addWorksheet(safeSheetName(sheetName));

  worksheet.columns = [
    { key: 'date', width: 14 },
    { key: 'billNo', width: 18 },
    { key: 'particulars', width: 18 },
    { key: 'details', width: 38 },
    { key: 'qty', width: 12 },
    { key: 'rate', width: 12 },
    { key: 'debit', width: 16 },
    { key: 'credit', width: 16 },
    { key: 'balance', width: 18 },
  ];

  const profile = customerId ? await getCustomerProfile(customerId) : null;
  const firstTx = transactions[0];
  const customerName = profile?.userId?.name || firstTx?.customerId?.userId?.name || 'All Customers';
  const customerCode = profile?.customerCode || firstTx?.customerId?.customerCode || '-';
  const address = profile?.address || firstTx?.customerId?.address || '-';
  const contactNo = profile?.phone || firstTx?.customerId?.phone || '-';
  const openingBalance = transactions[0]?.previousBalance || 0;

  writeLedgerHeader({
    worksheet,
    title,
    customerName,
    customerCode,
    address,
    contactNo,
    dateFrom: periodLabel.from,
    dateTo: periodLabel.to,
    openingBalance,
  });

  const summary = writeLedgerRows(worksheet, transactions);
  if (!transactions.length) {
    worksheet.getCell('A10').value = 'No transactions found for this customer and date range.';
  }
  writeLedgerFooter(worksheet, summary);

  return worksheet;
};

const writeSummarySheet = (workbook, sheetName, title, groups, periodLabel) => {
  const worksheet = workbook.addWorksheet(safeSheetName(sheetName));
  worksheet.columns = [
    { key: 'customer', width: 24 },
    { key: 'code', width: 16 },
    { key: 'entries', width: 12 },
    { key: 'fuel', width: 14 },
    { key: 'sales', width: 16 },
    { key: 'payments', width: 16 },
    { key: 'remaining', width: 18 },
  ];

  worksheet.mergeCells('A1:G1');
  worksheet.getCell('A1').value = title;
  worksheet.getCell('A1').font = { size: 16, bold: true };
  worksheet.getCell('A1').alignment = { horizontal: 'center' };
  worksheet.getCell('A3').value = `Period: ${periodLabel.from} to ${periodLabel.to}`;
  worksheet.getCell('A3').font = { bold: true };

  const headerRow = worksheet.getRow(5);
  headerRow.values = ['Customer', 'Code', 'Entries', 'Fuel (L)', 'Sales (PKR)', 'Payments (PKR)', 'Remaining (PKR)'];
  headerRow.font = { bold: true };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEDED' } };
  applyBorder(headerRow, 1, 7);

  let rowIndex = 6;
  const grandTotals = { entries: 0, fuel: 0, sales: 0, payments: 0, remaining: 0 };

  groups.forEach((group) => {
    const customer = group.customer || {};
    const summary = summarizeTransactions(group.transactions);
    const lastBalance = summary.closingBalance;
    const row = worksheet.getRow(rowIndex);
    row.values = [
      customer.userId?.name || '—',
      customer.customerCode || '—',
      group.transactions.length,
      qty(summary.productTotals.pmg + summary.productTotals.hsd + summary.productTotals.nr),
      money(summary.totalDebit),
      money(summary.totalCredit),
      money(lastBalance),
    ];
    applyBorder(row, 1, 7);

    grandTotals.entries += group.transactions.length;
    grandTotals.fuel += summary.productTotals.pmg + summary.productTotals.hsd + summary.productTotals.nr;
    grandTotals.sales += summary.totalDebit;
    grandTotals.payments += summary.totalCredit;
    grandTotals.remaining += lastBalance;

    rowIndex += 1;
  });

  const totalRow = worksheet.getRow(rowIndex + 1);
  totalRow.values = [
    'Grand Total',
    '-',
    grandTotals.entries,
    qty(grandTotals.fuel),
    money(grandTotals.sales),
    money(grandTotals.payments),
    money(grandTotals.remaining),
  ];
  totalRow.font = { bold: true };
  applyBorder(totalRow, 1, 7);
};

const buildStatementWorkbook = async ({ title, periodLabel, startDate, endDate, customerId = null }) => {
  const workbook = createWorkbook();
  const transactions = await loadTransactions({ startDate, endDate, customerId });

  // Debug: log how many transactions were loaded for this export
  try {
    logger.info({ count: Array.isArray(transactions) ? transactions.length : 0, customerId, startDate, endDate }, 'Excel export - transactions loaded');
  } catch (err) {
    // swallow logging errors — do not break export
  }

  if (customerId) {
    await writeLedgerSheet({
      workbook,
      sheetName: 'Statement',
      title,
      periodLabel,
      customerId,
      transactions,
    });
    return workbook;
  }

  const groups = groupTransactions(transactions);
  writeSummarySheet(workbook, 'Summary', `${title} - Summary`, groups, periodLabel);

  for (const group of groups) {
    const customer = group.customer || {};
    const customerTitle = `${title} - ${customer.userId?.name || customer.customerCode || 'Customer'}`;
    await writeLedgerSheet({
      workbook,
      sheetName: customer.customerCode || customer.userId?.name || 'Customer',
      title: customerTitle,
      periodLabel,
      customerId: customer._id,
      transactions: group.transactions,
    });
  }

  return workbook;
};

const generateDailyExcel = async (date, customerId = null) => {
  const startDate = parsePkDateStart(date);
  const endDate = parsePkDateEnd(date);

  return buildStatementWorkbook({
    title: 'DAILY ACCOUNT STATEMENT',
    periodLabel: { from: fmtDate(startDate), to: fmtDate(endDate) },
    startDate,
    endDate,
    customerId,
  });
};

const generateMonthlyExcel = async (year, month, customerId = null) => {
  const startDate = parsePkMonthStart(year, month);
  const endDate = parsePkMonthEnd(year, month);

  return buildStatementWorkbook({
    title: 'MONTHLY ACCOUNT STATEMENT',
    periodLabel: { from: fmtDate(startDate), to: fmtDate(endDate) },
    startDate,
    endDate,
    customerId,
  });
};

const generateYearlyExcel = async (year, customerId = null) => {
  const startDate = parsePkYearStart(year);
  const endDate = parsePkYearEnd(year);

  return buildStatementWorkbook({
    title: 'YEARLY ACCOUNT STATEMENT',
    periodLabel: { from: fmtDate(startDate), to: fmtDate(endDate) },
    startDate,
    endDate,
    customerId,
  });
};

const generateCustomerStatement = async ({ customerId, startDate, endDate }) => {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const from = coercePkRangeStart(startDate) || parsePkDateStart(todayKey);
  const to = coercePkRangeEnd(endDate) || parsePkDateEnd(todayKey);

  return buildStatementWorkbook({
    title: 'CUSTOMER STATEMENT',
    periodLabel: { from: fmtDate(from), to: fmtDate(to) },
    startDate: from,
    endDate: to,
    customerId,
  });
};

// ─── Enhanced Daily Report with 3 sheets ─────────────────────────────────

const writeDailySummarySheet = (workbook, sheetName, title, groups, periodLabel) => {
  const worksheet = workbook.addWorksheet(safeSheetName(sheetName));
  worksheet.columns = [
    { key: 'customer', width: 24 },
    { key: 'code', width: 16 },
    { key: 'entries', width: 12 },
    { key: 'pmg', width: 14 },
    { key: 'hsd', width: 14 },
    { key: 'nr', width: 14 },
    { key: 'sales', width: 16 },
    { key: 'payments', width: 16 },
    { key: 'remaining', width: 18 },
  ];

  worksheet.mergeCells('A1:I1');
  worksheet.getCell('A1').value = title;
  worksheet.getCell('A1').font = { size: 16, bold: true };
  worksheet.getCell('A1').alignment = { horizontal: 'center' };
  worksheet.getCell('A3').value = `Period: ${periodLabel.from} to ${periodLabel.to}`;
  worksheet.getCell('A3').font = { bold: true };

  const headerRow = worksheet.getRow(5);
  headerRow.values = ['Customer', 'Code', 'Entries', 'PMG (L)', 'HSD (L)', 'NR (L)', 'Sales (PKR)', 'Payments (PKR)', 'Remaining (PKR)'];
  headerRow.font = { bold: true };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEDED' } };
  applyBorder(headerRow, 1, 9);

  let rowIndex = 6;
  const grandTotals = { entries: 0, pmg: 0, hsd: 0, nr: 0, sales: 0, payments: 0, remaining: 0 };

  groups.forEach((group) => {
    const customer = group.customer || {};
    const summary = summarizeTransactions(group.transactions);
    const lastBalance = summary.closingBalance;
    const row = worksheet.getRow(rowIndex);
    row.values = [
      customer.userId?.name || '—',
      customer.customerCode || '—',
      group.transactions.length,
      qty(summary.productTotals.pmg),
      qty(summary.productTotals.hsd),
      qty(summary.productTotals.nr),
      money(summary.totalDebit),
      money(summary.totalCredit),
      money(lastBalance),
    ];
    applyBorder(row, 1, 9);

    grandTotals.entries += group.transactions.length;
    grandTotals.pmg += summary.productTotals.pmg;
    grandTotals.hsd += summary.productTotals.hsd;
    grandTotals.nr += summary.productTotals.nr;
    grandTotals.sales += summary.totalDebit;
    grandTotals.payments += summary.totalCredit;
    grandTotals.remaining += lastBalance;

    rowIndex += 1;
  });

  const totalRow = worksheet.getRow(rowIndex + 1);
  totalRow.values = [
    'Grand Total',
    '-',
    grandTotals.entries,
    qty(grandTotals.pmg),
    qty(grandTotals.hsd),
    qty(grandTotals.nr),
    money(grandTotals.sales),
    money(grandTotals.payments),
    money(grandTotals.remaining),
  ];
  totalRow.font = { bold: true };
  applyBorder(totalRow, 1, 9);
};

const writeDetailedLedgerSheet = (workbook, sheetName, title, transactions, periodLabel) => {
  const worksheet = workbook.addWorksheet(safeSheetName(sheetName));
  worksheet.columns = [
    { key: 'time', width: 16 },
    { key: 'billNo', width: 14 },
    { key: 'customer', width: 22 },
    { key: 'particulars', width: 16 },
    { key: 'fuelType', width: 12 },
    { key: 'qty', width: 12 },
    { key: 'rate', width: 14 },
    { key: 'debit', width: 16 },
    { key: 'credit', width: 16 },
    { key: 'balance', width: 16 },
  ];

  worksheet.mergeCells('A1:J1');
  worksheet.getCell('A1').value = title;
  worksheet.getCell('A1').font = { size: 16, bold: true };
  worksheet.getCell('A1').alignment = { horizontal: 'center' };
  worksheet.getCell('A3').value = `Period: ${periodLabel.from} to ${periodLabel.to}`;
  worksheet.getCell('A3').font = { bold: true };

  const headerRow = worksheet.getRow(5);
  headerRow.values = ['Time', 'Bill No', 'Customer', 'Particulars', 'Fuel Type', 'Qty', 'Rate', 'Debit', 'Credit', 'Balance'];
  headerRow.font = { bold: true };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEDED' } };
  applyBorder(headerRow, 1, 10);

  let rowIndex = 6;
  transactions.forEach((tx) => {
    const debit = Number(tx.totalAmount || 0);
    const credit = Number(tx.paymentReceived || 0);
    const balance = Number(tx.updatedBalance || 0);
    const fuelQty = Number(tx.fuelQuantity || 0);

    const row = worksheet.getRow(rowIndex);
    row.values = [
      fmtDateTime(tx.transactionDate),
      tx.referenceNo || '-',
      tx.customerId?.userId?.name || '—',
      TYPE_LABELS[tx.transactionType] || tx.transactionType,
      tx.fuelType ? FUEL_LABELS[tx.fuelType] : '-',
      fuelQty ? qty(fuelQty) : '-',
      tx.rate ? money(tx.rate) : '-',
      debit > 0 ? money(debit) : '-',
      credit > 0 ? money(credit) : '-',
      money(balance),
    ];
    row.alignment = { vertical: 'middle' };
    applyBorder(row, 1, 10);
    rowIndex += 1;
  });

  if (!transactions.length) {
    worksheet.getCell('A7').value = 'No transactions found for this date range.';
  }
};

const writePaymentBreakdownSheet = (workbook, sheetName, title, transactions, periodLabel) => {
  const worksheet = workbook.addWorksheet(safeSheetName(sheetName));
  worksheet.columns = [
    { key: 'customer', width: 24 },
    { key: 'code', width: 16 },
    { key: 'cash', width: 16 },
    { key: 'bank', width: 16 },
    { key: 'creditNote', width: 16 },
    { key: 'total', width: 16 },
  ];

  worksheet.mergeCells('A1:F1');
  worksheet.getCell('A1').value = title;
  worksheet.getCell('A1').font = { size: 16, bold: true };
  worksheet.getCell('A1').alignment = { horizontal: 'center' };
  worksheet.getCell('A3').value = `Period: ${periodLabel.from} to ${periodLabel.to}`;
  worksheet.getCell('A3').font = { bold: true };

  const headerRow = worksheet.getRow(5);
  headerRow.values = ['Customer', 'Code', 'Cash (PKR)', 'Bank Transfer (PKR)', 'Credit Note (PKR)', 'Total (PKR)'];
  headerRow.font = { bold: true };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEDED' } };
  applyBorder(headerRow, 1, 6);

  // Group transactions by customer and payment method
  const paymentMap = new Map();
  transactions.forEach((tx) => {
    if (tx.transactionType !== 'payment') return;

    const customerId = tx.customerId?._id || 'unknown';
    const customerName = tx.customerId?.userId?.name || '—';
    const customerCode = tx.customerId?.customerCode || '—';

    if (!paymentMap.has(customerId)) {
      paymentMap.set(customerId, {
        customerName,
        customerCode,
        cash: 0,
        bank: 0,
        creditNote: 0,
        total: 0,
      });
    }

    const entry = paymentMap.get(customerId);
    const amount = Number(tx.paymentReceived || 0);
    entry.total += amount;

    // Determine payment method from notes or reference
    const notes = (tx.notes || '').toLowerCase();
    const reference = (tx.referenceNo || '').toLowerCase();

    if (notes.includes('bank') || reference.includes('bank')) {
      entry.bank += amount;
    } else if (notes.includes('credit note') || reference.includes('credit')) {
      entry.creditNote += amount;
    } else {
      entry.cash += amount;
    }
  });

  let rowIndex = 6;
  const totals = { cash: 0, bank: 0, creditNote: 0, total: 0 };

  [...paymentMap.entries()].sort((a, b) => {
    const nameA = a[1].customerName;
    const nameB = b[1].customerName;
    return nameA.localeCompare(nameB);
  }).forEach(([_, payment]) => {
    const row = worksheet.getRow(rowIndex);
    row.values = [
      payment.customerName,
      payment.customerCode,
      money(payment.cash),
      money(payment.bank),
      money(payment.creditNote),
      money(payment.total),
    ];
    row.font = { bold: payment.total > 0 ? true : false };
    applyBorder(row, 1, 6);

    totals.cash += payment.cash;
    totals.bank += payment.bank;
    totals.creditNote += payment.creditNote;
    totals.total += payment.total;

    rowIndex += 1;
  });

  const totalRow = worksheet.getRow(rowIndex + 1);
  totalRow.values = [
    'Grand Total',
    '-',
    money(totals.cash),
    money(totals.bank),
    money(totals.creditNote),
    money(totals.total),
  ];
  totalRow.font = { bold: true };
  applyBorder(totalRow, 1, 6);

  if (!transactions.some(t => t.transactionType === 'payment')) {
    worksheet.getCell('A7').value = 'No payment transactions found for this date range.';
  }
};

const generateEnhancedDailyExcel = async (date, customerId = null) => {
  const startDate = parsePkDateStart(date);
  const endDate = parsePkDateEnd(date);
  const workbook = createWorkbook();
  const transactions = await loadTransactions({ startDate, endDate, customerId });
  const periodLabel = { from: fmtDate(startDate), to: fmtDate(endDate) };

  try {
    logger.info({ count: Array.isArray(transactions) ? transactions.length : 0, customerId, startDate, endDate }, 'Excel export - transactions loaded');
  } catch (err) {
    // swallow logging errors
  }

  if (customerId) {
    // For a specific customer, show all 3 sheets filtered to that customer
    const customerTransactions = transactions;

    writeDailySummarySheet(
      workbook,
      'Daily Summary',
      'DAILY ACCOUNT STATEMENT - Summary',
      groupTransactions(customerTransactions),
      periodLabel
    );

    writeDetailedLedgerSheet(
      workbook,
      'Detailed Ledger',
      'DAILY ACCOUNT STATEMENT - Detailed Ledger',
      customerTransactions,
      periodLabel
    );

    writePaymentBreakdownSheet(
      workbook,
      'Payment Breakdown',
      'DAILY ACCOUNT STATEMENT - Payment Breakdown',
      customerTransactions,
      periodLabel
    );
  } else {
    // For all customers, show 3 sheets
    const groups = groupTransactions(transactions);

    writeDailySummarySheet(
      workbook,
      'Daily Summary',
      'DAILY ACCOUNT STATEMENT - Summary',
      groups,
      periodLabel
    );

    writeDetailedLedgerSheet(
      workbook,
      'Detailed Ledger',
      'DAILY ACCOUNT STATEMENT - Detailed Ledger',
      transactions,
      periodLabel
    );

    writePaymentBreakdownSheet(
      workbook,
      'Payment Breakdown',
      'DAILY ACCOUNT STATEMENT - Payment Breakdown',
      transactions,
      periodLabel
    );
  }

  return workbook;
};

// ─── Enhanced Monthly Report with 4 sheets ──────────────────────────────────

const writeMonthlyCustomerAnalysisSheet = (workbook, sheetName, title, groups, periodLabel) => {
  const worksheet = workbook.addWorksheet(safeSheetName(sheetName));
  worksheet.columns = [
    { key: 'customer', width: 24 },
    { key: 'code', width: 16 },
    { key: 'transactions', width: 14 },
    { key: 'totalQty', width: 14 },
    { key: 'totalSales', width: 16 },
    { key: 'totalReceived', width: 16 },
    { key: 'outstanding', width: 16 },
  ];

  worksheet.mergeCells('A1:G1');
  worksheet.getCell('A1').value = title;
  worksheet.getCell('A1').font = { size: 16, bold: true };
  worksheet.getCell('A1').alignment = { horizontal: 'center' };
  worksheet.getCell('A3').value = `Period: ${periodLabel.from} to ${periodLabel.to}`;
  worksheet.getCell('A3').font = { bold: true };

  const headerRow = worksheet.getRow(5);
  headerRow.values = ['Customer', 'Code', 'Transactions', 'Total Qty (L)', 'Total Sales (PKR)', 'Total Received (PKR)', 'Outstanding (PKR)'];
  headerRow.font = { bold: true };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEDED' } };
  applyBorder(headerRow, 1, 7);

  let rowIndex = 6;
  const grandTotals = { transactions: 0, totalQty: 0, totalSales: 0, totalReceived: 0, outstanding: 0 };

  groups.forEach((group) => {
    const customer = group.customer || {};
    const summary = summarizeTransactions(group.transactions);
    const outstanding = summary.totalDebit - summary.totalCredit;

    const row = worksheet.getRow(rowIndex);
    row.values = [
      customer.userId?.name || '—',
      customer.customerCode || '—',
      group.transactions.length,
      qty(summary.productTotals.pmg + summary.productTotals.hsd + summary.productTotals.nr),
      money(summary.totalDebit),
      money(summary.totalCredit),
      money(outstanding),
    ];
    applyBorder(row, 1, 7);

    grandTotals.transactions += group.transactions.length;
    grandTotals.totalQty += summary.productTotals.pmg + summary.productTotals.hsd + summary.productTotals.nr;
    grandTotals.totalSales += summary.totalDebit;
    grandTotals.totalReceived += summary.totalCredit;
    grandTotals.outstanding += outstanding;

    rowIndex += 1;
  });

  const totalRow = worksheet.getRow(rowIndex + 1);
  totalRow.values = [
    'Grand Total',
    '-',
    grandTotals.transactions,
    qty(grandTotals.totalQty),
    money(grandTotals.totalSales),
    money(grandTotals.totalReceived),
    money(grandTotals.outstanding),
  ];
  totalRow.font = { bold: true };
  applyBorder(totalRow, 1, 7);
};

const writeMonthlyProductPerformanceSheet = (workbook, sheetName, title, transactions, periodLabel) => {
  const worksheet = workbook.addWorksheet(safeSheetName(sheetName));
  worksheet.columns = [
    { key: 'product', width: 16 },
    { key: 'totalQty', width: 16 },
    { key: 'totalRevenue', width: 16 },
    { key: 'avgRate', width: 16 },
    { key: 'transactionCount', width: 16 },
  ];

  worksheet.mergeCells('A1:E1');
  worksheet.getCell('A1').value = title;
  worksheet.getCell('A1').font = { size: 16, bold: true };
  worksheet.getCell('A1').alignment = { horizontal: 'center' };
  worksheet.getCell('A3').value = `Period: ${periodLabel.from} to ${periodLabel.to}`;
  worksheet.getCell('A3').font = { bold: true };

  const headerRow = worksheet.getRow(5);
  headerRow.values = ['Product', 'Total Qty (L)', 'Total Revenue (PKR)', 'Avg Rate (PKR/L)', 'Transaction Count'];
  headerRow.font = { bold: true };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEDED' } };
  applyBorder(headerRow, 1, 5);

  // Aggregate by fuel type
  const productMap = { pmg: { name: 'PMG', qty: 0, revenue: 0, count: 0 }, hsd: { name: 'HSD', qty: 0, revenue: 0, count: 0 }, nr: { name: 'NR', qty: 0, revenue: 0, count: 0 } };

  transactions.forEach((tx) => {
    if (tx.transactionType === 'fuel_sale' && tx.fuelType && productMap[tx.fuelType]) {
      const fuelQty = Number(tx.fuelQuantity || 0);
      const revenue = Number(tx.totalAmount || 0);
      productMap[tx.fuelType].qty += fuelQty;
      productMap[tx.fuelType].revenue += revenue;
      productMap[tx.fuelType].count += 1;
    }
  });

  let rowIndex = 6;
  let grandQty = 0;
  let grandRevenue = 0;
  let grandCount = 0;

  Object.values(productMap).forEach((product) => {
    const avgRate = product.qty > 0 ? product.revenue / product.qty : 0;
    const row = worksheet.getRow(rowIndex);
    row.values = [
      product.name,
      qty(product.qty),
      money(product.revenue),
      money(avgRate),
      product.count,
    ];
    applyBorder(row, 1, 5);

    grandQty += product.qty;
    grandRevenue += product.revenue;
    grandCount += product.count;
    rowIndex += 1;
  });

  const avgRateGrand = grandQty > 0 ? grandRevenue / grandQty : 0;
  const totalRow = worksheet.getRow(rowIndex + 1);
  totalRow.values = [
    'Total',
    qty(grandQty),
    money(grandRevenue),
    money(avgRateGrand),
    grandCount,
  ];
  totalRow.font = { bold: true };
  applyBorder(totalRow, 1, 5);
};

const writeMonthlyDailyBreakdownSheet = (workbook, sheetName, title, transactions, periodLabel) => {
  const worksheet = workbook.addWorksheet(safeSheetName(sheetName));
  worksheet.columns = [
    { key: 'date', width: 14 },
    { key: 'transactions', width: 14 },
    { key: 'totalQty', width: 14 },
    { key: 'totalSales', width: 16 },
    { key: 'totalReceived', width: 16 },
    { key: 'netChange', width: 16 },
    { key: 'closingBalance', width: 16 },
  ];

  worksheet.mergeCells('A1:G1');
  worksheet.getCell('A1').value = title;
  worksheet.getCell('A1').font = { size: 16, bold: true };
  worksheet.getCell('A1').alignment = { horizontal: 'center' };
  worksheet.getCell('A3').value = `Period: ${periodLabel.from} to ${periodLabel.to}`;
  worksheet.getCell('A3').font = { bold: true };

  const headerRow = worksheet.getRow(5);
  headerRow.values = ['Date', 'Transactions', 'Total Qty (L)', 'Total Sales (PKR)', 'Total Received (PKR)', 'Net Change (PKR)', 'Closing Balance (PKR)'];
  headerRow.font = { bold: true };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEDED' } };
  applyBorder(headerRow, 1, 7);

  // Group by date
  const dateMap = new Map();
  transactions.forEach((tx) => {
    const dateKey = fmtDate(tx.transactionDate);
    if (!dateMap.has(dateKey)) {
      dateMap.set(dateKey, {
        transactions: 0,
        totalQty: 0,
        totalSales: 0,
        totalReceived: 0,
        netChange: 0,
        closingBalance: 0,
      });
    }

    const entry = dateMap.get(dateKey);
    entry.transactions += 1;
    entry.totalQty += Number(tx.fuelQuantity || 0);
    entry.totalSales += tx.transactionType === 'fuel_sale' ? Number(tx.totalAmount || 0) : 0;
    entry.totalReceived += tx.transactionType === 'payment' ? Number(tx.paymentReceived || 0) : 0;
    entry.netChange = (Number(tx.paymentReceived || 0)) - (Number(tx.totalAmount || 0));
    entry.closingBalance = Number(tx.updatedBalance || 0);
  });

  let rowIndex = 6;
  const grandTotals = { transactions: 0, totalQty: 0, totalSales: 0, totalReceived: 0 };

  [...dateMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([date, data]) => {
    const row = worksheet.getRow(rowIndex);
    row.values = [
      date,
      data.transactions,
      qty(data.totalQty),
      money(data.totalSales),
      money(data.totalReceived),
      money(data.netChange),
      money(data.closingBalance),
    ];
    applyBorder(row, 1, 7);

    grandTotals.transactions += data.transactions;
    grandTotals.totalQty += data.totalQty;
    grandTotals.totalSales += data.totalSales;
    grandTotals.totalReceived += data.totalReceived;

    rowIndex += 1;
  });

  const totalRow = worksheet.getRow(rowIndex + 1);
  totalRow.values = [
    'Total',
    grandTotals.transactions,
    qty(grandTotals.totalQty),
    money(grandTotals.totalSales),
    money(grandTotals.totalReceived),
    '-',
    '-',
  ];
  totalRow.font = { bold: true };
  applyBorder(totalRow, 1, 7);
};

const generateEnhancedMonthlyExcel = async (year, month, customerId = null) => {
  const startDate = parsePkMonthStart(year, month);
  const endDate = parsePkMonthEnd(year, month);
  const workbook = createWorkbook();
  const transactions = await loadTransactions({ startDate, endDate, customerId });
  const periodLabel = { from: fmtDate(startDate), to: fmtDate(endDate) };

  try {
    logger.info({ count: Array.isArray(transactions) ? transactions.length : 0, customerId, startDate, endDate }, 'Excel export - transactions loaded');
  } catch (err) {
    // swallow logging errors
  }

  if (customerId) {
    // For specific customer, show analytical sheets
    const customerTransactions = transactions;
    const groups = groupTransactions(customerTransactions);

    writeMonthlyCustomerAnalysisSheet(
      workbook,
      'Customer Analysis',
      'MONTHLY ACCOUNT STATEMENT - Customer Analysis',
      groups,
      periodLabel
    );

    writeMonthlyProductPerformanceSheet(
      workbook,
      'Product Performance',
      'MONTHLY ACCOUNT STATEMENT - Product Performance',
      customerTransactions,
      periodLabel
    );

    writeMonthlyDailyBreakdownSheet(
      workbook,
      'Daily Breakdown',
      'MONTHLY ACCOUNT STATEMENT - Daily Breakdown',
      customerTransactions,
      periodLabel
    );
  } else {
    // For all customers, show all 4 sheets
    const groups = groupTransactions(transactions);

    writeDailySummarySheet(
      workbook,
      'Monthly Summary',
      'MONTHLY ACCOUNT STATEMENT - Summary',
      groups,
      periodLabel
    );

    writeMonthlyCustomerAnalysisSheet(
      workbook,
      'Customer Analysis',
      'MONTHLY ACCOUNT STATEMENT - Customer Analysis',
      groups,
      periodLabel
    );

    writeMonthlyProductPerformanceSheet(
      workbook,
      'Product Performance',
      'MONTHLY ACCOUNT STATEMENT - Product Performance',
      transactions,
      periodLabel
    );

    writeMonthlyDailyBreakdownSheet(
      workbook,
      'Daily Breakdown',
      'MONTHLY ACCOUNT STATEMENT - Daily Breakdown',
      transactions,
      periodLabel
    );
  }

  return workbook;
};

module.exports = {
  generateDailyExcel,
  generateEnhancedDailyExcel,
  generateMonthlyExcel,
  generateEnhancedMonthlyExcel,
  generateYearlyExcel,
  generateCustomerStatement,
  // Internal helpers exported for testing
  parsePkDateStart,
  parsePkDateEnd,
  parsePkMonthStart,
  parsePkMonthEnd,
  parsePkYearStart,
  parsePkYearEnd,
  safeSheetName,
  createWorkbook,
  buildDetailText,
  groupTransactions,
  summarizeTransactions,
};