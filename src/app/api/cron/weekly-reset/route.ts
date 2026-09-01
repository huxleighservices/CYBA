import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  // Verify cron secret
  const secret = request.headers.get('x-cron-secret');
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = adminDb;

    // Clear the weekly winners display so the board shows fresh for the new week
    await db.collection('settings').doc('weeklyWinners').set({
      winners: [],
      weekOf: Date.now(),
      setAt: Date.now(),
    });

    // Reset weekly-specific score fields on all users in batches of 500
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    let totalReset = 0;

    while (true) {
      let q = db.collection('users').limit(500);
      if (lastDoc) q = q.startAfter(lastDoc) as typeof q;

      const snap = await q.get();
      if (snap.empty) break;

      const batch = db.batch();
      snap.docs.forEach(d => {
        batch.update(d.ref, {
          weeklyPostCount: FieldValue.delete(),
          weeklySupportGiven: FieldValue.delete(),
        });
      });
      await batch.commit();

      totalReset += snap.docs.length;
      lastDoc = snap.docs[snap.docs.length - 1];
      if (snap.docs.length < 500) break;
    }

    return NextResponse.json({
      message: 'Weekly reset complete.',
      usersReset: totalReset,
    });
  } catch (error) {
    console.error('[weekly-reset] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
