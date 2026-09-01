import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../firebase-admin';

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret');
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = Date.now();
    const snapshot = await adminDb.collection('pulses').get();

    const expired = snapshot.docs.filter(d => {
      const expiresAt = d.data().expiresAt;
      if (!expiresAt) return false;
      const ms = typeof expiresAt === 'number' ? expiresAt : expiresAt.toMillis?.() ?? 0;
      return ms <= now;
    });

    if (expired.length === 0) {
      return NextResponse.json({ deleted: 0 });
    }

    const BATCH_SIZE = 500;
    for (let i = 0; i < expired.length; i += BATCH_SIZE) {
      const batch = adminDb.batch();
      expired.slice(i, i + BATCH_SIZE).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    return NextResponse.json({ deleted: expired.length });
  } catch (err: any) {
    console.error('cleanup-pulses error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
