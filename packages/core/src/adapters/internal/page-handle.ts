import type { Page } from 'puppeteer';

// Internal seam between the two concrete adapters that must share one live page: the Puppeteer
// browser adapter creates and drives the page; the resolution adapter reads it to run the targeting
// ladder [tech-arch §3.1, §3.2]. Kept off the public BrowserContext interface so the engine never
// sees a Puppeteer type - only concrete adapters in core/adapters/* reach through this.
export interface PageHandle {
  readonly page: Page;
}

export function pageOf(ctx: unknown): Page {
  if (ctx && typeof ctx === 'object' && 'page' in ctx) {
    const page = (ctx as PageHandle).page;
    if (page && typeof (page as { $?: unknown }).$ === 'function') {
      return page;
    }
  }
  // Fail precisely at the seam: the browser and resolution adapters must be co-selected (the
  // Puppeteer browser adapter paired with this ladder), not mixed with a non-Puppeteer context.
  throw new Error('resolution adapter requires a Puppeteer-backed BrowserContext');
}
