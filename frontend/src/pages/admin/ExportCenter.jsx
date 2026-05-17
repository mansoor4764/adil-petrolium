import React, { useEffect, useMemo, useState } from 'react';
import { exportDaily, exportMonthly, exportYearly } from '../../api/reportApi';
import { toInputDatePK } from '../../utils/pkFormat';
import { SectionHeader, Section } from '../../components/ui/Section';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const triggerDownload = async (request, filename) => {
  const res = await request();
  const blob = new Blob([res.data], { type: res.headers?.['content-type'] || 'application/octet-stream' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const InfoChip = ({ color, children }) => (
  <span
    className="report-status-chip"
    style={{
      '--chip-accent': color,
    }}
  >
    {children}
  </span>
);

const StatCard = ({ label, value, hint, accent, icon }) => (
  <div
    className="report-stat-card"
    style={{
      '--card-accent': accent,
    }}
  >
    <div className="report-stat-card__top">
      <span className="report-stat-card__label">
        {label}
      </span>
      <span className="report-stat-card__icon">
        {icon}
      </span>
    </div>

    <div className="report-stat-card__value">
      {value}
    </div>

    <div className="report-stat-card__hint">
      {hint}
    </div>
  </div>
);

const FieldLabel = ({ children }) => (
  <label
    style={{
      fontSize: 'var(--text-xs)',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.07em',
      color: 'var(--color-text-muted)',
      display: 'block',
      marginBottom: 'var(--space-1)',
    }}
  >
    {children}
  </label>
);

const controlStyle = {
  padding: 'var(--space-2) var(--space-3)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--text-sm)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  minHeight: 40,
};

const ExportCard = ({
  title,
  description,
  badge,
  accent,
  icon,
  status = 'Ready',
  controls,
  onSubmit,
  loading,
  error,
  buttonLabel,
}) => (
  <div
    className="report-export-card"
    style={{
      '--card-accent': accent,
    }}
  >
    <div className="report-export-card__header">
      <div className="report-export-card__titleRow">
        <div className="report-export-card__icon">
          {icon}
        </div>

        <div className="report-export-card__titleGroup">
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
            <h2 className="report-export-card__title">
              {title}
            </h2>
            {badge}
          </div>
          <p className="report-export-card__description">
            {description}
          </p>
        </div>
      </div>

      <InfoChip color={accent}>{loading ? 'Processing' : status}</InfoChip>
    </div>

    <div className="report-export-card__body">
      <div className="report-export-card__controls">
        {controls}
        <Button onClick={onSubmit} loading={loading}>
          {buttonLabel}
        </Button>
      </div>

      {error ? (
        <div
          style={{
            background: 'color-mix(in oklch, var(--color-error) 8%, var(--color-surface))',
            border: '1px solid color-mix(in oklch, var(--color-error) 20%, var(--color-divider))',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3)',
          }}
        >
          <div
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-error)',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              fontWeight: 700,
              marginBottom: 'var(--space-1)',
            }}
          >
            Export Error
          </div>
          <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)', margin: 0 }}>
            {error}
          </p>
        </div>
      ) : null}
    </div>
  </div>
);

