import { NextResponse } from 'next/server';
import { requireSessionApi } from '@/server/auth/session';
import { getCarMakes, addCarMake } from '@/lib/server/carMakesRepo';
import { logError, logInfo } from '@/lib/server/log';
import { HttpError, toErrorResponse } from '@/lib/server/httpError';
import { requireEnvs } from '@/lib/server/requireEnv';

export const runtime = 'nodejs';

export async function GET() {
  const requestId = crypto.randomUUID();
  logInfo('api.car-makes.get.start', { requestId });

  try {
    if (process.env.NODE_ENV === 'production') {
      requireEnvs(['SESSION_SECRET']);
    }
    await requireSessionApi();
    const makes = await getCarMakes();
    return NextResponse.json({ carMakes: makes.map((m) => m.nameUpper) });
  } catch (err) {
    const error = err instanceof HttpError ? err : new HttpError(401, 'UNAUTHORIZED');
    logError('api.car-makes.get.error', { requestId, message: String(err) });
    const { status, body } = toErrorResponse(error, requestId);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  logInfo('api.car-makes.post.start', { requestId });

  try {
    if (process.env.NODE_ENV === 'production') {
      requireEnvs(['SESSION_SECRET']);
    }
    const session = await requireSessionApi();
    if (session.role !== 'admin' && session.role !== 'employee') {
      throw new HttpError(403, 'FORBIDDEN', { message: 'Only signed-in staff can add car makes' });
    }
    const body = await request.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    const nameUpper = await addCarMake(name);
    return NextResponse.json({ nameUpper });
  } catch (err) {
    if (err instanceof HttpError) {
      logError('api.car-makes.post.error', { requestId, message: String(err) });
      const { status, body } = toErrorResponse(err, requestId);
      return NextResponse.json(body, { status });
    }
    logError('api.car-makes.post.error', { requestId, message: String(err) });
    return NextResponse.json({ error: 'Failed to add car make' }, { status: 500 });
  }
}
