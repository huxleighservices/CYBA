import { collection, addDoc, serverTimestamp, type Firestore } from 'firebase/firestore';

export type NotificationType =
  | 'like'
  | 'comment'
  | 'repost'
  | 'follow'
  | 'mention'
  | 'submission_approved'
  | 'submission_rejected'
  | 'market_purchase'
  | 'promo_expiring_soon'
  | 'promo_renewal_bonus'
  | 'new_post'
  | 'subnet_request'
  | 'subnet_approved'
  | 'subnet_invite'
  | 'subnet_revoked';

export interface NotificationPayload {
  type: NotificationType;
  actorId: string;
  actorUsername: string;
  actorProfilePictureUrl?: string | null;
  postId?: string;
  postSnippet?: string;
  commentContent?: string;
  /** Custom human-readable message (used for system/approval notifications) */
  message?: string;
  /** Override link destination */
  linkTo?: string;
}

/** Write a notification to the recipient's subcollection.
 *  No-op if actor === recipient, UNLESS actorId is 'system'.
 *  Also fires a fire-and-forget email when called from browser context. */
export async function createNotification(
  firestore: Firestore,
  recipientId: string,
  payload: NotificationPayload,
): Promise<void> {
  if (payload.actorId !== 'system' && payload.actorId === recipientId) return;
  try {
    await addDoc(collection(firestore, 'notifications', recipientId, 'items'), {
      ...payload,
      read: false,
      timestamp: serverTimestamp(),
    });

    // Fire-and-forget email (browser only — relative path resolves to same origin)
    if (typeof window !== 'undefined') {
      fetch('/api/send-notification-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientId,
          type: payload.type,
          message: payload.message,
          actorUsername: payload.actorUsername,
          linkTo: payload.linkTo,
        }),
      }).catch(() => {}); // non-critical
    }
  } catch (e) {
    // Notifications are non-critical — swallow errors silently
    console.warn('Failed to create notification:', e);
  }
}
