import admin from 'firebase-admin';
import { getApps } from 'firebase-admin/app';
import type { Firestore } from 'firebase-admin/firestore';

function init(): void {
  if (getApps().length) return;

  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT;

  // Optional: full service account JSON (single line in env). If invalid, we fall through.
  const svcJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (svcJson) {
    try {
      const serviceAccount = JSON.parse(svcJson) as { project_id?: string; [key: string]: unknown };
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
        projectId: serviceAccount.project_id ?? projectId,
      });
      return;
    } catch {
      // Invalid JSON or cert: fall through to split credentials or ADC
    }
  }

  // Split credentials (no JSON in env)
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (clientEmail && privateKey && projectId) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        projectId,
      });
      return;
    } catch {
      // Invalid key shape: fall through
    }
  }

  // WIF/ADC path (preferred on Vercel — no keys). Locally this uses gcloud ADC;
  // if you see invalid_rapt / reauth errors, use a service-account key in .env.local instead.
  if (!projectId) {
    throw new Error(
      'Missing projectId. For local dev: add GOOGLE_CLOUD_PROJECT or FIREBASE_PROJECT_ID to .env.local. On Vercel: set in Project Settings → Environment Variables.'
    );
  }
  admin.initializeApp({ projectId });
}

export function getAdminDb(): Firestore {
  init();
  return admin.firestore();
}

export { admin };
