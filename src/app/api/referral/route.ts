import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    const { newUserId, referrerUsername } = await request.json();

    if (!newUserId || !referrerUsername?.trim()) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const newUserRef = adminDb.collection('users').doc(newUserId);
    const newUserDoc = await newUserRef.get();

    if (!newUserDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (newUserDoc.data()?.referralApplied) {
      return NextResponse.json({ error: 'Referral already applied' }, { status: 409 });
    }

    const snap = await adminDb
      .collection('users')
      .where('username_lowercase', '==', referrerUsername.trim().toLowerCase())
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json({ error: 'Referrer not found' }, { status: 404 });
    }

    const referrerDoc = snap.docs[0];
    if (referrerDoc.id === newUserId) {
      return NextResponse.json({ error: 'Cannot refer yourself' }, { status: 400 });
    }

    const referrerName = referrerDoc.data()?.username ?? 'unknown';
    const newUsername = newUserDoc.data()?.username ?? 'new user';
    const now = new Date();

    // 5 Zone Builder referrals → +1 to the 7-day free-promo counter. Checked against the
    // count BEFORE this referral's increment, since FieldValue.increment doesn't let us read
    // the post-increment value synchronously.
    const referrerCountBefore = referrerDoc.data()?.referralCount ?? 0;
    const crossesFiveReferrals = referrerCountBefore + 1 === 5;

    const batch = adminDb.batch();
    batch.update(newUserRef, {
      cybaCoinBalance: FieldValue.increment(1000),
      referralApplied: true,
      referredBy: referrerName,
    });
    batch.update(referrerDoc.ref, {
      cybaCoinBalance: FieldValue.increment(1000),
      payoutBalance: FieldValue.increment(1),
      referralCount: FieldValue.increment(1),
      ...(crossesFiveReferrals ? { 'freePromoVouchers.day7': FieldValue.increment(1) } : {}),
    });
    // Track this referral in referrer's subcollection
    const referralEntryRef = adminDb
      .collection('users')
      .doc(referrerDoc.id)
      .collection('referrals')
      .doc(newUserId);
    batch.set(referralEntryRef, {
      username: newUsername,
      userId: newUserId,
      joinedAt: now,
    });
    await batch.commit();

    await Promise.allSettled([
      adminDb.collection('users').doc(newUserId).collection('coinTransactions').add({
        type: 'referral_bonus',
        amount: 1000,
        description: `Referral bonus — referred by @${referrerName}`,
        timestamp: now,
      }),
      adminDb.collection('users').doc(referrerDoc.id).collection('coinTransactions').add({
        type: 'referral_bonus',
        amount: 1000,
        description: `Referral bonus — @${newUsername} joined using your code`,
        timestamp: now,
      }),
      adminDb.collection('users').doc(referrerDoc.id).collection('cashTransactions').add({
        type: 'referral_cash',
        amount: 1,
        description: `Referral cash — @${newUsername} joined`,
        timestamp: now,
      }),
    ]);

    return NextResponse.json({ success: true, referredBy: referrerName });
  } catch (err: any) {
    console.error('Referral error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
