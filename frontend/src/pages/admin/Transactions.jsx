import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getCustomers } from '../../api/customerApi';
import { downloadAdminStatementExcel } from '../../api/reportApi';
import { getTransactions, voidTransaction } from '../../api/transactionApi';
import { TransactionForm } from '../../components/admin/TransactionForm';
import { Pagination } from '../../components/common/Pagination';
import { EmptyState } from '../../components/ui/EmptyState';
import { SectionHeader } from '../../components/ui/Section';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { SkeletonTable } from '../../components/ui/Skeleton';
import { usePagination } from '../../hooks/usePagination';
import {
  formatCurrencyPK,
  formatDatePK,
  formatDateTimePK,
  formatNumberPK,
  formatRatePK,
  PK_TIMEZONE,
} from '../../utils/pkFormat';

const TYPE_VARIANTS = {
  fuel_sale: 'warning',
  payment: 'success',
  adjustment: 'primary',
  credit_note: 'primary',
  opening_balance: 'neutral',
};

const CARD = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-xl)',
  boxShadow: 'var(--shadow-sm)',
};

const SECTION_TITLE = {
  fontSize: 'var(--text-xs)',
  fontWeight: 700,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
};

const selectStyle = {
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  fontSize: 'var(--text-sm)',
};

const tableHeadStyle = {
  padding: 'var(--space-2) var(--space-3)',
  textAlign: 'left',
  fontSize: 'var(--text-xs)',
  fontWeight: 700,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  borderBottom: '1px solid var(--color-divider)',
  whiteSpace: 'nowrap',
};

const cellStyle = {
  padding: 'var(--space-2) var(--space-3)',
  fontSize: 'var(--text-xs)',
  verticalAlign: 'middle',
};

const numericCellStyle = {
  ...cellStyle,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
};

const ellipsisStyle = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const formatMoney = formatCurrencyPK;
const formatNumber = formatNumberPK;
const formatRate = formatRatePK;
const formatDateTime = formatDateTimePK;
const formatDate = formatDatePK;
const formatBalance = (value) => formatCurrencyPK(Math.abs(Number(value) || 0));

const titleize = (value) =>
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const StatementCard = ({ label, value, accent, hint }) => (
  <div
    style={{
      ...CARD,
      padding: 'var(--space-3) var(--space-4)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-2)',
      minHeight: 'auto',
    }}
  >
    <div style={SECTION_TITLE}>{label}</div>
    <div
      style={{
        fontSize: 'var(--text-xl)',
        fontWeight: 700,
        color: accent || 'var(--color-text)',
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-0.02em',
        lineHeight: 1.2,
      }}
    >
      {value}
    </div>
    {hint ? (
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontWeight: 500, marginTop: '2px' }}>
        {hint}
      </div>
    ) : null}
  </div>
);

