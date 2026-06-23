'use client';

import { forwardRef } from 'react';
import type { InputHTMLAttributes, ReactNode, FocusEvent } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, className = '', style, onFocus, onBlur, ...props }, ref) => {
    function handleFocus(e: FocusEvent<HTMLInputElement>) {
      e.currentTarget.style.borderColor = 'var(--accent-primary)';
      e.currentTarget.style.boxShadow =
        'inset 1px 1px 3px rgba(0,0,0,0.3), 0 0 0 2px color-mix(in srgb, var(--accent-primary) 20%, transparent)';
      onFocus?.(e);
    }

    function handleBlur(e: FocusEvent<HTMLInputElement>) {
      e.currentTarget.style.borderColor = error ? 'var(--color-fail-text)' : 'var(--surface-border)';
      e.currentTarget.style.boxShadow = 'inset 1px 1px 3px rgba(0,0,0,0.3)';
      onBlur?.(e);
    }

    return (
      <input
        ref={ref}
        className={className}
        style={{
          display: 'block',
          width: '100%',
          backgroundColor: 'var(--surface-elevated)',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-base)',
          borderRadius: 'var(--radius-clay-sm)',
          border: `1px solid ${error ? 'var(--color-fail-text)' : 'var(--surface-border)'}`,
          padding: 'var(--space-3) var(--space-4)',
          boxShadow: 'inset 1px 1px 3px rgba(0,0,0,0.3)',
          outline: 'none',
          transition: 'border-color 120ms ease-out, box-shadow 120ms ease-out',
          ...style,
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
      />
    );
  },
);

Input.displayName = 'Input';

export interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  help?: string;
  children: ReactNode;
  required?: boolean;
}

export function Field({ label, htmlFor, error, help, children, required }: FieldProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <label
        htmlFor={htmlFor}
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-sm)',
          fontWeight: 500,
          color: 'var(--text-secondary)',
          letterSpacing: 'var(--tracking-wide)',
          textTransform: 'uppercase',
        }}
      >
        {label}
        {required && (
          <span style={{ color: 'var(--color-fail-text)', marginLeft: 'var(--space-1)' }} aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {error && (
        <p
          role="alert"
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-fail-text)',
          }}
        >
          {error}
        </p>
      )}
      {help && !error && (
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
          }}
        >
          {help}
        </p>
      )}
    </div>
  );
}
