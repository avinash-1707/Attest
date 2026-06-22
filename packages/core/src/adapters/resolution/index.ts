import type { ResolvedTarget } from '../types';
import type { BrowserContext } from '../browser/index';

// Resolution adapter: element resolution (Stagehand impl) behind this interface [tech-arch §3.2].
// Turns an intent into a ResolvedTarget via the fallback ladder; a miss is re-resolved, not failed.
export interface ResolutionAdapter {
  resolve(intent: string, ctx: BrowserContext): Promise<ResolvedTarget>;
}
