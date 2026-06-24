import { Section } from './Section';
import { Reveal } from './Reveal';
import { Metric } from './Metric';

const metrics = [
  { value: 95, suffix: '%+', label: 'Verdict accuracy measured against human QA' },
  { value: 60, prefix: '<', suffix: 's', label: 'Median run time, goal to verdict' },
  { value: 70, suffix: '%+', label: 'Fix loops the agent closes on its own' },
  { value: 100, suffix: '%', label: 'Same attestation from MCP and dashboard' },
];

export function Metrics() {
  return (
    <Section className="pb-8 md:pb-12">
      <Reveal
        className="grid gap-px md:grid-cols-2 lg:grid-cols-4"
        style={{
          backgroundColor: 'var(--surface-border)',
          borderRadius: 'var(--radius-clay-md)',
          boxShadow: 'var(--clay-shadow)',
          overflow: 'hidden',
        }}
      >
        {metrics.map((m) => (
          <div key={m.label} style={{ backgroundColor: 'var(--surface-raised)' }}>
            <Metric {...m} />
          </div>
        ))}
      </Reveal>
    </Section>
  );
}
