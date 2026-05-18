import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getAuditLogs } from '../../api/reportApi';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';

import { Input } from '../../components/ui/Input';
import { Pagination } from '../../components/common/Pagination';
import { SkeletonTable } from '../../components/ui/Skeleton';
import { usePagination } from '../../hooks/usePagination';
import { toInputDatePK } from '../../utils/pkFormat';

const ACTION_VARIANTS = {
  TRANSACTION_CREATED: 'primary',
  TRANSACTION_VOIDED: 'warning',
  DAILY_RECORD_LOCKED: 'success',
  REPORT_EXPORTED: 'gold',
  CUSTOMER_CREATED: 'success',
  CUSTOMER_UPDATED: 'primary',
  USER_LOGIN: 'neutral',
};

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'TRANSACTION_CREATED', label: 'Transaction Created' },
  { value: 'TRANSACTION_VOIDED', label: 'Transaction Voided' },
  { value: 'DAILY_RECORD_LOCKED', label: 'Daily Record Locked' },
  { value: 'REPORT_EXPORTED', label: 'Report Exported' },
  { value: 'CUSTOMER_CREATED', label: 'Customer Created' },
  { value: 'CUSTOMER_UPDATED', label: 'Customer Updated' },
  { value: 'USER_LOGIN', label: 'User Login' },
];

const formatDateTime = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const safeJson = (value) => {
  if (!value || (typeof value === 'object' && !Object.keys(value).length)) return '—';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '—';
  }
};

const formatActionLabel = (action) => {
  if (!action) return 'Unknown';
  return action.replace(/_/g, ' ').toLowerCase();
};

