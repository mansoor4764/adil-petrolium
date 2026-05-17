import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { recoverAdminPassword } from '../../api/authApi';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
// No longer show recovery keys in the UI — backend issues keys via secure channels

export default function AdminRecover() {
  const [email, setEmail] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newRecoveryKey] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError('');

    try {
      await recoverAdminPassword({
        email: email.trim(),
        recoveryKey: recoveryKey.trim(),
        newPassword,
      });

      // Backend now issues recovery keys via secure channels and does not return them in responses
      setSuccess(true);
      setEmail('');
      setRecoveryKey('');
      setNewPassword('');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // No clipboard handling — recovery key is not shown

  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: 'radial-gradient(circle at top, color-mix(in oklch, var(--color-primary) 8%, transparent), transparent 42%), var(--color-bg)', padding: '24px 16px' }}>
      <div className="form-surface form-surface--padded form-section" style={{ width: '100%', maxWidth: 460, background: 'linear-gradient(180deg, color-mix(in oklch, var(--color-surface) 96%, white), var(--color-surface))', boxShadow: 'var(--shadow-md)', borderRadius: 'var(--radius-xl)' }}>
        <div className="form-hero__titleGroup" style={{ marginBottom: 8 }}>
          <p className="form-hero__eyebrow" style={{ margin: 0 }}>
            Admin Access
          </p>
          <h1 className="form-hero__title" style={{ margin: '8px 0 0' }}>
            Recover password
          </h1>
          <p className="form-hero__subtitle" style={{ margin: '10px 0 0' }}>
            Enter your admin email, current recovery key, and a new password to rotate access.
          </p>
        </div>

        {!newRecoveryKey ? (
          <form onSubmit={handleSubmit}>
            <div className="form-section">
            <Input
              label="Email address"
              type="email"
              id="admin-recover-email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              label="Recovery key"
              type="text"
              id="admin-recover-key"
              autoComplete="one-time-code"
              placeholder="XXXXXX-XXXXXX-XXXXXX-XXXXXX"
              value={recoveryKey}
              onChange={(e) => setRecoveryKey(e.target.value)}
              required
              hint="Format: XXXXXX-XXXXXX-XXXXXX-XXXXXX"
            />

            <Input
              label="New password"
              type="password"
              id="admin-recover-password"
              autoComplete="new-password"
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />

            {error ? (
              <div
                role="alert"
                aria-live="polite"
                style={{
                  background: 'color-mix(in oklch, var(--color-error) 8%, var(--color-surface))',
                  border: '1px solid color-mix(in oklch, var(--color-error) 20%, var(--color-divider))',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 12px',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-error)',
                }}
              >
                {error}
              </div>
            ) : null}

            <div className="form-actions--stacked" style={{ marginTop: 6 }}>
              <Button
                type="submit"
                loading={loading}
                fullWidth
                style={{ justifyContent: 'center' }}
              >
                Reset Password
              </Button>
            </div>
            </div>
          </form>
        ) : success ? (
          <div className="form-section">
            <div
              role="status"
              style={{
                padding: '12px 14px',
                borderRadius: 12,
                border: '1px solid color-mix(in oklch, var(--color-success) 20%, var(--color-divider))',
                background: 'color-mix(in oklch, var(--color-success) 8%, var(--color-surface))',
                color: 'var(--color-text)',
                fontSize: 'var(--text-sm)',
                lineHeight: 1.6,
              }}
            >
              Password reset successful. The new recovery key has been issued via a secure channel.
            </div>

            <div className="form-footer__actions" style={{ justifyContent: 'flex-start' }}>
              <Link
                to="/admin/login"
                style={{
                  minWidth: 140,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 38,
                  padding: '0 16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid color-mix(in oklch, var(--color-primary) 24%, transparent)',
                  background: 'color-mix(in oklch, var(--color-primary) 8%, var(--color-surface))',
                  color: 'var(--color-primary)',
                  textDecoration: 'none',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 700,
                }}
              >
                Go to Login
              </Link>
            </div>
          </div>
        ) : (
          <div className="form-section">
            {/* fallback: show the form again if not successful */}
          </div>
        )}
      </div>
    </div>
  );
}