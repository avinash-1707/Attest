'use client';

interface Strength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
}

// Deterministic, dependency-free heuristic: length tiers plus character-class variety. Mirrors the
// 8-char minimum the form enforces, then rewards length and mixed classes. Not a security control
// (the server validates), purely user-facing feedback.
function scorePassword(pw: string): Strength {
  if (!pw) return { score: 0, label: '', color: 'var(--surface-border)' };

  let points = 0;
  if (pw.length >= 8) points++;
  if (pw.length >= 12) points++;
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(pw)).length;
  if (classes >= 2) points++;
  if (classes >= 3) points++;
  if (pw.length < 8) points = Math.min(points, 1);

  const score = Math.min(points, 4) as Strength['score'];
  const meta: Record<Strength['score'], Omit<Strength, 'score'>> = {
    0: { label: '', color: 'var(--surface-border)' },
    1: { label: 'Weak', color: 'var(--color-fail-text)' },
    2: { label: 'Fair', color: 'var(--color-warn-text)' },
    3: { label: 'Good', color: 'var(--color-warn-text)' },
    4: { label: 'Strong', color: 'var(--color-pass-text)' },
  };
  return { score, ...meta[score] };
}

export function PasswordStrength({ password }: { password: string }) {
  const { score, label, color } = scorePassword(password);

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}
      aria-live="polite"
    >
      <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
        {[1, 2, 3, 4].map((seg) => (
          <span
            key={seg}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 'var(--radius-full)',
              backgroundColor: seg <= score ? color : 'var(--surface-border)',
              transition: 'background-color var(--dur-2) var(--ease-out)',
            }}
          />
        ))}
      </div>
      {label && (
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-xs)',
            color,
            margin: 0,
          }}
        >
          {label} password
        </p>
      )}
    </div>
  );
}
