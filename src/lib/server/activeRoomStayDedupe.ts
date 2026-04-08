import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Normalize room id for occupancy grouping (e.g. "40", "14A", "14b" → same logical key).
 * Trims whitespace and uppercases so "14a" / "14A" collapse to one bucket.
 */
export function normalizeOccupiedRoomKey(roomId: unknown): string {
  if (roomId == null || roomId === '') return '';
  return String(roomId).trim().toUpperCase().replace(/\s+/g, '');
}

function docRecencyMs(data: Record<string, unknown>): number {
  const created = data.createdAt as Timestamp | undefined;
  const checkIn = data.checkInAt as Timestamp | undefined;
  return Math.max(created?.toMillis?.() ?? 0, checkIn?.toMillis?.() ?? 0);
}

/** Tie-break when timestamps match: stable deterministic choice. */
function pickNewerStayDoc(
  a: QueryDocumentSnapshot,
  b: QueryDocumentSnapshot
): QueryDocumentSnapshot {
  const ta = docRecencyMs(a.data());
  const tb = docRecencyMs(b.data());
  if (tb !== ta) return tb > ta ? b : a;
  return a.id.localeCompare(b.id) >= 0 ? a : b;
}

/**
 * When multiple active room stays exist for the same room (bad data or legacy double-submits),
 * keep exactly one Firestore document per normalized room key for checkout UI and occupancy.
 * Rule: prefer the most recent stay by max(createdAt, checkInAt); tie-break by document id.
 */
export function dedupeActiveRoomStaySnapshots(
  docs: QueryDocumentSnapshot[]
): QueryDocumentSnapshot[] {
  const byKey = new Map<string, QueryDocumentSnapshot>();
  for (const d of docs) {
    const key = normalizeOccupiedRoomKey(d.data().roomId);
    const mapKey = key || `__missing_room_${d.id}`;
    const prev = byKey.get(mapKey);
    if (!prev) {
      byKey.set(mapKey, d);
    } else {
      byKey.set(mapKey, pickNewerStayDoc(prev, d));
    }
  }
  return [...byKey.values()];
}

/** For manual / admin cleanup: list room keys that still have multiple active stay documents. */
export function findDuplicateActiveRoomGroups(
  docs: QueryDocumentSnapshot[]
): { roomKey: string; docIds: string[] }[] {
  const byKey = new Map<string, QueryDocumentSnapshot[]>();
  for (const d of docs) {
    const key = normalizeOccupiedRoomKey(d.data().roomId);
    const mapKey = key || `__missing_room_${d.id}`;
    const list = byKey.get(mapKey) ?? [];
    list.push(d);
    byKey.set(mapKey, list);
  }
  return [...byKey.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([roomKey, group]) => ({
      roomKey,
      docIds: group.map((x) => x.id).sort(),
    }))
    .sort((a, b) => a.roomKey.localeCompare(b.roomKey));
}
