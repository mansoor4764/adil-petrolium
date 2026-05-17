import React, { useEffect, useRef, useState } from 'react';
import { getMySummaryMonthly } from '../../api/customerApi';
import { formatNumberPK } from '../../utils/pkFormat';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Build year list dynamically: from 2023 up to the current year
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 2022 }, (_, i) => 2023 + i);

// Format different number types: fuel (0 decimals), currency (2 decimals)
const formatFuel = (n) => formatNumberPK(n, 0, 0);
const formatCurrency = (n) => formatNumberPK(n, 2, 2);

function YearDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="report-filter__control"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          cursor: 'pointer',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          minWidth: '90px',
          justifyContent: 'space-between',
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{value}</span>
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
          aria-hidden="true"
        >
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Select year"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            zIndex: 200,
            margin: 0,
            padding: '4px 0',
            listStyle: 'none',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            minWidth: '90px',
          }}
        >
          {YEARS.map(y => (
            <li
              key={y}
              role="option"
              aria-selected={y === value}
              onClick={() => { onChange(y); setOpen(false); }}
              style={{
                padding: '8px 16px',
                cursor: 'pointer',
                fontVariantNumeric: 'tabular-nums',
                fontSize: 'var(--text-sm)',
                fontWeight: y === value ? 700 : 400,
                color: y === value ? 'var(--color-primary)' : 'var(--color-text)',
                background: y === value ? 'var(--color-primary-subtle, rgba(0,150,136,0.08))' : 'transparent',
              }}
              onMouseEnter={e => { if (y !== value) e.currentTarget.style.background = 'var(--color-bg-subtle, rgba(0,0,0,0.04))'; }}
              onMouseLeave={e => { e.currentTarget.style.background = y === value ? 'var(--color-primary-subtle, rgba(0,150,136,0.08))' : 'transparent'; }}
            >
              {y}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function MonthlySummary() {
  const [data, setData]     = useState([]);
  const [year, setYear]     = useState(CURRENT_YEAR);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getMySummaryMonthly(year)
      .then(r => setData(r.data.data || []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [year]);

  return (
    <div className="animate-fadeIn page-shell">
      <div className="page-shell__header">
        <div className="page-shell__title-group">
          <h1 className="page-shell__title">Monthly Summary</h1>
          <p className="page-shell__subtitle">Overview of fuel purchases and payments by month.</p>
        </div>

        <div className="page-shell__actions">
          <YearDropdown value={year} onChange={setYear} />
        </div>
      </div>

      <div className="surface-panel">
        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                {['Month','Fuel (L)','Sales (Rs)','Paid (Rs)','Closing Balance'].map(h => (
                  <th key={h} style={{ textAlign: h === 'Month' ? 'left' : 'right' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && data.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--color-text-muted)' }}>No data for {year}</td></tr>
              )}
              {data.map((r) => (
                <tr key={r.month}>
                  <td style={{ fontWeight: 600 }}>{MONTHS[r.month - 1]}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatFuel(r.totalFuel)}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(r.totalSales)}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(r.totalPayments)}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: r.closingBalance > 0 ? 'var(--color-error)' : 'var(--color-success)' }}>{formatCurrency(r.closingBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}