import type {
  Viewport,
  NavigationResult,
  ResolvedTarget,
  ConsoleEvent,
  NetworkEvent,
  A11yNode,
} from '../types';

// Browser adapter: Chromium via Puppeteer/CDP behind this interface [tech-arch §3.1].
// The engine talks to this, never to Puppeteer.
export interface BrowserAdapter {
  // A clean-room context per run, never a real user profile [arch §10].
  newContext(opts: { viewport?: Viewport; userAgent?: string }): Promise<BrowserContext>;
}

export interface BrowserContext {
  goto(url: string): Promise<NavigationResult>;
  click(target: ResolvedTarget): Promise<void>;
  type(target: ResolvedTarget, text: string): Promise<void>;
  screenshot(): Promise<Buffer>;
  domSnapshot(): Promise<string>;
  a11ySnapshot(): Promise<A11yNode[]>;
  // Continuous evidence streams the executor subscribes to.
  onConsole(cb: (e: ConsoleEvent) => void): void;
  onNetwork(cb: (e: NetworkEvent) => void): void;
  close(): Promise<void>;
}
