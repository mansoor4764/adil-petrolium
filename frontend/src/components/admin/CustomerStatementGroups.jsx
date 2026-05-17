import React from 'react';
import { EmptyState } from '../ui/EmptyState';
import { SkeletonTable } from '../ui/Skeleton';
import { formatCurrencyPK, formatDatePK, formatNumberPK, formatRatePK } from '../../utils/pkFormat';

const tableHeadStyle = {
  padding: '6px 14px',
  textAlign: 'left',
  fontSize: 'var(--text-xs)',
  fontWeight: 700,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  borderBottom: '1px solid var(--color-divider)',
  whiteSpace: 'nowrap',
};

const numericHeadStyle = {
  ...tableHeadStyle,
  textAlign: 'right',
};

const cellStyle = {
  padding: '5px 14px',
  fontSize: 'var(--text-xs)',
  verticalAlign: 'middle',
};

const numericCellStyle = {
  ...cellStyle,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
};

const fmt = formatCurrencyPK;
const fmtL = (value) => `${formatNumberPK(value, 0, 0)} L`;

const footerKeyStyle = {
  fontSize: '8px',
  fontWeight: 700,
  textTransform: 'uppercase',
  color: 'var(--color-text-muted)',
};

const footerValueStyle = {
  fontWeight: 700,
  fontSize: '10px',
  fontVariantNumeric: 'tabular-nums',
};

const footerRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '4px',
};

const footerLabelStyle = {
  fontWeight: 700,
  fontSize: '10px',
};