const StatCard = ({ label, value, hint, accent, icon }) => (
  <div
    style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-5)',
      boxShadow: 'var(--shadow-sm)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-2)',
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span
        style={{
          fontSize: 'var(--text-xs)',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          color: 'var(--color-text-muted)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          width: 30,
          height: 30,
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `color-mix(in oklch, ${accent} 12%, var(--color-surface))`,
          color: accent,
          fontSize: 14,
        }}
      >
        {icon}
      </span>
    </div>

    <div
      style={{
        fontSize: 'clamp(1.15rem, 2vw, 1.7rem)',
        fontWeight: 700,
        letterSpacing: '-0.03em',
        lineHeight: 1.15,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {value}
    </div>

    {hint ? (
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
        {hint}
      </div>
    ) : null}

    <div
      style={{
        height: 3,
        borderRadius: 2,
        background: `color-mix(in oklch, ${accent} 24%, transparent)`,
      }}
    />
  </div>
);

const Field = ({ label, children, hint }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
    <label
      style={{
        fontSize: 'var(--text-xs)',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
        color: 'var(--color-text-muted)',
      }}
    >
      {label}
    </label>
    {children}
    {hint ? (
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{hint}</span>
    ) : null}
  </div>
);

const InfoChip = ({ color, children }) => (
  <span
    style={{
      fontSize: 'var(--text-xs)',
      fontWeight: 700,
      padding: '2px 10px',
      borderRadius: 'var(--radius-full)',
      background: `color-mix(in oklch, ${color} 12%, var(--color-surface))`,
      color,
      border: `1px solid color-mix(in oklch, ${color} 25%, transparent)`,
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </span>
);

export default function AuditLogs() {
  const { page, limit, goTo } = usePagination(25);
  const [logs, setLogs] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draftFilters, setDraftFilters] = useState({ action: '', startDate: '', endDate: '', actor: '' });
  const [filters, setFilters] = useState({ action: '', startDate: '', endDate: '', actor: '' });

  const todayStr = useMemo(() => toInputDatePK(new Date()), []);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getAuditLogs({
        page,
        limit,
        action: filters.action || undefined,
        actor: filters.actor || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      });
      setLogs(res.data.data || []);
      setMeta(res.data.meta || null);
    } catch (err) {
      setLogs([]);
      setMeta(null);
      setError(err.response?.data?.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [page, limit, filters]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const applyFilters = () => {
    setFilters(draftFilters);
    goTo(1);
  };

  const resetFilters = () => {
    const cleared = { action: '', startDate: '', endDate: '', actor: '' };
    setDraftFilters(cleared);
    setFilters(cleared);
    goTo(1);
  };

  const totals = useMemo(() => ({
    count: meta?.total || logs.length,
    actions: new Set(logs.map((log) => log.action)).size,
    actors: new Set(logs.map((log) => log.actor?._id || log.actorEmail || 'unknown')).size,
    requests: logs.filter((log) => log.requestId).length,
  }), [meta, logs]);

  return (
    <div className="animate-fadeIn report-page" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div className="report-hero">
        <div>
          <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, letterSpacing: '-0.02em' }}>Audit Logs</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-1)' }}>
            Review security, operational, and traceability events across the system.
          </p>
        </div>
        <Button variant="secondary" onClick={loadLogs}>Refresh</Button>
      </div>

      <div className="report-stat-grid">
        <StatCard label="Loaded Logs" value={totals.count} hint="Current filtered result" accent="var(--color-primary)" icon="🧾" />
        <StatCard label="Visible Actions" value={totals.actions} hint="Distinct event types on page" accent="var(--color-warning)" icon="🏷️" />
        <StatCard label="Visible Actors" value={totals.actors} hint="Distinct users or system actors" accent="var(--color-success)" icon="👤" />
        <StatCard label="Tracked Requests" value={totals.requests} hint="Rows with request IDs" accent="var(--color-blue)" icon="🔗" />
      </div>

      <div className="financial-detail-card">
        <div className="financial-detail-card__body" style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-end', flexWrap: 'nowrap' }}>
          <div style={{ flex: '0 0 auto', minWidth: 200 }}>
            <Field label="Action">
              <select
                value={draftFilters.action}
                onChange={(e) => setDraftFilters((current) => ({ ...current, action: e.target.value }))}
                className="financial-filter-control"
              >
                {ACTION_OPTIONS.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div style={{ flex: '0 0 auto', minWidth: 220 }}>
            <Input
              label="Actor"
              value={draftFilters.actor}
              onChange={(e) => setDraftFilters((current) => ({ ...current, actor: e.target.value }))}
              placeholder="User ID, email, or leave blank"
            />
          </div>

          <div style={{ flex: '0 0 auto', minWidth: 160, marginLeft: 'var(--space-3)' }}>
            <Input
              label="From"
              type="date"
              value={draftFilters.startDate}
              onChange={(e) => setDraftFilters((current) => ({ ...current, startDate: e.target.value }))}
              max={todayStr}
            />
          </div>

          <div style={{ flex: '0 0 auto', minWidth: 160 }}>
            <Input
              label="To"
              type="date"
              value={draftFilters.endDate}
              onChange={(e) => setDraftFilters((current) => ({ ...current, endDate: e.target.value }))}
              max={todayStr}
            />
          </div>

          <div style={{ flex: '1' }} />

          <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <Button onClick={applyFilters}>Apply</Button>
            <Button variant="secondary" onClick={resetFilters}>Reset</Button>
          </div>
        </div>
      </div>

      {loading ? (
        <SkeletonTable rows={8} cols={7} />
      ) : error ? (
        <EmptyState
          icon="⚠️"
          title="Could not load audit logs"
          description={error}
          action={loadLogs}
          actionLabel="Try Again"
        />
      ) : logs.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="No audit logs found"
          description="Try adjusting the filters or refreshing the list."
          action={loadLogs}
          actionLabel="Refresh"
        />
      ) : (
        <div className="financial-table-shell">
          <div className="financial-table-toolbar">
            <div>
              <h2 className="financial-table-title">Operational Timeline</h2>
              <p className="financial-table-subtitle">
                Security and activity trail for admin visibility and traceability.
              </p>
            </div>

            <div className="financial-detail-chipRow">
              <InfoChip color="var(--color-primary)">Page {page}</InfoChip>
              <InfoChip color="var(--color-success)">Rows {logs.length}</InfoChip>
              <InfoChip color="var(--color-warning)">Actions {totals.actions}</InfoChip>
            </div>
          </div>

          <div className="financial-table-wrap">
            <table className="financial-table" style={{ minWidth: 1320 }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-2)' }}>
                  {['Date', 'Action', 'Actor', 'Target', 'Details', 'Request ID', 'Role'].map((heading) => (
                    <th
                      key={heading}
                      style={{ textAlign: 'left' }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {logs.map((log, idx) => {
                  const variant = ACTION_VARIANTS[log.action] || 'neutral';
                  const actorName = log.actor?.name || log.actorEmail || 'System';
                  const actorEmail = log.actor?.email || '';
                  const targetModel = log.targetModel || '—';
                  const targetId = log.targetId || '—';

                  return (
                    <tr
                      key={log._id}
                      style={{
                        verticalAlign: 'top',
                      }}
                    >
                      <td
                        style={{
                          fontSize: 'var(--text-sm)',
                          whiteSpace: 'nowrap',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>{formatDateTime(log.createdAt)}</div>
                      </td>

                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <Badge variant={variant}>{formatActionLabel(log.action)}</Badge>
                      </td>

                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', minWidth: 190 }}>
                        <div style={{ fontWeight: 700 }}>{actorName}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
                          {actorEmail || '—'}
                        </div>
                      </td>

                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', minWidth: 180 }}>
                        <div style={{ fontWeight: 700 }}>{targetModel}</div>
                        <div
                          style={{
                            fontSize: 'var(--text-xs)',
                            color: 'var(--color-text-muted)',
                            marginTop: 2,
                            wordBreak: 'break-word',
                          }}
                        >
                          {targetId}
                        </div>
                      </td>

                      <td style={{ padding: 'var(--space-3) var(--space-4)', minWidth: 300 }}>
                        <div
                          style={{
                            background: 'color-mix(in oklch, var(--color-surface-2) 78%, var(--color-surface))',
                            border: '1px solid var(--color-divider)',
                            borderRadius: 'var(--radius-md)',
                            padding: 'var(--space-3)',
                          }}
                        >
                          <pre
                            style={{
                              margin: 0,
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              fontSize: '12px',
                              lineHeight: 1.55,
                              color: 'var(--color-text-muted)',
                              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                            }}
                          >
                            {safeJson(log.details)}
                          </pre>
                        </div>
                      </td>

                      <td
                        style={{
                          padding: 'var(--space-3) var(--space-4)',
                          fontSize: 'var(--text-xs)',
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                          color: 'var(--color-text-muted)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {log.requestId || '—'}
                      </td>

                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)' }}>
                        {log.actorRole ? (
                          <InfoChip color="var(--color-blue)">{log.actorRole}</InfoChip>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ padding: 'var(--space-4) var(--space-5)', borderTop: '1px solid var(--color-divider)' }}>
            <Pagination page={page} totalPages={meta?.totalPages} onPageChange={goTo} />
          </div>
        </div>
      )}
    </div>
  );
}