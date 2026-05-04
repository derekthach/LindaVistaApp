/**
 * Detect errors that mean Firestore/Google auth is unavailable (e.g. expired ADC,
 * invalid_rapt, invalid_grant). In development we return safe defaults so the app
 * can run; in production we treat these as real failures (callers should rethrow).
 */
export function isFirestoreUnavailableError(err: unknown): boolean {
  if (err == null) return false;
  const msg = typeof (err as Error).message === 'string' ? (err as Error).message : '';
  const details = typeof (err as { details?: string }).details === 'string'
    ? (err as { details: string }).details
    : '';
  const combined = `${msg} ${details}`.toLowerCase();
  if ((err as { code?: number }).code === 2) return true;
  if (combined.includes('invalid_grant')) return true;
  if (combined.includes('invalid_rapt')) return true;
  if (combined.includes('metadata from plugin failed')) return true;
  if (combined.includes('reauth related error')) return true;
  if (combined.includes('getaddrinfo enotfound')) return true;
  if (combined.includes('failed to parse private key')) return true;
  if (combined.includes('unparsed der bytes')) return true;
  return false;
}

/**
 * Firestore daily free-tier or project limits (gRPC 8 / "Quota exceeded").
 * When true, login should fall back to JSON users where possible instead of failing the whole request.
 */
export function isFirestoreQuotaExceededError(err: unknown): boolean {
  if (err == null) return false;
  const code = (err as { code?: number }).code;
  if (code === 8) return true;
  const msg = String((err as Error).message ?? err);
  const details = String((err as { details?: string }).details ?? '');
  const combined = `${msg} ${details}`.toUpperCase();
  if (combined.includes('RESOURCE_EXHAUSTED')) return true;
  if (combined.includes('QUOTA EXCEEDED')) return true;
  return false;
}

/** In production, Firestore auth failures should not be masked (fail loudly). */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}
