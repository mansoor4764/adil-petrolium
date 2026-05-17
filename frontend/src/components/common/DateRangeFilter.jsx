import React, { useState, useMemo } from 'react';
import { Button } from '../ui/Button';

const PRESETS = [
  { label: 'Today',      days: 0  },
  { label: '7 days',     days: 7  },
  { label: '30 days',    days: 30 },
  { label: 'This month', days: null, type: 'month' },
  { label: 'This year',  days: null, type: 'year'  },
];

export const DateRangeFilter = ({ onFilter }) => {
  const [start, setStart] = useState('');
  const [end,   setEnd]   = useState('');
  const [active, setActive] = useState(null);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const toISO = (d) => d.toISOString().split('T')[0];

  const applyPreset = (preset) => {
    setActive(preset.label);
    const today = new Date();
    if (preset.type === 'month') {
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      setStart(toISO(s)); setEnd(toISO(today));
      onFilter({ startDate: toISO(s), endDate: toISO(today) });
    } else if (preset.type === 'year') {
      const s = new Date(today.getFullYear(), 0, 1);
      setStart(toISO(s)); setEnd(toISO(today));
      onFilter({ startDate: toISO(s), endDate: toISO(today) });
    } else if (preset.days === 0) {
      setStart(toISO(today)); setEnd(toISO(today));
      onFilter({ startDate: toISO(today), endDate: toISO(today) });
    } else {
      const s = new Date(today); s.setDate(today.getDate() - preset.days);
      setStart(toISO(s)); setEnd(toISO(today));
      onFilter({ startDate: toISO(s), endDate: toISO(today) });
    }
  };

  const applyCustom = () => {
    setActive('custom');
    onFilter({ startDate: start, endDate: end });
  };

  const clear = () => {
    setStart(''); setEnd(''); setActive(null);
    onFilter({ startDate: '', endDate: '' });
  };

  return (
    <div className="financial-filter-row">
      {PRESETS.map((p) => (
        <button key={p.label} onClick={() => applyPreset(p)} className="report-status-chip" style={{
          '--chip-accent': active === p.label ? 'var(--color-primary)' : 'var(--color-text-muted)',
          padding: '0.28rem 0.7rem',
          cursor: 'pointer',
        }}>
          {p.label}
        </button>
      ))}
      <div className="financial-filter-row financial-filter-row--date">
        <input className="financial-filter-control" type="date" value={start} onChange={e => setStart(e.target.value)} max={todayStr} />
        <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>to</span>
        <input className="financial-filter-control" type="date" value={end} onChange={e => setEnd(e.target.value)} max={todayStr} />
        <Button size="sm" onClick={applyCustom} disabled={!start || !end} style={{ flexShrink: 0 }}>Apply</Button>
        {active && <Button size="sm" variant="ghost" onClick={clear} style={{ flexShrink: 0 }}>Clear</Button>}
      </div>
    </div>
  );
};