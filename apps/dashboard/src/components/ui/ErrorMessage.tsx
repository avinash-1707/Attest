'use client';

interface ErrorMessageProps {
  message: string;
  onDismiss?: () => void;
}

export function ErrorMessage({ message, onDismiss }: ErrorMessageProps) {
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 'var(--space-3)',
        backgroundColor: 'var(--color-fail)',
        borderRadius: 'var(--radius-xs)',
        border: '1px solid var(--data-border)',
        padding: 'var(--space-3) var(--space-4)',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-sm)',
          color: 'var(--color-fail-text)',
          lineHeight: 1.5,
        }}
      >
        {message}
      </p>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss error"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-fail-text)',
            fontSize: 'var(--text-base)',
            lineHeight: 1,
            padding: 0,
            flexShrink: 0,
            opacity: 0.7,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
