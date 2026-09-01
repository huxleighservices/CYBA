import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Prize amounts by rank (USD)
const PRIZES: Record<number, number> = {
  1: 20,
  2: 10,
  3: 5,
  4: 3,
  5: 2,
};

function score(user: { postCount?: number; supportGiven?: number }) {
  return (user.postCount ?? 0) + (user.supportGiven ?? 0);
}

export async function POST(request: NextRequest) {
  // Verify cron secret to prevent unauthorized calls
  const secret = request.headers.get('x-cron-secret');
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = adminDb;

    // Fetch users — order by postCount desc as a proxy, then re-rank in memory
    const usersSnap = await db.collection('users')
      .where('leaderboardOptOut', '!=', true)
      .orderBy('leaderboardOptOut')
      .orderBy('postCount', 'desc')
      .limit(200)
      .get();

    type UserRow = {
      id: string;
      username?: string;
      postCount?: number;
      supportGiven?: number;
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

    // Save a payout history record
    const historyRef = db.collection('weekly_payout_history').doc();
    batch.set(historyRef, {
      payouts,
      executedAt: FieldValue.serverTimestamp(),
      weekOf: Date.now(),
    });

    // Snapshot the top 10 winners for the weekly display
    const top10 = users.slice(0, 10).map((u, i) => ({
      rank: i + 1,
      name: u.username ?? 'Unknown',
      posts: u.postCount ?? 0,
      support: u.supportGiven ?? 0,
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
