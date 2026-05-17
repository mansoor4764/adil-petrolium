import React, { useEffect, useState } from 'react';
import { getMyProfile, getMyTransactions } from '../../api/customerApi';
import { BalanceCard }   from '../../components/customer/BalanceCard';
import { Ledger }        from '../../components/customer/Ledger';
import { StatementDownload } from '../../components/customer/StatementDownload';
import { DateRangeFilter }   from '../../components/common/DateRangeFilter';
import { usePagination }     from '../../hooks/usePagination';
import { SkeletonCard }  from '../../components/ui/Skeleton';
import { API_BASE_URL } from '../../api/axiosClient';

export default function CustomerDashboard() {
  const [profile, setProfile] = useState(null);
  const [txs,    setTxs]      = useState([]);
  const [meta,   setMeta]     = useState(null);
  const [filter, setFilter]   = useState({});
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const { page, limit, goTo } = usePagination(20);

  const loadProfile = () =>
    getMyProfile()
      .then((r) => setProfile(r.data.data))
      .catch(() => {});

  const loadTxs = (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    return getMyTransactions({ ...filter, page, limit })
      .then(r => { setTxs(r.data.data || []); setMeta(r.data.meta); })
      .catch(e => setError(e.response?.data?.message || 'Failed to load'))
      .finally(() => setLoading(false))
      .then(() => loadProfile());
  };

  const loadTxsRef = React.useRef(loadTxs);
  useEffect(() => {
    loadTxsRef.current = loadTxs;
  });

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => { loadTxsRef.current(false); }, [filter, page, limit]);

  // Fallback polling so the customer view still updates if SSE is blocked.
  useEffect(() => {
    const timer = setInterval(() => {
      loadTxsRef.current(true);
    }, 60000); // Increased polling interval to 60 seconds to reduce network spam

    return () => clearInterval(timer);
  }, []);

  // SSE: reload transactions when admin creates/voids a transaction for this customer
  useEffect(() => {
    if (!profile?._id) return undefined;
    const url = `${API_BASE_URL.replace(/\/$/, '')}/events/transactions?customerId=${profile._id}`;
    let es;
    try {
      es = new EventSource(url, { withCredentials: true });
    } catch (e) {
      return undefined;
    }

    const onEvent = () => { loadTxsRef.current(true); };

    es.addEventListener('transaction.created', onEvent);
    es.addEventListener('transaction.voided', onEvent);
    es.onerror = () => { 
        // Do not close it immediately, let EventSource auto-reconnect natively
    };

    return () => {
      try {
        es.removeEventListener('transaction.created', onEvent);
        es.removeEventListener('transaction.voided', onEvent);
        es.close();
      } catch (e) {}
    };
  }, [profile?._id]);

  return (
    <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {profile ? (
        <BalanceCard
          balance={profile.currentBalance}
          customerCode={profile.customerCode}
          name={profile.userId?.name}
        />
      ) : <SkeletonCard />}

      <StatementDownload customerCode={profile?.customerCode || ''} />

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>Transaction History</h2>
        </div>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <DateRangeFilter onFilter={(f) => { setFilter(f); goTo(1); }} />
        </div>
        <Ledger
          data={txs} loading={loading} error={error}
          onRetry={() => setFilter({ ...filter })}
          pagination={meta} onPageChange={goTo}
        />
      </div>
    </div>
  );
}