import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCustomers } from '../../api/customerApi';
import { createTransaction } from '../../api/transactionApi';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { useToast } from '../../hooks/useToast';
import { pkInputDateTimeToIso, toInputDateTimePK } from '../../utils/pkFormat';

const SECTION_TITLE = {
  fontSize: 'var(--text-xs)',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--color-text-muted)',
};

const fuelOptions = [
  { value: 'pmg', label: 'PMG' },
  { value: 'hsd', label: 'HSD' },
  { value: 'nr', label: 'NR' },
];

const formatMoney = (value) =>
  `PKR ${(Number(value) || 0).toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function FuelEntry() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    customerId: '',
    fuelType: 'pmg',
    fuelQuantity: '',
    rate: '',
    transactionDate: toInputDateTimePK(new Date()),
    vehicleNo: '',
  });
  const toast = useToast();

  const maxDateTime = useMemo(() => toInputDateTimePK(new Date()), []);

  React.useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoadingCustomers(true);
      try {
        const res = await getCustomers({ limit: 100, sort: 'customerCode', isActive: true });
        if (mounted) setCustomers(res.data?.data || []);
      } catch {
        if (mounted) setCustomers([]);
      } finally {
        if (mounted) setLoadingCustomers(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const amount = useMemo(() => {
    const quantity = Number(form.fuelQuantity) || 0;
    const rate = Number(form.rate) || 0;
    return quantity * rate;
  }, [form.fuelQuantity, form.rate]);

  const selectedCustomer = useMemo(() => 
    customers.find((c) => c._id === form.customerId) || null
  , [customers, form.customerId]);

  // Calculate what the new balance would be after this transaction
  const projectedBalance = useMemo(() => {
    if (!selectedCustomer) return 0;
    return (selectedCustomer.currentBalance || 0) + amount;
  }, [selectedCustomer, amount]);

  // Check if transaction would exceed credit limit
  const exceedsCreditLimit = useMemo(() => {
    if (!selectedCustomer || selectedCustomer.creditLimit === 0 || selectedCustomer.creditLimit === null) return false;
    return projectedBalance > selectedCustomer.creditLimit;
  }, [selectedCustomer, projectedBalance]);

  const requiredComplete = useMemo(() => (
    Boolean(form.customerId)
    && selectedCustomer?.isActive === true
    && Boolean(form.fuelQuantity) && Number(form.fuelQuantity) > 0
    && Boolean(form.rate) && Number(form.rate) > 0
    && Boolean(form.transactionDate)
    && !exceedsCreditLimit
  ), [form.customerId, selectedCustomer, form.fuelQuantity, form.rate, form.transactionDate, exceedsCreditLimit]);

  const setField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    if (!form.customerId) {
      setError('Please select a customer.');
      return;
    }

    if (!form.fuelQuantity || Number(form.fuelQuantity) <= 0) {
      setError('Please enter a valid quantity.');
      return;
    }

    if (!form.rate || Number(form.rate) <= 0) {
      setError('Please enter a valid rate.');
      return;
    }

    setLoading(true);
    try {
      await createTransaction({
        customerId: form.customerId,
        transactionType: 'fuel_sale',
        fuelType: form.fuelType,
        fuelQuantity: Number(form.fuelQuantity),
        rate: Number(form.rate),
        totalAmount: amount,
        vehicleNo: form.vehicleNo || '',
        transactionDate: pkInputDateTimeToIso(form.transactionDate),
      });

      toast.success({
        title: 'Fuel entry saved',
        message: `${selectedCustomer?.userId?.name || 'Customer'} · ${formatMoney(amount)}`,
        duration: 5000,
      });

      setForm((current) => ({
        ...current,
        fuelQuantity: '',
        rate: '',
        vehicleNo: '',
      }));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save fuel entry.');
      toast.error({ title: 'Failed', message: err.response?.data?.message || 'Failed to save fuel entry.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fadeIn form-page">
      <div className="form-hero">
        <div className="form-hero__titleGroup">
          <h1 className="form-hero__title">Fuel Entry</h1>
          <p className="form-hero__subtitle">Record PMG, HSD, or NR sales from this separate admin page.</p>
        </div>
      </div>

      <div className="report-stat-grid">
        <div className="financial-summary-card">
          <div style={SECTION_TITLE}>Fuel Types</div>
          <div style={{ marginTop: 'var(--space-2)', fontWeight: 700 }}>PMG, HSD, NR</div>
          <div className="financial-summary-hint">Choose the fuel type before saving the sale.</div>
        </div>
        <div className="financial-summary-card">
          <div style={SECTION_TITLE}>Entry Amount</div>
          <div style={{ marginTop: 'var(--space-2)', fontWeight: 700 }}>{formatMoney(amount)}</div>
          <div className="financial-summary-hint">Calculated from quantity multiplied by rate.</div>
        </div>
      </div>

      <form onSubmit={submit} className="form-section">
        <div className="form-surface form-surface--padded">
          <div className="form-section__header">
            <div>
              <div className="form-section__title">Customer Selection</div>
              <div className="form-section__subtitle">Choose the account that will receive this fuel sale.</div>
            </div>
          </div>
          
          <div className="form-grid-12" style={{ marginTop: 'var(--space-5)' }}>
            <div style={{ gridColumn: 'span 12' }}>
              <Select
                label="Select Customer"
                value={form.customerId}
                onChange={(e) => setField('customerId', e.target.value)}
                required
                hint={loadingCustomers ? "Fetching customer list..." : "Choose an active customer by name or code."}
              >
                <option value="">Select customer</option>
                {customers.map((customer) => (
                  <option key={customer._id} value={customer._id}>
                    {customer.customerCode} · {customer.userId?.name || 'Unknown'}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Selected customer quick details */}
          {selectedCustomer && (
            <>
              <div style={{ 
                marginTop: 'var(--space-4)', 
                padding: 'var(--space-4)', 
                background: 'var(--color-surface-2)', 
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border)',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 'var(--space-4)'
              }}>
                <div>
                  <div style={SECTION_TITLE}>Full Name</div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', marginTop: 4 }}>{selectedCustomer.userId?.name || 'Unknown'}</div>
                </div>
                <div>
                  <div style={SECTION_TITLE}>Customer Code</div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', marginTop: 4 }}>{selectedCustomer.customerCode || '—'}</div>
                </div>
                <div>
                  <div style={SECTION_TITLE}>Phone Number</div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', marginTop: 4 }}>{selectedCustomer.phone || '—'}</div>
                </div>
                <div>
                  <div style={SECTION_TITLE}>Current Balance</div>
                  <div style={{ 
                    fontWeight: 800, 
                    fontSize: '1.1rem', 
                    marginTop: 4,
                    color: (selectedCustomer.currentBalance || 0) > 0 ? 'var(--color-error)' : 'var(--color-success)'
                  }}>
                    {formatMoney(selectedCustomer.currentBalance)}
                  </div>
                </div>
                <div>
                  <div style={SECTION_TITLE}>Credit Limit</div>
                  <div style={{ 
                    fontWeight: 700, 
                    fontSize: '1rem', 
                    marginTop: 4,
                    color: selectedCustomer.creditLimit === 0 || selectedCustomer.creditLimit === null ? 'var(--color-text-muted)' : 'var(--color-text)'
                  }}>
                    {selectedCustomer.creditLimit === 0 || selectedCustomer.creditLimit === null ? 'Unlimited' : formatMoney(selectedCustomer.creditLimit)}
                  </div>
                </div>
              </div>

              {/* Inactive customer warning */}
              {!selectedCustomer.isActive && (
                <div style={{
                  marginTop: 'var(--space-4)',
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
                    Fuel entries cannot be created for inactive customers. Please activate this customer first.
                  </div>
                </div>
              )}

              {/* Credit limit warning */}
              {selectedCustomer.creditLimit > 0 && amount > 0 && (
                <div style={{
                  marginTop: 'var(--space-4)',
                  padding: 'var(--space-4)',
                  background: exceedsCreditLimit 
                    ? 'color-mix(in oklch, var(--color-error) 10%, var(--color-surface))'
                    : 'color-mix(in oklch, var(--color-warning) 10%, var(--color-surface))',
                  border: `1px solid color-mix(in oklch, ${exceedsCreditLimit ? 'var(--color-error)' : 'var(--color-warning)'} 30%, transparent)`,
                  borderRadius: 'var(--radius-lg)',
                  color: exceedsCreditLimit ? 'var(--color-error)' : 'var(--color-warning)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600
                }}>
                  {exceedsCreditLimit ? (
                    <>
                      <div style={{ marginBottom: 'var(--space-2)' }}>❌ Credit limit would be exceeded</div>
                      <div style={{ fontSize: 'var(--text-xs)', opacity: 0.9 }}>
                        Limit: {formatMoney(selectedCustomer.creditLimit)} | 
                        Projected Balance: {formatMoney(projectedBalance)}
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ marginBottom: 'var(--space-2)' }}>✓ Within credit limit</div>
                      <div style={{ fontSize: 'var(--text-xs)', opacity: 0.9 }}>
                        Limit: {formatMoney(selectedCustomer.creditLimit)} | 
                        Projected Balance: {formatMoney(projectedBalance)}
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          <div className="form-grid-12" style={{ marginTop: 'var(--space-8)' }}>
            <div style={{ gridColumn: 'span 3' }}>
              <Select
                label="Fuel Type"
                value={form.fuelType}
                onChange={(e) => setField('fuelType', e.target.value)}
                required
              >
                {fuelOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </div>
            
            <div style={{ gridColumn: 'span 3' }}>
              <Input
                label="Quantity (Liters)"
                type="number"
                step="0.01"
                min="0"
                value={form.fuelQuantity}
                onChange={(e) => setField('fuelQuantity', e.target.value)}
                hint="Liters sold."
                required
              />
            </div>
            
            <div style={{ gridColumn: 'span 3' }}>
              <Input
                label="Rate (PKR)"
                type="number"
                step="0.01"
                min="0"
                value={form.rate}
                onChange={(e) => setField('rate', e.target.value)}
                hint="Rate per liter."
                required
              />
            </div>

            <div style={{ gridColumn: 'span 3' }}>
              <Input
                label="Vehicle No."
                value={form.vehicleNo}
                onChange={(e) => setField('vehicleNo', e.target.value)}
                placeholder="ABC-1234"
                hint="Registration No."
              />
            </div>

            <div style={{ gridColumn: 'span 3' }}>
              <Input
                label="Transaction Date & Time"
                type="datetime-local"
                value={form.transactionDate}
                onChange={(e) => setField('transactionDate', e.target.value)}
                required
                max={maxDateTime}
                hint="Sale date."
              />
            </div>
          </div>
        </div>

        <div className="form-footer">
          <div className="form-footer__inner">
            <div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>Confirm Transaction</div>
              <div className="form-note" style={{ marginTop: 2 }}>Total: {formatMoney(amount)}</div>
            </div>
            <div className="form-footer__actions">
              <Button type="button" variant="ghost" onClick={() => navigate('/admin/transactions')}>View Ledger</Button>
              <Button type="submit" loading={loading} disabled={!requiredComplete || loading}>Save Fuel Entry</Button>
            </div>
          </div>
        </div>

        {error ? (
          <div style={{ marginTop: 'var(--space-4)' }}>
            <EmptyState icon="⚠️" title="Submission Failed" description={error} />
          </div>
        ) : null}
      </form>
    </div>
  );
}