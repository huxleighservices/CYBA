import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Prize amounts by rank (USD) — cash payout, gated on payoutEnrolled, untouched by the CC+voucher addition below.
const PRIZES: Record<number, number> = {
  1: 20,
  2: 10,
  3: 5,
  4: 3,
  5: 2,
};

// Top-3-only, added ON TOP of the cash payout above, NOT gated on payoutEnrolled.
const TOP3_CC_BONUS: Record<number, number> = { 1: 50000, 2: 25000, 3: 10000 };
const TOP3_VOUCHER_TIER: Record<number, 'day30' | 'day14' | 'day7'> = { 1: 'day30', 2: 'day14', 3: 'day7' };

// Ranks by THIS WEEK's activity (weeklyPostCount/weeklySupportGiven), matching exactly what the
// Leaderboard page's Weekly tab shows — NOT all-time postCount/supportGiven. Using all-time
// stats here would let someone with a huge all-time history win "Top CYBA of the Week" despite
// having done nothing this week, which contradicted the weekly leaderboard the payout is
// supposed to be rewarding.
function score(user: { weeklyPostCount?: number; weeklySupportGiven?: number }) {
  return (user.weeklyPostCount ?? 0) + (user.weeklySupportGiven ?? 0);
}

export async function POST(request: NextRequest) {
  // Verify cron secret to prevent unauthorized calls
  const secret = request.headers.get('x-cron-secret');
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = adminDb;

    // Fetch users — order by weeklyPostCount desc as a proxy, then re-rank in memory. Ordering
    // by the WEEKLY field (not all-time postCount) matters here so the candidate pool actually
    // contains this week's top performers, not just all-time prolific posters.
    const usersSnap = await db.collection('users')
      .where('leaderboardOptOut', '!=', true)
      .orderBy('leaderboardOptOut')
      .orderBy('weeklyPostCount', 'desc')
      .limit(200)
      .get();

    type UserRow = {
      id: string;
      username?: string;
      weeklyPostCount?: number;
      weeklySupportGiven?: number;
      payoutEnrolled?: boolean;
      payoutBalance?: number;
    };

    const users: UserRow[] = usersSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as UserRow))
      .filter(u => u.username); // must have a username (registered)

    // Sort by combined score descending
    users.sort((a, b) => score(b) - score(a));

    const top5 = users.slice(0, 5);

    const batch = db.batch();
    const payouts: { rank: number; userId: string; username: string; amount: number; paid: boolean }[] = [];

    for (let i = 0; i < top5.length; i++) {
      const user = top5[i];
      const rank = i + 1;
      const prize = PRIZES[rank];

      if (!prize) continue;

      const paid = !!user.payoutEnrolled;
      payouts.push({ rank, userId: user.id, username: user.username ?? user.id, amount: prize, paid });

      if (!paid) continue;

      const userRef = db.collection('users').doc(user.id);

      // Credit payoutBalance
      batch.update(userRef, {
        payoutBalance: FieldValue.increment(prize),
      });

      // Log cash transaction
      const txRef = db
        .collection('users')
        .doc(user.id)
        .collection('cashTransactions')
        .doc();

      batch.set(txRef, {
        type: 'quest_payout',
        amount: prize,
        description: `Weekly Leaderboard Payout — Rank #${rank} ($${prize.toFixed(2)})`,
        timestamp: FieldValue.serverTimestamp(),
      });
    }

    // Top 3 CC + free-promo-voucher bonus — added on top of the cash payout above, independent
    // of payoutEnrolled (every top-3 finisher gets this, not just cash-enrolled members).
    for (let i = 0; i < Math.min(3, top5.length); i++) {
      const user = top5[i];
      const rank = i + 1;
      const ccBonus = TOP3_CC_BONUS[rank];
      const voucherTier = TOP3_VOUCHER_TIER[rank];
      const userRef = db.collection('users').doc(user.id);

      batch.update(userRef, {
        cybaCoinBalance: FieldValue.increment(ccBonus),
        [`freePromoVouchers.${voucherTier}`]: FieldValue.increment(1),
      });
      const ccTxRef = db.collection('users').doc(user.id).collection('coinTransactions').doc();
      batch.set(ccTxRef, {
        type: 'quest_reward',
        amount: ccBonus,
        description: `Top CYBA of the Week — Rank #${rank} (+${ccBonus.toLocaleString()} CC, +1 ${voucherTier} free promo)`,
        timestamp: FieldValue.serverTimestamp(),
      });
    }

    // Save a payout history record
    const historyRef = db.collection('weekly_payout_history').doc();
    batch.set(historyRef, {
      payouts,
      executedAt: FieldValue.serverTimestamp(),
      weekOf: Date.now(),
    });

    // Snapshot the top 10 winners for the weekly display — weeklyPostCount/weeklySupportGiven,
    // matching exactly what the Leaderboard page's Weekly tab reads.
    const top10 = users.slice(0, 10).map((u, i) => ({
      rank: i + 1,
      name: u.username ?? 'Unknown',
      posts: u.weeklyPostCount ?? 0,
      support: u.weeklySupportGiven ?? 0,
    }));

    const winnersRef = db.collection('settings').doc('weeklyWinners');
    batch.set(winnersRef, {
      winners: top10,
      weekOf: Date.now(),
      setAt: Date.now(),
    });

    await batch.commit();

    const paidCount = payouts.filter(p => p.paid).length;
    return NextResponse.json({
      message: 'Weekly payout complete.',
      payouts,
      paidCount,
    });
  } catch (error) {
    console.error('[weekly-payout] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
