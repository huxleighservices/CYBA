import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const LAUNCH_GRANT_CC = 10000;

/**
 * One-time, admin-triggered launch reset — NOT on any schedule. Zeroes every user's
 * CYBACOIN balance, level-driving stats (postCount/supportGiven), and quest-completion
 * tracking, then grants a flat 10,000 CC to everyone. Meant to be run exactly once, at
 * actual public launch, to wipe out beta-period test data.
 *
 * Requires BOTH the standard cron secret AND an explicit confirm flag in the body, since a
 * misfire here resets every user's progress with no undo.
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret');
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  if (body?.confirm !== 'RESET_FOR_LAUNCH') {
    return NextResponse.json({ error: 'Missing or incorrect confirmation flag' }, { status: 400 });
  }

  try {
    const usersSnap = await adminDb.collection('users').get();
    const BATCH_SIZE = 500;
    const docs = usersSnap.docs;
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = adminDb.batch();
      docs.slice(i, i + BATCH_SIZE).forEach(d => {
        batch.update(d.ref, {
          cybaCoinBalance: LAUNCH_GRANT_CC,
          postCount: 0,
          supportGiven: 0,
          completedQuests: [],
          unlockedQuests: [],
        });
        batch.set(d.ref.collection('coinTransactions').doc(), {
          type: 'admin_adjustment',
          amount: LAUNCH_GRANT_CC,
          description: 'Launch reset — CYBACOIN, level, and quest progress cleared; 10,000 CC granted',
          timestamp: FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
    }

    return NextResponse.json({ usersReset: docs.length });
  } catch (err: any) {
    console.error('launch-reset error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
