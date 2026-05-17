import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getDaily, lockDailyRecord } from '../../api/reportApi';
import { getTransactions } from '../../api/transactionApi';
import { Button } from '../../components/ui/Button';
import { EmptyState }    from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { CustomerStatementGroups, buildCustomerStatementGroups, filterCustomerStatementGroups } from '../../components/admin/CustomerStatementGroups';
import { SectionHeader, Section } from '../../components/ui/Section';
import { formatCurrencyPK, formatDatePK, formatNumberPK, toInputDatePK, formatCurrencyShortPK } from '../../utils/pkFormat';

const fmt     = formatCurrencyShortPK;
const fmtL    = (v) => `${formatNumberPK(v, 0, 0)} L`;
const formatNumber = formatNumberPK;
const fmtDate = formatDatePK;
const PK_TIMEZONE = 'Asia/Karachi';

const localToday = () => toInputDatePK(new Date());

const formatBalance = (value) => formatCurrencyPK(Math.abs(Number(value) || 0));

const StatusPill = ({ locked }) => (
  <span style={{
    fontSize: 'var(--text-xs)', fontWeight: 700, padding: '0.28rem 0.7rem',
    borderRadius: 'var(--radius-full)',
    background: locked
      ? 'color-mix(in oklch, var(--color-success) 10%, var(--color-surface))'
      : 'color-mix(in oklch, var(--color-warning) 10%, var(--color-surface))',
    color:  locked ? 'var(--color-success)' : 'var(--color-warning)',
    border: locked
      ? '1px solid color-mix(in oklch, var(--color-success) 18%, transparent)'
      : '1px solid color-mix(in oklch, var(--color-warning) 18%, transparent)',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    lineHeight: 1,
  }}>
    {locked ? '🔒 Locked' : '● Open'}
  </span>
);

const SummaryCard = ({ label, value, hint, accent }) => (
  <div style={{
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-xl)',
    boxShadow: 'var(--shadow-sm)',
    padding: 'var(--space-4)',
    display: 'flex',
    flexDirection: 'column',
  }}>
    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)' }}>{label}</div>
    <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xl)', fontWeight: 700, color: accent || 'var(--color-text)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1.2 }}>{value}</div>
    {hint ? <div style={{ marginTop: 'var(--space-1)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontWeight: 500 }}>{hint}</div> : null}
  </div>
);

const formatLongDate = (value) =>
  new Date(value).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: '2-digit',
    year: 'numeric',
    timeZone: PK_TIMEZONE,
  });

