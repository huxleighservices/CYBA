'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Bell, MessageCircle, Mail, Loader2 } from 'lucide-react';
import { useFirebase, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, orderBy, limit, where, writeBatch, getDocs, doc, updateDoc } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { AvatarDisplay } from '@/components/AvatarDisplay';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import type { NotificationType } from '@/lib/notifications';
import type { Conversation } from '@/app/messages/layout';
import { PostCard, type CybazonePost } from '@/components/cybazone/PostCard';
import { sfxNotification } from '@/lib/sfx';

interface Notification {
  id: string;
  type: NotificationType;
  actorId: string;
  actorUsername: string;
  actorProfilePictureUrl?: string;
  postId?: string;
  postSnippet?: string;
  commentContent?: string;
  message?: string;
  linkTo?: string;
  read: boolean;
  timestamp: any;
}

function notifIcon(type: NotificationType) {
  switch (type) {
    case 'like':                 return '❤️';
    case 'repost':               return '🔁';
    case 'comment':              return '💬';
    case 'follow':               return '👤';
    case 'mention':              return '📣';
    case 'submission_approved':  return '✅';
    case 'submission_rejected':  return '❌';
    case 'market_purchase':      return '🛒';
    case 'promo_expiring_soon':  return '⏳';
    case 'promo_renewal_bonus':  return '🎁';
    case 'new_post':             return '📝';
    case 'birthday_gift':        return '🎂';
    case 'merch_order':          return '📦';
    case 'merch_shipped':        return '🚚';
  }
}

function notifLabel(n: Notification) {
  switch (n.type) {
    case 'like':
      return (
        <span>
          <strong>{n.actorUsername}</strong> liked your post
          {n.postSnippet && <span className="text-muted-foreground"> · &ldquo;{n.postSnippet.slice(0, 50)}{n.postSnippet.length > 50 ? '…' : ''}&rdquo;</span>}
        </span>
      );
    case 'repost':
      return (
        <span>
          <strong>{n.actorUsername}</strong> reposted your post
          {n.postSnippet && <span className="text-muted-foreground"> · &ldquo;{n.postSnippet.slice(0, 50)}{n.postSnippet.length > 50 ? '…' : ''}&rdquo;</span>}
        </span>
      );
    case 'comment':
      return (
        <span>
          <strong>{n.actorUsername}</strong> commented: <span className="text-muted-foreground">&ldquo;{n.commentContent}&rdquo;</span>
        </span>
      );
    case 'follow':
      return <span><strong>{n.actorUsername}</strong> started following you</span>;
    case 'mention':
      return (
        <span>
          <strong>{n.actorUsername}</strong> mentioned you
          {(n.commentContent || n.postSnippet) && (
            <span className="text-muted-foreground"> · &ldquo;{(n.commentContent || n.postSnippet)?.slice(0, 50)}…&rdquo;</span>
          )}
        </span>
      );
    case 'submission_approved':
      return (
        <span>
          <strong>CYBAZONE</strong> {n.message ?? 'Your submission was approved!'}
        </span>
      );
    case 'submission_rejected':
      return (
        <span>
          <strong>CYBAZONE</strong> {n.message ?? 'Your submission was not approved.'}
        </span>
      );
    case 'market_purchase':
      return (
        <span>
          <strong>CYBAZONE</strong> {n.message ?? 'Someone bought an item from your store!'}
        </span>
      );
    case 'promo_expiring_soon':
      return (
        <span>
          <strong>CYBAZONE</strong> {n.message ?? 'Your promo slot expires in 3 days.'}
        </span>
      );
    case 'promo_renewal_bonus':
      return (
        <span>
          <strong>CYBAZONE</strong> {n.message ?? 'You earned a CYBACOIN bonus for renewing early!'}
        </span>
      );
    case 'new_post':
      return <span><strong>{n.actorUsername}</strong> just posted</span>;
    case 'birthday_gift':
      return (
        <span>
          <strong>CYBAZONE</strong> {n.message ?? 'Happy Birthday! We added a CYBACOIN gift to your wallet.'}
        </span>
      );
    case 'merch_order':
      return (
        <span>
          <strong>CYBAZONE</strong> {n.message ?? 'New merch order placed.'}
        </span>
      );
    case 'merch_shipped':
      return (
        <span>
          <strong>CYBAZONE</strong> {n.message ?? 'Your order has shipped!'}
        </span>
      );
  }
}

function notifHref(n: Notification) {
  if (n.linkTo) return n.linkTo;
  if (n.type === 'follow') return `/u/${n.actorUsername}`;
  if (n.postId) return `/?post=${n.postId}`;
  return '/';
}

interface UserProfile {
  emailNotifications?: boolean;
  email?: string;
}

