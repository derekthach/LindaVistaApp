/**
 * Seeds the Firestore `users` collection with six employee accounts.
 *
 * Prerequisites: same env as the app (GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_JSON, etc.)
 * and GOOGLE_CLOUD_PROJECT / FIREBASE_PROJECT_ID.
 *
 * Default login password (all accounts): value of SEED_EMPLOYEE_PASSWORD or "LvHms2026!"
 * All seeded users have mustChangePassword=true (first-login change required).
 *
 * Run: node scripts/seed-employee-users.mjs
 * Or:  node --env-file=.env.local scripts/seed-employee-users.mjs
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
const USERS = 'users';

const defaultPassword = process.env.SEED_EMPLOYEE_PASSWORD || 'LvHms2026!';
const passwordHash = bcrypt.hashSync(defaultPassword, 10);

const employees = [
  { id: 'benjamin', fullName: 'Benjamin', nickname: 'Siky', username: 'benjamin' },
  { id: 'luis', fullName: 'Luis', nickname: null, username: 'luis' },
  { id: 'tonito', fullName: 'Tonito', nickname: null, username: 'tonito' },
  { id: 'tono', fullName: 'Tono', nickname: null, username: 'tono' },
  { id: 'jose', fullName: 'Jose', nickname: 'Ivan', username: 'jose' },
  { id: 'makito', fullName: 'Makito', nickname: null, username: 'makito' },
];

async function main() {
  const now = admin.firestore.Timestamp.now();
  const batch = db.batch();

  for (const e of employees) {
    const ref = db.collection(USERS).doc(e.id);
    batch.set(ref, {
      id: e.id,
      fullName: e.fullName,
      nickname: e.nickname,
      username: e.username,
      passwordHash,
      role: 'employee',
      status: 'active',
      mustChangePassword: true,
      passwordResetRequested: false,
      passwordResetRequestedAt: null,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    });
  }

  await batch.commit();
  console.log(`Seeded ${employees.length} users into ${USERS}. Default password: ${defaultPassword}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
