import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getMyProfile } from '../../api/customerApi';

const NAV = [
  { to: '/dashboard',          label: 'My Account',    icon: '🏠', end: true },
  { to: '/dashboard/statement',label: 'Statement',     icon: '🧾' },
  { to: '/dashboard/monthly',  label: 'Monthly',       icon: '📅' },
];

export default function CustomerLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!user) return undefined;

    const loadProfile = async () => {
      try {
        await getMyProfile();
      } catch (error) {
        // Ignore transient errors on initial load.
      }
    };

    loadProfile();
  }, [user]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>
      <header className="customer-header">
        <div className="customer-header-top">
          <svg className="customer-header-logo" width="28" height="28" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="10" fill="var(--color-primary)" />
            <rect x="8" y="22" width="8" height="12" rx="2" fill="white" />
            <rect x="20" y="16" width="8" height="18" rx="2" fill="white" opacity="0.8" />
            <path d="M8 14 L20 8 L32 14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          <span className="customer-header-brand">Adil Petroleum</span>
          <button className="customer-mobile-menu-btn" onClick={() => setMenuOpen(!menuOpen)}>
            ☰
          </button>
        </div>
        
        {menuOpen && (
          <div className="customer-mobile-backdrop" onClick={() => setMenuOpen(false)} />
        )}
        
        <div className={`customer-header-content ${menuOpen ? 'open' : ''}`}>
          <div className="customer-drawer-top">
            <span className="customer-drawer-title">Menu</span>
            <button className="customer-drawer-close" onClick={() => setMenuOpen(false)}>✕</button>
          </div>
          <nav className="customer-header-nav">
            {NAV.map(({ to, label, icon, end }) => (
              <NavLink 
                key={to} 
                to={to} 
                end={end} 
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) => `customer-nav-link ${isActive ? 'active' : ''}`}
              >
                <span className="customer-nav-icon">{icon}</span> 
                <span className="customer-nav-label">{label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="customer-header-actions">
            <span className="customer-user-name">{user?.name}</span>
            <button onClick={async () => { await logout(); nav('/login'); }} className="customer-signout-btn">
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main style={{ flex: 1, width: '100%', maxWidth: 960, margin: '0 auto', padding: 'var(--space-4)' }}>
        <Outlet />
      </main>
    </div>
  );
}