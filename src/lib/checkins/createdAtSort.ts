/**
 * Sort key for “when this record was entered into HMS”.
 * Distinct from check-in business date/time (checkInAt).
 */

type TimestampLike = {
  toMillis?: () => number;
  toDate?: () => Date;
};

function toMs(value: unknown): number | undefined {
  if (value == null) return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getTime();
  const ts = value as TimestampLike;
  if (typeof ts.toMillis === 'function') {
    const ms = ts.toMillis();
    if (Number.isFinite(ms)) return ms;
  }
  if (typeof ts.toDate === 'function') {
    const d = ts.toDate();
    if (d instanceof Date && !Number.isNaN(d.getTime())) return d.getTime();
  }
  return undefined;
}

/** Prefer createdAt; fall back to checkInAt for legacy docs that never stored createdAt. */
export function getCheckinCreationTimeMs(data: Record<string, unknown>): number {
  return toMs(data.createdAt) ?? toMs(data.checkInAt) ?? 0;
}

export function compareCheckinsByCreatedAtDesc(
  a: Record<string, unknown>,
  b: Record<string, unknown>
): number {
  return getCheckinCreationTimeMs(b) - getCheckinCreationTimeMs(a);
}
