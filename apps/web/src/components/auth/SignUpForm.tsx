'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signUp, signIn } from '@/lib/auth-client';
import { DASHBOARD_URL } from '@/lib/env';
import { useRedirectIfAuthed } from '@/lib/use-redirect-if-authed';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { PasswordStrength } from '@/components/ui/PasswordStrength';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Spinner } from '@/components/ui/Spinner';

export function SignUpForm() {
  const { isPending: sessionPending } = useRedirectIfAuthed();

  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  if (sessionPending) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 'var(--space-12)',
        }}
      >
        <Spinner style={{ color: 'var(--text-muted)' }} />
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await signUp.email({ name, email, password });
      if (result.error) {
        setError(result.error.message ?? 'Registration failed. Try again.');
        return;
      }
      // verify-email lives in web too; handoff to the dashboard happens after the OTP step.
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch {
      setError('Registration failed. Check your details and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    try {
      await signIn.social({ provider: 'google', callbackURL: DASHBOARD_URL });
    } catch {
      setError('Google sign-up failed. Try again or use email and password.');
      setGoogleLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <Button
        variant="secondary"
        onClick={handleGoogle}
        loading={googleLoading}
        disabled={loading}
        style={{ width: '100%', justifyContent: 'center', gap: 'var(--space-3)' }}
      >
        <GoogleIcon />
        Continue with Google
      </Button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <div style={{ flex: 1, height: 1, backgroundColor: 'var(--surface-border)' }} />
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            letterSpacing: 'var(--tracking-wide)',
            textTransform: 'uppercase',
          }}
        >
          or
        </span>
        <div style={{ flex: 1, height: 1, backgroundColor: 'var(--surface-border)' }} />
      </div>

      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <Field label="Name" htmlFor="name" required>
          <Input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            placeholder="Your name"
            required
            disabled={loading}
          />
        </Field>

        <Field label="Email" htmlFor="email" required>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            required
            disabled={loading}
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          help="Minimum 8 characters."
          required
        >
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="••••••••"
            minLength={8}
            required
            disabled={loading}
          />
          {password && <PasswordStrength password={password} />}
        </Field>

        {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

        <Button type="submit" loading={loading} disabled={googleLoading} style={{ width: '100%', justifyContent: 'center' }}>
          Create account
        </Button>
      </form>

      <p
        style={{
          textAlign: 'center',
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-sm)',
          color: 'var(--text-muted)',
        }}
      >
        Already have an account?{' '}
        <Link
          href="/sign-in"
          style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 500 }}
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M15.68 8.18c0-.57-.05-1.12-.14-1.64H8v3.1h4.3a3.67 3.67 0 0 1-1.6 2.41v2h2.6c1.52-1.4 2.38-3.46 2.38-5.87Z"
        fill="#4285F4"
      />
      <path
        d="M8 16c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01a5.01 5.01 0 0 1-2.7.74c-2.08 0-3.84-1.4-4.47-3.29H.87v2.07A8 8 0 0 0 8 16Z"
        fill="#34A853"
      />
      <path
        d="M3.53 9.5a4.8 4.8 0 0 1 0-3.01V4.43H.87a8 8 0 0 0 0 7.14L3.53 9.5Z"
        fill="#FBBC05"
      />
      <path
        d="M8 3.18a4.33 4.33 0 0 1 3.07 1.2L13.4 2.06A7.7 7.7 0 0 0 8 0a8 8 0 0 0-7.13 4.43l2.66 2.07C4.16 4.59 5.92 3.18 8 3.18Z"
        fill="#EA4335"
      />
    </svg>
  );
}