export default function DailyRecord() {
  const [selectedDate, setSelectedDate] = useState(localToday);
  const [record,        setRecord]       = useState(null);
  const [dayTransactions, setDayTransactions] = useState([]);
  const [dailySummary,  setDailySummary]  = useState({
    totalFuelSold: 0,
    totalSalesAmount: 0,
    totalPaymentsReceived: 0,
  });
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [loadingRecord, setLoadingRecord]= useState(true);
  const [summaryError,  setSummaryError] = useState('');
  const [recordError,    setRecordError]  = useState('');
  const [transactionsError, setTransactionsError] = useState('');
  const [lockTarget,    setLockTarget]   = useState(null);
  const [lockLoading,   setLockLoading]  = useState(false);
  const [dateReady,     setDateReady]    = useState(false);
  const [searchQuery,   setSearchQuery]   = useState('');

  const todayStr = useMemo(() => toInputDatePK(), []);

  const loadDailySummary = useCallback(async () => {
    setLoadingSummary(true); setSummaryError('');
    try {
      const allTransactions = [];
      let page = 1;
      let totalPages = 1;

      do {
        const res = await getTransactions({
          startDate: selectedDate,
          endDate: selectedDate,
          page,
          limit: 100,
          sort: 'transactionDate',
        });
        allTransactions.push(...(res.data?.data || []));
        totalPages = res.data?.meta?.totalPages || 1;
        page += 1;
      } while (page <= totalPages);

      const summary = allTransactions.reduce((acc, tx) => {
        acc.totalFuelSold += Number(tx.fuelQuantity) || 0;
        acc.totalSalesAmount += Number(tx.totalAmount) || 0;
        acc.totalPaymentsReceived += Number(tx.paymentReceived) || 0;
        return acc;
      }, { totalFuelSold: 0, totalSalesAmount: 0, totalPaymentsReceived: 0 });

      setDailySummary(summary);
    } catch (err) {
      setSummaryError(err.response?.data?.message || 'Failed to load daily totals');
      setDailySummary({ totalFuelSold: 0, totalSalesAmount: 0, totalPaymentsReceived: 0 });
    } finally {
      setLoadingSummary(false);
    }
  }, [selectedDate]);

  const loadDayTransactions = useCallback(async () => {
    setLoadingTransactions(true); setTransactionsError('');
    try {
      const all = [];
      let page = 1;
      let totalPages = 1;

      do {
        const res = await getTransactions({
          startDate: selectedDate,
          endDate: selectedDate,
          page,
          limit: 100,
          sort: 'transactionDate',
        });
        all.push(...(res.data?.data || []));
        totalPages = res.data?.meta?.totalPages || 1;
        page += 1;
      } while (page <= totalPages);

      setDayTransactions(all.filter((tx) => !tx.isVoided));
    } catch (err) {
      setTransactionsError(err.response?.data?.message || 'Failed to load buyer-wise details');
      setDayTransactions([]);
    } finally {
      setLoadingTransactions(false);
    }
  }, [selectedDate]);

  const loadRecord = useCallback(async () => {
    setLoadingRecord(true); setRecordError('');
    try {
      const res = await getDaily({ date: selectedDate });
      setRecord(res.data.data || res.data);
    } catch (err) {
      setRecordError(err.response?.data?.message || 'Failed to load daily record');
      setRecord(null);
    } finally { setLoadingRecord(false); }
  }, [selectedDate]);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const latestTransactionsRes = await getTransactions({ page: 1, limit: 1, sort: '-transactionDate' });
      if (cancelled) return;

      const latestTransaction = latestTransactionsRes.data?.data?.[0];
      const bootstrapDate = latestTransaction?.transactionDate;

      if (bootstrapDate) {
        setSelectedDate(toInputDatePK(bootstrapDate));
      }

      setDateReady(true);
    };

    bootstrap();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!dateReady) return;
    loadDailySummary();
    loadDayTransactions();
    loadRecord();
  }, [dateReady, loadDailySummary, loadDayTransactions, loadRecord]);

  const handleLock = async () => {
    if (!lockTarget) return;
    setLockLoading(true);
    try {
      await lockDailyRecord(lockTarget._id);
      setLockTarget(null);
      await Promise.all([loadRecord(), loadDailySummary(), loadDayTransactions()]);
    } catch (err) {
      setRecordError(err.response?.data?.message || 'Failed to lock daily record');
    } finally { setLockLoading(false); }
  };

  const ledgerRows = useMemo(() => {
    const ordered = [...dayTransactions].sort(
      (a, b) => new Date(a.transactionDate) - new Date(b.transactionDate)
    );

    return ordered.map((tx) => ({
      id: tx._id,
      date: fmtDate(tx.transactionDate),
      voucher: tx.referenceNo || tx.billNo || '—',
      accountCode: tx.customerId?.customerCode || '—',
      accountName: tx.customerId?.userId?.name || '—',
      product: tx.fuelType
        ? String(tx.fuelType).toUpperCase()
        : String(tx.transactionType || '').replace(/_/g, ' ') || '—',
      instNo: tx.referenceNo || tx.billNo || '—',
      vehicle: tx.customerId?.vehicleInfo || '—',
      qty: tx.fuelQuantity != null && tx.fuelQuantity !== ''
        ? formatNumber(tx.fuelQuantity) : '—',
      rate: tx.rate != null && tx.rate !== '' ? fmt(tx.rate) : '—',
      debit:  tx.totalAmount > 0 ? fmt(tx.totalAmount) : '—',
      credit: tx.paymentReceived > 0 ? fmt(tx.paymentReceived) : '—',
      balance: formatBalance(tx.updatedBalance),
      balanceValue: Number(tx.updatedBalance) || 0,
      transactionType: tx.transactionType,
      isVoided: Boolean(tx.isVoided),
      _debit:  Number(tx.totalAmount) || 0,
      _credit: Number(tx.paymentReceived) || 0,
      _qty:    Number(tx.fuelQuantity) || 0,
    }));
  }, [dayTransactions]);

  const openingBalance = ledgerRows.length
    ? Number(ledgerRows[0].balanceValue || 0)
      - Number(ledgerRows[0]._debit || 0)
      + Number(ledgerRows[0]._credit || 0)
    : 0;

  const closingBalance = ledgerRows.length
    ? Number(ledgerRows[ledgerRows.length - 1].balanceValue || 0)
    : 0;

  const productTotals = useMemo(
    () => ledgerRows.reduce((acc, tx) => {
      if (tx.product === 'PMG') acc.pmg += tx._qty;
      if (tx.product === 'HSD') acc.hsd += tx._qty;
      if (tx.product === 'NR')  acc.nr  += tx._qty;
      return acc;
    }, { pmg: 0, hsd: 0, nr: 0 }),
    [ledgerRows]
  );

  const totalDebitTransactions  = ledgerRows.filter((tx) => tx._debit  > 0 && !tx.isVoided).length;
  const totalCreditTransactions = ledgerRows.filter((tx) => tx._credit > 0 && !tx.isVoided).length;
  const loading = loadingSummary || loadingTransactions || loadingRecord;
  const statementGroups = useMemo(() => buildCustomerStatementGroups(dayTransactions), [dayTransactions]);
  const filteredStatementGroups = useMemo(
    () => filterCustomerStatementGroups(statementGroups, searchQuery),
    [statementGroups, searchQuery]
  );
  const totalCustomers = statementGroups.length;

  return (
    <>
      <div className="animate-fadeIn report-page">
        <SectionHeader
          title="Daily Record"
          subtitle="Review and lock the daily summary for a specific date"
          action={
            <div className="report-toolbar" style={{ alignItems: 'flex-end' }}>
            <div className="report-filter">
              <span className="report-filter__label">Record Date</span>
              <input
                className="report-filter__control"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={todayStr}
              />
            </div>

            {record && !record.isLocked ? (
              <Button size="sm" variant="danger" onClick={() => setLockTarget(record)}>
                Lock Record
              </Button>
            ) : null}
            </div>
          }
        />

        <div className="report-stat-grid" style={{ marginInline: 'var(--space-4)' }}>
          <SummaryCard label="Total Sale" value={loadingSummary ? 'Loading…' : fmt(dailySummary.totalSalesAmount)} accent="var(--color-primary)" hint="Debit transactions in the selected date." />
          <SummaryCard label="Total Fuel Sold" value={loadingSummary ? 'Loading…' : fmtL(dailySummary.totalFuelSold)} accent="var(--color-warning)" hint="Total litres sold across all entries." />
          <SummaryCard label="Total Payments" value={loadingSummary ? 'Loading…' : fmt(dailySummary.totalPaymentsReceived)} accent="var(--color-success)" hint="Credit transactions received." />
          <SummaryCard label="Remaining" value={loadingSummary ? 'Loading…' : fmt(dailySummary.totalSalesAmount - dailySummary.totalPaymentsReceived)} accent="var(--color-warning)" hint="Outstanding amount after payments." />
        </div>

        <div className="report-filter" style={{ minWidth: 240, maxWidth: 400, marginInline: 'var(--space-4)' }}>
          <span className="report-filter__label">Search</span>
          <input
            className="report-filter__control"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customer name..."
          />
        </div>

        {summaryError || transactionsError || recordError ? (
          <EmptyState icon="⚠️" title="Could not load daily record" description={summaryError || transactionsError || recordError} action={() => Promise.all([loadDailySummary(), loadDayTransactions(), loadRecord()])} actionLabel="Try Again" />
        ) : (
          <CustomerStatementGroups
            groups={filteredStatementGroups}
            loading={loading}
            error={''}
            onRetry={() => Promise.all([loadDailySummary(), loadDayTransactions(), loadRecord()])}
            emptyIcon="📂"
            emptyTitle="No record for this date"
            emptyDescription="Select a date that has transactions to view its customer statements."
          />
        )}
      </div>

      {/* Confirm dialog */}
      <ConfirmDialog
        open={Boolean(lockTarget)}
        title="Lock daily record"
        message={
          lockTarget
            ? `Lock the daily record for ${fmtDate(lockTarget.date)}? This prevents further edits.`
            : ''
        }
        confirmLabel={lockLoading ? 'Locking...' : 'Lock Record'}
        danger
        onCancel={() => { if (!lockLoading) setLockTarget(null); }}
        onConfirm={handleLock}
      />
    </>
  );
}