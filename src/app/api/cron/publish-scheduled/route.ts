import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../firebase-admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { DEFAULT_CC_RATES, mergeWithDefaults } from '@/lib/cc-rewards';
import type { Level } from '@/lib/levels';

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret');
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const ccRatesSnap = await adminDb.collection('settings').doc('ccRates').get();
    const ccRates = ccRatesSnap.exists
      ? mergeWithDefaults(ccRatesSnap.data() as any)
      : DEFAULT_CC_RATES;

    const now = Timestamp.now();
    const snap = await adminDb
      .collection('cybazone_posts')
      .where('published', '==', false)
      .where('scheduledAt', '<=', now)
      .limit(100)
      .get();

    if (snap.empty) {
      return NextResponse.json({ message: 'No scheduled posts to publish.', published: 0 });
    }

    const batch = adminDb.batch();
    snap.docs.forEach(d => {
      const data = d.data();
      const mediaType: 'text' | 'image' | 'video' = data.mediaType ?? 'text';
      const level: Level = data.authorLevel ?? 'spark';
      const cc = ccRates.post[mediaType][level];

      // Mark published; keep timestamp as the scheduledAt time so the post
      // appears at the correct position in the feed (not at cron-run time)
      batch.update(d.ref, {
        published: true,
        timestamp: data.scheduledAt ?? FieldValue.serverTimestamp(),
      });

      // Award postCount and CybaCoins that were deferred at creation time
      batch.update(adminDb.collection('users').doc(data.authorId), {
        postCount: FieldValue.increment(1),
        cybaCoinBalance: FieldValue.increment(cc),
      });
    });
    await batch.commit();

    return NextResponse.json({ message: 'Scheduled posts published.', published: snap.size });
  } catch (error) {
    console.error('[publish-scheduled] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
