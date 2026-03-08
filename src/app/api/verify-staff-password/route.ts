import { NextRequest, NextResponse } from 'next/server';

const STAFF_REQUIRING_PASSWORD = 'Derek Thach';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const staffName = typeof body.staffName === 'string' ? body.staffName.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (staffName !== STAFF_REQUIRING_PASSWORD) {
      return NextResponse.json({ ok: false, error: 'Invalid staff' }, { status: 400 });
    }

    const expected = process.env.STAFF_DEREK_PASSWORD ?? '1225';
    if (password === expected) {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false, error: 'Invalid password' }, { status: 401 });
  } catch {
    return NextResponse.json({ ok: false, error: 'Request failed' }, { status: 500 });
  }
}
