import type { EvidenceRef } from '@attest/contracts';
import type { BrowserContext } from '../adapters/browser/index';
import type { EvidenceStore } from '../adapters/storage/index';
import type { ConsoleEvent, NetworkEvent, TenantNamespace } from '../adapters/types';

// Evidence capture + reference management [arch §2, §9]. Subscribes to the continuous
// console/network streams and writes blobs through the storage adapter, returning refs.
// Payloads are stored by reference; the engine passes refs, never inline payloads [arch §8 G5].
export class EvidenceCollector {
  private readonly consoleStream: ConsoleEvent[] = [];
  private readonly networkStream: NetworkEvent[] = [];
  readonly screenshotRefs: EvidenceRef[] = [];
  readonly domSnapshotRefs: EvidenceRef[] = [];
  // Monotonic capture counter. Combined with the runId it yields a deterministic storage id per capture,
  // so a job re-delivery (same run, same journey order) overwrites the same keys instead of writing a
  // fresh random blob set that the storageKey unique index can't dedupe [audit 2026-06-27 H3].
  private seq = 0;

  constructor(
    private readonly ctx: BrowserContext,
    private readonly store: EvidenceStore,
    private readonly ns: TenantNamespace,
    private readonly runId: string,
  ) {
    ctx.onConsole((e) => this.consoleStream.push(e));
    ctx.onNetwork((e) => this.networkStream.push(e));
  }

  private nextId(): string {
    return `${this.runId}-${this.seq++}`;
  }

  consoleEvents(): ConsoleEvent[] {
    return [...this.consoleStream];
  }

  networkEvents(): NetworkEvent[] {
    return [...this.networkStream];
  }

  async captureScreenshot(): Promise<EvidenceRef> {
    const ref = await this.store.put(this.ns, await this.ctx.screenshot(), 'screenshot', this.nextId());
    this.screenshotRefs.push(ref);
    return ref;
  }

  async captureDomSnapshot(): Promise<EvidenceRef> {
    const html = await this.ctx.domSnapshot();
    const ref = await this.store.put(this.ns, Buffer.from(html, 'utf8'), 'dom_snapshot', this.nextId());
    this.domSnapshotRefs.push(ref);
    return ref;
  }
}
