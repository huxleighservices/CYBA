import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { BOOST_SUBSCRIPTION_TYPES, BOOST_FLAG_FIELD, DEFAULT_BOOST_SUBSCRIPTION_RATES, type BoostSubscriptionType } from '@/lib/boost-subscriptions';

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret');
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = adminDb;

    const ratesSnap = await db.collection('settings').doc('boostSubscriptionRates').get();
    const rates = { ...DEFAULT_BOOST_SUBSCRIPTION_RATES, ...(ratesSnap.exists ? ratesSnap.data() : {}) };

    const results = Object.fromEntries(
      BOOST_SUBSCRIPTION_TYPES.map(t => [t, { charged: 0, paused: 0 }])
    ) as Record<BoostSubscriptionType, { charged: number; paused: number }>;

    const batch = db.batch();

    for (const type of BOOST_SUBSCRIPTION_TYPES) {
      const price = rates[type] ?? DEFAULT_BOOST_SUBSCRIPTION_RATES[type];
      const flagField = BOOST_FLAG_FIELD[type];

      const snap = await db.collection('users')
        .where(`boostSubscriptions.${type}.subscribed`, '==', true)
        .get();

      for (const userDoc of snap.docs) {
        const data = userDoc.data();
        const balance = data.cybaCoinBalance ?? 0;

        if (balance >= price) {
          batch.update(userDoc.ref, {
            cybaCoinBalance: FieldValue.increment(-price),
            [flagField]: true,
          });
          const txRef = userDoc.ref.collection('coinTransactions').doc();
          batch.set(txRef, {
            type: 'boost_subscription',
            amount: -price,
            description: `Weekly ${type} boost subscription`,
            timestamp: FieldValue.serverTimestamp(),
          });
          results[type].charged++;
        } else {
          batch.update(userDoc.ref, { [flagField]: false });
          results[type].paused++;
        }
      }
    }

    await batch.commit();

    return NextResponse.json({ message: 'Weekly boost billing complete.', results });
  } catch (error) {
    console.error('[weekly-boost-billing] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
