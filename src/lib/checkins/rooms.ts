/**
 * Single source of truth for selectable room options.
 * Room 14 and 15 are split into 14A/14B and 15A/15B.
 * Historical records may still have numeric 14 or 15 — display only, not selectable.
 */

const ROOMS_1_13 = Array.from({ length: 13 }, (_, i) => i + 1);
const ROOMS_16_50 = Array.from({ length: 35 }, (_, i) => i + 16);

/** All selectable room values in display order. 14 and 15 are replaced by 14A, 14B, 15A, 15B. */
export const ROOM_OPTIONS: (number | string)[] = [
  ...ROOMS_1_13,
  '14A',
  '14B',
  '15A',
  '15B',
  ...ROOMS_16_50,
];

export type RoomId = number | string;

const VALID_ROOM_SET = new Set(ROOM_OPTIONS.map((o) => String(o)));

/** Whether the value is a valid selectable room (new check-ins only). */
export function isValidRoomId(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  return VALID_ROOM_SET.has(String(value));
}

/**
 * Room id allowed when an employee corrects an existing room check-in: current catalog
 * plus legacy numeric 14 / 15 stored on older records.
 */
export function isValidEmployeeRoomCorrection(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return false;
  if (isValidRoomId(value)) return true;
  const s = String(value).trim();
  if (s === '14' || s === '15') return true;
  const n = Number(s);
  return Number.isInteger(n) && (n === 14 || n === 15);
}

/**
 * `<select>` options for employee room correction: catalog order, plus the current value
 * when it is not in the catalog (e.g. legacy 14 / 15) so the control stays controlled.
 */
export function roomOptionsForEmployeeEdit(currentRoomId: unknown): RoomId[] {
  const base = [...ROOM_OPTIONS];
  if (currentRoomId === undefined || currentRoomId === null || currentRoomId === '') return base;
  const key = String(currentRoomId).trim();
  if (key === '' || VALID_ROOM_SET.has(key)) return base;
  const head: RoomId =
    typeof currentRoomId === 'number' && Number.isInteger(currentRoomId)
      ? currentRoomId
      : Number.isFinite(Number(key)) && String(Number(key)) === key
        ? Number(key)
        : (currentRoomId as RoomId);
  return [head, ...base];
}

/**
 * Parse room value from employee PATCH JSON or `<select>` (supports legacy 14 / 15).
 * Returns null if empty or not a recognized room.
 */
export function parseEmployeeRoomPatchValue(value: unknown): RoomId | null {
  if (value === undefined || value === null || value === '') return null;
  const s = String(value).trim();
  if (s === '') return null;
  const exact = ROOM_OPTIONS.find((o) => String(o) === s);
  if (exact !== undefined) return exact;
  const n = Number(s);
  if (!Number.isNaN(n) && Number.isInteger(n)) {
    if (n === 14 || n === 15) return n;
    const numMatch = ROOM_OPTIONS.find((o) => o === n);
    if (numMatch !== undefined) return numMatch as number;
  }
  return null;
}

/** Parse form/option value to stored type: number for 1–13, 16–50; string for 14A, 14B, 15A, 15B. */
export function parseRoomOptionValue(value: string): RoomId {
  const n = Number(value);
  if (!Number.isNaN(n) && Number.isInteger(n) && ROOM_OPTIONS.some((o) => o === n)) return n;
  if (ROOM_OPTIONS.some((o) => o === value)) return value;
  return 1;
}

/** Display label for any room id (supports historical 14/15 and new 14A/14B/15A/15B). */
export function formatRoomDisplay(roomId: RoomId, roomWord = 'Room'): string {
  return `${roomWord} ${roomId}`;
}
