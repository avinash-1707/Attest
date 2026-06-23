'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from '@/lib/auth-client';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';
import { ErrorMessage } from '@/components/ui/ErrorMessage';

export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await signIn.email({ email, password });
      if (result.error) {
        setError(result.error.message ?? 'Authentication failed. Check your credentials and try again.');
        return;
      }
      router.push('/');
    } catch {
      setError('Sign-in failed. Check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    try {
      await signIn.social({ provider: 'google', callbackURL: '/' });
    } catch {
      setError('Google sign-in failed. Try again or use email and password.');
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

        <Field label="Password" htmlFor="password" required>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="••••••••"
            required
            disabled={loading}
          />
        </Field>

        {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

        <Button type="submit" loading={loading} disabled={googleLoading} style={{ width: '100%', justifyContent: 'center' }}>
          Sign in
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
        No account?{' '}
        <Link
          href="/sign-up"
          style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 500 }}
        >
          Create one
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