export default function ExportCenter() {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  const [date, setDate] = useState(toInputDatePK());
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [yearOnly, setYearOnly] = useState(currentYear);
  const [loading, setLoading] = useState({});
  const [errors, setErrors] = useState({});

  const todayStr = useMemo(() => toInputDatePK(), []);
  const availableYears = useMemo(() => {
    const years = [];
    for (let y = 2023; y <= currentYear; y++) {
      years.push(y);
    }
    return years;
  }, [currentYear]);

  const availableMonths = useMemo(() => {
    if (year < currentYear) {
      return MONTHS.map((label, index) => ({ value: index + 1, label }));
    }
    return MONTHS
      .map((label, index) => ({ value: index + 1, label }))
      .filter((m) => m.value <= currentMonth);
  }, [year, currentYear, currentMonth]);

  // If year changes and makes current month invalid, adjust it
  useEffect(() => {
    if (year === currentYear && month > currentMonth) {
      setMonth(currentMonth);
    }
  }, [year, currentYear, currentMonth, month]);

  const run = async (key, fn) => {
    setLoading((current) => ({ ...current, [key]: true }));
    setErrors((current) => ({ ...current, [key]: '' }));
    try {
      await fn();
    } catch (err) {
      setErrors((current) => ({
        ...current,
        [key]: err.response?.data?.message || 'Export failed. Try again.',
      }));
    } finally {
      setLoading((current) => ({ ...current, [key]: false }));
    }
  };

  return (
    <div className="animate-fadeIn report-page" style={{ maxWidth: 1120 }}>
      <div className="report-hero">
        <div className="page-shell__title-group">
          <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, letterSpacing: '-0.02em' }}>
            Export Center
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-1)' }}>
            Download formatted operational reports for daily activity, monthly billing, and annual summaries.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <InfoChip color="var(--color-primary)">Admin Export</InfoChip>
          <InfoChip color="var(--color-success)">Excel</InfoChip>
        </div>
      </div>

      <div className="report-stat-grid">
        <StatCard label="Daily Export" value={date} hint="Selected posting date" accent="var(--color-primary)" icon="🗓️" />
        <StatCard label="Monthly Export" value={`${MONTHS[month - 1]} ${year}`} hint="Selected billing period" accent="var(--color-warning)" icon="📆" />
        <StatCard label="Yearly Export" value={yearOnly} hint="Selected annual range" accent="var(--color-success)" icon="📊" />
      </div>

      <div className="report-export-grid">
        <ExportCard
          title="Daily Report"
          description="Download the full daily workbook for one date."
          badge={<Badge variant="primary">Excel</Badge>}
          accent="var(--color-primary)"
          icon="📅"
          loading={loading.daily}
          error={errors.daily}
          buttonLabel="Export Daily Excel"
          controls={
            <div className="report-filter">
              <FieldLabel>Date</FieldLabel>
              <input
                className="report-filter__control"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                max={todayStr}
              />
            </div>
          }
          onSubmit={() =>
            run('daily', () =>
              triggerDownload(() => exportDaily(date), `petro_daily_${date}.xlsx`)
            )
          }
        />

        <ExportCard
          title="Monthly Report"
          description="Download a month-by-month workbook for billing and review."
          badge={<Badge variant="primary">Excel</Badge>}
          accent="var(--color-warning)"
          icon="📆"
          loading={loading.monthly}
          error={errors.monthly}
          buttonLabel="Export Monthly Excel"
          controls={
            <div className="report-export-card__controlGroup">
              <div className="report-filter">
                <FieldLabel>Month</FieldLabel>
                <select className="report-filter__control" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                  {availableMonths.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div className="report-filter">
                <FieldLabel>Year</FieldLabel>
                <select className="report-filter__control" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                  {availableYears.map((optionYear) => (
                    <option key={optionYear} value={optionYear}>{optionYear}</option>
                  ))}
                </select>
              </div>
            </div>
          }
          onSubmit={() =>
            run('monthly', () =>
              triggerDownload(
                () => exportMonthly(year, month),
                `petro_monthly_${year}_${String(month).padStart(2, '0')}.xlsx`
              )
            )
          }
        />

        <ExportCard
          title="Yearly Report"
          description="Download an annual Excel statement grouped by customer."
          badge={<Badge variant="success">Excel</Badge>}
          accent="var(--color-success)"
          icon="📈"
          loading={loading.yearly}
          error={errors.yearly}
          buttonLabel="Export Yearly Excel"
          controls={
            <div className="report-filter">
              <FieldLabel>Year</FieldLabel>
              <select className="report-filter__control" value={yearOnly} onChange={(e) => setYearOnly(Number(e.target.value))}>
                {availableYears.map((optionYear) => (
                  <option key={optionYear} value={optionYear}>{optionYear}</option>
                ))}
              </select>
            </div>
          }
          onSubmit={() =>
            run('yearly', () =>
              triggerDownload(() => exportYearly(yearOnly), `petro_yearly_${yearOnly}.xlsx`)
            )
          }
        />
      </div>
    </div>
  );
}