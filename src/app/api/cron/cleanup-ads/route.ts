import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../firebase-admin';

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret');
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = Date.now();

    // Expire active ads past their expiresAt. There's no slot cap or queue anymore — every
    // paid ad activates immediately and simply runs until its own expiresAt.
    const activeSnap = await adminDb.collection('ads').where('status', '==', 'active').get();
    const expired: FirebaseFirestore.QueryDocumentSnapshot[] = [];

    activeSnap.docs.forEach(d => {
      const expiresAt = d.data().expiresAt;
      const ms = expiresAt?.toMillis?.() ?? 0;
      if (ms && ms <= now) {
        expired.push(d);
      }
    });

    if (expired.length > 0) {
      const batch = adminDb.batch();
      expired.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    return NextResponse.json({ expired: expired.length });
  } catch (err: any) {
    console.error('cleanup-ads error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
