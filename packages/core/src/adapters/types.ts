import type { ResolvedBy } from '@attest/contracts';

// Shared adapter support types. Engine specifics never leak past the adapter seam [tech-arch §3].

export interface Viewport {
  width: number;
  height: number;
}

// Carries httpStatus, ok, timing [tech-arch §3.1]. Feeds guards #1, #2, #5.
export interface NavigationResult {
  ok: boolean;
  httpStatus: number;
  url: string;
  timingMs?: number;
}

export type ConsoleLevel = 'error' | 'warning' | 'log' | 'info' | 'debug';

export interface ConsoleEvent {
  level: ConsoleLevel;
  text: string;
}

export interface NetworkEvent {
  url: string;
  method: string;
  status: number;
  ok: boolean;
}

export interface A11yNode {
  role: string;
  name?: string;
  children?: A11yNode[];
}

// The resolution adapter's output; resolvedBy flows into the attestation step [tech-arch §3.2].
export interface ResolvedTarget {
  selector: string;
  resolvedBy: ResolvedBy;
  confidence: number;
}

// Evidence storage is structurally namespaced per tenant [arch §5.2, §9].
export interface TenantNamespace {
  orgId: string;
  appId: string;
}
