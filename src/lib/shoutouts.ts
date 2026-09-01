import { addDoc, collection, getDocs, getDoc, doc, query, serverTimestamp, Timestamp, where } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

const DAILY_LIMIT = 24;

export interface Shoutout {
  id: string;
  message: string;
  type: 'auto' | 'admin';
  active: boolean;
  createdAt: Timestamp;
  expiresAt: number;
}

export async function createShoutout(
  firestore: Firestore,
  message: string,
  type: 'auto' | 'admin' = 'auto'
): Promise<boolean> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const snap = await getDocs(
      query(
        collection(firestore, 'shoutouts'),
        where('createdAt', '>=', Timestamp.fromDate(today))
      )
    );

    if (snap.size >= DAILY_LIMIT) return false;

    await addDoc(collection(firestore, 'shoutouts'), {
      message: message.trim(),
      type,
      active: true,
      createdAt: serverTimestamp(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    });

    return true;
  } catch {
    return false;
  }
}

export type AutoShoutoutType = 'firstPost' | 'questComplete';

export const DEFAULT_AUTO_TEMPLATES: Record<AutoShoutoutType, string> = {
  firstPost:     '🎤 @{username} just dropped their first post on CYBAZONE!',
  questComplete: '{emoji} @{username} just completed the "{title}" quest!',
};

export async function createAutoShoutout(
  firestore: Firestore,
  type: AutoShoutoutType,
  vars: { username: string; emoji?: string; title?: string }
): Promise<void> {
  try {
    const configSnap = await getDoc(doc(firestore, 'settings', 'shoutoutConfig'));
    const config = configSnap.data() as any;
    const typeConfig = config?.[type];
    if (typeConfig?.enabled === false) return;
    const template: string = typeConfig?.template ?? DEFAULT_AUTO_TEMPLATES[type];
    const message = template
      .replace('{username}', vars.username)
      .replace('{emoji}', vars.emoji ?? '')
      .replace('{title}', vars.title ?? '');
    await createShoutout(firestore, message);
  } catch {
    // silent fail — shoutouts are best-effort
  }
}
