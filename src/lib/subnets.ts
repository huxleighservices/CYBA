import type { Firestore } from 'firebase/firestore';
import { doc, getDoc, increment, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { createNotification } from '@/lib/notifications';

export type SubnetMembershipStatus = 'pending' | 'invited' | 'active' | 'revoked';

export interface SubnetConfig {
  ownerId: string;
  ownerUsername: string;
  weeklyRate: number; // CYBACOIN
  memberCount: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface SubnetMembership {
  id: string;
  ownerId: string;
  ownerUsername: string;
  memberId: string;
  memberUsername: string;
  status: SubnetMembershipStatus;
  requestedAt?: any;
  approvedAt?: any;
  lastBilledAt?: any;
}

export function subnetMembershipId(ownerId: string, memberId: string): string {
  return `${ownerId}_${memberId}`;
}

/** Owner sets/raises/lowers their weekly CC rate — creates the Subnet lazily on first use. */
export async function setSubnetRate(
  firestore: Firestore,
  ownerId: string,
  ownerUsername: string,
  weeklyRate: number,
): Promise<void> {
  await setDoc(
    doc(firestore, 'subnets', ownerId),
    { ownerId, ownerUsername, weeklyRate, updatedAt: serverTimestamp() },
    { merge: true },
  );
  // Ensure memberCount/createdAt exist on first creation without clobbering them on later edits.
  const snap = await getDoc(doc(firestore, 'subnets', ownerId));
  if (snap.exists() && (snap.data() as any).memberCount === undefined) {
    await updateDoc(doc(firestore, 'subnets', ownerId), { memberCount: 0, createdAt: serverTimestamp() });
  }
}

/** Non-member taps locked content → sends a pending access request to the owner. */
export async function requestSubnetAccess(
  firestore: Firestore,
  params: { ownerId: string; ownerUsername: string; memberId: string; memberUsername: string },
): Promise<void> {
  const { ownerId, ownerUsername, memberId, memberUsername } = params;
  await setDoc(doc(firestore, 'subnet_memberships', subnetMembershipId(ownerId, memberId)), {
    ownerId, ownerUsername, memberId, memberUsername,
    status: 'pending',
    requestedAt: serverTimestamp(),
  }, { merge: true });
  await createNotification(firestore, ownerId, {
    type: 'subnet_request',
    actorId: memberId,
    actorUsername: memberUsername,
    message: `${memberUsername} requested access to your Subnet.`,
    linkTo: '/profile#subnet',
  });
}

/** Owner approves a pending request (or accepts happens automatically for invites the member accepted). */
export async function approveSubnetMembership(
  firestore: Firestore,
  ownerId: string,
  ownerUsername: string,
  memberId: string,
): Promise<void> {
  await updateDoc(doc(firestore, 'subnet_memberships', subnetMembershipId(ownerId, memberId)), {
    status: 'active',
    approvedAt: serverTimestamp(),
  });
  await updateDoc(doc(firestore, 'subnets', ownerId), { memberCount: increment(1) }).catch(() => {});
  await createNotification(firestore, memberId, {
    type: 'subnet_approved',
    actorId: ownerId,
    actorUsername: ownerUsername,
    message: `${ownerUsername} approved your Subnet access request!`,
    linkTo: `/u/${ownerUsername}`,
  });
}

/** Owner denies a pending request — removes it outright so the member can request again later. */
export async function denySubnetMembership(firestore: Firestore, ownerId: string, memberId: string): Promise<void> {
  await updateDoc(doc(firestore, 'subnet_memberships', subnetMembershipId(ownerId, memberId)), {
    status: 'revoked',
  });
}

/** Owner proactively invites a follower — member must accept before it counts as active. */
export async function inviteToSubnet(
  firestore: Firestore,
  params: { ownerId: string; ownerUsername: string; memberId: string; memberUsername: string },
): Promise<void> {
  const { ownerId, ownerUsername, memberId, memberUsername } = params;
  await setDoc(doc(firestore, 'subnet_memberships', subnetMembershipId(ownerId, memberId)), {
    ownerId, ownerUsername, memberId, memberUsername,
    status: 'invited',
    requestedAt: serverTimestamp(),
  }, { merge: true });
  await createNotification(firestore, memberId, {
    type: 'subnet_invite',
    actorId: ownerId,
    actorUsername: ownerUsername,
    message: `${ownerUsername} invited you to join their Subnet.`,
    linkTo: `/u/${ownerUsername}`,
  });
}

/** Member accepts an owner's invite — same effect as an approval, from the member's side. */
export async function acceptSubnetInvite(
  firestore: Firestore,
  ownerId: string,
  ownerUsername: string,
  memberId: string,
): Promise<void> {
  await approveSubnetMembership(firestore, ownerId, ownerUsername, memberId);
}

/** Owner revokes an active member's access — content re-locks immediately. */
export async function revokeSubnetMember(
  firestore: Firestore,
  ownerId: string,
  ownerUsername: string,
  memberId: string,
): Promise<void> {
  await updateDoc(doc(firestore, 'subnet_memberships', subnetMembershipId(ownerId, memberId)), {
    status: 'revoked',
  });
  await updateDoc(doc(firestore, 'subnets', ownerId), { memberCount: increment(-1) }).catch(() => {});
  await createNotification(firestore, memberId, {
    type: 'subnet_revoked',
    actorId: ownerId,
    actorUsername: ownerUsername,
    message: `Your access to ${ownerUsername}'s Subnet was revoked.`,
    linkTo: `/u/${ownerUsername}`,
  });
}
