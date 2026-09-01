export type EngagementType = 'like' | 'comment' | 'repost';

/**
 * Fire-and-forget call to the server-side /api/log-engagement route, which logs both sides
 * of the interaction (the actor's outward event, the recipient's inward event) into
 * users/{uid}/engagementLog. See that route for why this isn't a direct client write.
 */
export function logEngagement(actorId: string, recipientId: string, type: EngagementType, postId: string): void {
  if (actorId === recipientId) return;
  fetch('/api/log-engagement', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actorId, recipientId, type, postId }),
  }).catch(() => {});
}
