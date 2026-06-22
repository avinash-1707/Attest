import type { GuardId } from '@attest/contracts';
import type { A11yNode, ConsoleEvent, NavigationResult, NetworkEvent } from '../adapters/types';

// The five deterministic guards [tech-arch §4.2]. Plain checks over evidence the worker already
// holds: no LLM, no I/O. A guard yielding a conclusive failure short-circuits the LLM judge for
// that step's pass/fail [arch §6.3].

export interface StepExpectation {
  url?: string; // guard #2: expected path after navigation
  elementText?: string; // guard #3: expected visible text
  elementRole?: string; // guard #3: expected a11y role
}

export interface GuardEvidence {
  navigation?: NavigationResult;
  console: ConsoleEvent[];
  network: NetworkEvent[];
  a11y: A11yNode[];
  expectation?: StepExpectation;
  timedOut?: boolean; // per-step action timeout, feeds guard #5 [tech-arch §5.3]
}

// 'na' = the guard had nothing to assert (no expectation / no signal); never a failure.
export type GuardStatus = 'pass' | 'fail' | 'na';

export interface GuardResult {
  guardId: GuardId;
  status: GuardStatus;
  detail?: string;
}

// Guard #1: a 4xx/5xx on a request is a deterministic failure signal.
function httpStatusGuard(ev: GuardEvidence): GuardResult {
  if (ev.network.length === 0) return { guardId: 'http_status', status: 'na' };
  const bad = ev.network.filter((n) => n.status >= 400 || !n.ok);
  if (bad.length === 0) return { guardId: 'http_status', status: 'pass' };
  return {
    guardId: 'http_status',
    status: 'fail',
    detail: bad.map((n) => `${n.method} ${n.url} -> ${n.status}`).join('; '),
  };
}

// Guard #2: did navigation reach the expected path?
function urlAssertionGuard(ev: GuardEvidence): GuardResult {
  const expected = ev.expectation?.url;
  if (!expected || !ev.navigation) return { guardId: 'url_assertion', status: 'na' };
  if (ev.navigation.url === expected) return { guardId: 'url_assertion', status: 'pass' };
  return {
    guardId: 'url_assertion',
    status: 'fail',
    detail: `expected ${expected}, got ${ev.navigation.url}`,
  };
}

function findNode(nodes: A11yNode[], role: string | undefined, text: string | undefined): boolean {
  for (const node of nodes) {
    const roleOk = role === undefined || node.role === role;
    const textOk = text === undefined || (node.name?.includes(text) ?? false);
    if (roleOk && textOk) return true;
    if (node.children && findNode(node.children, role, text)) return true;
  }
  return false;
}

// Guard #3: is an element with the expected role/text in the snapshot?
function elementPresenceGuard(ev: GuardEvidence): GuardResult {
  const { elementRole, elementText } = ev.expectation ?? {};
  if (elementRole === undefined && elementText === undefined) {
    return { guardId: 'element_presence', status: 'na' };
  }
  if (findNode(ev.a11y, elementRole, elementText)) {
    return { guardId: 'element_presence', status: 'pass' };
  }
  return {
    guardId: 'element_presence',
    status: 'fail',
    detail: `absent: role=${elementRole ?? '*'} text=${elementText ?? '*'}`,
  };
}

// Guard #4: uncaught exceptions in the console stream.
function consoleErrorGuard(ev: GuardEvidence): GuardResult {
  const errors = ev.console.filter((c) => c.level === 'error');
  if (errors.length === 0) return { guardId: 'console_error', status: 'pass' };
  return {
    guardId: 'console_error',
    status: 'fail',
    detail: errors.map((e) => e.text).join('; '),
  };
}

// Guard #5: the browser reports navigation failure (or the step timed out) deterministically.
function pageLoadGuard(ev: GuardEvidence): GuardResult {
  if (ev.timedOut) return { guardId: 'page_load', status: 'fail', detail: 'step timed out' };
  if (!ev.navigation) return { guardId: 'page_load', status: 'na' };
  if (ev.navigation.ok) return { guardId: 'page_load', status: 'pass' };
  return { guardId: 'page_load', status: 'fail', detail: 'navigation failed' };
}

// Run order is fixed [tech-arch §4.2].
const GUARDS: Array<(ev: GuardEvidence) => GuardResult> = [
  httpStatusGuard,
  urlAssertionGuard,
  elementPresenceGuard,
  consoleErrorGuard,
  pageLoadGuard,
];

export function runGuards(ev: GuardEvidence): GuardResult[] {
  return GUARDS.map((g) => g(ev));
}

// The ids of guards that fired a failure, for steps[].guardsTriggered [arch §8].
export function firedGuards(results: GuardResult[]): GuardId[] {
  return results.filter((r) => r.status === 'fail').map((r) => r.guardId);
}

// Precedence: any conclusive guard failure decides the step's pass/fail without the LLM [arch §6.3].
export function hasConclusiveFailure(results: GuardResult[]): boolean {
  return results.some((r) => r.status === 'fail');
}