const Field = ({ label, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
    <label style={SECTION_TITLE}>{label}</label>
    {children}
  </div>
);

export default function Transactions() {
  const [searchParams] = useSearchParams();

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [customerLoading, setCustomerLoading] = useState(true);
  const [error, setError] = useState('');

  const [filters, setFilters] = useState({
    customerId: '',
    startDate: '',
    endDate: '',
  });

  const [draftFilters, setDraftFilters] = useState({
    customerId: '',
    startDate: '',
    endDate: '',
  });

  const [showCreate, setShowCreate] = useState(false);
  const [voidTarget, setVoidTarget] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidLoading, setVoidLoading] = useState(false);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const { page, limit, goTo } = usePagination(20);

  const customerIdFromUrl = searchParams.get('customerId');
  const inFlightRequestRef = useRef('');
  const syncedCustomerRef = useRef('');
  const [filtersReady, setFiltersReady] = useState(!customerIdFromUrl);

  const loadCustomers = useCallback(async () => {
    setCustomerLoading(true);
    try {
      const res = await getCustomers({ limit: 100, sort: 'customerCode' });
      setCustomers(res.data?.data || []);
    } catch {
      setCustomers([]);
    } finally {
      setCustomerLoading(false);
    }
  }, []);

  const handleCreateSuccess = () => {
    setShowCreate(false);
    loadTransactions();
  };

  const loadTransactions = useCallback(async () => {
    const requestKey = JSON.stringify({
      page,
      limit,
      customerId: filters.customerId,
      startDate: filters.startDate,
      endDate: filters.endDate,
    });

    if (inFlightRequestRef.current === requestKey) return;
    inFlightRequestRef.current = requestKey;

    setLoading(true);
    setError('');

    try {
      const isStatement = Boolean(filters.customerId);
      const params = {
        page: isStatement ? 1 : page,
        limit: isStatement ? 10000 : limit,
        sort: 'transactionDate',
        customerId: filters.customerId || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      };

      const res = await getTransactions(params);
      setRows(res.data?.data || []);
      setMeta(res.data?.meta || null);
    } catch (err) {
      const apiErr = err.response?.data;
      const detail = Array.isArray(apiErr?.errors)
        ? apiErr.errors.map((e) => e.message).filter(Boolean).join('. ')
        : '';
      setError(detail || apiErr?.message || 'Failed to load statement');
    } finally {
      if (inFlightRequestRef.current === requestKey) {
        inFlightRequestRef.current = '';
      }
      setLoading(false);
    }
  }, [page, limit, filters]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    if (!customerIdFromUrl) {
      setFiltersReady(true);
      return;
    }

    if (syncedCustomerRef.current === customerIdFromUrl) {
      setFiltersReady(true);
      return;
    }

    syncedCustomerRef.current = customerIdFromUrl;
    setDraftFilters((current) => ({ ...current, customerId: customerIdFromUrl }));
    setFilters((current) => ({ ...current, customerId: customerIdFromUrl }));
    goTo(1);
    setFiltersReady(true);
  }, [customerIdFromUrl, goTo]);

  useEffect(() => {
    if (!filtersReady) return;
    loadTransactions();
  }, [filtersReady, loadTransactions]);

  const applyFilters = () => {
    setFilters(draftFilters);
    goTo(1);
  };

  const resetFilters = () => {
    const cleared = { customerId: '', startDate: '', endDate: '' };
    setDraftFilters(cleared);
    setFilters(cleared);
    goTo(1);
  };

  const handleVoid = async () => {
    if (!voidTarget || !voidReason.trim()) return;

    setVoidLoading(true);
    try {
      await voidTransaction(voidTarget.id || voidTarget._id, voidReason.trim());
      setVoidTarget(null);
      setVoidReason('');
      loadTransactions();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to void transaction');
    } finally {
      setVoidLoading(false);
    }
  };

  const selectedCustomer = useMemo(
    () => customers.find((customer) => (customer.id || customer._id) === filters.customerId),
    [customers, filters.customerId]
  );

  const isStatementMode = Boolean(filters.customerId);

  const statementRows = useMemo(() => {
    let balance = 0;

    const ordered = [...rows].sort(
      (a, b) => new Date(a.transactionDate) - new Date(b.transactionDate)
    );

    return ordered
      .map((tx) => {
        const total = Number(tx.totalAmount) || 0;
        const payment = Number(tx.paymentReceived) || 0;
        const debit = total > 0 ? total : 0;
        const credit = payment + (total < 0 ? Math.abs(total) : 0);
        balance += total - payment;

        return {
          ...tx,
          id: tx.id || tx._id,
          debit,
          credit,
          runningBalance: Number(tx.updatedBalance ?? balance),
        };
      });
  }, [rows]);

  const totals = useMemo(
    () =>
      statementRows.reduce(
        (acc, tx) => {
          if (!tx.isVoided) {
            acc.sales += Number(tx.debit) || 0;
            acc.payments += Number(tx.credit) || 0;
            if (tx.transactionType === 'fuel_sale') {
              acc.totalFuel += Number(tx.fuelQuantity) || 0;
            }
          }
          return acc;
        },
        { sales: 0, payments: 0, totalFuel: 0 }
      ),
    [statementRows]
  );

  const openingBalance = statementRows.length
    ? Number(statementRows[0].runningBalance || 0) -
      Number(statementRows[0].debit || 0) +
      Number(statementRows[0].credit || 0)
    : 0;

  const closingBalance = totals.sales - totals.payments;

  const productTotals = useMemo(
    () =>
      statementRows.reduce(
        (acc, tx) => {
          const fuelType = String(tx.fuelType || '').toLowerCase();
          const quantity = Number(tx.fuelQuantity) || 0;
          if (fuelType === 'pmg') acc.pmg += quantity;
          if (fuelType === 'hsd') acc.hsd += quantity;
          if (fuelType === 'nr') acc.nr += quantity;
          return acc;
        },
        { pmg: 0, hsd: 0, nr: 0 }
      ),
    [statementRows]
  );

  const activeCount = statementRows.filter((tx) => !tx.isVoided).length;
  const voidedCount = statementRows.filter((tx) => tx.isVoided).length;

  const handleShareStatement = useCallback(async () => {
    if (!isStatementMode || !selectedCustomer) return;

    const customerId = selectedCustomer.id || selectedCustomer._id;
    if (!customerId) {
      setError('Could not resolve customer for export');
      return;
    }

    try {
      const response = await downloadAdminStatementExcel({
        customerId,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      });

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const accountName = selectedCustomer?.userId?.name || selectedCustomer?.customerCode || 'Customer';
      const safeName = String(accountName)
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase();

      const fromPart = filters.startDate || 'start';
      const toPart = filters.endDate || 'today';
      const filename = `statement-${safeName}-${fromPart}-${toPart}.xlsx`;

      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Error downloading statement:', err);
      setError(err.response?.data?.message || 'Failed to download statement');
    }
  }, [isStatementMode, selectedCustomer, filters.startDate, filters.endDate]);

  return (
    <div>
    <div className="animate-fadeIn report-page" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <SectionHeader
        title={isStatementMode ? 'Customer Account Statement' : 'Account Statement'}
        subtitle={
          ''
        }
        action={
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
            {isStatementMode ? (
              <Button variant="secondary" onClick={handleShareStatement}>
                ⬇ Download Statement
              </Button>
            ) : null}
            <Button onClick={() => setShowCreate(true)}>Receive Payment</Button>
          </div>
        }
      />

          <div className="financial-detail-card__body form-grid-12" style={{ alignItems: 'end', paddingBottom: 'var(--space-4)' }}>
          <div style={{ gridColumn: 'span 4' }}>
            <Select
              label="Customer"
              value={draftFilters.customerId}
              onChange={(e) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  customerId: e.target.value,
                }))
              }
            >
              <option value="">All Customers</option>
              {customerLoading ? <option value="">Loading...</option> : null}
              {customers.map((customer) => (
                <option key={customer.id || customer._id} value={customer.id || customer._id}>
                  {customer.customerCode} · {customer.userId?.name || 'Unknown'}
                </option>
              ))}
            </Select>
          </div>

          <div style={{ gridColumn: 'span 3' }}>
            <Input
              label="From"
              type="date"
              value={draftFilters.startDate}
              onChange={(e) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  startDate: e.target.value,
                }))
              }
              max={todayStr}
              style={{ height: '40px' }}
            />
          </div>

          <div style={{ gridColumn: 'span 3' }}>
            <Input
              label="To"
              type="date"
              value={draftFilters.endDate}
              onChange={(e) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  endDate: e.target.value,
                }))
              }
              max={todayStr}
              style={{ height: '40px' }}
            />
          </div>

          <div
            style={{
              gridColumn: 'span 2',
              display: 'flex',
              gap: 'var(--space-2)',
              justifyContent: 'flex-start',
              flexWrap: 'wrap',
              paddingTop: 'var(--space-2)',
            }}
          >
            <Button onClick={applyFilters}>Apply</Button>
            <Button variant="ghost" onClick={resetFilters}>
              Reset
            </Button>
          </div>
        </div>
      </div>

      {isStatementMode && selectedCustomer ? (
        <div className="financial-detail-card" style={{ marginTop: 'var(--space-6)' }}>
          <div className="financial-detail-card__body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-5)', borderBottom: '1px solid var(--color-divider)', paddingBottom: 'var(--space-5)' }}>
            <div>
              <div style={SECTION_TITLE}>Account Holder</div>
              <div
                style={{
                  marginTop: 'var(--space-2)',
                  fontSize: 'var(--text-lg)',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  color: 'var(--color-text)',
                }}
              >
                {selectedCustomer.userId?.name}
              </div>
              <div
                style={{
                  marginTop: 'var(--space-1)',
                  color: 'var(--color-text-muted)',
                  fontSize: 'var(--text-sm)',
                }}
              >
                Code: {selectedCustomer.customerCode}
              </div>
            </div>

            <div>
              <div style={SECTION_TITLE}>Contact Information</div>
              <div style={{ marginTop: 'var(--space-2)', display: 'grid', gap: 'var(--space-2)' }}>
                <div style={{ fontSize: 'var(--text-sm)' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Phone: </span>
                  <span style={{ fontWeight: 500 }}>{selectedCustomer.phone || '—'}</span>
                </div>
                <div style={{ fontSize: 'var(--text-sm)' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Address: </span>
                  <span style={{ fontWeight: 500 }}>{selectedCustomer.address || '—'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="financial-detail-card__body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-5)', marginTop: 'var(--space-5)' }}>
            <div>
              <div style={SECTION_TITLE}>Statement Period</div>
              <div style={{ marginTop: 'var(--space-2)', fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                {filters.startDate ? formatDate(filters.startDate) : 'Beginning'} to{' '}
                {filters.endDate ? formatDate(filters.endDate) : 'Today'}
              </div>
            </div>
            <div>
              <div style={SECTION_TITLE}>Current Balance</div>
              <div
                style={{
                  marginTop: 'var(--space-2)',
                  fontWeight: 700,
                  fontSize: 'var(--text-base)',
                  color: closingBalance > 0 ? 'var(--color-error)' : 'var(--color-success)',
                }}
              >
                {formatMoney(closingBalance)}
              </div>
            </div>
            <div>
              <div style={SECTION_TITLE}>Entries Summary</div>
              <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-sm)', display: 'flex', gap: 'var(--space-3)' }}>
                <span style={{ fontWeight: 500 }}>{activeCount} Active</span>
                <span style={{ color: 'var(--color-text-muted)' }}>·</span>
                <span style={{ fontWeight: 500, color: 'var(--color-text-muted)' }}>{voidedCount} Voided</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="report-stat-grid" style={{ marginTop: 'var(--space-6)' }}>
        <StatementCard
          label="Total Sales"
          value={formatMoney(totals.sales)}
          accent="var(--color-warning)"
          hint="Debit transactions in the statement."
        />
        <StatementCard
          label="Total Payments"
          value={formatMoney(totals.payments)}
          accent="var(--color-success)"
          hint="Credit transactions received."
        />
        <StatementCard
          label="Closing Balance"
          value={formatBalance(closingBalance)}
          accent={closingBalance > 0 ? 'var(--color-error)' : 'var(--color-primary)'}
          hint="Balance after all listed transactions."
        />
      </div>

      {loading ? (
        <SkeletonTable rows={8} cols={9} />
      ) : error ? (
        <EmptyState
          icon="⚠️"
          title="Could not load statement"
          description={error}
          action={loadTransactions}
          actionLabel="Try Again"
        />
      ) : statementRows.length === 0 ? (
        <EmptyState
          icon="🧾"
          title="No statement rows found"
          description={
            isStatementMode
              ? 'No transactions found for this customer in the selected period.'
              : 'Select a customer or date range, or record a new transaction.'
          }
          action={() => setShowCreate(true)}
          actionLabel="Record Entry"
        />
      ) : (
        <div className="financial-table-shell" style={{ marginTop: 'var(--space-6)' }}>
          <div className="financial-table-toolbar">
            <div>
              <h2
                style={{
                  fontSize: 'var(--text-base)',
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                }}
              >
                {isStatementMode ? 'Customer Ledger' : 'Statement Ledger'}
              </h2>
              <p
                style={{
                  color: 'var(--color-text-muted)',
                  fontSize: 'var(--text-xs)',
                  marginTop: 2,
                }}
              >
                {isStatementMode
                  ? 'Single-customer statement with debit, credit, and running balance.'
                  : ''}
              </p>
            </div>

            <div className="financial-detail-chipRow">
              <Badge variant="success">Active {activeCount}</Badge>
              <Badge variant="error">Voided {voidedCount}</Badge>
            </div>
          </div>

          <div className="financial-table-wrap">
            <table className="financial-table" style={{ tableLayout: 'fixed', minWidth: '850px' }}>
              <colgroup>
                <col style={{ width: '13%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '15%' }} />
              </colgroup>

              <thead>
                <tr style={{ background: 'var(--color-surface-2)' }}>
                  <th style={{ ...tableHeadStyle, padding: 'var(--space-3) var(--space-4)' }}>Date</th>
                  <th style={{ ...tableHeadStyle, padding: 'var(--space-3) var(--space-4)' }}>A/C Info</th>
                  <th style={{ ...tableHeadStyle, padding: 'var(--space-3) var(--space-4)' }}>Product</th>
                  <th style={{ ...tableHeadStyle, padding: 'var(--space-3) var(--space-4)' }}>Vehicle</th>
                  <th style={{ ...tableHeadStyle, textAlign: 'right', padding: 'var(--space-3) var(--space-4)' }}>Qty</th>
                  <th style={{ ...tableHeadStyle, textAlign: 'right', padding: 'var(--space-3) var(--space-4)' }}>Rate</th>
                  <th style={{ ...tableHeadStyle, textAlign: 'right', padding: 'var(--space-3) var(--space-4)' }}>Debit</th>
                  <th style={{ ...tableHeadStyle, textAlign: 'right', padding: 'var(--space-3) var(--space-4)' }}>Credit</th>
                  <th style={{ ...tableHeadStyle, textAlign: 'right', padding: 'var(--space-3) var(--space-4)' }}>Balance</th>
                </tr>
              </thead>

              <tbody>
                {statementRows.map((tx, idx) => {
                  const customer = tx.customerId || {};
                  const voided = Boolean(tx.isVoided);

                  return (
                    <tr
                      key={tx.id || tx._id || idx}
                      style={{
                        borderTop: idx === 0 ? 'none' : '1px solid var(--color-divider)',
                        background:
                          idx % 2
                            ? 'color-mix(in oklch, var(--color-surface-2) 40%, var(--color-surface))'
                            : 'transparent',
                        opacity: voided ? 0.65 : 1,
                        transition: 'background-color var(--transition-interactive)',
                      }}
                      onMouseEnter={(e) => {
                        if (!voided) {
                          e.currentTarget.style.background = 'color-mix(in oklch, var(--color-primary) 5%, var(--color-surface))';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = idx % 2
                          ? 'color-mix(in oklch, var(--color-surface-2) 40%, var(--color-surface))'
                          : 'transparent';
                      }}
                    >
                      <td style={{ ...cellStyle, padding: 'var(--space-3) var(--space-4)', ...ellipsisStyle }}>
                        <div className="is-strong">
                          {formatDate(tx.transactionDate || tx.date)}
                        </div>
                      </td>

                      <td style={{ ...cellStyle, padding: 'var(--space-3) var(--space-4)', ...ellipsisStyle }}>
                        <div className="is-strong">
                          {tx.transactionType === 'fuel_sale'
                            ? 'Sale'
                            : tx.transactionType === 'payment'
                            ? 'Payment'
                            : customer.customerCode || selectedCustomer?.customerCode || '—'}
                        </div>
                      </td>

                      <td style={{ ...cellStyle, padding: 'var(--space-3) var(--space-4)', ...ellipsisStyle }}>
                        {tx.fuelType ? String(tx.fuelType).toUpperCase() : '—'}
                      </td>

                      <td style={{ ...cellStyle, padding: 'var(--space-3) var(--space-4)', ...ellipsisStyle }}>
                        {escapeHtml(tx.vehicleNo || customer.vehicleInfo || selectedCustomer?.vehicleInfo || '—')}
                      </td>

                      <td style={{ ...numericCellStyle, padding: 'var(--space-3) var(--space-4)' }} className="is-numeric">
                        {tx.fuelQuantity != null && tx.fuelQuantity !== ''
                          ? formatNumber(tx.fuelQuantity)
                          : '—'}
                      </td>

                      <td style={{ ...numericCellStyle, padding: 'var(--space-3) var(--space-4)' }} className="is-numeric">
                        {tx.rate != null && tx.rate !== '' ? formatRate(tx.rate) : '—'}
                      </td>

                      <td style={{ ...numericCellStyle, padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--color-warning)' }} className="is-numeric is-strong">
                        {tx.debit > 0 ? formatMoney(tx.debit) : '—'}
                      </td>

                      <td style={{ ...numericCellStyle, padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--color-success)' }} className="is-numeric is-strong">
                        {tx.credit > 0 ? formatMoney(tx.credit) : '—'}
                      </td>

                      <td
                        style={{
                          ...numericCellStyle,
                          padding: 'var(--space-3) var(--space-4)',
                          fontWeight: 700,
                          fontSize: 'var(--text-sm)',
                          color:
                            Number(tx.runningBalance || tx.balanceValue || 0) > 0
                              ? 'var(--color-error)'
                              : 'var(--color-success)',
                        }}
                        className="is-numeric is-strong"
                      >
                        {formatBalance(tx.runningBalance || tx.balanceValue || 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {isStatementMode ? (
            <div className="financial-detail-card__body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)', borderTop: '1px solid var(--color-divider)', paddingTop: 'var(--space-4)' }}>
              <div
                style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-xl)',
                  padding: 'var(--space-4)',
                  background: 'var(--color-surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-3)',
                }}
              >
                <div style={SECTION_TITLE}>Sales Detail</div>
                <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--text-sm)' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>PMG</span>
                    <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatNumber(productTotals.pmg)} L</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--text-sm)' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>HSD</span>
                    <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatNumber(productTotals.hsd)} L</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--text-sm)' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>NR</span>
                    <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatNumber(productTotals.nr)} L</span>
                  </div>
                  <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 'var(--space-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--text-sm)' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Total Dr. Entries</span>
                    <span style={{ fontWeight: 700, color: 'var(--color-warning)' }}>
                      {statementRows.filter((tx) => (tx.debit || 0) > 0 && !tx.isVoided).length}
                    </span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-xl)',
                  padding: 'var(--space-4)',
                  background: 'var(--color-surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-3)',
                }}
              >
                <div style={SECTION_TITLE}>Balance Summary</div>
                <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--text-sm)' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Opening</span>
                    <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatMoney(openingBalance)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--text-sm)' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Total Sales</span>
                    <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--color-warning)' }}>{formatMoney(totals.sales)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--text-sm)' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Total Payments</span>
                    <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--color-success)' }}>{formatMoney(totals.payments)}</span>
                  </div>
                  <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 'var(--space-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--text-sm)' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Closing Balance</span>
                    <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: closingBalance > 0 ? 'var(--color-error)' : 'var(--color-success)' }}>
                      {formatBalance(closingBalance)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div
            style={{
              padding: 'var(--space-4) var(--space-5)',
              borderTop: '1px solid var(--color-divider)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: 56,
            }}
          >
            <div style={{ display: 'inline-flex' }}>
              <Pagination
                page={page}
                totalPages={meta?.totalPages}
                onPageChange={goTo}
              />
            </div>
          </div>
        </div>
      )}

      {showCreate ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowCreate(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-4)',
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 820,
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-lg)',
              padding: 'var(--space-6)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 'var(--space-4)',
                marginBottom: 'var(--space-5)',
              }}
            >
              <div>
                <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>Receive Payment</h2>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                  Choose a customer and record the received amount.
                </p>
              </div>
              <Button variant="ghost" onClick={() => setShowCreate(false)}>
                Close
              </Button>
            </div>

            <div style={{ marginBottom: 'var(--space-5)' }}>
              <Field label="Customer">
                <select
                  value={draftFilters.customerId}
                  onChange={(e) =>
                    setDraftFilters((current) => ({
                      ...current,
                      customerId: e.target.value,
                    }))
                  }
                  style={selectStyle}
                >
                  <option value="">Select a customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id || customer._id} value={customer.id || customer._id}>
                      {customer.customerCode} · {customer.userId?.name || 'Unknown'}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {!draftFilters.customerId ? (
              <EmptyState
                icon="👤"
                title="Pick a customer first"
                description="A payment entry must be tied to a customer account."
              />
            ) : (
              (() => {
                const paymentCustomer = customers.find(
                  (customer) => (customer.id || customer._id) === draftFilters.customerId
                );

                return (
              <TransactionForm
                customerId={draftFilters.customerId}
                currentBalance={paymentCustomer?.currentBalance || closingBalance || 0}
                customerName={paymentCustomer?.userId?.name}
                customerCode={paymentCustomer?.customerCode}
                customerIsActive={paymentCustomer?.isActive}
                onSuccess={handleCreateSuccess}
                onCancel={() => setShowCreate(false)}
              />
                );
              })()
            )}
          </div>
        </div>
      ) : null}

      {voidTarget ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10001,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-4)',
            background: 'rgba(0,0,0,0.35)',
          }}
          onClick={() => !voidLoading && setVoidTarget(null)}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 460,
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-lg)',
              padding: 'var(--space-6)',
            }}
          >
            <h3
              style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 700,
                marginBottom: 'var(--space-2)',
              }}
            >
              Reason for voiding
            </h3>
            <p
              style={{
                color: 'var(--color-text-muted)',
                fontSize: 'var(--text-sm)',
                marginBottom: 'var(--space-4)',
              }}
            >
              Add a clear reason before voiding this entry.
            </p>

            <textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              rows={4}
              placeholder="e.g. Duplicate entry, wrong customer, wrong amount"
              style={{
                width: '100%',
                padding: 'var(--space-3)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                resize: 'vertical',
              }}
            />

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 'var(--space-3)',
                marginTop: 'var(--space-5)',
              }}
            >
              <Button
                variant="ghost"
                onClick={() => {
                  if (!voidLoading) {
                    setVoidTarget(null);
                    setVoidReason('');
                  }
                }}
              >
                Cancel
              </Button>
              <Button
                loading={voidLoading}
                disabled={!voidReason.trim()}
                onClick={handleVoid}
              >
                Void
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  

);
}