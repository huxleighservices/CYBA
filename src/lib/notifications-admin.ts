import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/app/api/firebase-admin';
import type { NotificationType } from '@/lib/notifications';

export interface AdminNotificationPayload {
  type: NotificationType;
  actorId: string;
  actorUsername: string;
  message?: string;
  linkTo?: string;
  postId?: string;
}

/**
 * Server-side counterpart to createNotification() in notifications.ts — that one uses the
 * client SDK and can't run in cron/webhook routes. Writes to the exact same
 * notifications/{recipientId}/items path/shape so NotificationBell's existing query and
 * rendering work unchanged for these too.
 */
export async function createNotificationAdmin(
  recipientId: string,
  payload: AdminNotificationPayload,
): Promise<void> {
  try {
    await adminDb
      .collection('notifications')
      .doc(recipientId)
      .collection('items')
      .add({
        ...payload,
        read: false,
        timestamp: FieldValue.serverTimestamp(),
      });
  } catch (e) {
    console.warn('Failed to create admin notification:', e);
  }
}
