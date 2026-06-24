import { Section } from './Section';
import { Reveal } from './Reveal';
import { Metric } from './Metric';

const metrics = [
  { value: 95, suffix: '%+', label: 'Verdict accuracy vs. human QA' },
  { value: 60, prefix: '<', suffix: 's', label: 'Median time, goal to verdict' },
  { value: 70, suffix: '%+', label: 'Fix loops the agent closes itself' },
  { value: 100, suffix: '%', label: 'Same verdict, MCP or dashboard' },
];

export function Metrics() {
  return (
    <Section className="py-12 md:py-16">
      <Reveal>
        <hr className="attest-rule" />
        <div className="grid grid-cols-2 lg:grid-cols-4">
          {metrics.map((m, i) => (
            <div
              key={m.label}
              style={{
                borderLeft: i % 4 === 0 ? 'none' : '1px solid var(--surface-border)',
                borderTop:
                  i >= 2 ? '1px solid var(--surface-border)' : 'none',
              }}
              className="lg:!border-t-0"
            >
              <Metric {...m} />
            </div>
          ))}
        </div>
        <hr className="attest-rule" />
      </Reveal>
    </Section>
  );
}
