/** Client-generated UUID used once per review→confirm flow for idempotent room check-in writes. */
const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidRoomSubmissionKey(value: string | null | undefined): value is string {
  if (value == null) return false;
  const s = value.trim();
  return s.length === 36 && UUID_V4_RE.test(s);
}

/** New idempotency key for each trip from room form → verify (not reused across check-ins). */
export function createRoomSubmissionKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
