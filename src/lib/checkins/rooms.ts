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
