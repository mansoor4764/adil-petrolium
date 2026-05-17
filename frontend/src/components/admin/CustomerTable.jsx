import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { SkeletonTable } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';

const TH = ({ children, align }) => (
  <th style={align ? { textAlign: align } : {}}>
    {children}
  </th>
);

export const CustomerTable = ({ data, loading, onAdd }) => {
  const nav = useNavigate();

  const openLedger = (customerId) => {
    nav(`/admin/transactions?customerId=${customerId}`);
  };

  if (loading) return <SkeletonTable rows={6} cols={6} />;
  if (!data?.length) return (
    <EmptyState
      icon="👤"
      title="No customers yet"
      description="Add your first customer to get started."
      action={onAdd}
      actionLabel="+ Add Customer"
    />
  );

  return (
    <div className="financial-table-shell">
      <div className="financial-table-wrap">
      <table className="financial-table financial-table--customers">
        <colgroup>
          <col style={{ width: '10%', minWidth: '90px' }} />
          <col style={{ width: '16%', minWidth: '120px' }} />
          <col style={{ width: '1fr', flex: 1 }} />
          <col style={{ width: '18%', minWidth: '140px' }} />
          <col style={{ width: '12%', minWidth: '100px' }} />
          <col style={{ width: '20%', minWidth: '160px' }} />
        </colgroup>
        <thead>
          <tr>
            <TH>Code</TH>
            <TH>Name</TH>
            <TH>Email</TH>
            <TH align="right">Balance</TH>
            <TH align="right">Status</TH>
            <TH align="center">Action</TH>
          </tr>
        </thead>
        <tbody>
          {data.map((c) => (
            <tr
              key={c._id}
              className="is-clickable"
              onClick={() => nav(`/admin/customers/${c._id}`)}
            >
              <td className="is-strong" style={{ color: 'var(--color-primary)' }}>
                {c.customerCode}
              </td>

              <td>
                {c.userId?.name || '—'}
              </td>

              <td className="is-muted" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', wordBreak: 'break-word' }}>
                {c.userId?.email || '—'}
              </td>

              <td className="is-numeric is-strong" style={{ color: c.currentBalance > 0 ? 'var(--color-error)' : 'var(--color-success)' }}>
                PKR {Math.abs(c.currentBalance || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
              </td>

              <td style={{ textAlign: 'right' }}>
                <Badge variant={c.isActive ? 'success' : 'neutral'}>
                  {c.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </td>

              <td
                onClick={e => e.stopPropagation()}
                style={{ padding: 0, textAlign: 'center' }}
              >
                <div style={{
                  display: 'flex',
                  gap: 'var(--space-2)',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '100%',
                  padding: 'var(--space-2) var(--space-3)',
                }}>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => nav(`/admin/customers/${c._id}`)}
                    style={{ fontSize: '0.8125rem', letterSpacing: '-0.01em' }}
                  >
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => openLedger(c._id)}
                    style={{ fontSize: '0.8125rem', letterSpacing: '-0.01em', fontWeight: 600 }}
                  >
                    Ledger
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
};