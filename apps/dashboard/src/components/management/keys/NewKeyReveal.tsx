'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { AppKeyCreated } from '@attest/contracts';

interface NewKeyRevealProps {
  created: AppKeyCreated;
  onDone: () => void;
}

export function NewKeyReveal({ created, onDone }: NewKeyRevealProps) {
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(created.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // clipboard unavailable - user must copy manually
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <div
        style={{
          backgroundColor: 'var(--color-warn)',
          border: '1px solid var(--data-border)',
          borderRadius: 'var(--radius-xs)',
          padding: 'var(--space-3) var(--space-4)',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            color: 'var(--color-warn-text)',
            lineHeight: 1.5,
          }}
        >
          This key is shown exactly once. Copy it now and store it securely. It cannot be retrieved after you close this dialog.
        </p>
      </div>

      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--space-2)',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              letterSpacing: 'var(--tracking-wider)',
              textTransform: 'uppercase',
            }}
          >
            {created.name}
          </span>
          <button
            onClick={handleCopy}
            style={{
              background: 'none',
              border: '1px solid var(--data-border)',
              borderRadius: 'var(--radius-xs)',
              cursor: 'pointer',
              color: copied ? 'var(--color-pass-text)' : 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              padding: '2px 8px',
              transition: 'color 80ms ease-out',
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <pre
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            color: 'var(--data-text)',
            backgroundColor: 'var(--data-surface)',
            border: '1px solid var(--data-border)',
            borderRadius: 'var(--radius-xs)',
            padding: 'var(--space-4)',
            overflowX: 'auto',
            whiteSpace: 'pre',
            wordBreak: 'keep-all',
            userSelect: 'all',
            lineHeight: 1.5,
          }}
          aria-label="API key value"
        >
          {created.key}
        </pre>

        <p
          style={{
            marginTop: 'var(--space-2)',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
          }}
        >
          Prefix: {created.keyPrefix}
        </p>
      </div>

      <label
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 'var(--space-3)',
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          style={{ marginTop: 2, flexShrink: 0, accentColor: 'var(--accent-primary)' }}
        />
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
          }}
        >
          I have copied and stored this key. I understand it cannot be retrieved again.
        </span>
      </label>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button onClick={onDone} disabled={!confirmed}>
          Done
        </Button>
      </div>
    </div>
  );
}
