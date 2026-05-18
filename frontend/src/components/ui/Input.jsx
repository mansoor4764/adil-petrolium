import React, { useId, useState } from 'react';

const isDateLikeType = (type) => type === 'date' || type === 'datetime-local';

export const Input = React.forwardRef(({
  label, error, hint, id, required, type = 'text', ...rest
}, ref) => {
  const autoId = useId();
  const inputId = id || autoId;
  const [focused, setFocused] = useState(false);

  const dateLike = isDateLikeType(type);
  const active = focused;

  const borderColor = error
    ? 'var(--color-error)'
    : active
      ? 'var(--color-primary)'
      : 'var(--color-border)';

  const boxShadow = error
    ? '0 0 0 3px color-mix(in oklch, var(--color-error) 14%, transparent)'
    : active
      ? '0 0 0 3px color-mix(in oklch, var(--color-primary) 14%, transparent)'
      : 'none';

  const baseControlStyle = {
    padding: '0 var(--space-3)',
    height: 'var(--control-height-lg)',
    minHeight: 44,
    border: `1px solid ${borderColor}`,
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-sm)',
    background: active ? 'var(--color-surface-2)' : 'var(--color-surface)',
    color: 'var(--color-text)',
    outline: 'none',
    width: '100%',
    boxShadow,
    transition: 'border-color 150ms ease, box-shadow 150ms ease, background 150ms ease',
    fontVariantNumeric: type === 'number' ? 'tabular-nums' : undefined,
  };

  return (
    <div className="form-row">
      {label && (
        <label htmlFor={inputId} style={{
          fontSize: 'var(--text-xs)',
          fontWeight: 700,
          color: 'var(--color-text-muted)',
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
        }}>
          {label}
          {required && <span style={{ color: 'var(--color-error)', marginLeft: 3 }}>*</span>}
        </label>
      )}

      <input
        ref={ref}
        id={inputId}
        type={type}
        className="ui-input"
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-err` : hint ? `${inputId}-hint` : undefined}
        style={{
          ...baseControlStyle,
          WebkitAppearance: dateLike ? 'auto' : undefined,
          appearance: dateLike ? 'auto' : undefined,
        }}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        {...rest}
      />

      {error && (
        <span id={`${inputId}-err`} role="alert" style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--color-error)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <circle cx="6" cy="6" r="5.5" stroke="currentColor" />
            <path d="M6 3.5V6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="6" cy="8.5" r="0.75" fill="currentColor" />
          </svg>
          {error}
        </span>
      )}

      {hint && !error && (
        <span id={`${inputId}-hint`} style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--color-text-faint)',
        }}>{hint}</span>
      )}
    </div>
  );
});

Input.displayName = 'Input';
