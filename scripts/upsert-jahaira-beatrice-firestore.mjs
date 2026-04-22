/**
 * Creates or updates Firestore `users` docs for Jahaira and Beatrice so they appear on Admin → Empleados.
 * The admin UI lists Firestore only (`listUsersPublic`), not login-system/users.json.
 *
 * Default: copies password hash + mustChangePassword + display name from login-system/users.json
 * so login (Firestore-first) matches your repo.
 *
 * After syncing `jahaira` from JSON, removes legacy `users/jary` if present (username rename).
 *
 * Reset Beatrice to temporary password "123123123" and force change on first login:
 *   RESET_BEATRICE_TEMP_PASSWORD=1 npm run upsert:jahaira-beatrice:reset-beatrice
 *
 * Prerequisites: same Firebase Admin env as the app (see scripts/add-keith-thach-employee.mjs).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
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

  const isProduction = process.env.NODE_ENV === 'production';
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath && !isProduction) {
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

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      projectId,
    });
    return;
  }

  admin.initializeApp({ projectId });
}

initFirebase();

const db = admin.firestore();
const USERS_PATH = path.join(__dirname, '..', 'login-system', 'users.json');

const RESET_BEATRICE = process.env.RESET_BEATRICE_TEMP_PASSWORD === '1';
const BEATRICE_TEMP_PLAIN = process.env.BEATRICE_TEMP_PASSWORD || '123123123';

async function main() {
  const raw = fs.readFileSync(USERS_PATH, 'utf8');
  const list = JSON.parse(raw);
  const wanted = new Set(['jahaira', 'beatrice']);
  const rows = list.filter((u) => wanted.has(String(u.username).toLowerCase()));

  if (rows.length === 0) {
    console.error(`No jahaira or beatrice entries found in ${USERS_PATH}`);
    process.exit(1);
  }

  const now = admin.firestore.Timestamp.now();

  for (const row of rows) {
    const docId = String(row.username).trim().toLowerCase();
    const ref = db.collection('users').doc(docId);
    const snap = await ref.get();

    let passwordHash = row.password;
    let mustChangePassword = row.mustChangePassword === true;

    if (RESET_BEATRICE && docId === 'beatrice') {
      passwordHash = bcrypt.hashSync(BEATRICE_TEMP_PLAIN, 10);
      mustChangePassword = true;
      const beatriceIdx = list.findIndex((u) => String(u.username).toLowerCase() === 'beatrice');
      if (beatriceIdx !== -1) {
        list[beatriceIdx].password = passwordHash;
        list[beatriceIdx].mustChangePassword = true;
        fs.writeFileSync(USERS_PATH, `${JSON.stringify(list, null, 2)}\n`, 'utf8');
        console.log(`[beatrice] Updated login-system/users.json with matching bcrypt hash + mustChangePassword=true`);
      }
    }

    const fullName = row.name || docId;
    const createdAt = snap.exists ? snap.get('createdAt') ?? now : now;
    const lastLoginAt = snap.exists ? snap.get('lastLoginAt') ?? null : null;

    await ref.set(
      {
        id: docId,
        fullName,
        nickname: null,
        username: docId,
        passwordHash,
        role: row.role === 'admin' ? 'admin' : 'employee',
        status: 'active',
        mustChangePassword,
        passwordResetRequested: snap.exists ? snap.get('passwordResetRequested') ?? false : false,
        passwordResetRequestedAt: snap.exists ? snap.get('passwordResetRequestedAt') ?? null : null,
        createdAt,
        updatedAt: now,
        lastLoginAt,
      },
      { merge: true }
    );

    console.log(`Upserted users/${docId} (${fullName}). mustChangePassword=${mustChangePassword}`);
  }

  const legacyJary = db.collection('users').doc('jary');
  const legacySnap = await legacyJary.get();
  if (legacySnap.exists) {
    await legacyJary.delete();
    console.log('\nRemoved legacy Firestore users/jary (account renamed to jahaira in users.json).');
  }

  console.log('\nDone. Refresh Admin → Empleados to see Jahaira and Beatrice.');
  if (RESET_BEATRICE) {
    console.log(`Beatrice can log in with temp password (plain): env BEATRICE_TEMP_PASSWORD or default 123123123`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
