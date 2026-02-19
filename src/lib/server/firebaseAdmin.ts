import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';
import { getApps } from 'firebase-admin/app';
import type { Firestore } from 'firebase-admin/firestore';

function init(): void {
  if (getApps().length) return;

  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT;

  if (!projectId) {
    throw new Error(
      'Missing projectId. For local dev: add GOOGLE_CLOUD_PROJECT or FIREBASE_PROJECT_ID to .env.local.'
    );
  }

  // 1) Service account key file — local dev only (never in production; use env vars or Workload Identity there)
  const isProduction = process.env.NODE_ENV === 'production';
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath && !isProduction) {
    const resolved = path.isAbsolute(credPath) ? credPath : path.resolve(process.cwd(), credPath);
    if (fs.existsSync(resolved)) {
      const raw = fs.readFileSync(resolved, 'utf8');
      const serviceAccount = JSON.parse(raw) as { private_key?: string; project_id?: string; [key: string]: unknown };
      if (serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
        projectId: (serviceAccount.project_id as string) ?? projectId,
      });
      return;
    }
  }

  // 2) Inline JSON (e.g. from env)
  const svcJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (svcJson) {
    const serviceAccount = JSON.parse(svcJson) as { project_id?: string; [key: string]: unknown };
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
      projectId: serviceAccount.project_id ?? projectId,
    });
    return;
  }

  // Split credential fallback (local dev)
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (clientEmail && privateKey && projectId) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId,
    });
    return;
  }

  // 4) ADC (no key). On Vercel use Workload Identity; locally use a key file to avoid invalid_rapt.
  admin.initializeApp({ projectId });
}

export function getAdminDb(): Firestore {
  init();
  return admin.firestore();
}

export { admin };
