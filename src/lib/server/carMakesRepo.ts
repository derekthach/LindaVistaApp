import { Timestamp } from 'firebase-admin/firestore';
import { normalizeCarMakeName } from '@/lib/checkins/carMakeNormalize';
import { getAdminDb } from './firebaseAdmin';
import { isFirestoreUnavailableError, isProduction } from './firestoreError';

const CAR_MAKES_COLLECTION = 'carMakes';

export interface CarMakeDoc {
  id: string;
  nameUpper: string;
  createdAt: Date;
}

/** Fetch all car makes, sorted alphabetically by nameUpper. If Firestore/Google auth is unavailable, returns [] so the app can run. */
export async function getCarMakes(): Promise<CarMakeDoc[]> {
  try {
    const db = getAdminDb();
    const snapshot = await db
      .collection(CAR_MAKES_COLLECTION)
      .orderBy('nameUpper')
      .get();

    return snapshot.docs.map((doc) => {
      const d = doc.data();
      const createdAt = d.createdAt?.toDate?.() ?? new Date();
      return {
        id: doc.id,
        nameUpper: (d.nameUpper as string) ?? '',
        createdAt,
      };
    });
  } catch (err) {
    if (isFirestoreUnavailableError(err)) {
      if (isProduction()) throw err;
      console.warn('Firestore unavailable (getCarMakes), returning empty list:', (err as Error).message);
      return [];
    }
    throw err;
  }
}

/**
 * Add a car make. Normalizes to uppercase; if one already exists (case-insensitive), returns it without creating duplicate.
 * Returns the nameUpper that was stored (existing or new).
 */
export async function addCarMake(name: string): Promise<string> {
  const db = getAdminDb();
  const nameUpper = normalizeCarMakeName(name);
  if (!nameUpper) {
    throw new Error('Car make name is required');
  }

  const existing = await db
    .collection(CAR_MAKES_COLLECTION)
    .where('nameUpper', '==', nameUpper)
    .limit(1)
    .get();

  if (!existing.empty) {
    return nameUpper;
  }

  await db.collection(CAR_MAKES_COLLECTION).add({
    nameUpper,
    createdAt: Timestamp.now(),
  });

  return nameUpper;
}