const miniLabelStyle = {
  fontSize: '9px',
  fontWeight: 700,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const miniValueStyle = {
  fontSize: '11px',
  fontWeight: 700,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const ellipsisStyle = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const StatementBlock = ({ group }) => (
  <div className="report-statement-card">
    <div className="report-statement-card__header">
      <div className="report-statement-card__meta">
        <div className="report-statement-card__metaRow">
          <div className="report-statement-card__metaLabel">Account Name</div>
          <div className="report-statement-card__metaValue">{group.customerName}</div>
        </div>
        <div className="report-statement-card__metaRow">
          <div className="report-statement-card__metaLabel">Address</div>
          <div className="report-statement-card__metaValue">{group.address}</div>
        </div>
        <div className="report-statement-card__metaRow">
          <div className="report-statement-card__metaLabel">Contact No</div>
          <div className="report-statement-card__metaValue">{group.phone}</div>
        </div>
        <div className="report-statement-card__metaRow">
          <div className="report-statement-card__metaLabel">Email</div>
          <div style={miniValueStyle}>{group.email || '—'}</div>
        </div>
      </div>

      <div className="report-statement-card__meta">
        <div className="report-statement-card__metaRow">
          <div className="report-statement-card__metaLabel">Date From</div>
          <div className="report-statement-card__metaValue">{group.dateFrom}</div>
        </div>
        <div className="report-statement-card__metaRow">
          <div className="report-statement-card__metaLabel">Date To</div>
          <div className="report-statement-card__metaValue">{group.dateTo}</div>
        </div>
        <div className="report-statement-card__metaRow">
          <div className="report-statement-card__metaLabel">Account Nature</div>
          <div className="report-statement-card__metaValue">Customers</div>
        </div>
        <div className="report-statement-card__metaRow">
          <div className="report-statement-card__metaLabel">Opening Balance</div>
          <div
            style={{
              ...miniValueStyle,
              color:
                group.openingBalance > 0
                  ? 'var(--color-error)'
                  : 'var(--color-success)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {fmt(group.openingBalance)}
          </div>
        </div>
      </div>
    </div>

    <div
      className="report-statement-card__tableWrap"
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
          minWidth: '850px',
        }}
      >
        <colgroup>
          <col style={{ width: '14%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '14%' }} />
        </colgroup>

        <thead>
          <tr style={{ background: 'var(--color-surface-2)' }}>
            <th style={tableHeadStyle}>Date</th>
            <th style={tableHeadStyle}>A/C Info</th>
            <th style={tableHeadStyle}>Product</th>
            <th style={tableHeadStyle}>Vehicle</th>
            <th style={numericHeadStyle}>Qty</th>
            <th style={numericHeadStyle}>Rate</th>
            <th style={numericHeadStyle}>Debit</th>
            <th style={numericHeadStyle}>Credit</th>
            <th style={numericHeadStyle}>Balance</th>
          </tr>
        </thead>

        <tbody>
          {group.rows.map((row, index) => (
            <tr
              key={row.id || index}
              style={{
                borderTop: '1px solid var(--color-divider)',
                background: index % 2
                  ? 'color-mix(in oklch, var(--color-surface-2) 70%, var(--color-surface))'
                  : 'transparent',
              }}
            >
              <td style={cellStyle}>
                <div style={{ fontWeight: 600, wordBreak: 'break-word', overflow: 'visible', whiteSpace: 'normal' }}>{row.date}</div>
              </td>
              <td style={cellStyle}>
                <div style={{ fontWeight: 600, ...ellipsisStyle }}>
                  {row.transactionType === 'payment'
                    ? 'Payment'
                    : row.transactionType === 'fuel_sale'
                    ? 'Sale'
                    : row.transactionType === 'opening_balance'
                    ? 'Opening Balance'
                    : 'Sale'}
                </div>
              </td>
              <td style={cellStyle}>
                <div style={ellipsisStyle}>{row.product}</div>
              </td>
              <td style={cellStyle}>
                <div style={ellipsisStyle}>{row.vehicle}</div>
              </td>
              <td style={numericCellStyle}>{row.qty}</td>
              <td style={numericCellStyle}>{row.rate}</td>
              <td style={numericCellStyle}>{row.debit}</td>
              <td style={numericCellStyle}>{row.credit}</td>
              <td
                style={{
                  ...numericCellStyle,
                  fontWeight: 700,
                  color:
                    Number(row.balanceValue) > 0
                      ? 'var(--color-error)'
                      : 'var(--color-success)',
                }}
              >
                {row.balance}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className="report-statement-card__footer">
      <div className="report-statement-card__footerCard">
        <div className="report-statement-card__footerTitle">Sales Detail</div>
        <div className="report-statement-card__footerRows">
          <div className="report-statement-card__footerRow">
            <div className="report-statement-card__footerLabel">PMG</div>
            <div className="report-statement-card__footerValue">{fmtL(group.totals.pmg)}</div>
          </div>
          <div className="report-statement-card__footerRow">
            <div className="report-statement-card__footerLabel">HSD</div>
            <div className="report-statement-card__footerValue">{fmtL(group.totals.hsd)}</div>
          </div>
          <div className="report-statement-card__footerRow">
            <div className="report-statement-card__footerLabel">NR</div>
            <div className="report-statement-card__footerValue">{fmtL(group.totals.nr)}</div>
          </div>
          <div className="report-statement-card__footerRow">
            <div className="report-statement-card__footerLabel">Debit Entries</div>
            <div className="report-statement-card__footerValue">{group.totals.debitCount}</div>
          </div>
        </div>
      </div>

      <div className="report-statement-card__footerCard">
        <div className="report-statement-card__footerTitle">Transaction Detail</div>
        <div className="report-statement-card__footerRows">
          <div className="report-statement-card__footerRow">
            <div className="report-statement-card__footerLabel">Opening Balance</div>
            <div className="report-statement-card__footerValue">{fmt(group.openingBalance)}</div>
          </div>
          <div className="report-statement-card__footerRow">
            <div className="report-statement-card__footerLabel">Total Payments Received</div>
            <div className="report-statement-card__footerValue">{group.totals.creditCount}</div>
          </div>
          <div className="report-statement-card__footerRow">
            <div className="report-statement-card__footerLabel">Outstanding Balance</div>
            <div
              style={{
                ...footerValueStyle,
                color:
                  group.closingBalance > 0
                    ? 'var(--color-error)'
                    : 'var(--color-success)',
              }}
            >
              {fmt(group.closingBalance)}
            </div>
          </div>
          <div className="report-statement-card__footerRow">
            <div className="report-statement-card__footerLabel">Amount Due</div>
            <div
              style={{
                ...footerValueStyle,
                color:
                  group.closingBalance > 0
                    ? 'var(--color-error)'
                    : 'var(--color-success)',
              }}
            >
              {fmt(group.closingBalance)}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export function CustomerStatementGroups({
  groups,
  loading,
  error,
  onRetry,
  emptyIcon = '🧾',
  emptyTitle = 'No customer statements found',
  emptyDescription = 'No transactions were found for the selected period.',
}) {
  if (loading) {
    return <SkeletonTable rows={8} cols={9} />;
  }

  if (error) {
    return (
      <EmptyState
        icon="⚠️"
        title="Could not load customer statements"
        description={error}
        action={onRetry}
        actionLabel="Try Again"
      />
    );
  }

  if (!groups?.length) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <div className="report-statement-list">
      {groups.map((group) => (
        <StatementBlock key={group.id} group={group} />
      ))}
    </div>
  );
}

export const buildCustomerStatementGroups = (transactions) => {
  const ordered = [...transactions].sort(
    (a, b) => new Date(a.transactionDate) - new Date(b.transactionDate)
  );
  const map = new Map();

  ordered.forEach((tx) => {
    const customer = tx.customerId || {};
    const key =
      customer._id ||
      customer.customerCode ||
      customer.userId?._id ||
      tx.customerId ||
      'unknown';

    if (!map.has(key)) {
      map.set(key, {
        id: key,
        customerName: customer.userId?.name || '—',
        customerCode: customer.customerCode || '—',
        phone: customer.phone || customer.userId?.phone || '—',
        email: customer.userId?.email || customer.email || '—',
        address: customer.address || '—',
        vehicleInfo: customer.vehicleInfo || '—',
        rows: [],
        firstTransactionDate: tx.transactionDate,
      });
    }

    const row = {
      id: tx._id,
      transactionDate: tx.transactionDate,
      date: formatDatePK(tx.transactionDate),
      voucher: tx.referenceNo || tx.billNo || '—',
      accountType: tx.transactionType || '—',
      accountName: customer.userId?.name || '—',
      transactionType: tx.transactionType,
      product: tx.fuelType ? String(tx.fuelType).toUpperCase() : '—',
      instNo: tx.referenceNo || tx.billNo || '—',
      vehicle: tx.vehicleNo || customer.vehicleInfo || '—',
      qty:
        tx.fuelQuantity != null && tx.fuelQuantity !== ''
          ? formatNumberPK(tx.fuelQuantity, 0, 0)
          : '—',
      rate: tx.rate != null && tx.rate !== '' ? formatRatePK(tx.rate) : '—',
      debit: tx.totalAmount > 0 ? fmt(tx.totalAmount) : '—',
      credit: tx.paymentReceived > 0 ? fmt(tx.paymentReceived) : '—',
      balance: fmt(tx.updatedBalance || 0),
      balanceValue: Number(tx.updatedBalance) || 0,
      _debit: Number(tx.totalAmount) || 0,
      _credit: Number(tx.paymentReceived) || 0,
      _qty: Number(tx.fuelQuantity) || 0,
      fuelType: String(tx.fuelType || '').toUpperCase(),
    };

    map.get(key).rows.push(row);
  });

  return [...map.values()]
    .map((group) => {
      const rows = group.rows;
      const openingBalance = rows.length
        ? Number(rows[0].previousBalance ?? rows[0].balanceValue ?? 0)
        : 0;

      const closingBalance = rows.length
        ? Number(rows[rows.length - 1].balanceValue || 0)
        : 0;

      const totals = rows.reduce(
        (acc, row) => {
          acc.sales += row._debit;
          acc.payments += row._credit;
          acc.debitCount += row._debit > 0 ? 1 : 0;
          acc.creditCount += row._credit > 0 ? 1 : 0;
          if (row.fuelType === 'PMG') acc.pmg += row._qty;
          if (row.fuelType === 'HSD') acc.hsd += row._qty;
          if (row.fuelType === 'NR') acc.nr += row._qty;
          return acc;
        },
        { sales: 0, payments: 0, debitCount: 0, creditCount: 0, pmg: 0, hsd: 0, nr: 0 }
      );

      return {
        ...group,
        openingBalance,
        closingBalance,
        dateFrom: rows.length
          ? formatDatePK(rows[0].transactionDate || group.firstTransactionDate)
          : '—',
        dateTo: rows.length
          ? formatDatePK(rows[rows.length - 1].transactionDate || group.firstTransactionDate)
          : '—',
        totals,
      };
    })
    .sort((a, b) => new Date(a.firstTransactionDate) - new Date(b.firstTransactionDate));
};

const normalizeSearchText = (value) => String(value ?? '').toLowerCase().trim();

export const filterCustomerStatementGroups = (groups, searchQuery) => {
  const normalizedQuery = normalizeSearchText(searchQuery);
  if (!normalizedQuery) return groups;

  return (groups || []).filter((group) => normalizeSearchText(group.customerName).includes(normalizedQuery));
};