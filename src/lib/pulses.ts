import type { Firestore } from 'firebase/firestore';
import { addDoc, collection, deleteDoc, doc, increment, serverTimestamp, updateDoc } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import type { AvatarConfig } from '@/lib/avatar-assets';
import type { Level } from '@/lib/levels';
import { getCCForPulse, type CCRates } from '@/lib/cc-rewards';
import { logTransaction } from '@/lib/transactions';

export const PULSE_LIFETIME_MS = 24 * 60 * 60 * 1000;

/**
 * Shared Pulse-creation path — used by both the Pulses row's own-circle upload
 * and the composer's "Pulse" publish mode, so the reward/behavior stays in one place.
 */
async function writePulseDoc(
  firestore: Firestore,
  params: {
    userId: string;
    username: string;
    profilePictureUrl?: string | null;
    avatarConfig?: AvatarConfig | null;
    mediaUrl: string;
    mediaType: 'image' | 'video';
    caption?: string;
    level: Level;
    ccRates?: CCRates | null;
  },
): Promise<{ cc: number }> {
  const { userId, username, profilePictureUrl, avatarConfig, mediaUrl, mediaType, caption, level, ccRates } = params;
  const nowDate = new Date();
  await addDoc(collection(firestore, 'pulses'), {
    authorId: userId,
    authorUsername: username,
    authorProfilePictureUrl: profilePictureUrl ?? null,
    authorAvatarConfig: avatarConfig ?? null,
    mediaUrl,
    mediaType,
    caption: caption?.trim() || null,
    createdAt: serverTimestamp(),
    expiresAt: new Date(nowDate.getTime() + PULSE_LIFETIME_MS),
    viewedBy: [],
  });

  const cc = getCCForPulse(level, ccRates);
  updateDoc(doc(firestore, 'users', userId), {
    cybaCoinBalance: increment(cc),
  }).catch(() => {});
  logTransaction(firestore, userId, {
    type: 'pulse_reward',
    amount: cc,
    description: '✨ Pulse posted',
  }).catch(() => {});

  return { cc };
}

/** Uploads a new file and publishes it as a Pulse — the own-circle / composer path. */
export async function createPulse(
  firestore: Firestore,
  storage: FirebaseStorage,
  params: {
    userId: string;
    username: string;
    profilePictureUrl?: string | null;
    avatarConfig?: AvatarConfig | null;
    file: File;
    caption?: string;
    level: Level;
    ccRates?: CCRates | null;
  },
): Promise<{ cc: number }> {
  const { userId, username, profilePictureUrl, avatarConfig, file, caption, level, ccRates } = params;
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  if (!isImage && !isVideo) {
    throw new Error('Upload an image or a video.');
  }

  const ext = file.name.split('.').pop() ?? (isImage ? 'jpg' : 'mp4');
  const path = `pulses/${uuidv4()}.${ext}`;
  const fileRef = storageRef(storage, path);
  const task = uploadBytesResumable(fileRef, file, { contentType: file.type });
  const mediaUrl = await new Promise<string>((resolve, reject) => {
    task.on('state_changed', () => {}, reject, async () => resolve(await getDownloadURL(task.snapshot.ref)));
  });

  return writePulseDoc(firestore, {
    userId, username, profilePictureUrl, avatarConfig,
    mediaUrl, mediaType: isImage ? 'image' : 'video', caption,
    level, ccRates,
  });
}

/** Deletes a Pulse — caller must already have confirmed this is the author's own Pulse
 *  (Firestore rules also enforce owner-only delete server-side). */
export async function deletePulse(firestore: Firestore, pulseId: string): Promise<void> {
  await deleteDoc(doc(firestore, 'pulses', pulseId));
}

/** Re-publishes an existing post's media (already in Storage) as a Pulse — "Share to Pulse". */
export async function sharePulseFromMedia(
  firestore: Firestore,
  params: {
    userId: string;
    username: string;
    profilePictureUrl?: string | null;
    avatarConfig?: AvatarConfig | null;
    mediaUrl: string;
    mediaType: 'image' | 'video';
    level: Level;
    ccRates?: CCRates | null;
  },
): Promise<{ cc: number }> {
  return writePulseDoc(firestore, params);
}
