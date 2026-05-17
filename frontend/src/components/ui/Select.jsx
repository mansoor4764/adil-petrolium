import React, { useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

const MOBILE_BREAKPOINT = 880;

const readOptionLabel = (node) => {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(readOptionLabel).join('');
  return '';
};

const collectOptions = (nodes) => React.Children.toArray(nodes).flatMap((child) => {
  if (!React.isValidElement(child)) return [];

  if (child.type === React.Fragment) {
    return collectOptions(child.props.children);
  }

  if (child.type === 'optgroup') {
    return collectOptions(child.props.children);
  }

  if (child.type !== 'option') {
    return [];
  }

  return [{
    value: child.props.value ?? '',
    label: readOptionLabel(child.props.children),
    disabled: !!child.props.disabled,
    key: child.key ?? child.props.value ?? readOptionLabel(child.props.children),
  }];
});

export const Select = React.forwardRef(({
  label, error, hint, id, required, children, ...rest
}, ref) => {
  const autoId = useId();
  const selectId = id || autoId;
  const [focused, setFocused] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const options = useMemo(() => collectOptions(children), [children]);
  const currentValue = rest.value ?? '';
  const selectedOption = options.find((option) => String(option.value) === String(currentValue));
  const currentLabel = selectedOption?.label || options[0]?.label || 'Select an option';

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;

    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const update = () => setIsMobile(mediaQuery?.matches || false);

    update();

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', update);
      return () => mediaQuery.removeEventListener('change', update);
    }

    mediaQuery.addListener(update);
    return () => mediaQuery.removeListener(update);
  }, []);

  useEffect(() => {
    if (!mobileOpen || typeof window === 'undefined') return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  const emitChange = (nextValue) => {
    rest.onChange?.({ target: { value: nextValue } });
  };

  const baseControlStyle = {
    padding: '0 var(--space-3)',
    height: 'var(--control-height-lg)',
    minHeight: 44,
    border: `1px solid ${error ? 'var(--color-error)' : focused ? 'var(--color-primary)' : 'var(--color-border)'}`,
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-sm)',
    background: focused ? 'var(--color-surface-2)' : 'var(--color-surface)',
    color: 'var(--color-text)',
    outline: 'none',
    width: '100%',
    boxShadow: error
      ? '0 0 0 3px color-mix(in oklch, var(--color-error) 14%, transparent)'
      : focused
        ? '0 0 0 3px color-mix(in oklch, var(--color-primary) 14%, transparent)'
        : 'none',
    transition: 'border-color 150ms ease, box-shadow 150ms ease, background 150ms ease',
    cursor: 'pointer',
  };

  const mobileSheet = mobileOpen && typeof document !== 'undefined' ? createPortal(
    <div
      role="presentation"
      onClick={() => setMobileOpen(false)}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(15, 23, 42, 0.45)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: 'var(--space-4)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${selectId}-sheet-title`}
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 'min(100%, 460px)',
          maxHeight: '80vh',
          overflow: 'hidden',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-divider)' }}>
          <div id={`${selectId}-sheet-title`} style={{ fontSize: 'var(--text-sm)', fontWeight: 750 }}>
            {label || 'Select an option'}
          </div>
          <div style={{ marginTop: 2, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            Tap an item to choose it.
          </div>
        </div>

        <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {options.map((option) => {
            const isSelected = String(option.value) === String(currentValue);

            return (
              <button
                key={option.key}
                type="button"
                disabled={option.disabled}
                onClick={() => {
                  emitChange(option.value);
                  setMobileOpen(false);
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: 'var(--space-3) var(--space-4)',
                  border: 'none',
                  borderBottom: '1px solid var(--color-divider)',
                  background: isSelected ? 'color-mix(in oklch, var(--color-primary) 10%, var(--color-surface))' : 'var(--color-surface)',
                  color: option.disabled ? 'var(--color-text-muted)' : 'var(--color-text)',
                  fontWeight: isSelected ? 700 : 500,
                  cursor: option.disabled ? 'not-allowed' : 'pointer',
                }}
              >
                {option.label || '\u00A0'}
              </button>
            );
          })}
        </div>

        <div style={{ padding: 'var(--space-3) var(--space-4)', borderTop: '1px solid var(--color-divider)' }}>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            style={{
              width: '100%',
              minHeight: 44,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              fontWeight: 650,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>, document.body
  ) : null;

  return (
    <div className="form-row">
      {label && (
        <label htmlFor={selectId} style={{
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

      {isMobile ? (
        <>
          <button
            id={selectId}
            type="button"
            aria-describedby={error ? `${selectId}-err` : hint ? `${selectId}-hint` : undefined}
            aria-haspopup="dialog"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
            style={{
              ...baseControlStyle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-3)',
              textAlign: 'left',
              touchAction: 'manipulation',
            }}
          >
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentLabel}
            </span>
            <span aria-hidden="true" style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>
              ▾
            </span>
          </button>

          {mobileSheet}
        </>
      ) : (
        <select
          ref={ref}
          id={selectId}
          className="ui-input"
          aria-invalid={!!error}
          aria-describedby={error ? `${selectId}-err` : hint ? `${selectId}-hint` : undefined}
          style={{
            ...baseControlStyle,
            WebkitAppearance: 'auto',
            appearance: 'auto',
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
        >
          {children}
        </select>
      )}

      {error && (
        <span id={`${selectId}-err`} role="alert" style={{
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
        <span id={`${selectId}-hint`} style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--color-text-faint)',
        }}>{hint}</span>
      )}
    </div>
  );
});

Select.displayName = 'Select';
