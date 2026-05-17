import React, { useEffect, useState } from 'react';
import { getCustomers } from '../../api/customerApi';
import { getTransactions } from '../../api/transactionApi';
import { getDaily } from '../../api/reportApi';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { formatCurrencyPK, formatNumberPK, toInputDatePK } from '../../utils/pkFormat';

const KPI = ({ label, value, sub, accent, icon }) => {
  const [hov, setHov] = useState(false);

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className="financial-summary-card"
      style={{
        boxShadow: hov ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        transform: hov ? 'translateY(-1px)' : 'none',
        transition: 'box-shadow 180ms ease, transform 180ms ease',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        '--card-accent': accent || 'var(--color-primary)',
      }}
    >
      <div className="report-stat-card__top">
        <span className="report-stat-card__label">
          {label}
        </span>

        {icon ? (
          <span className="report-stat-card__icon" style={{ width: 30, height: 30, fontSize: 14 }}>
            {icon}
          </span>
        ) : null}
      </div>

      <p className="financial-summary-value" style={{ color: accent || 'var(--color-text)' }}>
        {value}
      </p>

      {sub ? (
        <p className="financial-summary-hint" style={{ marginTop: 2 }}>
          {sub}
        </p>
      ) : null}

      <div
        style={{
          height: 3,
          borderRadius: 2,
          marginTop: 'var(--space-1)',
          background: `color-mix(in oklch, ${accent || 'var(--color-primary)'} 28%, transparent)`,
        }}
      />
    </div>
  );
};

const Dot = ({ color }) => (
  <span
    style={{
      display: 'inline-block',
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: color,
      marginRight: 7,
      flexShrink: 0,
    }}
  />
);

