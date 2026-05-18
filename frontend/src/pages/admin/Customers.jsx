import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCustomers }  from '../../api/customerApi';
import { CustomerTable } from '../../components/admin/CustomerTable';
import { Pagination }    from '../../components/common/Pagination';
import { Button }        from '../../components/ui/Button';

import { usePagination } from '../../hooks/usePagination';

export default function Customers() {
  const nav = useNavigate();
  const [data,    setData]    = useState([]);
  const [meta,    setMeta]    = useState(null);
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(false);
  const { page, limit, goTo } = usePagination(20);

  const load = useCallback(() => {
    setLoading(true);
    getCustomers({ page, limit, search: search || undefined })
      .then(r => { setData(r.data.data || []); setMeta(r.data.meta); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, limit, search]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="animate-fadeIn form-page">
      <div className="form-hero">
        <div className="form-hero__titleGroup">
          <h1 className="form-hero__title">Customers</h1>
          <p className="form-hero__subtitle">Search and manage customer accounts, balances, and access.</p>
        </div>
        <Button onClick={() => nav('/admin/customers/new')}>+ Add Customer</Button>
      </div>

      <div className="financial-detail-card">
        <div className="financial-detail-card__body" style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 320px', width: '100%', maxWidth: 420, minWidth: 240 }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (goTo(1), load())}
              placeholder="Search by name, email, or code…"
              className="financial-filter-control"
              style={{ width: '100%', paddingRight: search ? '40px' : '12px' }}
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  goTo(1);
                  setTimeout(load, 0);
                }}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-text-muted)',
                  borderRadius: 'var(--radius-sm)',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--color-surface-2)';
                  e.currentTarget.style.color = 'var(--color-text)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--color-text-muted)';
                }}
                aria-label="Clear search"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 4L4 12M4 4l8 8" />
                </svg>
              </button>
            )}
          </div>
          <Button variant="secondary" onClick={() => { goTo(1); load(); }}>Search</Button>
        </div>
      </div>
      <CustomerTable data={data} loading={loading} />
      <Pagination page={page} totalPages={meta?.totalPages} onPageChange={goTo} />
    </div>
  );
}