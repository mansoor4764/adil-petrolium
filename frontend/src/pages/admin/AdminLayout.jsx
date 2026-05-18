import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const NAV = [
  { to: '/admin',               label: 'Overview',     icon: '📊', end: true },
  { to: '/admin/customers',     label: 'Customers',    icon: '👥' },
  { to: '/admin/fuel-entry',    label: 'Fuel Entry',   icon: '⛽' },
  { to: '/admin/transactions',  label: 'Transactions', icon: '💳' },
  { to: '/admin/daily-record',  label: 'Daily Record', icon: '📅' },
  { to: '/admin/monthly-report',label: 'Monthly',      icon: '📆' },
  { to: '/admin/yearly-report', label: 'Yearly',       icon: '📈' },
  { to: '/admin/exports',       label: 'Export Center',icon: '⬇'  },
  { to: '/admin/audit-logs',    label: 'Audit Logs',   icon: '🔍' },
  { to: '/admin/recovery-key',  label: 'Recovery Key', icon: '🔑' },
];

export default function AdminLayout() {
  const { logout } = useAuth();
  const nav = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);

  React.useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth < 768;

  const handleLogout = async () => {
    await logout();
    nav('/login', { replace: true });
  };

  const shellStyle = {
    display: 'flex',
    minHeight: '100dvh',
    height: isMobile ? 'auto' : '100vh',
    overflow: isMobile ? 'visible' : 'hidden',
  };

  const contentStyle = {
    flex: 1,
    padding: isMobile ? 'var(--space-4)' : 'var(--space-4) var(--space-5)',
    overflow: isMobile ? 'visible' : 'auto',
    WebkitOverflowScrolling: 'touch',
  };

  return (
    <div className="admin-shell" style={shellStyle}>
      {isMobile && mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 39,
          }}
        />
      )}

      <aside
        className="admin-shell__sidebar"
        style={{
          position: isMobile ? 'fixed' : 'relative',
          left: isMobile && !mobileMenuOpen ? '-100%' : 0,
          width: isMobile ? '250px' : (collapsed ? 56 : 'var(--sidebar-width)'),
          minWidth: isMobile ? '250px' : (collapsed ? 56 : 'var(--sidebar-width)'),
          height: '100vh',
          color: 'var(--color-sidebar-text)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: isMobile ? 'left 200ms ease' : 'width 200ms ease',
          flexShrink: 0,
          zIndex: 40,
        }}
      >
        <div
          className="admin-shell__brand"
          style={{
            padding: 'var(--space-3) var(--space-3)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            minHeight: 'var(--topbar-height)',
          }}
        >
          <svg width="26" height="26" viewBox="0 0 40 40" fill="none" style={{ flexShrink: 0 }}>
            <rect width="40" height="40" rx="10" fill="var(--color-primary)" />
            <rect x="8" y="22" width="8" height="12" rx="2" fill="white" />
            <rect x="20" y="16" width="8" height="18" rx="2" fill="white" opacity="0.8" />
            <path d="M8 14 L20 8 L32 14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          {!collapsed && <span style={{ fontWeight: 750, fontSize: 'var(--text-sm)', color: '#fff', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>Adil Petroleum</span>}
        </div>

        <nav className="sidebar-nav" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: 'var(--space-2) var(--space-2) var(--space-3)' }}>
          {NAV.map(({ to, label, icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => isMobile && setMobileMenuOpen(false)}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                textDecoration: 'none',
                marginBottom: 4,
                background: isActive
                  ? 'color-mix(in oklch, var(--color-primary) 18%, var(--color-sidebar-active))'
                  : 'transparent',
                color: isActive ? '#fff' : 'var(--color-sidebar-text)',
                transition: 'background var(--transition), color var(--transition), transform var(--transition)',
                boxShadow: isActive ? 'inset 0 0 0 1px color-mix(in oklch, var(--color-primary) 24%, transparent)' : 'none',
                position: 'relative',
              })}
              onMouseEnter={e => !isMobile && (e.currentTarget.style.background = 'var(--color-sidebar-hover)')}
              onMouseLeave={e => {
                if (!isMobile) {
                  const active = e.currentTarget.getAttribute('aria-current') === 'page';
                  e.currentTarget.style.background = active
                    ? 'color-mix(in oklch, var(--color-primary) 18%, var(--color-sidebar-active))'
                    : 'transparent';
                }
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 20,
                  minWidth: 20,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 15,
                  lineHeight: 1,
                  flexShrink: 0,
                  transform: 'translateY(-0.5px)',
                }}
              >
                {icon}
              </span>
              {(isMobile || !collapsed) && <span style={{ whiteSpace: 'nowrap' }}>{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: 'var(--space-3)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          {(isMobile || !collapsed) && (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-sidebar-text)', marginBottom: 'var(--space-2)', opacity: 0.82, lineHeight: 1.4 }}>
              <span style={{ opacity: 0.7 }}>Admin</span>
            </div>
          )}
          <button onClick={handleLogout} style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(255,255,255,0.06)',
            color: 'var(--color-sidebar-text)',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            textAlign: (isMobile || collapsed) ? 'center' : 'left',
          }}>
            {(isMobile || collapsed) ? '↩' : '↩ Sign out'}
          </button>
        </div>
      </aside>

      <main className="admin-shell__main" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <header style={{
          minHeight: 'var(--topbar-height)',
          background: 'color-mix(in oklch, var(--color-surface) 92%, var(--color-bg))',
          borderBottom: '1px solid var(--color-divider)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 var(--space-5)',
          gap: 'var(--space-3)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: 'var(--shadow-sm)',
        }}>
          {isMobile ? (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
              style={{
                fontSize: 20,
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                background: 'none',
                border: 'none',
                padding: 'var(--space-1)',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {mobileMenuOpen ? '✕' : '☰'}
            </button>
          ) : (
            <button
              onClick={() => setCollapsed(c => !c)}
              aria-label="Toggle sidebar"
              style={{
                fontSize: 18,
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                background: 'none',
                border: 'none',
                padding: 'var(--space-1)',
              }}
            >
              ☰
            </button>
          )}
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Admin dashboard
            </span>
          </div>
          <span style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginLeft: 'auto' }}>
            <button
              onClick={() => nav('/admin/profile')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 40,
                height: 40,
                padding: 0,
                borderRadius: 'var(--radius-md)',
                background: 'rgba(255,255,255,0.06)',
                cursor: 'pointer',
                border: 'none',
              }}
              aria-label="Open profile"
            >
              <span aria-hidden="true" style={{ color: 'var(--color-text-muted)', fontSize: '1.2rem', lineHeight: 1 }}>👤</span>
            </button>
          </div>
        </header>
        <div className="admin-shell__content" style={contentStyle}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
