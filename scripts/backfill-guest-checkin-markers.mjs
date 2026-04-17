/**
 * One-time: set `employeeId` + `createdByUsername` on specific check-in docs so the UI can
 * show "(Guest)" for rows created via the shared guest login before those fields were persisted.
 *
 * Usage (receipt numbers as shown in the app, e.g. 00011):
 *   node --env-file=.env.local scripts/backfill-guest-checkin-markers.mjs 00011 00010
 *
 * Only updates docs where `createdByRole` is already `employee` (does not touch admin rows).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvLocal();

const projectId =
  process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;

if (!projectId) {
  console.error('Set GOOGLE_CLOUD_PROJECT or FIREBASE_PROJECT_ID');
  process.exit(1);
}

function initFirebase() {
  if (admin.apps.length) return;
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath) {
    const resolved = path.isAbsolute(credPath) ? credPath : path.resolve(process.cwd(), credPath);
    if (fs.existsSync(resolved)) {
      const raw = fs.readFileSync(resolved, 'utf8');
      const serviceAccount = JSON.parse(raw);
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id ?? projectId,
      });
      return;
    }
  }
  const svcJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (svcJson) {
    const serviceAccount = JSON.parse(svcJson);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id ?? projectId,
    });
    return;
  }
  admin.initializeApp({ projectId });
}

initFirebase();

const receipts = process.argv.slice(2).map((r) => r.trim().padStart(5, '0')).filter(Boolean);
if (receipts.length === 0) {
  console.error('Pass one or more receipt numbers, e.g.: node scripts/backfill-guest-checkin-markers.mjs 00011');
  process.exit(1);
}

async function main() {
  const db = admin.firestore();
  for (const receiptNumber of receipts) {
    const snap = await db.collection('checkins').where('receiptNumber', '==', receiptNumber).get();
    if (snap.empty) {
      console.warn(`No check-in found for receipt ${receiptNumber}`);
      continue;
    }
    for (const doc of snap.docs) {
      const data = doc.data();
      if (data.createdByRole !== 'employee') {
        console.warn(`Skip ${doc.id} (receipt ${receiptNumber}): createdByRole is not employee`);
        continue;
      }
      await doc.ref.update({
        employeeId: 'guest',
        createdByUsername: 'guest',
        updatedAt: admin.firestore.Timestamp.now(),
      });
      console.log(`Updated ${doc.id} (receipt ${receiptNumber}) with employeeId + createdByUsername = guest`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
