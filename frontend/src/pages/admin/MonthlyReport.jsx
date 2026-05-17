import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getTransactions } from '../../api/transactionApi';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Select } from '../../components/ui/Select';
import { SkeletonTable } from '../../components/ui/Skeleton';
import { CustomerStatementGroups, buildCustomerStatementGroups, filterCustomerStatementGroups } from '../../components/admin/CustomerStatementGroups';
import { SectionHeader, Section } from '../../components/ui/Section';
import { formatCurrencyPK, formatDateTimePK, formatNumberPK, formatCurrencyShortPK } from '../../utils/pkFormat';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const fmt = formatCurrencyShortPK;
const fmtL = (v) => `${formatNumberPK(v, 0, 0)} L`;
const fmtDT = formatDateTimePK;
const formatNumber = formatNumberPK;

const controlStyle = {
  padding: 'var(--space-2) var(--space-3)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--text-sm)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  minHeight: 40,
};

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

export default function MonthlyReport() {
  const currentDate = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [year, setYear] = useState(currentDate.getFullYear());
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const availableYears = useMemo(() => [2023, 2024, 2025, 2026], []);

  const availableMonths = useMemo(() => {
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    
    // If selected year is in the future, no months available
    if (year > currentYear) return [];
    
    // If selected year is in the past, all months available
    if (year < currentYear) return MONTHS.map((label, index) => ({ label, value: index + 1 }));
    
    // If selected year is current, only show months up to current month
    return MONTHS.slice(0, currentMonth).map((label, index) => ({ label, value: index + 1 }));
  }, [year, currentDate]);

  const loadMonthly = useCallback(async (targetYear = year, targetMonth = month) => {
    setLoading(true);
    setError('');
    try {
      const startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
      const monthEnd = new Date(targetYear, targetMonth, 0).getDate();
      const endDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(monthEnd).padStart(2, '0')}`;

      const all = [];
      let page = 1;
      let totalPages = 1;

      do {
        const res = await getTransactions({
          startDate,
          endDate,
          page,
          limit: 100,
          sort: 'transactionDate',
        });

        all.push(...(res.data?.data || []));
        totalPages = res.data?.meta?.totalPages || 1;
        page += 1;
      } while (page <= totalPages);

      setTransactions(all.filter((tx) => !tx.isVoided));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load monthly details');
      setTransactions([]);
    } finally {
      setLoading(false);
      setReloading(false);
    }
  }, [year, month]);

  useEffect(() => {
    loadMonthly();
  }, [loadMonthly]);

  const handleReload = async () => {
    setReloading(true);
    await loadMonthly();
  };

  const handleYearChange = (newYear) => {
    setYear(newYear);
    
    // If current month is not available in the new year, adjust it to the last available month
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    
    if (newYear > currentYear) {
      // No months available, set to 1
      setMonth(1);
    } else if (newYear === currentYear && month > currentMonth) {
      // Adjust to current month if past month was selected
      setMonth(currentMonth);
    }
  };

  const summary = useMemo(() => transactions.reduce((acc, tx) => {
    acc.totalFuelSold += Number(tx.fuelQuantity) || 0;
    acc.totalSales += Number(tx.totalAmount) || 0;
    acc.totalPayments += Number(tx.paymentReceived) || 0;
    return acc;
  }, { totalFuelSold: 0, totalSales: 0, totalPayments: 0 }), [transactions]);

  const statementGroups = useMemo(() => buildCustomerStatementGroups(transactions), [transactions]);
  const filteredStatementGroups = useMemo(
    () => filterCustomerStatementGroups(statementGroups, searchQuery),
    [statementGroups, searchQuery]
  );

  return (
    <div className="animate-fadeIn report-page">
      <div className="report-hero">
        <div className="page-shell__title-group">
          <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, letterSpacing: '-0.02em' }}>Monthly Report</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-1)' }}>
            Monthly transaction review grouped by day and customer activity.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 'var(--space-4)', marginInline: 'var(--space-4)' }}>
        <SummaryCard label="Total Sale" value={loading ? 'Loading…' : fmt(summary.totalSales)} accent="var(--color-primary)" hint="Debit transactions in the period." />
        <SummaryCard label="Total Fuel Sold" value={loading ? 'Loading…' : fmtL(summary.totalFuelSold)} accent="var(--color-warning)" hint="Total litres sold across all entries." />
        <SummaryCard label="Total Payments" value={loading ? 'Loading…' : fmt(summary.totalPayments)} accent="var(--color-success)" hint="Credit transactions received." />
        <SummaryCard label="Remaining" value={loading ? 'Loading…' : fmt(summary.totalSales - summary.totalPayments)} accent="var(--color-warning)" hint="Outstanding amount after payments." />
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 'var(--space-4)', marginInline: 'var(--space-4)', marginTop: 'var(--space-6)' }}>
        <div className="report-filter" style={{ minWidth: 240, maxWidth: 400 }}>
          <span className="report-filter__label">Search</span>
          <input
            className="report-filter__control"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customer name..."
          />
        </div>

        <div style={{ flex: 1, minWidth: '40px' }} />

        <div style={{ minWidth: '100px' }}>
          <Select label="Month" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {availableMonths.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </Select>
        </div>

        <div style={{ minWidth: '90px' }}>
          <Select label="Year" value={year} onChange={(e) => handleYearChange(Number(e.target.value))}>
            {availableYears.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
        </div>

        <Button size="lg" onClick={handleReload} loading={reloading}>Reload</Button>
      </div>

      <CustomerStatementGroups
        groups={filteredStatementGroups}
        loading={loading}
        error={error}
        onRetry={handleReload}
        emptyIcon="🧾"
        emptyTitle="No purchases for this month"
        emptyDescription="No customer purchases found for the selected month."
      />
    </div>
  );
}
