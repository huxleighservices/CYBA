import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../firebase-admin';
import { createNotificationAdmin } from '@/lib/notifications-admin';

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret');
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = Date.now();
    const snapshot = await adminDb.collection('ads').where('status', '==', 'active').get();

    const dueForWarning = snapshot.docs.filter(d => {
      const data = d.data();
      if (data.expiryWarningSent) return false;
      const expiresAt = data.expiresAt;
      if (!expiresAt) return false;
      const ms = typeof expiresAt === 'number' ? expiresAt : expiresAt.toMillis?.() ?? 0;
      const msRemaining = ms - now;
      return msRemaining > 0 && msRemaining <= THREE_DAYS_MS;
    });

    for (const d of dueForWarning) {
      const data = d.data();
      await createNotificationAdmin(data.userId, {
        type: 'promo_expiring_soon',
        actorId: 'system',
        actorUsername: 'CYBAZONE',
        message: 'Your promo slot expires in 3 days! Renew before it ends and get 25% of the new slot\'s price back as cash — and if you have a minute, we\'d love a review.',
        linkTo: '/promo-blast',
      });
      await d.ref.update({ expiryWarningSent: true });
    }

    return NextResponse.json({ warned: dueForWarning.length });
  } catch (err: any) {
    console.error('promo-expiry-warning error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
