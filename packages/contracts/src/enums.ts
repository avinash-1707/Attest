import { z } from 'zod';

// schemaVersion is sacred and additive-only within a major [arch §8, tech-arch §2.3].
export const SCHEMA_VERSION = '1.0' as const;

// Goal-relative run status. inconclusive = environment failure, not a code bug [arch §8, tech-arch §4.3].
export const runStatus = z.enum(['passed', 'failed', 'inconclusive']);
export type RunStatus = z.infer<typeof runStatus>;

// A step resolves to pass or fail; run-level inconclusive lives on the run, not the step [arch §8].
export const stepStatus = z.enum(['passed', 'failed']);
export type StepStatus = z.infer<typeof stepStatus>;

// Same execution path; recorded for metrics [arch §8].
export const source = z.enum(['mcp', 'dashboard']);
export type Source = z.infer<typeof source>;

// How the resolution adapter located the element [tech-arch §3.2]; the fallback ladder.
export const resolvedBy = z.enum(['a11y', 'text', 'aria', 'role', 'visual']);
export type ResolvedBy = z.infer<typeof resolvedBy>;

// Model roles the user picks a model for; per-tenant/app config [tech-arch §3.3, prd §6.4].
export const agentRole = z.enum(['planner', 'judge', 'resolution']);
export type AgentRole = z.infer<typeof agentRole>;

// The five deterministic guards, in run order [tech-arch §4.2].
export const guardId = z.enum([
  'http_status',
  'url_assertion',
  'element_presence',
  'console_error',
  'page_load',
]);
export type GuardId = z.infer<typeof guardId>;

// Evidence kinds captured during a run [arch §9].
export const evidenceKind = z.enum([
  'screenshot',
  'console',
  'network',
  'dom_snapshot',
  'a11y_tree',
  'video',
]);
export type EvidenceKind = z.infer<typeof evidenceKind>;
