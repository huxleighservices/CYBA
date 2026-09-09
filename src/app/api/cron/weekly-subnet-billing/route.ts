import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Creator-to-creator weekly billing: unlike weekly-boost-billing (which deducts to nowhere,
// a platform fee), Subnet CC actually routes from member -> owner's wallet.
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret');
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = adminDb;
    const results = { charged: 0, revoked: 0 };

    const snap = await db.collection('subnet_memberships').where('status', '==', 'active').get();

    for (const membershipDoc of snap.docs) {
      const membership = membershipDoc.data();
      const { ownerId, memberId } = membership;
      if (!ownerId || !memberId) continue;

      const subnetSnap = await db.collection('subnets').doc(ownerId).get();
      const weeklyRate = subnetSnap.exists ? (subnetSnap.data()?.weeklyRate ?? 0) : 0;
      if (!weeklyRate || weeklyRate <= 0) continue;

      const memberRef = db.collection('users').doc(memberId);
      const memberSnap = await memberRef.get();
      const balance = memberSnap.exists ? (memberSnap.data()?.cybaCoinBalance ?? 0) : 0;

      const batch = db.batch();

      if (balance >= weeklyRate) {
        batch.update(memberRef, { cybaCoinBalance: FieldValue.increment(-weeklyRate) });
        batch.update(db.collection('users').doc(ownerId), { cybaCoinBalance: FieldValue.increment(weeklyRate) });
        batch.update(membershipDoc.ref, { lastBilledAt: FieldValue.serverTimestamp() });

        const memberTxRef = memberRef.collection('coinTransactions').doc();
        batch.set(memberTxRef, {
          type: 'boost_subscription',
          amount: -weeklyRate,
          description: `Weekly Subnet subscription — ${membership.ownerUsername ?? 'creator'}`,
          timestamp: FieldValue.serverTimestamp(),
        });
        const ownerTxRef = db.collection('users').doc(ownerId).collection('coinTransactions').doc();
        batch.set(ownerTxRef, {
          type: 'boost_subscription',
          amount: weeklyRate,
          description: `Subnet payment — ${membership.memberUsername ?? 'member'}`,
          timestamp: FieldValue.serverTimestamp(),
        });

        await batch.commit();
        results.charged++;
      } else {
        batch.update(membershipDoc.ref, { status: 'revoked' });
        batch.update(db.collection('subnets').doc(ownerId), { memberCount: FieldValue.increment(-1) });
        await batch.commit();
        results.revoked++;
      }
    }

    return NextResponse.json({ message: 'Weekly Subnet billing complete.', results });
  } catch (error) {
    console.error('[weekly-subnet-billing] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
