// Flat-data surface: the attestation readout. Radius 0, hard 1px borders,
// mono type, no shadow. This is the "data never wears clay" half of the system.
// Verdict is communicated by color + label + symbol prefix (color-independence).

const rows: Array<{ k: string; v: string; mono?: boolean }> = [
  { k: 'run_id', v: 'run_a1b2c3d4e5', mono: true },
  { k: 'goal', v: 'User completes checkout with a saved card' },
  { k: 'duration', v: '24.81s', mono: true },
  { k: 'steps', v: '7 / 7 executed', mono: true },
];

const evidence = ['screenshot-07.png', 'dom-snapshot.html', 'network.har'];

export function AttestationPanel() {
  return (
    <div
      role="status"
      aria-label="Example attestation: passed"
      style={{
        backgroundColor: 'var(--data-surface)',
        border: '1px solid var(--data-border)',
        borderRadius: 'var(--radius-0)',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-xs)',
        color: 'var(--data-text)',
        width: '100%',
      }}
    >
      {/* Verdict header strip */}
      <div
        className="flex items-center justify-between"
        style={{
          padding: '10px 14px',
          backgroundColor: 'var(--color-pass)',
          color: 'var(--color-pass-text)',
          borderBottom: '1px solid var(--data-border)',
        }}
      >
        <span
          className="uppercase"
          style={{ letterSpacing: 'var(--tracking-wide)', fontSize: 'var(--text-md)' }}
        >
          + PASSED
        </span>
        <span className="uppercase" style={{ letterSpacing: 'var(--tracking-wide)' }}>
          schema v1.0
        </span>
      </div>

      {/* Key / value rows */}
      <div style={{ padding: '6px 0' }}>
        {rows.map((r) => (
          <div
            key={r.k}
            className="flex gap-4"
            style={{ padding: '5px 14px', lineHeight: 1.5 }}
          >
            <span
              style={{ color: 'var(--oxblood-400)', minWidth: 72, flexShrink: 0 }}
            >
              {r.k}
            </span>
            <span
              style={{
                color: 'var(--data-text)',
                fontFamily: r.mono ? 'var(--font-mono)' : 'var(--font-sans)',
              }}
            >
              {r.v}
            </span>
          </div>
        ))}
      </div>

      {/* Evidence block */}
      <div
        style={{
          borderTop: '1px solid var(--data-border)',
          padding: '8px 14px',
        }}
      >
        <div
          className="uppercase"
          style={{
            color: 'var(--data-text-muted)',
            letterSpacing: 'var(--tracking-wide)',
            marginBottom: 6,
          }}
        >
          evidence
        </div>
        <div className="flex flex-wrap gap-2">
          {evidence.map((e) => (
            <span
              key={e}
              style={{
                backgroundColor: 'var(--data-surface-alt)',
                border: '1px solid var(--data-border)',
                borderRadius: 'var(--radius-xs)',
                padding: '2px 6px',
                color: 'var(--data-text-muted)',
              }}
            >
              {e}
            </span>
          ))}
        </div>
      </div>

      {/* Judge note */}
      <div
        style={{
          borderTop: '1px solid var(--data-border)',
          padding: '8px 14px',
          color: 'var(--data-text-muted)',
          lineHeight: 1.6,
        }}
      >
        <span style={{ color: 'var(--oxblood-400)' }}>judge</span>{' '}
        outcome matches goal; payment confirmed (conf #cnf_9X2T). next_action: null
      </div>
    </div>
  );
}
