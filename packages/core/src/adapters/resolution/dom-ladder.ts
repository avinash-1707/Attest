import type { ResolvedTarget } from '../types';
import type { BrowserContext } from '../browser/index';
import type { ResolutionAdapter } from './index';
import { pageOf } from '../internal/page-handle';

// Puppeteer's aria/ and text/ query handlers take everything after the first slash literally (not a
// CSS or regex context), so the intent is passed verbatim; escaping it would corrupt any name
// containing a slash. Only the CSS attribute rungs need escaping of " and \.
function escAttr(intent: string): string {
  return intent.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

interface Rung {
  selector: string;
  resolvedBy: ResolvedTarget['resolvedBy'];
  confidence: number;
}

// Confidences are heuristic per-rung priors (stronger signal = higher), not calibrated probabilities.
function rungs(intent: string): Rung[] {
  return [
    { selector: `aria/${intent}`, resolvedBy: 'a11y', confidence: 0.9 },
    { selector: `text/${intent}`, resolvedBy: 'text', confidence: 0.8 },
    { selector: `[aria-label="${escAttr(intent)}"]`, resolvedBy: 'aria', confidence: 0.7 },
    { selector: `[role="${escAttr(intent)}"]`, resolvedBy: 'role', confidence: 0.6 },
  ];
}

export async function runLadder(
  intent: string,
  probe: (selector: string) => Promise<boolean>,
): Promise<ResolvedTarget | null> {
  if (intent.trim() === '') {
    return null;
  }
  for (const rung of rungs(intent)) {
    if (await probe(rung.selector)) {
      return { selector: rung.selector, resolvedBy: rung.resolvedBy, confidence: rung.confidence };
    }
  }
  return null;
}

export function createDomLadderResolutionAdapter(): ResolutionAdapter {
  return {
    async resolve(intent: string, ctx: BrowserContext): Promise<ResolvedTarget> {
      const page = pageOf(ctx);
      const target = await runLadder(intent, (sel) => page.$(sel).then((el) => el !== null));
      if (target === null) {
        throw new Error('resolution miss: ' + intent);
      }
      return target;
    },
  };
}
