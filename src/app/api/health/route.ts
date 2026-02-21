import { NextResponse } from 'next/server';
import { logInfo } from '@/lib/server/log';
import { getAdminDb } from '@/lib/server/firebaseAdmin';

export const runtime = 'nodejs';

export async function GET() {
  const requestId = crypto.randomUUID();
  let firestore: 'connected' | 'disconnected' = 'disconnected';
  try {
    getAdminDb();
    firestore = 'connected';
  } catch {
    firestore = 'disconnected';
  }
  const envChecks = {
    SESSION_SECRET: Boolean(process.env.SESSION_SECRET),
    LV_ADMIN_SECRET: Boolean(process.env.LV_ADMIN_SECRET),
    SQLITE_PATH: Boolean(process.env.SQLITE_PATH),
    VERCEL: Boolean(process.env.VERCEL),
  };

  logInfo('api.health', { requestId, envChecks, firestore });

  return NextResponse.json({
    ok: true,
    firestore,
    timestamp: new Date().toISOString(),
    envChecks,
    requestId,
  });
}
