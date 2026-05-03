/**
 * Upserts Firestore `users/shakira` — employee Shakira (username: shakira).
 * Password is bcrypt-hashed; plaintext must be supplied at runtime only (never commit secrets).
 *
 * Run (example):
 *   SHAKIRA_TEMP_PASSWORD='123123123' node --env-file=.env.local scripts/add-shakira-employee.mjs
 *
 * Overwrite existing doc (e.g. reset temp password):
 *   FORCE_RESEED_SHAKIRA=1 SHAKIRA_TEMP_PASSWORD='123123123' node --env-file=.env.local scripts/add-shakira-employee.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import admin from 'firebase-admin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DOC_ID = 'shakira';
const USERNAME = 'shakira';
const FULL_NAME = 'Shakira';

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

async function main() {
  const plain = process.env.SHAKIRA_TEMP_PASSWORD?.trim();
  if (!plain || plain.length < 8) {
    console.error(
      'Set SHAKIRA_TEMP_PASSWORD in the environment to the temporary password (min 8 characters). Do not commit this value.'
    );
    process.exit(1);
  }

  const ref = db.collection('users').doc(DOC_ID);
  const snap = await ref.get();
  if (snap.exists && process.env.FORCE_RESEED_SHAKIRA !== '1') {
    console.log(
      `User "${DOC_ID}" already exists. Nothing written. Use FORCE_RESEED_SHAKIRA=1 to overwrite password and profile flags.`
    );
    return;
  }

  const passwordHash = bcrypt.hashSync(plain, 10);
  const now = admin.firestore.Timestamp.now();

  await ref.set({
    id: DOC_ID,
    fullName: FULL_NAME,
    nickname: null,
    username: USERNAME,
    passwordHash,
    role: 'employee',
    status: 'active',
    mustChangePassword: true,
    passwordResetRequested: false,
    passwordResetRequestedAt: null,
    createdAt: snap.exists ? snap.get('createdAt') ?? now : now,
    updatedAt: now,
    lastLoginAt: snap.exists ? snap.get('lastLoginAt') ?? null : null,
  });

  console.log(
    `Upserted users/${DOC_ID}. Username: ${USERNAME}. Display: ${FULL_NAME}. mustChangePassword=true. Password from SHAKIRA_TEMP_PASSWORD (not echoed).`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
