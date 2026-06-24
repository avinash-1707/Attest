import { guillocheStack, dialTicks } from './guilloche';

const C = 170;
const ticks = dialTicks({ cx: C, cy: C, radius: 150, count: 72, minor: 5, major: 11, majorEvery: 6 });
const inner = guillocheStack({ cx: C, cy: C, rings: 7, innerBase: 90, ringGap: 4.5, amp: 5, petals: 11 });
const microText =
  'ATTESTED · EVIDENCE-BACKED · REAL BROWSER · REPRODUCIBLE · ATTESTED · EVIDENCE-BACKED · REAL BROWSER · REPRODUCIBLE · ';

// The signature mark: an attestation seal. Reads as an instrument dial (ticks, sweep)
// fused with a certificate seal (guilloche, micro-text ring, struck checkmark). Carries
// the oxblood brand signal as a centerpiece so the rest of the page can stay calm.
export function AttestSeal({ className = '' }: { className?: string }) {
  return (
    <div className={`relative ${className}`} style={{ width: '100%', maxWidth: 460, margin: '0 auto' }}>
      <svg viewBox="0 0 340 340" width="100%" height="100%" role="img" aria-label="Attestation seal: verdict passed">
        <defs>
          <path
            id="seal-ring-text"
            d={`M${C},${C - 138} A138,138 0 1,1 ${C - 0.01},${C - 138}`}
            fill="none"
          />
        </defs>

        {/* faint engraved certificate weave */}
        {inner.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={i % 3 === 0 ? 'var(--accent-primary)' : 'var(--surface-border)'}
            strokeWidth={0.5}
            opacity={0.4}
          />
        ))}

        {/* outer dial - rotates slowly */}
        <g className="seal-rotate">
          <circle cx={C} cy={C} r={150} fill="none" stroke="var(--surface-border)" strokeWidth={1} />
          {ticks.map((t, i) => (
            <line
              key={i}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={t.major ? 'var(--accent-primary)' : 'var(--surface-border)'}
              strokeWidth={t.major ? 1.4 : 0.8}
              opacity={t.major ? 0.85 : 0.6}
            />
          ))}
          <text
            fill="var(--text-muted)"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '8.5px',
              letterSpacing: '2.5px',
            }}
          >
            <textPath href="#seal-ring-text" startOffset="0">
              {microText}
            </textPath>
          </text>
        </g>

        {/* counter-rotating measurement sweep + tight ring */}
        <g className="seal-rotate-rev">
          <circle
            cx={C}
            cy={C}
            r={120}
            fill="none"
            stroke="var(--surface-border)"
            strokeWidth={0.75}
            strokeDasharray="2 6"
            opacity={0.7}
          />
          <line x1={C} y1={C} x2={C} y2={C - 120} stroke="var(--accent-primary)" strokeWidth={1.2} opacity={0.5} />
        </g>

        {/* certificate double ring */}
        <circle cx={C} cy={C} r={104} fill="none" stroke="var(--surface-border)" strokeWidth={1} />
        <circle cx={C} cy={C} r={99} fill="none" stroke="var(--surface-border)" strokeWidth={0.6} opacity={0.6} />

        {/* struck center disc */}
        <circle cx={C} cy={C} r={92} fill="var(--surface-raised)" stroke="var(--surface-border)" strokeWidth={1} />

        {/* the verdict mark, drawn on */}
        <path
          className="seal-draw"
          d={`M${C - 34},${C + 2} L${C - 10},${C + 26} L${C + 40},${C - 30}`}
          fill="none"
          stroke="var(--accent-primary)"
          strokeWidth={11}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ ['--draw-len' as string]: 130 }}
        />
      </svg>

      {/* crisp HTML verdict chip - flat data, color-independent (+ prefix) */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{ bottom: '4%' }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            letterSpacing: 'var(--tracking-wide)',
            color: 'var(--color-pass-text)',
            backgroundColor: 'var(--data-surface)',
            border: '1px solid var(--data-border)',
            borderRadius: 'var(--radius-xs)',
            padding: '5px 12px',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ color: 'var(--data-text-muted)' }}>VERDICT</span>
          <span style={{ color: 'var(--data-border)' }}>·</span>
          <span>+ PASSED</span>
        </span>
      </div>
    </div>
  );
}
