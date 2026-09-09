import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

/** Same "most recent Sunday at midnight EST" boundary the Leaderboard page uses client-side —
 *  duplicated here since this route runs server-side with no access to that module. */
function lastSundayMidnightEst(): number {
  const now = new Date();
  const etDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(now);
  const etDow = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }).format(now);
  const DOW_MAP: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const daysBack = DOW_MAP[etDow] ?? 0;
  const [y, m, d] = etDateStr.split('-').map(Number);
  const lastSunday = new Date(Date.UTC(y, m - 1, d - daysBack));
  const sy = lastSunday.getUTCFullYear();
  const sm = String(lastSunday.getUTCMonth() + 1).padStart(2, '0');
  const sd = String(lastSunday.getUTCDate()).padStart(2, '0');
  return new Date(`${sy}-${sm}-${sd}T00:00:00-05:00`).getTime();
}

/**
 * One-time (admin-triggered) repair: weeklyPostCount/weeklySupportGiven were being read by the
 * Leaderboard's Weekly tab and the weekly-reset cron, but NOTHING ever incremented them on an
 * actual post/like/comment/repost — so the Weekly tab has always shown 0s. That increment gap
 * is now fixed at each action site; this route backfills the *current* week's already-happened
 * activity (since last Sunday midnight EST) from cybazone_posts and each user's engagementLog,
 * so the board doesn't sit at 0 for everyone until new activity trickles in.
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret');
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = adminDb;
    const weekStart = Timestamp.fromMillis(lastSundayMidnightEst());

    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    let totalUpdated = 0;

    while (true) {
      let q = db.collection('users').limit(200);
      if (lastDoc) q = q.startAfter(lastDoc) as typeof q;
      const snap = await q.get();
      if (snap.empty) break;

      await Promise.all(snap.docs.map(async (userDoc) => {
        const uid = userDoc.id;

        const [postsSnap, engagementSnap] = await Promise.all([
          db.collection('cybazone_posts')
            .where('authorId', '==', uid)
            .where('timestamp', '>=', weekStart)
            .get(),
          db.collection('users').doc(uid).collection('engagementLog')
            .where('direction', '==', 'outward')
            .where('timestamp', '>=', weekStart)
            .get(),
        ]);

        await userDoc.ref.update({
          weeklyPostCount: postsSnap.size,
          weeklySupportGiven: engagementSnap.size,
        });
        totalUpdated++;
      }));

      lastDoc = snap.docs[snap.docs.length - 1];
      if (snap.docs.length < 200) break;
    }

    return NextResponse.json({ message: 'Weekly score backfill complete.', usersUpdated: totalUpdated });
  } catch (error) {
    console.error('[backfill-weekly-scores] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
