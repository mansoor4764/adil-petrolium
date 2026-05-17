import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getCustomerById, updateCustomer } from '../../api/customerApi';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';

const formatMoney = (value) => `PKR ${(Number(value) || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`;

export default function CustomerDetail() {
	const { id } = useParams();
	const nav = useNavigate();
	const [profile, setProfile] = useState(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');
	const [form, setForm] = useState({ phone: '', address: '', creditLimit: '', notes: '', isActive: true });

	useEffect(() => {
		const load = async () => {
			setLoading(true);
			setError('');
			try {
				const res = await getCustomerById(id);
				const data = res.data.data || res.data;
				setProfile(data);
				setForm({
					phone: data.phone || '',
					address: data.address || '',
					creditLimit: data.creditLimit ?? 0,
					notes: data.notes || '',
					isActive: Boolean(data.isActive),
				});
			} catch (err) {
				setError(err.response?.data?.message || 'Customer not found');
				setProfile(null);
			} finally {
				setLoading(false);
			}
		};
		load();
	}, [id]);

	const hasOutstandingBalance = Number(profile?.currentBalance || 0) > 0;

	const dirty = useMemo(() => {
		if (!profile) return false;
		return ['phone', 'address', 'creditLimit', 'notes', 'isActive'].some((key) => {
			const current = key === 'creditLimit' ? String(form[key] ?? '') : String(form[key] ?? '');
			const original = key === 'creditLimit' ? String(profile[key] ?? '') : String(profile[key] ?? '');
			return current !== original;
		});
	}, [form, profile]);

	const handleSave = async (e) => {
		e.preventDefault();
		setSaving(true);
		setError('');
		try {
			const payload = {
				phone: form.phone,
				address: form.address,
				creditLimit: form.creditLimit === '' ? 0 : Number(form.creditLimit),
				notes: form.notes,
				isActive: form.isActive,
			};
			const res = await updateCustomer(id, payload);
			setProfile(res.data.data || res.data);
		} catch (err) {
			setError(err.response?.data?.message || 'Failed to update customer');
		} finally {
			setSaving(false);
		}
	};

	const openStatementLedger = () => {
		nav(`/admin/transactions?customerId=${id}`);
	};

	if (loading) {
		return <SkeletonCard />;
	}

	if (error && !profile) {
		return <EmptyState icon="⚠️" title="Could not load customer" description={error} action={() => nav('/admin/customers')} actionLabel="Back to Customers" />;
	}

	return (
		<div className="animate-fadeIn form-page">
			<div className="form-hero">
				<div className="form-hero__titleGroup">
					<Button variant="ghost" onClick={() => nav('/admin/customers')} style={{ alignSelf: 'flex-start' }}>← Back</Button>
					<h1 className="form-hero__title">{profile?.customerCode}</h1>
					<p className="form-hero__subtitle">{profile?.userId?.name} · {profile?.userId?.email}</p>
				</div>
				<div className="form-badges">
					<Badge variant={profile?.isActive ? 'success' : 'neutral'}>{profile?.isActive ? 'Active' : 'Inactive'}</Badge>
					<Button variant="secondary" onClick={openStatementLedger}>Open Statement Ledger</Button>
				</div>
			</div>

			<div className="report-stat-grid">
				{[
					{ label: 'Current Balance', value: formatMoney(Math.abs(profile?.currentBalance || 0)) },
					{ label: 'Credit Limit', value: formatMoney(profile?.creditLimit) },
					{ label: 'Created', value: profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-PK') : '—' },
				].map((card) => (
					<div key={card.label} className="financial-summary-card">
						<div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{card.label}</div>
						<div className="financial-summary-value" style={{ marginTop: 'var(--space-2)' }}>{card.value}</div>
					</div>
				))}
			</div>



			<form onSubmit={handleSave} className="form-surface form-surface--padded form-section">
				<div className="form-section__header">
					<div>
						<div className="form-section__title">Edit Customer Profile</div>
						<div className="form-section__subtitle">Keep billing and operational details accurate for the selected customer.</div>
					</div>
				</div>

				<div className="form-grid-2">
					<Input label="Phone" value={form.phone} onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))} />
					<Input label="Credit Limit" type="text" inputMode="decimal" value={form.creditLimit} onChange={(e) => {
						const value = e.target.value;
						// Allow empty, numbers, and single decimal point
						if (value === '' || /^\d*\.?\d*$/.test(value)) {
							setForm((current) => ({ ...current, creditLimit: value }));
						}
					}} />
				</div>

<div className="form-grid-2">
				<div className="form-field">
					<label className="form-field__label">Address</label>
					<textarea value={form.address} onChange={(e) => setForm((current) => ({ ...current, address: e.target.value }))} rows={3} style={{ width: '100%', padding: 'var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', color: 'var(--color-text)', minHeight: 92 }} />
				</div>

				<div className="form-field">
					<label className="form-field__label">Notes</label>
					<textarea value={form.notes} onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))} rows={3} style={{ width: '100%', padding: 'var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', color: 'var(--color-text)', minHeight: 92 }} />
				</div>
				</div>

				<label style={{
					display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
					fontSize: 'var(--text-sm)', paddingTop: 'var(--space-1)',
					cursor: hasOutstandingBalance ? 'not-allowed' : 'pointer',
					opacity: hasOutstandingBalance ? 0.55 : 1,
				}}>
					<input
						type="checkbox"
						checked={form.isActive}
						disabled={hasOutstandingBalance}
						onChange={(e) => setForm((current) => ({ ...current, isActive: e.target.checked }))}
					/>
					Active customer
				</label>

				{error ? <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)' }}>{error}</p> : null}

				<div className="form-actions--stacked">
					<Button type="button" variant="secondary" onClick={() => nav('/admin/customers')}>Cancel</Button>
					<Button type="submit" loading={saving} disabled={!dirty}>Save Changes</Button>
				</div>
			</form>
		</div>
	);
}
