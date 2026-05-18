import React, { useMemo, useState } from 'react';
import { createTransaction } from '../../api/transactionApi';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { pkInputDateTimeToIso, toInputDateTimePK } from '../../utils/pkFormat';

const CARD = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-xl)',
  boxShadow: 'var(--shadow-sm)',
  padding: 'clamp(var(--space-3), 4vw, var(--space-5))',
};

const SECTION_TITLE = {
  fontSize: 'var(--text-xs)',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--color-text-muted)',
};

const formatMoneyRounded = (value, mode = 'round') => {
  const num = Number(value) || 0;
  const abs = Math.abs(num);
  let n;
  if (mode === 'floor') n = Math.floor(abs);
  else if (mode === 'ceil') n = Math.ceil(abs);
  else n = Math.round(abs);
  return `PKR ${n.toLocaleString('en-PK', { minimumFractionDigits: 0 })}`;
};

const clampMoney = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const SummaryCard = ({ label, value, tone }) => (
  <div
    style={{
      padding: 'clamp(var(--space-3), 3vw, var(--space-4))',
      background: `color-mix(in oklch, ${tone} 7%, var(--color-surface))`,
      border: `1px solid color-mix(in oklch, ${tone} 18%, transparent)`,
      borderRadius: 'var(--radius-lg)',
      minHeight: 'clamp(80px, 15vw, 92px)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      gap: 'var(--space-1)',
    }}
  >
    <div style={SECTION_TITLE}>{label}</div>
    <div
      style={{
        fontSize: 'clamp(var(--text-base), 4vw, var(--text-lg))',
        fontWeight: 700,
        color: tone,
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-0.02em',
      }}
    >
      {value}
    </div>
  </div>
);

