import { AttestMark } from './AttestMark';

interface WordmarkProps {
  className?: string;
}

// The logo lockup: the Attest mark (browser window + verified outcome) beside the sans logotype.
export function Wordmark({ className = '' }: WordmarkProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <AttestMark size={26} />
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-lg)',
          fontWeight: 600,
          letterSpacing: 'var(--tracking-tight)',
          color: 'var(--text-primary)',
        }}
      >
        Attest
      </span>
    </span>
  );
}
