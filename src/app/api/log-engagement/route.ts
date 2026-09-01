import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export type EngagementType = 'like' | 'comment' | 'repost';

/**
 * Logs one engagement action from both sides — the actor's outward event and the recipient's
 * inward event — into users/{uid}/engagementLog. Routed server-side (rather than two direct
 * client writes) because the recipient-side write targets a DIFFERENT user's subcollection
 * than whoever is calling this; allowing that directly from the client would require loosening
 * Firestore rules to let any signed-in user write into anyone's engagementLog, which is
 * trivially spoofable (fabricated engagement stats on someone else's account).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { actorId, recipientId, type, postId } = body as {
      actorId?: string;
      recipientId?: string;
      type?: EngagementType;
      postId?: string;
    };

    if (!actorId || !recipientId || !type || !postId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    if (actorId === recipientId) {
      // Self-engagement isn't logged (matches the existing CC-reward/notification guards).
      return NextResponse.json({ skipped: true });
    }

    const timestamp = FieldValue.serverTimestamp();
    const batch = adminDb.batch();
    batch.set(adminDb.collection('users').doc(actorId).collection('engagementLog').doc(), {
      type, direction: 'outward', postId, otherUserId: recipientId, timestamp,
    });
    batch.set(adminDb.collection('users').doc(recipientId).collection('engagementLog').doc(), {
      type, direction: 'inward', postId, otherUserId: actorId, timestamp,
    });
    await batch.commit();

    return NextResponse.json({ logged: true });
  } catch (err: any) {
    console.error('log-engagement error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
