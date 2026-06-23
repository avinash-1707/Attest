'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';
import { ErrorMessage } from '@/components/ui/ErrorMessage';

interface OtpVerifyFormProps {
  email: string;
}

export function OtpVerifyForm({ email }: OtpVerifyFormProps) {
  const router = useRouter();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const emailOtp = (authClient as Record<string, unknown>).emailOtp as
        | { verifyEmail: (opts: { email: string; otp: string }) => Promise<{ error?: { message?: string } | null }> }
        | undefined;

      if (!emailOtp) {
        setError('OTP verification is not configured on this client.');
        return;
      }

      const result = await emailOtp.verifyEmail({ email, otp });
      if (result.error) {
        setError(result.error.message ?? 'Invalid code. Check the code and try again.');
        return;
      }
      router.push('/');
    } catch {
      setError('Verification failed. Check the code and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError(null);
    setResending(true);
    try {
      const emailOtp = (authClient as Record<string, unknown>).emailOtp as
        | { sendVerificationOtp: (opts: { email: string; type: string }) => Promise<{ error?: { message?: string } | null }> }
        | undefined;

      if (!emailOtp) return;
      await emailOtp.sendVerificationOtp({ email, type: 'email-verification' });
      setResent(true);
    } catch {
      setError('Failed to resend the code. Try again.');
    } finally {
      setResending(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <p
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-sm)',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
        }}
      >
        A verification code was sent to{' '}
        <span
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontSize: 'var(--text-xs)' }}
        >
          {email}
        </span>
        . Enter it below.
      </p>

      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <Field label="Verification code" htmlFor="otp" required>
          <Input
            id="otp"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            autoComplete="one-time-code"
            placeholder="000000"
            maxLength={8}
            required
            disabled={loading}
            style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.2em', textAlign: 'center', fontSize: 'var(--text-lg)' }}
          />
        </Field>

        {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

        {resent && (
          <p
            role="status"
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-pass-text)',
            }}
          >
            New code sent.
          </p>
        )}

        <Button type="submit" loading={loading} style={{ width: '100%', justifyContent: 'center' }}>
          Verify email
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
        Didn't receive it?{' '}
        <button
          onClick={handleResend}
          disabled={resending}
          style={{
            background: 'none',
            border: 'none',
            cursor: resending ? 'not-allowed' : 'pointer',
            color: 'var(--accent-primary)',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            padding: 0,
            opacity: resending ? 0.5 : 1,
          }}
        >
          {resending ? 'Sending...' : 'Resend code'}
        </button>
      </p>
    </div>
  );
}
