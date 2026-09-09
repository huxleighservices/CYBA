import type { Firestore } from 'firebase/firestore';
import { addDoc, collection, doc, getDoc, getDocs, increment, limit, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';

/** CYBAZONE's own system/support account username — same lookup used by the
 *  Contact Us → DM flow (src/components/layout/HelpButton.tsx). */
const CYBAZONE_SYSTEM_USERNAME = 'cybazone';

/**
 * Sends a DM "from" the CYBAZONE system account to a given user, finding or creating
 * the conversation as needed. Used for automated notices (e.g. moderation removals) that
 * need to originate from CYBAZONE regardless of who's actually signed in (an admin).
 * Firestore rules allow any signed-in user to write conversations/messages (no participant
 * check on create), so this works from the admin's own session without impersonation issues.
 */
export async function sendSystemDM(firestore: Firestore, recipientUserId: string, text: string): Promise<void> {
  const sysSnap = await getDocs(query(
    collection(firestore, 'users'),
    where('username_lowercase', '==', CYBAZONE_SYSTEM_USERNAME),
    limit(1),
  ));
  if (sysSnap.empty) return; // system account doesn't exist in this environment — skip silently

  const sysDoc = sysSnap.docs[0];
  const sysData = sysDoc.data() as any;
  if (sysDoc.id === recipientUserId) return; // don't DM the system account itself

  const key = [recipientUserId, sysDoc.id].sort().join('_');
  const existing = await getDocs(query(collection(firestore, 'conversations'), where('participantKey', '==', key)));

  let convId: string;
  if (!existing.empty) {
    convId = existing.docs[0].id;
  } else {
    const recipientSnap = await getDoc(doc(firestore, 'users', recipientUserId));
    const recipientData = recipientSnap.data() as any;
    const convRef = await addDoc(collection(firestore, 'conversations'), {
      type: 'direct',
      participants: [recipientUserId, sysDoc.id],
      participantInfo: {
        [recipientUserId]: { username: recipientData?.username ?? 'Member', profilePictureUrl: recipientData?.profilePictureUrl ?? null, avatarConfig: recipientData?.avatarConfig ?? null },
        [sysDoc.id]: { username: sysData?.username ?? 'CYBAZONE', profilePictureUrl: sysData?.profilePictureUrl ?? null, avatarConfig: sysData?.avatarConfig ?? null },
      },
      participantKey: key,
      unreadCounts: { [recipientUserId]: 0, [sysDoc.id]: 0 },
      createdAt: serverTimestamp(),
      createdBy: sysDoc.id,
      lastMessageAt: serverTimestamp(),
      lastMessage: '',
      name: null,
    });
    convId = convRef.id;
  }

  await addDoc(collection(firestore, 'conversations', convId, 'messages'), {
    senderId: sysDoc.id,
    senderUsername: sysData?.username ?? 'CYBAZONE',
    senderProfilePictureUrl: sysData?.profilePictureUrl ?? null,
    senderAvatarConfig: sysData?.avatarConfig ?? null,
    text,
    createdAt: serverTimestamp(),
  });

  await updateDoc(doc(firestore, 'conversations', convId), {
    lastMessage: text.length > 80 ? text.slice(0, 80) + '…' : text,
    lastMessageAt: serverTimestamp(),
    lastMessageSenderId: sysDoc.id,
    [`unreadCounts.${recipientUserId}`]: increment(1),
  });
}
