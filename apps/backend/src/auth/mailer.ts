// The mailer seam. Auth OTP delivery goes through this interface so the transport is swappable
// without touching auth wiring. MVP impl logs the code (zero-config, self-hosted-first); a real
// provider (Resend/SES) is a second impl selected by config in a later unit.

// Matches better-auth emailOTP's sendVerificationOTP `type` union.
export type OtpType = 'sign-in' | 'email-verification' | 'forget-password' | 'change-email';

export interface Mailer {
  sendVerificationOtp(args: { to: string; otp: string; type: OtpType }): Promise<void>;
}

// Minimal logger shape; satisfied by both pino and the global console.
export interface MailerLogger {
  info(obj: unknown, msg?: string): void;
  warn(msg: string): void;
}

// Logs the OTP instead of emailing it. An operator running self-hosted reads the code from logs;
// the first account can be verified with no SMTP/provider configured. The code is logged at warn
// (dev-visible) with recipient + type metadata at info. Not for production hosted use.
export function createConsoleMailer(logger: MailerLogger = console): Mailer {
  return {
    async sendVerificationOtp({ to, otp, type }) {
      logger.info({ to, type }, 'auth.otp.sent');
      logger.warn(`[mailer:console] OTP for ${to} (${type}): ${otp}`);
    },
  };
}
