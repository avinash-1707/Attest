'use client';

import { useState } from 'react';
import { useSession, organization } from '@/lib/auth-client';
import { useQuery } from '@tanstack/react-query';

export function OrgSwitcher() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  const { data: orgs } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const result = await organization.list();
      return result.data ?? [];
    },
    enabled: !!session,
  });

  async function handleSwitch(orgId: string) {
    await organization.setActive({ organizationId: orgId });
    setOpen(false);
    window.location.reload();
  }

  const activeOrgId = (session?.session as Record<string, unknown> | undefined)?.activeOrganizationId as string | undefined;
  const activeOrg = orgs?.find((o) => o.id === activeOrgId);
  const orgName = activeOrg?.name ?? 'Select org';
  const orgInitial = orgName.charAt(0).toUpperCase();

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Switch organization"
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
          cursor: 'pointer',
          color: 'var(--text-primary)',
          textAlign: 'left',
          transition: 'box-shadow 80ms ease-out',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--clay-shadow-hover)'; }}
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
            color: 'var(--text-primary)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {orgName}
        </span>
        <span aria-hidden="true" style={{ color: 'var(--text-muted)', fontSize: 10 }}>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && orgs && orgs.length > 1 && (
        <div
          role="listbox"
          aria-label="Organizations"
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
          {orgs.map((org) => (
            <button
              key={org.id}
              role="option"
              aria-selected={org.id === activeOrgId}
              onClick={() => handleSwitch(org.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                width: '100%',
                padding: `var(--space-2) var(--space-3)`,
                border: 'none',
                backgroundColor: org.id === activeOrgId ? 'var(--surface-elevated)' : 'transparent',
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
                  org.id === activeOrgId ? 'var(--surface-elevated)' : 'transparent';
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
              {org.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
