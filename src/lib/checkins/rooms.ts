/**
 * Room catalog: full list of room ids that may appear in the database or historical forms.
 * Room 14 and 15 are split into 14A/14B and 15A/15B (no numeric 14/15 in the catalog).
 * Historical records may still have numeric 14 or 15 — handled in employee correction helpers.
 *
 * New Room Check-In uses {@link ROOM_OPTIONS} — the same catalog minus rooms that do not exist on site.
 */

const ROOMS_1_13 = Array.from({ length: 13 }, (_, i) => i + 1);
const ROOMS_16_50 = Array.from({ length: 35 }, (_, i) => i + 16);

/** Full catalog in display order (legacy + all formerly selectable ids). */
export const FULL_ROOM_CATALOG: (number | string)[] = [
  ...ROOMS_1_13,
  '14A',
  '14B',
  '15A',
  '15B',
  ...ROOMS_16_50,
];

/** Rooms that do not exist on site — excluded from new check-in / occupancy dropdown only. */
function isExcludedFromNewCheckin(room: number | string): boolean {
  const s = String(room).trim();
  if (/^\d+[A-Za-z]/.test(s)) return false;
  const n = typeof room === 'number' ? room : Number(s);
  if (Number.isNaN(n) || !Number.isInteger(n)) return false;
  if (n >= 4 && n <= 13) return true;
  if (n >= 30 && n <= 37) return true;
  if (n === 39 || n === 49 || n === 50) return true;
  return false;
}

/**
 * Selectable rooms for new Room Check-In (employee + admin) and room occupancy filtering.
 * Subset of {@link FULL_ROOM_CATALOG}.
 */
export const ROOM_OPTIONS: (number | string)[] = FULL_ROOM_CATALOG.filter(
  (r) => !isExcludedFromNewCheckin(r)
);

export type RoomId = number | string;

const VALID_ROOM_SET = new Set(FULL_ROOM_CATALOG.map((o) => String(o)));
const NEW_CHECKIN_ROOM_SET = new Set(ROOM_OPTIONS.map((o) => String(o)));

/** Whether the value is in the full catalog (edits, past room entry, display). */
export function isValidRoomId(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  return VALID_ROOM_SET.has(String(value).trim());
}

/** Whether the value may be used for a new room check-in submission (filtered list). */
export function isValidRoomForNewCheckin(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return false;
  return NEW_CHECKIN_ROOM_SET.has(String(value).trim());
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
 * `<select>` options for room correction (employee + admin): selectable-new list in catalog order,
 * plus the current room when it is not in that list (legacy ids, full-catalog-only rooms) so the control stays controlled.
 */
export function roomOptionsForEmployeeEdit(currentRoomId: unknown): RoomId[] {
  const base = [...ROOM_OPTIONS];
  if (currentRoomId === undefined || currentRoomId === null || currentRoomId === '') return base;
  const key = String(currentRoomId).trim();
  if (key === '') return base;
  if (base.some((r) => String(r) === key)) return base;
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
  const exact = FULL_ROOM_CATALOG.find((o) => String(o) === s);
  if (exact !== undefined) return exact;
  const n = Number(s);
  if (!Number.isNaN(n) && Number.isInteger(n)) {
    if (n === 14 || n === 15) return n;
    const numMatch = FULL_ROOM_CATALOG.find((o) => o === n);
    if (numMatch !== undefined) return numMatch as number;
  }
  return null;
}

/** Parse form/option value to stored type: number for 1–13, 16–50; string for 14A, 14B, 15A, 15B. */
export function parseRoomOptionValue(value: string): RoomId {
  const n = Number(value);
  if (!Number.isNaN(n) && Number.isInteger(n) && FULL_ROOM_CATALOG.some((o) => o === n)) return n;
  if (FULL_ROOM_CATALOG.some((o) => o === value)) return value;
  return 1;
}

/** Display label for any room id (supports historical 14/15 and new 14A/14B/15A/15B). */
export function formatRoomDisplay(roomId: RoomId, roomWord = 'Room'): string {
  return `${roomWord} ${roomId}`;
}
