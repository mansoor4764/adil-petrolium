import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getDaily, lockDailyRecord } from '../../api/reportApi';
import { getTransactions } from '../../api/transactionApi';
import { Button } from '../../components/ui/Button';
import { EmptyState }    from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { CustomerStatementGroups, buildCustomerStatementGroups, filterCustomerStatementGroups } from '../../components/admin/CustomerStatementGroups';
import { SectionHeader } from '../../components/ui/Section';
import { formatDatePK, formatNumberPK, toInputDatePK, formatCurrencyShortPK } from '../../utils/pkFormat';

const fmt     = formatCurrencyShortPK;
const fmtL    = (v) => `${formatNumberPK(v, 0, 0)} L`;
const fmtDate = formatDatePK;

const localToday = () => toInputDatePK(new Date());

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

  const loading = loadingSummary || loadingTransactions || loadingRecord;
  const statementGroups = useMemo(() => buildCustomerStatementGroups(dayTransactions), [dayTransactions]);
  const filteredStatementGroups = useMemo(
    () => filterCustomerStatementGroups(statementGroups, searchQuery),
    [statementGroups, searchQuery]
  );

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