function PostModal({ postId, onClose }: { postId: string | null; onClose: () => void }) {
  const { firestore } = useFirebase();
  // Keep showing the last-open post's content while the close animation plays, instead of
  // blanking to "not found" — visibility itself is driven by the `open` prop below.
  const [lastPostId, setLastPostId] = useState<string | null>(null);
  useEffect(() => {
    if (postId) setLastPostId(postId);
  }, [postId]);

  const postRef = useMemoFirebase(
    () => (lastPostId ? doc(firestore, 'cybazone_posts', lastPostId) : null),
    [firestore, lastPostId]
  );
  const { data: postData, isLoading } = useDoc<Omit<CybazonePost, 'id'>>(postRef);
  const post: CybazonePost | null = postData && lastPostId ? { ...postData, id: lastPostId } : null;

  return (
    // Rendered persistently (not conditionally mounted) so Radix's own close/cleanup
    // lifecycle runs instead of a hard unmount, which can leave the shared modal
    // scroll-lock/pointer-events state stuck and freeze the page.
    <Dialog open={!!postId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-xl sm:max-w-2xl p-0 gap-0 overflow-visible border-primary/30 bg-transparent shadow-2xl shadow-purple-950/40">
        <DialogTitle className="sr-only">Post</DialogTitle>
        {isLoading ? (
          <div className="flex items-center justify-center p-16 bg-card rounded-xl border border-primary/20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : post ? (
          <PostCard post={post} />
        ) : (
          <div className="p-8 text-center text-muted-foreground text-sm bg-card rounded-xl border border-primary/20">
            Post not found or has been deleted.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function NotificationBell() {
  const { firestore, user } = useFirebase();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'notifications' | 'messages'>('notifications');
  const [openPostId, setOpenPostId] = useState<string | null>(null);

  // Email notifications preference
  const profileRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userProfile } = useDoc<UserProfile>(profileRef);
  const emailNotifEnabled = userProfile?.emailNotifications ?? false;

  const toggleEmailNotif = useCallback(async (enabled: boolean) => {
    if (!user) return;
    await updateDoc(doc(firestore, 'users', user.uid), { emailNotifications: enabled }).catch(() => {});
  }, [firestore, user]);

  // Notifications query
  const notifQuery = useMemoFirebase(
    () =>
      user
        ? query(
            collection(firestore, 'notifications', user.uid, 'items'),
            orderBy('timestamp', 'desc'),
            limit(30),
          )
        : null,
    [firestore, user],
  );
  const { data: notifications } = useCollection<Notification>(notifQuery);

  // Play a sound when a genuinely new notification arrives — skips the very first load
  // (that's existing history, not a new arrival) and only fires when the newest id changes.
  const lastSeenNotifIdRef = useRef<string | null>(null);
  const hasSeenFirstLoadRef = useRef(false);
  useEffect(() => {
    if (!notifications || notifications.length === 0) return;
    const newestId = notifications[0].id;
    if (!hasSeenFirstLoadRef.current) {
      hasSeenFirstLoadRef.current = true;
      lastSeenNotifIdRef.current = newestId;
      return;
    }
    if (newestId !== lastSeenNotifIdRef.current) {
      lastSeenNotifIdRef.current = newestId;
      sfxNotification();
    }
  }, [notifications]);

  // Conversations query — always active so the unread badge updates in real time
  const convsQuery = useMemoFirebase(
    () =>
      user
        ? query(
            collection(firestore, 'conversations'),
            where('participants', 'array-contains', user.uid),
            limit(50),
          )
        : null,
    [firestore, user],
  );
  const { data: rawConversations } = useCollection<Conversation>(convsQuery);

  // Sort conversations by most recent message (client-side — no composite index needed)
  const conversations = useMemo(() => {
    if (!rawConversations) return null;
    return [...rawConversations].sort((a, b) => {
      const ta = a.lastMessageAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
      const tb = b.lastMessageAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0;
      return tb - ta;
    }).slice(0, 20);
  }, [rawConversations]);

  const unreadNotifCount = notifications?.filter((n) => !n.read).length ?? 0;

  const unreadMsgCount = useMemo(() => {
    if (!conversations || !user) return 0;
    return conversations.reduce((sum, c) => sum + (c.unreadCounts?.[user.uid] ?? 0), 0);
  }, [conversations, user]);

  const totalUnread = unreadNotifCount + unreadMsgCount;

  const markAllRead = useCallback(async () => {
    if (!user || !notifications) return;
    const unread = notifications.filter((n) => !n.read);
    if (!unread.length) return;
    const batch = writeBatch(firestore);
    unread.forEach((n) => {
      batch.update(doc(firestore, 'notifications', user.uid, 'items', n.id), { read: true });
    });
    await batch.commit().catch(() => {});
  }, [firestore, user, notifications]);

  const handleOpen = (val: boolean) => {
    setOpen(val);
    if (val && unreadNotifCount > 0) markAllRead();
  };

  if (!user) return null;

  return (
    <>
    <PostModal postId={openPostId} onClose={() => setOpenPostId(null)} />
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button className="relative shrink-0 rounded-full p-1 text-muted-foreground hover:text-primary transition-colors">
          <Bell className="h-5 w-5" />
          {totalUnread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
              {totalUnread > 9 ? '9+' : totalUnread}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0 shadow-xl border-primary/20">
        {/* Tab bar */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setTab('notifications')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors',
              tab === 'notifications'
                ? 'text-foreground border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Bell className="h-3.5 w-3.5" />
            Notifications
            {unreadNotifCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('messages')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors',
              tab === 'messages'
                ? 'text-foreground border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Messages
            {unreadMsgCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                {unreadMsgCount > 9 ? '9+' : unreadMsgCount}
              </span>
            )}
          </button>
        </div>

        {/* ── Notifications tab ── */}
        {tab === 'notifications' && (
          <>
            {unreadNotifCount > 0 && (
              <div className="flex justify-end px-4 py-2 border-b border-border/40">
                <button onClick={markAllRead} className="text-xs text-primary hover:underline">
                  Mark all read
                </button>
              </div>
            )}
            <div className="max-h-[340px] overflow-y-auto">
              {!notifications || notifications.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        setOpen(false);
                        if (n.postId) {
                          setOpenPostId(n.postId);
                        } else {
                          window.location.href = notifHref(n);
                        }
                      }}
                      className={cn(
                        'w-full flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left',
                        !n.read && 'bg-primary/5',
                      )}
                    >
                      <div className="relative shrink-0">
                        {n.actorId === 'system' ? (
                          <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-base">
                            🌐
                          </div>
                        ) : (
                          <AvatarDisplay profilePictureUrl={n.actorProfilePictureUrl} size={36} />
                        )}
                        <span className="absolute -bottom-1 -right-1 text-sm leading-none">
                          {notifIcon(n.type)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-snug">{notifLabel(n)}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {n.timestamp?.toDate
                            ? formatDistanceToNow(n.timestamp.toDate(), { addSuffix: true })
                            : 'just now'}
                        </p>
                      </div>
                      {!n.read && (
                        <span className="shrink-0 mt-1.5 h-2 w-2 rounded-full bg-primary" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Email notifications toggle */}
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/40 bg-muted/20">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                <span>Email notifications</span>
              </div>
              <Switch
                checked={emailNotifEnabled}
                onCheckedChange={toggleEmailNotif}
                aria-label="Toggle email notifications"
              />
            </div>
          </>
        )}

        {/* ── Messages tab ── */}
        {tab === 'messages' && (
          <div className="max-h-[380px] overflow-y-auto">
            {!conversations || conversations.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>No conversations yet</p>
                <Link
                  href="/messages"
                  onClick={() => setOpen(false)}
                  className="mt-2 inline-block text-primary text-xs underline"
                >
                  Start messaging
                </Link>
              </div>
            ) : (
              <>
                <div className="divide-y divide-border/50">
                  {conversations.map((conv) => {
                    if (!user) return null;
                    const unread = conv.unreadCounts?.[user.uid] ?? 0;
                    const isGroup = conv.type === 'group';
                    const otherId = !isGroup ? conv.participants.find(p => p !== user.uid) ?? '' : '';
                    const otherInfo = !isGroup ? conv.participantInfo?.[otherId] : null;
                    const displayName = isGroup
                      ? (conv.name ?? conv.participants.filter(p => p !== user.uid).map(p => conv.participantInfo?.[p]?.username).join(', '))
                      : (otherInfo?.username ?? 'Unknown');

                    return (
                      <Link
                        key={conv.id}
                        href={`/messages/${conv.id}`}
                        onClick={() => setOpen(false)}
                        className={cn(
                          'flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors',
                          unread > 0 && 'bg-primary/5',
                        )}
                      >
                        <AvatarDisplay
                          profilePictureUrl={otherInfo?.profilePictureUrl ?? undefined}
                          avatarConfig={otherInfo?.avatarConfig ?? undefined}
                          size={36}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <p className={cn('text-sm truncate', unread > 0 ? 'font-bold' : 'font-medium')}>
                              {isGroup ? `👥 ${displayName}` : `@${displayName}`}
                            </p>
                            {unread > 0 && (
                              <span className="shrink-0 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                                {unread > 9 ? '9+' : unread}
                              </span>
                            )}
                          </div>
                          <p className={cn('text-xs truncate', unread > 0 ? 'text-foreground/80' : 'text-muted-foreground')}>
                            {conv.lastMessage || 'No messages yet'}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
                <div className="p-3 border-t border-border/40">
                  <Link
                    href="/messages"
                    onClick={() => setOpen(false)}
                    className="block w-full text-center text-xs text-primary hover:underline py-1"
                  >
                    Open Messages →
                  </Link>
                </div>
              </>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
    </>
  );
}
