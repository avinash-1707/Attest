import puppeteer, { type Browser, type BrowserContext as PuppeteerContext, type LaunchOptions, type Page } from 'puppeteer';
import type {
  Viewport,
  NavigationResult,
  ResolvedTarget,
  ConsoleEvent,
  NetworkEvent,
  A11yNode,
  ConsoleLevel,
} from '../types';
import type { BrowserAdapter, BrowserContext } from './index';
import type { PageHandle } from '../internal/page-handle';

const DEFAULT_VIEWPORT: Viewport = { width: 1280, height: 800 };

function mapLevel(type: string): ConsoleLevel {
  switch (type) {
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'info':
      return 'info';
    case 'debug':
      return 'debug';
    default:
      return 'log';
  }
}

interface RawA11yNode {
  role?: string;
  name?: string;
  children?: RawA11yNode[];
}

function mapA11yNode(node: RawA11yNode): A11yNode {
  const mapped: A11yNode = { role: node.role ?? '' };
  if (node.name !== undefined) {
    mapped.name = node.name;
  }
  if (node.children && node.children.length > 0) {
    mapped.children = node.children.map(mapA11yNode);
  }
  return mapped;
}

class PuppeteerBrowserContext implements BrowserContext, PageHandle {
  readonly page: Page;
  private readonly context: PuppeteerContext;
  private readonly browser: Browser;
  private readonly ownsBrowser: boolean;
  private closed = false;

  constructor(args: { page: Page; context: PuppeteerContext; browser: Browser; ownsBrowser: boolean }) {
    this.page = args.page;
    this.context = args.context;
    this.browser = args.browser;
    this.ownsBrowser = args.ownsBrowser;
  }

  async goto(url: string): Promise<NavigationResult> {
    const start = Date.now();
    try {
      const resp = await this.page.goto(url, { waitUntil: 'load' });
      return {
        ok: resp?.ok() ?? false,
        httpStatus: resp?.status() ?? 0,
        url: this.page.url(),
        timingMs: Date.now() - start,
      };
    } catch {
      // A timeout / DNS / connection failure is an environment result the guards interpret, not an
      // exception the executor should crash on [tech-arch §3.1, §7.5].
      return { ok: false, httpStatus: 0, url: this.page.url(), timingMs: Date.now() - start };
    }
  }

  async click(target: ResolvedTarget): Promise<void> {
    await this.page.waitForSelector(target.selector);
    await this.page.click(target.selector);
  }

  async type(target: ResolvedTarget, text: string): Promise<void> {
    await this.page.waitForSelector(target.selector);
    await this.page.type(target.selector, text);
  }

  async screenshot(): Promise<Buffer> {
    const bytes = await this.page.screenshot();
    return Buffer.from(bytes);
  }

  async domSnapshot(): Promise<string> {
    return this.page.content();
  }

  async a11ySnapshot(): Promise<A11yNode[]> {
    const snap = await this.page.accessibility.snapshot();
    if (!snap) {
      return [];
    }
    return [mapA11yNode(snap)];
  }

  onConsole(cb: (e: ConsoleEvent) => void): void {
    this.page.on('console', (m) => cb({ level: mapLevel(m.type()), text: m.text() }));
  }

  onNetwork(cb: (e: NetworkEvent) => void): void {
    this.page.on('response', (r) =>
      cb({ url: r.url(), method: r.request().method(), status: r.status(), ok: r.ok() }),
    );
    this.page.on('requestfailed', (r) =>
      cb({ url: r.url(), method: r.method(), status: 0, ok: false }),
    );
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.page.removeAllListeners();
    await this.context.close();
    if (this.ownsBrowser) {
      await this.browser.close();
    }
  }
}

export function createPuppeteerBrowserAdapter(opts?: {
  launch?: LaunchOptions;
  browser?: Browser;
}): BrowserAdapter {
  return {
    // One fresh browser per context when none is injected, so each run is a true clean room torn
    // down with the context [arch §10, tech-arch §7.3]; an injected browser is the caller's to close.
    async newContext({ viewport, userAgent }): Promise<BrowserContext> {
      const injected = opts?.browser;
      const browser = injected ?? (await puppeteer.launch({ headless: true, ...opts?.launch }));
      const ownsBrowser = injected === undefined;
      let context: PuppeteerContext | undefined;
      try {
        context = await browser.createBrowserContext();
        const page = await context.newPage();
        await page.setViewport(viewport ?? DEFAULT_VIEWPORT);
        if (userAgent) {
          await page.setUserAgent(userAgent);
        }
        return new PuppeteerBrowserContext({ page, context, browser, ownsBrowser });
      } catch (err) {
        await context?.close().catch(() => {});
        if (ownsBrowser) {
          await browser.close().catch(() => {});
        }
        throw err;
      }
    },
  };
}
