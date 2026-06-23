import type { Metadata } from 'next';
import { OrgSelectForm } from '@/components/auth/OrgSelectForm';

export const metadata: Metadata = {
  title: 'Select organization - Attest',
};

export default function OrgPage() {
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
          maxWidth: 440,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-8)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span
            aria-hidden="true"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-clay-sm)',
              backgroundColor: 'var(--accent-primary)',
              boxShadow: 'var(--clay-shadow-accent)',
              color: 'var(--text-on-accent)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-md)',
              fontWeight: 500,
            }}
          >
            @
          </span>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-xl)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: 'var(--tracking-tight)',
            }}
          >
            attest
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
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <h1
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-2xl)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: 'var(--tracking-tight)',
                marginBottom: 'var(--space-2)',
              }}
            >
              Select organization
            </h1>
            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                color: 'var(--text-muted)',
              }}
            >
              Choose an existing organization or create a new one to continue.
            </p>
          </div>
          <OrgSelectForm />
        </div>
      </div>
    </div>
  );
}
