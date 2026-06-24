import type { ReactNode } from 'react';
import { AttestMark } from '@/components/marketing/AttestMark';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--surface-base)',
        padding: 'var(--space-6)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-8)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <AttestMark size={32} />
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-xl)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: 'var(--tracking-tight)',
            }}
          >
            Attest
          </span>
        </div>

        <div
          style={{
            backgroundColor: 'var(--surface-raised)',
            borderRadius: 'var(--radius-clay-md)',
            boxShadow: 'var(--clay-shadow)',
            padding: 'var(--space-8)',
          }}
        >
          {children}
        </div>

        <p
          style={{
            textAlign: 'center',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
          }}
        >
          QA attestation by Attest
        </p>
      </div>
    </div>
  );
}
