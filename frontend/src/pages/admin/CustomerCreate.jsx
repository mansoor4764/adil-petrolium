import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCustomer } from '../../api/customerApi';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { Badge } from '../../components/ui/Badge';
import { Section as SectionCard } from '../../components/ui/Section';
import { useToast } from '../../hooks/useToast';

const initialForm = {
  name: '',
  email: '',
  password: '',
  customerCode: '',
  phone: '',
  address: '',
};

const FieldBlock = ({ label, hint, error, required, children }) => (
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
      {label} {required ? <span style={{ color: 'var(--color-notification)' }}>*</span> : null}
    </label>

    {children}

    {hint ? (
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
        {hint}
      </span>
    ) : null}

    {error ? (
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-error)' }}>
        {error}
      </span>
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

const textareaStyle = {
  width: '100%',
  padding: 'var(--space-3)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  resize: 'vertical',
  fontSize: 'var(--text-sm)',
  lineHeight: 1.6,
  outline: 'none',
};

export default function CustomerCreate() {
  const nav = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [created, setCreated] = useState(null);

  const requiredComplete = useMemo(() => (
    Boolean(form.name.trim())
    && Boolean(form.email.trim())
    && Boolean(form.password.trim())
    && Boolean(form.phone.trim())
    && Boolean(form.customerCode.trim())
  ), [form]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setValidationErrors({});

    try {
      const payload = {
        ...form,
        customerCode: form.customerCode.trim(),
      };
      // Ensure creditLimit is not sent from the create form (removed from UI)
      if (Object.prototype.hasOwnProperty.call(payload, 'creditLimit')) delete payload.creditLimit;

      const res = await createCustomer(payload);
      const data = res.data.data || res.data;
      setCreated(data);
      try {
        toast.success({
          title: 'Customer created',
          message: `Account ${data.profile?.customerCode || data.customerCode || ''} created successfully`,
          duration: 6000,
          action: {
            label: 'Open',
            onClick: () => nav(`/admin/customers/${data.profile?._id || data._id}`),
          },
        });
      } catch (e) {}
      setForm(initialForm);
      // Redirect to customers section after creation
      try {
        nav('/admin/customers');
      } catch (e) {}
    } catch (err) {
      const errData = err.response?.data;

      if (errData?.errors && Array.isArray(errData.errors)) {
        const fieldErrors = {};
        errData.errors.forEach((item) => {
          fieldErrors[item.field] = item.message;
        });
        setValidationErrors(fieldErrors);
        const msg = errData.message || 'Validation failed';
        try {
          toast.error({ title: 'Submission Error', message: msg, duration: 7000 });
        } catch (e) {}
      } else {
        const msg = errData?.message || 'Failed to create customer';
        try {
          toast.error({ title: 'Submission Error', message: msg, duration: 7000 });
        } catch (e) {}
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-fadeIn form-page" style={{ maxWidth: 1120 }}>
      <div className="form-hero">
        <div className="form-hero__titleGroup">
          <Button variant="ghost" onClick={() => nav('/admin/customers')} style={{ alignSelf: 'flex-start' }}>
            ← Back
          </Button>
          <h1 className="form-hero__title">Add Customer</h1>
          <p className="form-hero__subtitle">Create a customer account, profile, and credit setup in one step.</p>
        </div>

        <div className="form-badges">
          <InfoChip color="var(--color-primary)">Form Ready</InfoChip>
          <InfoChip color={requiredComplete ? 'var(--color-success)' : 'var(--color-warning)'}>
            {requiredComplete ? 'Required Complete' : 'Required Pending'}
          </InfoChip>
        </div>
      </div>

        {/* Stats removed: Completed Fields / Required Fields / Credit Setup */}

      {created ? (
        <EmptyState
          icon="✅"
          title="Customer created successfully"
          description={`Account ${created.profile?.customerCode || created.customerCode || ''} is ready.`}
          action={() => nav(`/admin/customers/${created.profile?._id || created._id}`)}
          actionLabel="Open Customer"
        />
      ) : null}

      <form onSubmit={handleSubmit} className="form-section">
        <SectionCard
          title="Account Details"
          description="Login credentials using password or phone fallback. Keep the required identifiers together so the form is easier to scan."
          right={<Badge variant="primary">New Customer</Badge>}
        >
          <div className="form-grid-12">
            <div style={{ gridColumn: 'span 4' }}>
              <Input
                label="Name"
                value={form.name}
                onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                error={validationErrors.name}
                required
              />
            </div>

            <div style={{ gridColumn: 'span 4' }}>
              <Input
                label="Email"
                type="email"
                autoComplete="off"
                value={form.email}
                onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
                error={validationErrors.email}
                required
              />
            </div>

            <div style={{ gridColumn: 'span 4' }}>
              <Input
                label="Password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm((current) => ({ ...current, password: e.target.value }))}
                error={validationErrors.password}
                required
                hint="Set a password for customer login"
              />
            </div>

            <div style={{ gridColumn: 'span 4' }}>
              <Input
                label="Customer Code"
                value={form.customerCode}
                onChange={(e) => setForm((current) => ({ ...current, customerCode: e.target.value }))}
                error={validationErrors.customerCode}
                required
              />
            </div>

            <div style={{ gridColumn: 'span 4' }}>
              <Input
                label="Phone"
                type="tel"
                value={form.phone}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^\d]/g, '');
                  setForm((current) => ({ ...current, phone: value }));
                }}
                error={validationErrors.phone}
                required
                hint="Used for customer login fallback"
              />
            </div>

            {/* Credit Limit removed per request */}
          </div>
        </SectionCard>

        <SectionCard
          title="Profile Details"
          description="Operational notes used by staff for delivery, billing, and customer servicing."
          right={
            <InfoChip color="var(--color-blue)">Optional Fields</InfoChip>
          }
        >
          <div className="form-grid-2">
            <div className="form-field">
              <FieldBlock label="Address" error={validationErrors.address}>
                <textarea
                  value={form.address}
                  onChange={(e) => setForm((current) => ({ ...current, address: e.target.value }))}
                  rows={2}
                  style={{ ...textareaStyle, minHeight: 84 }}
                />
              </FieldBlock>
            </div>

            {/* Vehicle info removed from create form; handled separately in profile editing */}

            {/* Notes removed from create form per request */}
          </div>
        </SectionCard>

        {/* Errors are shown via toast (top-center) using useToast(). */}

        <div className="form-footer">
          <div className="form-footer__inner">
          <div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>Create Customer Account</div>
            <div className="form-note" style={{ marginTop: 2 }}>
              Validate the form before saving customer access and profile data.
            </div>
          </div>

          <div className="form-footer__actions">
            <Button type="button" variant="secondary" onClick={() => nav('/admin/customers')}>
              Cancel
            </Button>
            <Button type="submit" loading={saving} disabled={!requiredComplete || saving}>
              Create Customer
            </Button>
          </div>
          </div>
        </div>
      </form>
    </div>
  );
}