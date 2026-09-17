import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { BOOST_SUBSCRIPTION_TYPES, BOOST_FLAG_FIELD, DEFAULT_BOOST_SUBSCRIPTION_RATES, MARKET_TIER_EXTRA_RATE, type BoostSubscriptionType, type MarketBoostTier } from '@/lib/boost-subscriptions';

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret');
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = adminDb;

    const ratesSnap = await db.collection('settings').doc('boostSubscriptionRates').get();
    const rawRates = ratesSnap.exists ? ratesSnap.data() ?? {} : {};
    const rates = { ...DEFAULT_BOOST_SUBSCRIPTION_RATES, ...rawRates };
    const marketTierExtraRate = { ...MARKET_TIER_EXTRA_RATE, ...(rawRates.marketTierExtraRate ?? {}) };

    const results = Object.fromEntries(
      BOOST_SUBSCRIPTION_TYPES.map(t => [t, { charged: 0, paused: 0 }])
    ) as Record<BoostSubscriptionType, { charged: number; paused: number }>;

    // Gather every user subscribed to at least one boost type, deduplicated, since a user
    // subscribed to multiple boosts must be billed once per user (not once per type) against
    // a single running balance — the old per-type loop could over-charge past their real balance.
    const userIds = new Set<string>();
    for (const type of BOOST_SUBSCRIPTION_TYPES) {
      const snap = await db.collection('users')
        .where(`boostSubscriptions.${type}.subscribed`, '==', true)
        .get();
      snap.docs.forEach(d => userIds.add(d.id));
    }

    const batch = db.batch();

    for (const userId of userIds) {
      const userRef = db.collection('users').doc(userId);
      const userSnap = await userRef.get();
      if (!userSnap.exists) continue;
      const data = userSnap.data() ?? {};
      let balance = data.cybaCoinBalance ?? 0;

      // This user's subscribed types, sorted by priority ascending (1 = highest, billed first).
      const subscribedTypes = BOOST_SUBSCRIPTION_TYPES
        .filter(type => data.boostSubscriptions?.[type]?.subscribed === true)
        .sort((a, b) => (data.boostSubscriptions?.[a]?.priority ?? 3) - (data.boostSubscriptions?.[b]?.priority ?? 3));

      let totalDeduction = 0;
      for (const type of subscribedTypes) {
        // Market Boost's Mid/Top tiers add a surcharge on top of the base weekly rate.
        const marketSurcharge = type === 'market'
          ? marketTierExtraRate[(data.marketBoostTier as MarketBoostTier) ?? 'base']
          : 0;
        const price = (rates[type] ?? DEFAULT_BOOST_SUBSCRIPTION_RATES[type]) + marketSurcharge;
        const flagField = BOOST_FLAG_FIELD[type];

        if (balance >= price) {
          balance -= price;
          totalDeduction += price;
          batch.update(userRef, { [flagField]: true });
          const txRef = userRef.collection('coinTransactions').doc();
          batch.set(txRef, {
            type: 'boost_subscription',
            amount: -price,
            description: `Weekly ${type} boost subscription`,
            timestamp: FieldValue.serverTimestamp(),
          });
          results[type].charged++;
        } else {
          // Pauses (flag off, stays subscribed) rather than unsubscribing — auto-resumes next
          // run once balance allows, in the same priority order.
          batch.update(userRef, { [flagField]: false });
          results[type].paused++;
        }
      }

      if (totalDeduction > 0) {
        batch.update(userRef, { cybaCoinBalance: FieldValue.increment(-totalDeduction) });
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
