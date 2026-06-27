'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FiCopy, FiCheck } from 'react-icons/fi';
import { Card } from '@/components/ui/Card';

const MCP_SNIPPET = `{
  "mcpServers": {
    "attest": {
      "command": "npx",
      "args": ["-y", "@attest/mcp"],
      "env": {
        "SERVICE_KEY": "ak_YOUR_KEY_HERE",
        "APP_ID": "app_YOUR_APP_ID_HERE",
        "ATTEST_BACKEND_URL": "https://api.attest.dev"
      }
    }
  }
}`;

export function OnboardingCard() {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(MCP_SNIPPET).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Card className="attest-enter" style={{ padding: 'var(--space-8)' }}>
      <h2
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-xl)',
          fontWeight: 600,
          color: 'var(--text-primary)',
          letterSpacing: 'var(--tracking-tight)',
          margin: 0,
          marginBottom: 'var(--space-2)',
        }}
      >
        Get started
      </h2>
      <p
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-sm)',
          color: 'var(--text-secondary)',
          marginBottom: 'var(--space-5)',
          lineHeight: 1.6,
        }}
      >
        Complete these steps to submit your first attestation run.
      </p>

      <ol
        style={{
          listStyle: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
        }}
      >
        <OnboardingStep
          index={1}
          title="Create an app"
          description="Apps define the URL allowlist for run submissions."
          action={<Link href="/apps" style={linkStyle}>Create app</Link>}
        />
        <OnboardingStep
          index={2}
          title="Mint an API key"
          description="Service keys authenticate runs from CI and your MCP client. The key is shown once."
          action={<Link href="/settings" style={linkStyle}>Create key</Link>}
        />
        <OnboardingStep
          index={3}
          title="Copy the MCP config"
          description="Add this to your MCP client config, replacing the placeholder values."
          action={null}
        >
          <div style={{ marginTop: 'var(--space-3)', position: 'relative' }}>
            <pre
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                color: 'var(--data-text)',
                backgroundColor: 'var(--data-surface)',
                border: '1px solid var(--data-border)',
                borderRadius: 0,
                padding: 'var(--space-4)',
                overflowX: 'auto',
                margin: 0,
                lineHeight: 1.65,
                whiteSpace: 'pre',
              }}
            >
              {MCP_SNIPPET}
            </pre>
            <button
              onClick={handleCopy}
              aria-label={copied ? 'Copied' : 'Copy MCP config to clipboard'}
              title={copied ? 'Copied' : 'Copy'}
              onMouseEnter={(e) => { if (!copied) e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { if (!copied) e.currentTarget.style.color = 'var(--text-muted)'; }}
              style={{
                position: 'absolute',
                top: 'var(--space-2)',
                right: 'var(--space-2)',
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: copied ? 'var(--color-pass)' : 'var(--surface-elevated)',
                color: copied ? 'var(--color-pass-text)' : 'var(--text-muted)',
                border: '1px solid var(--data-border)',
                borderRadius: 'var(--radius-clay-sm)',
                cursor: 'pointer',
                transition: 'background-color var(--dur-2) var(--ease-out), color var(--dur-2) var(--ease-out)',
                boxShadow: 'var(--clay-shadow)',
              }}
            >
              <span style={{ position: 'relative', width: 15, height: 15, display: 'block' }}>
                <FiCopy
                  size={15}
                  strokeWidth={2}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: copied ? 0 : 1,
                    transform: copied ? 'scale(0.5)' : 'scale(1)',
                    transition: 'opacity var(--dur-2) var(--ease-out), transform var(--dur-2) var(--ease-out)',
                  }}
                />
                <FiCheck
                  size={15}
                  strokeWidth={2.5}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: copied ? 1 : 0,
                    transform: copied ? 'scale(1)' : 'scale(0.5)',
                    transition: 'opacity var(--dur-2) var(--ease-out), transform var(--dur-2) var(--ease-out)',
                  }}
                />
              </span>
            </button>
          </div>
        </OnboardingStep>
        <OnboardingStep
          index={4}
          title="Run an attestation"
          description="Use the MCP tool in your agent, or submit a run from the dashboard."
          action={<Link href="/runs" style={linkStyle}>Go to Runs</Link>}
        />
      </ol>
    </Card>
  );
}

interface OnboardingStepProps {
  index: number;
  title: string;
  description: string;
  action: React.ReactNode;
  children?: React.ReactNode;
}

function OnboardingStep({ index, title, description, action, children }: OnboardingStepProps) {
  return (
    <li style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start' }}>
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          width: 28,
          height: 28,
          borderRadius: 'var(--radius-clay-sm)',
          backgroundColor: 'var(--surface-elevated)',
          boxShadow: 'var(--clay-shadow)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-xs)',
          fontWeight: 600,
          color: 'var(--text-muted)',
          marginTop: 2,
        }}
      >
        {index}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-md)',
              fontWeight: 500,
              color: 'var(--text-primary)',
            }}
          >
            {title}
          </span>
          {action}
        </div>
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-muted)',
            marginTop: 'var(--space-1)',
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>
        {children}
      </div>
    </li>
  );
}

const linkStyle: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--text-sm)',
  color: 'var(--accent-primary)',
  textDecoration: 'none',
  fontWeight: 500,
};
