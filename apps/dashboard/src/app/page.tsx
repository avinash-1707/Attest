'use client';

import { useSession } from '@/lib/auth-client';
import { useRuns } from '@/lib/hooks';

// Minimal proof-of-wiring page: confirms the session client and a TanStack Query read both reach the
// backend end to end. NOT the real dashboard - the designed surfaces (sign-in, app/key management,
// run-watch, attestation/evidence views) are built against these same hooks in the UI slice (canvas),
// per docs/technical/ui-context.md.
export default function Home() {
  const { data: session, isPending } = useSession();

  return (
    <main style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <h1>Attest dashboard</h1>
      {isPending ? <p>Loading session...</p> : session ? <RunsPanel /> : <p>Not signed in.</p>}
    </main>
  );
}

function RunsPanel() {
  const { data, isPending, error } = useRuns();

  if (isPending) return <p>Loading runs...</p>;
  if (error) return <p>Failed to load runs: {error.message}</p>;

  return (
    <section>
      <h2>Runs ({data.runs.length})</h2>
      <ul>
        {data.runs.map((r) => (
          <li key={r.runId}>
            {r.goal} - {r.lifecycle}
            {r.status ? ` (${r.status})` : ''}
          </li>
        ))}
      </ul>
    </section>
  );
}
