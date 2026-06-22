// App-side envelope encryption for secrets at rest [tech-arch §6.2]. The KeyProvider abstracts the
// KEK backend (env-sourced for MVP, KMS later); the SecretCipher wraps per-org DEKs and seals values.
export * from './envelope';
export * from './key-provider';
export * from './cipher';
