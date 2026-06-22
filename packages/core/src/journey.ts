// The planned journey: engine-internal domain types (not a boundary contract; the boundary
// shape is the Attestation in @attest/contracts). Produced by the planner, consumed by the
// executor and judge [arch §4.1].

export type StepAction =
  | { kind: 'goto'; url: string }
  | { kind: 'click'; intent: string }
  | { kind: 'type'; intent: string; text: string };

// What guards #2/#3 check after the action runs [tech-arch §4.2].
export interface StepExpectation {
  url?: string;
  elementText?: string;
  elementRole?: string;
}

export interface JourneyStep {
  index: number;
  name: string;
  action: StepAction;
  expectation?: StepExpectation;
}

export interface Journey {
  goal: string;
  steps: JourneyStep[];
}
