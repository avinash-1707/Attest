'use client';

import { useEffect, useRef } from 'react';
import { useSession } from './auth-client';
import { DASHBOARD_URL } from './env';

// Redirects an already-authenticated user away from public auth pages (sign-in, sign-up).
// Returns isPending: true while the session is still resolving OR while an authenticated user
// is being redirected, so callers can render a spinner for both cases without flashing the form.
export function useRedirectIfAuthed(): { isPending: boolean } {
  const { data: session, isPending } = useSession();
  const redirected = useRef(false);

  useEffect(() => {
    if (isPending || redirected.current) return;
    if (session) {
      redirected.current = true;
      window.location.assign(DASHBOARD_URL);
    }
  }, [isPending, session]);

  // Treat an active session as still "pending" from the form's perspective - the redirect
  // is in-flight and the form must not render.
  const shouldBlock = isPending || !!session;

  return { isPending: shouldBlock };
}
