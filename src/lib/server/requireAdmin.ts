import { cookies, headers } from 'next/headers';
import type { NextRequest } from 'next/server';
import { HttpError } from './httpError';

const HEADER_SECRET = 'x-lv-admin-secret';
const COOKIE_NAME = 'lv_admin';

export async function requireAdmin(request?: NextRequest): Promise<void> {
  const expected = process.env.LV_ADMIN_SECRET;
  if (!expected) {
    return;
  }

  let secret: string | undefined;

  if (request) {
    secret = request.headers.get(HEADER_SECRET) ?? request.cookies.get(COOKIE_NAME)?.value;
  } else {
    const [h, c] = await Promise.all([headers(), cookies()]);
    secret = h.get(HEADER_SECRET) ?? c.get(COOKIE_NAME)?.value;
  }

  if (!secret || secret !== expected) {
    throw new HttpError(401, 'UNAUTHORIZED');
  }
}