export const TransactionForm = ({
  customerId,
  currentBalance = 0,
  customerName,
  customerCode,
  customerIsActive,
  onSuccess,
  onCancel,
}) => {
  const [form, setForm] = useState({
    paymentReceived: '',
    transactionDate: toInputDateTimePK(new Date()),
    referenceNo: '',
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiErr, setApiErr] = useState('');

  const balance = clampMoney(currentBalance);

  const amountPaid = useMemo(
    () => clampMoney(form.paymentReceived),
    [form.paymentReceived]
  );

  const balanceRounded = useMemo(() => Math.floor(balance), [balance]);
  const amountPaidRounded = useMemo(() => Math.ceil(amountPaid), [amountPaid]);
  const remainingRounded = useMemo(
    () => balanceRounded - amountPaidRounded,
    [balanceRounded, amountPaidRounded]
  );

  const overpaid = remainingRounded < 0;

  const setField = (key, value) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const validate = () => {
    const next = {};

    if (!customerId) next.customerId = 'Customer is required';

    if (customerIsActive === false) {
      next.customerId = 'This customer is inactive. Cannot record entries for inactive customers.';
    }

    if (
      !form.paymentReceived ||
      Number.isNaN(Number(form.paymentReceived)) ||
      Number(form.paymentReceived) <= 0
    ) {
      next.paymentReceived = 'Enter a valid payment amount';
    }

    if (!form.transactionDate) {
      next.transactionDate = 'Transaction date is required';
    } else {
      // Prevent future dates
      const selectedDate = new Date(form.transactionDate);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      
      if (selectedDate > today) {
        next.transactionDate = 'Transaction date cannot be in the future';
      }
    }

    if (form.referenceNo && form.referenceNo.length > 100) {
      next.referenceNo = 'Reference is too long';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setApiErr('');

    try {
      const parsedPayment = Number.parseFloat(String(form.paymentReceived));
      await createTransaction({
        customerId,
        transactionType: 'payment',
        paymentReceived: Number.isFinite(parsedPayment) ? parsedPayment : 0,
        totalAmount: 0,
        referenceNo: form.referenceNo || '',
        transactionDate: pkInputDateTimeToIso(form.transactionDate),
      });

      onSuccess?.();
    } catch (err) {
      setApiErr(err.response?.data?.message || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-5)',
      }}
    >
      <div style={CARD}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 'var(--space-3)',
            flexWrap: 'wrap',
            marginBottom: 'var(--space-5)',
          }}
        >
          <div>
            <div style={SECTION_TITLE}>Receive Payment</div>
            <h3
              style={{
                marginTop: 'var(--space-2)',
                fontSize: 'var(--text-lg)',
                fontWeight: 700,
                letterSpacing: '-0.02em',
              }}
            >
              Record payment
            </h3>
          </div>
        </div>

        {(customerName || customerCode) && (
          <div
            style={{
              marginBottom: 'var(--space-5)',
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-divider)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 'var(--space-3)',
            }}
          >
            <div>
              <div style={SECTION_TITLE}>Customer</div>
              <div style={{ marginTop: 'var(--space-1)', fontWeight: 700 }}>
                {customerName || customerCode || '—'}
              </div>
            </div>
          </div>
        )}

        {customerIsActive === false && (
          <div style={{
            marginBottom: 'var(--space-5)',
            padding: 'var(--space-4)',
            background: 'color-mix(in oklch, var(--color-error) 10%, var(--color-surface))',
            border: '1px solid color-mix(in oklch, var(--color-error) 30%, transparent)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--color-error)',
            fontSize: 'var(--text-sm)',
            fontWeight: 600
          }}>
            <div style={{ marginBottom: 'var(--space-2)' }}>❌ This customer is inactive</div>
            <div style={{ fontSize: 'var(--text-xs)', opacity: 0.9 }}>
              Entries cannot be created for inactive customers. Please activate this customer first.
            </div>
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-5)',
          }}
        >
            <SummaryCard
              label="Current Balance"
              value={formatMoneyRounded(balance, 'floor')}
              tone="var(--color-warning)"
            />
            <SummaryCard
              label="Payment Now"
              value={formatMoneyRounded(amountPaid, 'ceil')}
              tone="var(--color-success)"
            />
            <SummaryCard
              label={overpaid ? 'Advance / Overpaid' : 'Remaining Balance'}
              value={formatMoneyRounded(remainingRounded, 'floor')}
              tone={overpaid ? 'var(--color-primary)' : 'var(--color-text)'}
            />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
            gap: 'var(--space-3)',
          }}
        >
          <div>
            <Input
              label="Payment Received (PKR)"
              type="number"
              step="0.01"
              min="0"
              value={form.paymentReceived}
              onChange={(e) => setField('paymentReceived', e.target.value)}
              error={errors.paymentReceived}
              required
            />
          </div>

          <div>
            <Input
              label="Date & Time"
              type="datetime-local"
              value={form.transactionDate}
              onChange={(e) => setField('transactionDate', e.target.value)}
              error={errors.transactionDate}
              max={toInputDateTimePK(new Date())}
              required
            />
          </div>

          <div>
            <Input
              label="Reference No."
              value={form.referenceNo}
              onChange={(e) => setField('referenceNo', e.target.value)}
              error={errors.referenceNo}
              hint="Receipt no, bank transfer ref, or voucher no."
            />
          </div>
        </div>
      </div>

      

      <div
        style={{
          ...CARD,
          padding: 'clamp(var(--space-3), 4vw, var(--space-4))',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--space-3)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: '1 1 auto', minWidth: '120px' }}>
          <div style={SECTION_TITLE}>Submission Summary</div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 'var(--space-2)',
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
            flex: '0 0 auto',
            width: '100%',
            maxWidth: '100%',
          }}
        >
          {onCancel ? (
            <Button type="button" variant="ghost" onClick={onCancel} style={{ flex: '1 1 auto', minWidth: '100px' }}>
              Cancel
            </Button>
          ) : null}
          <Button type="submit" loading={loading} disabled={customerIsActive === false} style={{ flex: '1 1 auto', minWidth: '140px' }}>
            Record Payment
          </Button>
        </div>
      </div>

      {apiErr ? (
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            background:
              'color-mix(in oklch, var(--color-error) 8%, var(--color-surface))',
            border:
              '1px solid color-mix(in oklch, var(--color-error) 18%, transparent)',
            color: 'var(--color-error)',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
          }}
        >
          {apiErr}
        </div>
      ) : null}
    </form>
  );
};