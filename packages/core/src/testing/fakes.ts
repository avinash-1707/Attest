import type { AgentRole, EvidenceKind, EvidenceRef } from '@attest/contracts';
import type {
  BrowserAdapter,
  BrowserContext,
} from '../adapters/browser/index';
import type { ResolutionAdapter } from '../adapters/resolution/index';
import type { ModelClient, ModelRequest, ModelResponse } from '../adapters/model/index';
import type { EvidenceStore } from '../adapters/storage/index';
import type {
  A11yNode,
  ConsoleEvent,
  NavigationResult,
  NetworkEvent,
  ResolvedTarget,
  TenantNamespace,
} from '../adapters/types';

// In-memory adapters for pure unit tests. No I/O, no engine SDKs, fully deterministic.

export class FakeBrowserContext implements BrowserContext {
  navResults: Record<string, NavigationResult> = {};
  defaultNav: NavigationResult = { ok: true, httpStatus: 200, url: 'about:blank' };
  a11y: A11yNode[] = [];
  dom = '<html></html>';
  screenshotBytes = Buffer.from('fake-png');
  consoleEvents: ConsoleEvent[] = [];
  networkEvents: NetworkEvent[] = [];
  closed = false;

  private consoleCbs: Array<(e: ConsoleEvent) => void> = [];
  private networkCbs: Array<(e: NetworkEvent) => void> = [];

  async goto(url: string): Promise<NavigationResult> {
    return this.navResults[url] ?? { ...this.defaultNav, url };
  }
  async click(_target: ResolvedTarget): Promise<void> {}
  async type(_target: ResolvedTarget, _text: string): Promise<void> {}
  async screenshot(): Promise<Buffer> {
    return this.screenshotBytes;
  }
  async domSnapshot(): Promise<string> {
    return this.dom;
  }
  async a11ySnapshot(): Promise<A11yNode[]> {
    return this.a11y;
  }
  onConsole(cb: (e: ConsoleEvent) => void): void {
    this.consoleCbs.push(cb);
  }
  onNetwork(cb: (e: NetworkEvent) => void): void {
    this.networkCbs.push(cb);
  }
  async close(): Promise<void> {
    this.closed = true;
  }

  // Test helpers: push an event onto the stream and notify subscribers.
  emitConsole(e: ConsoleEvent): void {
    this.consoleEvents.push(e);
    for (const cb of this.consoleCbs) cb(e);
  }
  emitNetwork(e: NetworkEvent): void {
    this.networkEvents.push(e);
    for (const cb of this.networkCbs) cb(e);
  }
}

export class FakeBrowserAdapter implements BrowserAdapter {
  readonly context = new FakeBrowserContext();
  async newContext(): Promise<BrowserContext> {
    return this.context;
  }
}

export class FakeResolutionAdapter implements ResolutionAdapter {
  // Intents that always miss (permanent resolution failure).
  misses = new Set<string>();
  // Intents that miss N times then resolve, to exercise the re-resolution retry.
  failuresBeforeSuccess = new Map<string, number>();
  async resolve(intent: string, _ctx: BrowserContext): Promise<ResolvedTarget> {
    const remaining = this.failuresBeforeSuccess.get(intent) ?? 0;
    if (remaining > 0) {
      this.failuresBeforeSuccess.set(intent, remaining - 1);
      throw new Error(`fake resolution miss: ${intent}`);
    }
    if (this.misses.has(intent)) {
      throw new Error(`fake resolution miss: ${intent}`);
    }
    return { selector: `[data-intent="${intent}"]`, resolvedBy: 'text', confidence: 1 };
  }
}

export class FakeModelClient implements ModelClient {
  // Scripted response text per role; tests set what the planner/judge "returns".
  responses: Partial<Record<AgentRole, string>> = {};
  calls: Array<{ role: AgentRole; req: ModelRequest }> = [];
  async complete(role: AgentRole, req: ModelRequest): Promise<ModelResponse> {
    this.calls.push({ role, req });
    return { text: this.responses[role] ?? '' };
  }
}

export class FakeEvidenceStore implements EvidenceStore {
  private blobs = new Map<EvidenceRef, Buffer>();
  private seq = 0;
  async put(_ns: TenantNamespace, blob: Buffer, kind: EvidenceKind): Promise<EvidenceRef> {
    const ref = `ev_${kind}_${++this.seq}`;
    this.blobs.set(ref, blob);
    return ref;
  }
  async get(_ns: TenantNamespace, ref: EvidenceRef): Promise<Buffer> {
    const blob = this.blobs.get(ref);
    if (!blob) throw new Error(`fake evidence store: unknown ref ${ref}`);
    return blob;
  }
}
