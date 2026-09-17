import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { createNotificationAdmin } from '@/lib/notifications-admin';

const BIRTHDAY_GIFT_CC = 5000;

/** Today's month/day in ET as "MM-DD", matching how `birthday` is stored ("YYYY-MM-DD"). */
function todayMonthDayEt(): string {
  const etDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
  return etDateStr.slice(5); // "YYYY-MM-DD" -> "MM-DD"
}

/**
 * Daily cron: grants a 5,000 CYBACOIN birthday gift + a congratulatory notification to any
 * member whose stored `birthday` (YYYY-MM-DD, collected at signup or added later in profile
 * settings) matches today's month/day. `lastBirthdayGiftYear` guards against double-gifting if
 * the cron runs more than once in a day, or a user has no `birthday` set (skipped entirely).
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret');
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = adminDb;
    const monthDay = todayMonthDayEt();
    const currentYear = new Date().getFullYear();

    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    let gifted = 0;

    while (true) {
      let q = db.collection('users').limit(200);
      if (lastDoc) q = q.startAfter(lastDoc) as typeof q;
      const snap = await q.get();
      if (snap.empty) break;

      await Promise.all(snap.docs.map(async (userDoc) => {
        const data = userDoc.data();
        const birthday: string | undefined = data.birthday;
        if (!birthday || birthday.length < 10 || birthday.slice(5) !== monthDay) return;
        if (data.lastBirthdayGiftYear === currentYear) return;

        await userDoc.ref.update({
          cybaCoinBalance: FieldValue.increment(BIRTHDAY_GIFT_CC),
          lastBirthdayGiftYear: currentYear,
        });
        await userDoc.ref.collection('coinTransactions').add({
          type: 'birthday_gift',
          amount: BIRTHDAY_GIFT_CC,
          description: `🎂 Happy Birthday! +${BIRTHDAY_GIFT_CC.toLocaleString()} CYBACOIN`,
          timestamp: FieldValue.serverTimestamp(),
        });
        await createNotificationAdmin(userDoc.id, {
          type: 'birthday_gift',
          actorId: 'system',
          actorUsername: 'CYBAZONE',
          message: `🎂 Happy Birthday from CYBAZONE! We just added ${BIRTHDAY_GIFT_CC.toLocaleString()} CYBACOIN to your wallet — go treat yourself.`,
          linkTo: '/wallet',
        });
        gifted++;
      }));

      lastDoc = snap.docs[snap.docs.length - 1];
      if (snap.docs.length < 200) break;
    }

    return NextResponse.json({ message: 'Birthday gifts sent.', gifted });
  } catch (error) {
    console.error('[birthday-gift] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
