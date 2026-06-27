// Typed DAL errors, so callers branch on the error TYPE rather than matching on a message substring
// (which silently breaks when a message is reworded, and can mis-catch unrelated errors)
// [audit 2026-06-27 M10].

// Thrown when a write references an app that is not in the bound org (a client-supplied bad appId, not
// a backend fault). The backend maps it to a 400, not an opaque 500.
export class AppScopeError extends Error {
  override readonly name = 'AppScopeError';
  constructor(message = 'A referenced app is not in your org') {
    super(message);
  }
}
