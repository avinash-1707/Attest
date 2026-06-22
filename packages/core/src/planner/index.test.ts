import { describe, it, expect } from 'vitest';
import { plan, PlanError } from './index';
import { FakeModelClient } from '../testing/fakes';

function modelReturning(text: string): FakeModelClient {
  const m = new FakeModelClient();
  m.responses.planner = text;
  return m;
}

const validPlan = JSON.stringify({
  steps: [
    { name: 'Open login', action: { kind: 'goto', url: 'https://app.com/login' } },
    { name: 'Type email', action: { kind: 'type', intent: 'email field', text: 'qa@app.com' } },
    {
      name: 'Submit',
      action: { kind: 'click', intent: 'login button' },
      expectation: { url: 'https://app.com/dashboard', elementText: 'Dashboard' },
    },
  ],
});

describe('planner', () => {
  it('parses a valid plan and assigns sequential indices', async () => {
    const journey = await plan({ goal: 'log in', url: 'https://app.com' }, modelReturning(validPlan));
    expect(journey.goal).toBe('log in');
    expect(journey.steps.map((s) => s.index)).toEqual([0, 1, 2]);
    expect(journey.steps[2]?.action).toEqual({ kind: 'click', intent: 'login button' });
    expect(journey.steps[2]?.expectation?.url).toBe('https://app.com/dashboard');
  });

  it('calls the planner role with the goal and url', async () => {
    const model = modelReturning(validPlan);
    await plan({ goal: 'log in', url: 'https://app.com' }, model);
    expect(model.calls[0]?.role).toBe('planner');
    expect(model.calls[0]?.req.prompt).toContain('https://app.com');
  });

  it('throws PlanError on non-JSON output', async () => {
    await expect(plan({ goal: 'x', url: 'https://app.com' }, modelReturning('not json'))).rejects.toBeInstanceOf(
      PlanError,
    );
  });

  it('throws PlanError on a structurally invalid plan', async () => {
    const bad = JSON.stringify({ steps: [{ name: '', action: { kind: 'jump' } }] });
    await expect(plan({ goal: 'x', url: 'https://app.com' }, modelReturning(bad))).rejects.toBeInstanceOf(PlanError);
  });

  it('throws PlanError on an empty step list', async () => {
    await expect(
      plan({ goal: 'x', url: 'https://app.com' }, modelReturning(JSON.stringify({ steps: [] }))),
    ).rejects.toBeInstanceOf(PlanError);
  });
});