export default function AdminDashboard() {
  const today = toInputDatePK(new Date());
  const [summary, setSummary] = useState(null);
  const [monthSummary, setMonthSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      setWarnings([]);

      try {
        const [custResult, txResult, dailyResult] = await Promise.allSettled([
          getCustomers({ limit: 100, isActive: true }),
          getTransactions({ startDate: today, endDate: today, limit: 100 }),
          getDaily({ date: today }),
        ]);

        const nextWarnings = [];

        const customers =
          custResult.status === 'fulfilled' ? custResult.value?.data?.data || [] : [];
        if (custResult.status === 'rejected') {
          nextWarnings.push('Customers data could not be loaded.');
        }

        const txs =
          txResult.status === 'fulfilled' ? txResult.value?.data?.data || [] : [];
        if (txResult.status === 'rejected') {
          nextWarnings.push("Today's transactions could not be loaded.");
        }

        const daily =
          dailyResult.status === 'fulfilled' ? dailyResult.value?.data?.data || null : null;
        if (dailyResult.status === 'rejected') {
          nextWarnings.push('Daily record could not be loaded.');
        }

        if (
          custResult.status === 'rejected' &&
          txResult.status === 'rejected' &&
          dailyResult.status === 'rejected'
        ) {
          setError('Failed to load dashboard data.');
          setSummary(null);
          setMonthSummary(null);
          return;
        }

        const totalOutstanding = customers.reduce(
          (sum, customer) => sum + (Number(customer.currentBalance) > 0 ? Number(customer.currentBalance) : 0),
          0
        );

        const todayRevenue = txs.reduce(
          (sum, tx) => sum + (Number(tx.totalAmount) || 0),
          0
        );

        const todayCollected = txs.reduce(
          (sum, tx) => sum + (Number(tx.paymentReceived) || 0),
          0
        );

        const topDebtors = [...customers]
          .sort((a, b) => Number(b.currentBalance || 0) - Number(a.currentBalance || 0))
          .slice(0, 5);

        setSummary({
          customers: customers.length,
          totalOutstanding,
          todayRevenue,
          todayCollected,
          todayTx: txs.length,
          topDebtors,
          daily,
        });

        setWarnings(nextWarnings);

        try {
          const now = new Date();
          const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
          const monthEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
          const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(monthEndDate).padStart(2, '0')}`;

          let page = 1;
          let totalPages = 1;
          const all = [];

          do {
            const response = await getTransactions({
              startDate: monthStart,
              endDate: monthEnd,
              page,
              limit: 500,
            });

            all.push(...(response.data?.data || []));
            totalPages = response.data?.meta?.totalPages || 1;
            page += 1;
          } while (page <= totalPages);

          const monthTotals = all.reduce(
            (acc, tx) => {
              acc.transactions += 1;
              acc.fuel += Number(tx.fuelQuantity) || 0;
              acc.sales += Number(tx.totalAmount) || 0;
              acc.payments += Number(tx.paymentReceived) || 0;
              acc.net += (Number(tx.totalAmount) || 0) - (Number(tx.paymentReceived) || 0);
              return acc;
            },
            { transactions: 0, fuel: 0, sales: 0, payments: 0, net: 0 }
          );

          setMonthSummary(monthTotals);
        } catch (err) {
          // Silently fail for monthly summary - it's not critical to dashboard display
          setMonthSummary(null);
        }
      } catch {
        setError('Failed to load dashboard data.');
        setSummary(null);
        setMonthSummary(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [today]);

  if (loading) {
    return (
      <div>
        <div
          style={{
            height: 28,
            width: 160,
            background: 'var(--color-surface-offset)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-6)',
          }}
        />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 'var(--space-4)',
          }}
        >
          {[0, 1, 2, 3].map((index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return <ErrorState message={error || 'Failed to load dashboard data.'} />;
  }

  const fmt = (n) => formatCurrencyPK(n || 0);

  const fmtShort = (n) => {
    const value = Number(n || 0);
    if (value >= 1000000) return `Rs ${formatNumberPK(value / 1000000, 2, 2)}M`;
    if (value >= 1000) return `Rs ${formatNumberPK(value / 1000, 1, 1)}K`;
    return fmt(value);
  };

  const collectionRate =
    summary.todayRevenue > 0
      ? Math.round((summary.todayCollected / summary.todayRevenue) * 100)
      : 0;

  const circumference = 2 * Math.PI * 38;

  return (
    <div className="animate-fadeIn" style={{ maxWidth: 1200 }}>
      {warnings.length > 0 ? (
        <div
          style={{
            marginBottom: 'var(--space-4)',
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid color-mix(in oklch, var(--color-warning) 28%, transparent)',
            background: 'color-mix(in oklch, var(--color-warning) 10%, var(--color-surface))',
            color: 'var(--color-text)',
            fontSize: 'var(--text-sm)',
          }}
        >
          {warnings.map((warning, index) => (
            <div key={index}>{warning}</div>
          ))}
        </div>
      ) : null}

      <div className="form-hero" style={{ marginBottom: 'var(--space-6)', paddingBottom: 'var(--space-5)', borderBottom: '1px solid var(--color-divider)' }}>
        <div>
          <h1
            style={{
              fontSize: 'var(--text-xl)',
              fontWeight: 700,
              color: 'var(--color-text)',
              letterSpacing: '-0.02em',
            }}
          >
            Overview
          </h1>
          <p
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-muted)',
              marginTop: 3,
            }}
          >
            {new Date().toLocaleDateString('en-PK', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-8)',
        }}
      >
        <KPI
          label="Active Customers"
          value={summary.customers}
          accent="var(--color-primary)"
          icon="👥"
          sub="Registered accounts"
        />
        <KPI
          label="Total Outstanding"
          value={fmtShort(summary.totalOutstanding)}
          accent="var(--color-error)"
          icon="₨"
          sub={fmt(summary.totalOutstanding)}
        />
        <KPI
          label="Today's Sales"
          value={fmtShort(summary.todayRevenue)}
          accent="var(--color-gold)"
          icon="🧾"
          sub={`${summary.todayTx} transaction${summary.todayTx !== 1 ? 's' : ''}`}
        />
        <KPI
          label="Today's Collections"
          value={fmtShort(summary.todayCollected)}
          accent="var(--color-success)"
          icon="💰"
          sub={`${collectionRate}% collection rate`}
        />
        {monthSummary ? (
          <KPI
            label="This Month Sales"
            value={fmtShort(monthSummary.sales)}
            accent="var(--color-primary)"
            icon="📈"
            sub={`${monthSummary.transactions} tx, ${formatNumberPK(monthSummary.fuel, 2, 2)} L`}
          />
        ) : null}
      </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 'var(--space-5)', alignItems: 'start' }}>
        {summary.topDebtors.length > 0 ? (
          <div className="financial-table-shell">
            <div className="financial-table-toolbar">
              <span className="financial-table-title">
                Top Outstanding Accounts
              </span>
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 700,
                  background: 'color-mix(in oklch, var(--color-primary) 10%, var(--color-surface))',
                  color: 'var(--color-primary)',
                  borderRadius: 'var(--radius-full)',
                  padding: '0.28rem 0.7rem',
                }}
              >
                {summary.topDebtors.length} accounts
              </span>
            </div>

            <div className="financial-table-wrap">
            <table className="financial-table">
              <thead>
                <tr style={{ background: 'var(--color-surface-2)' }}>
                  {['#', 'Code', 'Customer', 'Balance'].map((head) => (
                    <th
                      key={head}
                      style={{ textAlign: head === 'Balance' ? 'right' : 'left' }}
                    >
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.topDebtors.map((customer, index) => {
                  const balance = Number(customer.currentBalance || 0);
                  const isDebt = balance > 0;

                  return (
                    <tr key={customer._id || customer.id || index}>
                      <td style={{ width: 36 }} className="is-muted">
                        {index + 1}
                      </td>
                      <td
                        className="is-strong"
                        style={{ color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
                      >
                        {customer.customerCode}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <Dot color={isDebt ? 'var(--color-error)' : 'var(--color-success)'} />
                          {customer.userId?.name || customer.name || '—'}
                        </div>
                      </td>
                      <td
                        className="is-numeric is-strong"
                        style={{ color: isDebt ? 'var(--color-error)' : 'var(--color-success)' }}
                      >
                        {fmt(balance)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        ) : (
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-xl)',
              padding: 'var(--space-10)',
              textAlign: 'center',
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-sm)',
            }}
          >
            No outstanding accounts
          </div>
        )}

        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-5)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <p
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              marginBottom: 'var(--space-4)',
            }}
          >
            Today's Ratio
          </p>

          <div style={{ position: 'relative', width: 96, height: 96, margin: '0 auto var(--space-4)' }}>
            <svg width="96" height="96" viewBox="0 0 96 96">
              <circle
                cx="48"
                cy="48"
                r="38"
                fill="none"
                stroke="var(--color-surface-offset)"
                strokeWidth="10"
              />
              <circle
                cx="48"
                cy="48"
                r="38"
                fill="none"
                stroke="var(--color-success)"
                strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - collectionRate / 100)}
                strokeLinecap="round"
                transform="rotate(-90 48 48)"
                style={{ transition: 'stroke-dashoffset 0.8s ease' }}
              />
            </svg>

            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                style={{
                  fontSize: 'var(--text-lg)',
                  fontWeight: 800,
                  color: 'var(--color-text)',
                  lineHeight: 1,
                }}
              >
                {collectionRate}%
              </span>
              <span
                style={{
                  fontSize: 9,
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Collected
              </span>
            </div>
          </div>

          {[
            { label: 'Sales', val: summary.todayRevenue, color: 'var(--color-text)' },
            { label: 'Collected', val: summary.todayCollected, color: 'var(--color-success)' },
            { label: 'Pending', val: Math.max(0, summary.todayRevenue - summary.todayCollected), color: 'var(--color-error)' },
          ].map(({ label, val, color }) => (
            <div
              key={label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 'var(--text-xs)',
                marginBottom: 'var(--space-2)',
              }}
            >
              <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
              <span
                style={{
                  fontWeight: 700,
                  color,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {fmtShort(val)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}