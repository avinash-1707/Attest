'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, organization, authClient } from '@/lib/auth-client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export function OrgSwitcher() {
  const { data: session } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  const activeOrgId = session?.session.activeOrganizationId;

  const { data: orgs, isPending } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const result = await organization.list();
      return result.data ?? [];
    },
    enabled: !!session,
  });

  async function handleSwitch(orgId: string) {
    if (orgId === activeOrgId) {
      setOpen(false);
      return;
    }
    setSwitchError(null);
    try {
      await organization.setActive({ organizationId: orgId });
      setOpen(false);
      // setActive fires $sessionSignal (an async atom refetch); await an explicit fresh read so the
      // session store carries the new active org BEFORE we re-render, otherwise the sidebar label and
      // any org-scoped refetch can briefly run against the previous org.
      await authClient.getSession({ query: { disableCookieCache: true } });
      await queryClient.invalidateQueries();
      router.refresh();
    } catch {
      setSwitchError('Failed to switch workspace.');
    }
  }

  const activeOrg = orgs?.find((o) => o.id === activeOrgId);

  // While loading and an active org is already known, show a neutral placeholder (not "Select org").
  // Only fall back to "Select org" when genuinely no active org exists after load.
  let orgName: string;
  if (isPending && activeOrgId) {
    orgName = '';
  } else {
    orgName = activeOrg?.name ?? (isPending ? '' : 'Select org');
  }

  const orgInitial = orgName ? orgName.charAt(0).toUpperCase() : '?';
  const hasMultiple = (orgs?.length ?? 0) > 1;

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => { if (hasMultiple) setOpen((v) => !v); }}
        aria-expanded={hasMultiple ? open : undefined}
        aria-haspopup={hasMultiple ? 'listbox' : undefined}
        aria-label="Switch workspace"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          width: '100%',
          padding: `var(--space-2) var(--space-3)`,
          borderRadius: 'var(--radius-clay-sm)',
          backgroundColor: 'var(--surface-elevated)',
          boxShadow: 'var(--clay-shadow)',
          border: 'none',
          cursor: hasMultiple ? 'pointer' : 'default',
          color: 'var(--text-primary)',
          textAlign: 'left',
          transition: 'box-shadow 80ms ease-out',
        }}
        onMouseEnter={(e) => { if (hasMultiple) e.currentTarget.style.boxShadow = 'var(--clay-shadow-hover)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--clay-shadow)'; }}
      >
        <span
          aria-hidden="true"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            borderRadius: 'var(--radius-clay-sm)',
            backgroundColor: 'var(--accent-primary)',
            color: 'var(--text-on-accent)',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-xs)',
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {orgInitial}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            color: orgName ? 'var(--text-primary)' : 'var(--text-muted)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {orgName}
        </span>
        {hasMultiple && (
          <span aria-hidden="true" style={{ color: 'var(--text-muted)', fontSize: 10 }}>
            {open ? '▲' : '▼'}
          </span>
        )}
      </button>

      {switchError && (
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-fail-text)',
            marginTop: 'var(--space-1)',
            paddingLeft: 'var(--space-1)',
          }}
        >
          {switchError}
        </p>
      )}

      {open && hasMultiple && (
        <div
          role="listbox"
          aria-label="Workspaces"
          className="attest-dialog-in"
          style={{
            position: 'absolute',
            top: 'calc(100% + var(--space-2))',
            left: 0,
            right: 0,
            backgroundColor: 'var(--surface-raised)',
            borderRadius: 'var(--radius-clay-md)',
            boxShadow: 'var(--clay-shadow-hover)',
            border: '1px solid var(--surface-border)',
            overflow: 'hidden',
            zIndex: 50,
          }}
        >
          {orgs!.map((org) => {
            const isActive = org.id === activeOrgId;
            return (
              <button
                key={org.id}
                role="option"
                aria-selected={isActive}
                onClick={() => handleSwitch(org.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  width: '100%',
                  padding: `var(--space-2) var(--space-3)`,
                  border: 'none',
                  backgroundColor: isActive ? 'var(--surface-elevated)' : 'transparent',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-sm)',
                  textAlign: 'left',
                  transition: 'background-color 80ms ease-out',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface-elevated)'; }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    isActive ? 'var(--surface-elevated)' : 'transparent';
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 20,
                    height: 20,
                    borderRadius: 6,
                    backgroundColor: 'var(--accent-primary)',
                    color: 'var(--text-on-accent)',
                    fontSize: 'var(--text-2xs)',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {org.name.charAt(0).toUpperCase()}
                </span>
                <span style={{ flex: 1 }}>{org.name}</span>
                {isActive && (
                  <span
                    aria-hidden="true"
                    style={{
                      color: 'var(--accent-primary)',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
