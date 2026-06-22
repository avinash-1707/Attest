import { pgEnum } from 'drizzle-orm/pg-core';
import { runStatus, stepStatus, source, resolvedBy, evidenceKind } from '@attest/contracts';

// DB enums mirror the contract enums; values are sourced from contracts so the two cannot drift
// [tech-arch §2, invariant 6]. Adding a value is an additive migration; removing one is a major bump.
const asTuple = (values: readonly string[]) => values as [string, ...string[]];

export const runStatusEnum = pgEnum('run_status', asTuple(runStatus.options));
export const stepStatusEnum = pgEnum('step_status', asTuple(stepStatus.options));
export const sourceEnum = pgEnum('run_source', asTuple(source.options));
export const resolvedByEnum = pgEnum('resolved_by', asTuple(resolvedBy.options));
export const evidenceKindEnum = pgEnum('evidence_kind', asTuple(evidenceKind.options));
