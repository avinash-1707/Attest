'use client';

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode, MouseEvent } from 'react';
import { Spinner } from './Spinner';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: ReactNode;
}

const sizeStyles: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-3 py-1.5',
  md: 'px-4 py-2',
  lg: 'px-5 py-2.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      children,
      className = '',
      style,
      onMouseEnter,
      onMouseLeave,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    const base =
      'inline-flex items-center justify-center gap-2 font-medium cursor-pointer select-none clay-interactive disabled:opacity-50 disabled:cursor-not-allowed';

    const variantClass = (() => {
      switch (variant) {
        case 'primary':
          return 'rounded-[var(--radius-clay-sm)]';
        case 'secondary':
          return 'rounded-[var(--radius-clay-sm)]';
        case 'ghost':
          return 'rounded-[var(--radius-clay-sm)]';
      }
    })();

    const computedStyle = (() => {
      switch (variant) {
        case 'primary':
          return {
            backgroundColor: 'var(--accent-primary)',
            boxShadow: 'var(--clay-shadow-accent)',
            color: 'var(--text-on-accent)',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-md)',
            ...style,
          };
        case 'secondary':
          return {
            backgroundColor: 'var(--surface-elevated)',
            boxShadow: 'var(--clay-shadow)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-md)',
            ...style,
          };
        case 'ghost':
          return {
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-md)',
            ...style,
          };
      }
    })();

    function handleMouseEnter(e: MouseEvent<HTMLButtonElement>) {
      if (!isDisabled) {
        if (variant === 'primary') {
          e.currentTarget.style.backgroundColor = 'var(--accent-hover)';
        } else if (variant === 'secondary') {
          e.currentTarget.style.boxShadow = 'var(--clay-shadow-hover)';
        } else if (variant === 'ghost') {
          e.currentTarget.style.color = 'var(--text-primary)';
        }
      }
      onMouseEnter?.(e);
    }

    function handleMouseLeave(e: MouseEvent<HTMLButtonElement>) {
      if (!isDisabled) {
        if (variant === 'primary') {
          e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
        } else if (variant === 'secondary') {
          e.currentTarget.style.boxShadow = 'var(--clay-shadow)';
        } else if (variant === 'ghost') {
          e.currentTarget.style.color = 'var(--text-secondary)';
        }
      }
      onMouseLeave?.(e);
    }

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`${base} ${variantClass} ${sizeStyles[size]} ${className}`}
        style={computedStyle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {loading && <Spinner size="sm" />}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
