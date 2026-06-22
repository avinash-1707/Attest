import { describe, it, expect } from 'vitest';
import { runLadder } from './dom-ladder';

function probeMatching(...selectors: string[]): (selector: string) => Promise<boolean> {
  const set = new Set(selectors);
  return async (selector) => set.has(selector);
}

describe('runLadder', () => {
  it('returns the text rung when only the text selector matches', async () => {
    const result = await runLadder('Sign in', probeMatching('text/Sign in'));
    expect(result).toEqual({ selector: 'text/Sign in', resolvedBy: 'text', confidence: 0.8 });
  });

  it('prefers a11y over text when both would match (rung order)', async () => {
    const result = await runLadder('Sign in', probeMatching('aria/Sign in', 'text/Sign in'));
    expect(result).toEqual({ selector: 'aria/Sign in', resolvedBy: 'a11y', confidence: 0.9 });
  });

  it('returns null when nothing matches', async () => {
    const result = await runLadder('Sign in', probeMatching());
    expect(result).toBeNull();
  });

  it('selects on [aria-label=...] for the aria rung', async () => {
    const result = await runLadder('Close dialog', probeMatching('[aria-label="Close dialog"]'));
    expect(result).toEqual({
      selector: '[aria-label="Close dialog"]',
      resolvedBy: 'aria',
      confidence: 0.7,
    });
  });

  it('selects on [role=...] for the role rung', async () => {
    const result = await runLadder('button', probeMatching('[role="button"]'));
    expect(result).toEqual({ selector: '[role="button"]', resolvedBy: 'role', confidence: 0.6 });
  });

  it('passes a slash-bearing intent verbatim to the aria/text rungs', async () => {
    const result = await runLadder('Save / exit', probeMatching('aria/Save / exit'));
    expect(result).toEqual({ selector: 'aria/Save / exit', resolvedBy: 'a11y', confidence: 0.9 });
  });

  it('returns null for an empty or whitespace-only intent without probing', async () => {
    const probed: string[] = [];
    const result = await runLadder('   ', async (selector) => {
      probed.push(selector);
      return true;
    });
    expect(result).toBeNull();
    expect(probed).toEqual([]);
  });

  it('escapes a double-quote so the attribute selector is not broken', async () => {
    const probed: string[] = [];
    await runLadder('Say "hi"', async (selector) => {
      probed.push(selector);
      return false;
    });
    expect(probed).toContain('[aria-label="Say \\"hi\\""]');
    expect(probed).toContain('[role="Say \\"hi\\""]');
  });
});
