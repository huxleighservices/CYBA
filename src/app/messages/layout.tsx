'use client';

import { useState, useMemo, useRef } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection, query, where, orderBy, addDoc, serverTimestamp,
  getDocs, doc, getDoc, limit,
} from 'firebase/firestore';
import { usePathname, useRouter } from 'next/navigation';
import { AvatarDisplay } from '@/components/AvatarDisplay';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, PenSquare, Search, Users, X, MessageCircle, UserPlus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { AvatarConfig } from '@/lib/avatar-assets';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

export type Conversation = {
  id: string;
  type: 'direct' | 'group';
  participants: string[];
  participantInfo: Record<string, { username: string; profilePictureUrl?: string | null; avatarConfig?: AvatarConfig | null }>;
  participantKey?: string;
  name?: string;
  lastMessage?: string;
  lastMessageAt?: any;
  lastMessageSenderId?: string;
  unreadCounts: Record<string, number>;
  createdAt?: any;
  createdBy?: string;
};

type SearchUser = {
  id: string;
  username: string;
  profilePictureUrl?: string;
  avatarConfig?: AvatarConfig;
};

function timeAgo(ts: any) {
  if (!ts?.toDate) return '';
  try { return formatDistanceToNow(ts.toDate(), { addSuffix: true }); }
  catch { return ''; }
}

function ConvAvatar({ conv, myUid }: { conv: Conversation; myUid: string }) {
  if (conv.type === 'group') {
    const members = conv.participants.filter(p => p !== myUid).slice(0, 2);
    return (
      <div className="relative w-10 h-10 shrink-0">
        {members.map((uid, i) => {
          const info = conv.participantInfo?.[uid];
          return (
            <div key={uid} className={cn(
              'absolute w-7 h-7 rounded-full border-2 border-background overflow-hidden',
              i === 0 ? 'top-0 left-0' : 'bottom-0 right-0',
            )}>
              <AvatarDisplay profilePictureUrl={info?.profilePictureUrl ?? undefined} avatarConfig={info?.avatarConfig ?? undefined} size={28} />
            </div>
          );
        })}
      </div>
    );
  }
  const otherId = conv.participants.find(p => p !== myUid) ?? '';
  const other = conv.participantInfo?.[otherId];
  return <AvatarDisplay profilePictureUrl={other?.profilePictureUrl ?? undefined} avatarConfig={other?.avatarConfig ?? undefined} size={40} />;
}

export function convDisplayName(conv: Conversation, myUid: string) {
  if (conv.type === 'group') return conv.name || 'Group Chat';
  const otherId = conv.participants.find(p => p !== myUid) ?? '';
  return conv.participantInfo?.[otherId]?.username ?? 'Unknown';
}

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  const { firestore, user, isUserLoading } = useFirebase();
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();

  const [showNew, setShowNew] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<SearchUser[]>([]);
  const [groupName, setGroupName] = useState('');
  const [creating, setCreating] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // ── NO orderBy here — that requires a composite index. Sort client-side. ──
  const convsQuery = useMemoFirebase(
    () => user
      ? query(collection(firestore, 'conversations'), where('participants', 'array-contains', user.uid))
      : null,
    [firestore, user],
  );
  const { data: rawConversations, isLoading: convsLoading } = useCollection<Conversation>(convsQuery);

  // Sort client-side: most recent first, null timestamps go to bottom
  const conversations = useMemo(() => {
    if (!rawConversations) return [];
    return [...rawConversations].sort((a, b) => {
      const ta = a.lastMessageAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
      const tb = b.lastMessageAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0;
      return tb - ta;
    });
  }, [rawConversations]);

  const activeId = pathname.startsWith('/messages/') ? pathname.split('/')[2] : null;

  const totalUnread = useMemo(() => {
    if (!conversations || !user) return 0;
    return conversations.reduce((sum, c) => sum + (c.unreadCounts?.[user.uid] ?? 0), 0);
  }, [conversations, user]);

  const handleSearch = async (val: string) => {
    setSearchQuery(val);
    if (!val.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const term = val.trim().toLowerCase();
      const snap = await getDocs(query(
        collection(firestore, 'users'),
        where('username_lowercase', '>=', term),
        where('username_lowercase', '<=', term + '\uf8ff'),
        limit(10),
      ));
      setSearchResults(
        snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).filter(u => u.id !== user?.uid)
      );
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  };

  const toggleSelectUser = (u: SearchUser) =>
    setSelectedUsers(prev => prev.find(x => x.id === u.id) ? prev.filter(x => x.id !== u.id) : [...prev, u]);

  const resetDialog = () => {
    setSelectedUsers([]);
    setSearchQuery('');
    setSearchResults([]);
    setGroupName('');
  };

  const handleStartConversation = async () => {
    if (!user || selectedUsers.length === 0) return;
    setCreating(true);
    try {
      const isGroup = selectedUsers.length > 1;

      // For DMs check if one already exists
      if (!isGroup) {
        const key = [user.uid, selectedUsers[0].id].sort().join('_');
        const existing = await getDocs(query(
          collection(firestore, 'conversations'),
          where('participantKey', '==', key),
        ));
        if (!existing.empty) {
          router.push(`/messages/${existing.docs[0].id}`);
          setShowNew(false);
          resetDialog();
          return;
        }
      }

      // Load current user info once
      const mySnap = await getDoc(doc(firestore, 'users', user.uid));
      const myData = mySnap.data() as any;

      const allParticipants = [user.uid, ...selectedUsers.map(u => u.id)];
      const participantInfo: Record<string, any> = {
        [user.uid]: {
          username: myData?.username ?? 'Me',
          profilePictureUrl: myData?.profilePictureUrl ?? null,
          avatarConfig: myData?.avatarConfig ?? null,
        },
      };
      selectedUsers.forEach(u => {
        participantInfo[u.id] = {
          username: u.username,
          profilePictureUrl: u.profilePictureUrl ?? null,
          avatarConfig: u.avatarConfig ?? null,
        };
      });

      const unreadCounts: Record<string, number> = {};
      allParticipants.forEach(id => { unreadCounts[id] = 0; });

      const now = serverTimestamp();
      const newConv: any = {
        type: isGroup ? 'group' : 'direct',
        participants: allParticipants,
        participantInfo,
        unreadCounts,
        createdAt: now,
        createdBy: user.uid,
        lastMessageAt: now,
        lastMessage: '',
        name: isGroup
          ? (groupName.trim() || selectedUsers.map(u => u.username).join(', '))
          : null,
      };
      if (!isGroup) {
        newConv.participantKey = [user.uid, selectedUsers[0].id].sort().join('_');
      }

      const ref = await addDoc(collection(firestore, 'conversations'), newConv);
      router.push(`/messages/${ref.id}`);
      setShowNew(false);
      resetDialog();
    } catch (e: any) {
      console.error('Failed to create conversation:', e);
      toast({ variant: 'destructive', title: 'Could not create chat', description: e?.message });
    } finally {
      setCreating(false);
    }
  };

  if (!user && !isUserLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-muted-foreground">
          <Link href="/login" className="text-primary underline">Sign in</Link> to use Messages.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-0 sm:px-4 py-0 sm:py-6 max-w-6xl">
      <div className="flex sm:rounded-2xl border border-border/50 bg-card/30 overflow-hidden" style={{ height: 'calc(100dvh - 4rem)' }}>

        {/* ── Sidebar ── */}
        <div className={cn(
          'flex flex-col border-r border-border/50 bg-card/60 shrink-0',
          activeId ? 'hidden sm:flex w-72 lg:w-80' : 'flex w-full sm:w-72 lg:w-80',
        )}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-border/50 bg-card/80">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              <h1 className="font-bold text-base">Messages</h1>
              {totalUnread > 0 && (
                <Badge className="text-[10px] px-1.5 py-0 h-4 bg-primary text-primary-foreground">
                  {totalUnread > 99 ? '99+' : totalUnread}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="rounded-full h-8 w-8 text-muted-foreground hover:text-primary"
                onClick={() => { setShowNew(true); setTimeout(() => searchRef.current?.focus(), 100); }}
                title="New message"
              >
                <PenSquare className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* List */}
          <ScrollArea className="flex-1">
            {convsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-3">
                <MessageCircle className="h-12 w-12 text-muted-foreground/30" />
                <p className="text-sm font-medium">No conversations yet</p>
                <p className="text-xs text-muted-foreground">Start a DM or a group chat</p>
                <Button size="sm" onClick={() => setShowNew(true)}>
                  <PenSquare className="h-3.5 w-3.5 mr-1.5" />
                  New Message
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {conversations.map(conv => {
                  if (!user) return null;
                  const unread = conv.unreadCounts?.[user.uid] ?? 0;
                  const isActive = conv.id === activeId;
                  const displayName = convDisplayName(conv, user.uid);

                  return (
                    <Link key={conv.id} href={`/messages/${conv.id}`}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 transition-colors',
                        isActive ? 'bg-primary/15 border-l-2 border-primary' : 'hover:bg-muted/40',
                        !isActive && unread > 0 && 'bg-primary/5',
                      )}
                    >
                      <ConvAvatar conv={conv} myUid={user.uid} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <p className={cn('text-sm truncate', unread > 0 ? 'font-bold text-foreground' : 'font-medium')}>
                            {conv.type === 'group' && <span className="text-muted-foreground mr-1">👥</span>}
                            {displayName}
                          </p>
                          <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(conv.lastMessageAt)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          <p className={cn('text-xs truncate', unread > 0 ? 'text-foreground/80' : 'text-muted-foreground')}>
                            {conv.lastMessage || <span className="italic">No messages yet</span>}
                          </p>
                          {unread > 0 && (
                            <span className="shrink-0 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                              {unread > 9 ? '9+' : unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* ── Main pane ── */}
        <div className={cn('flex-1 flex flex-col min-w-0', !activeId && 'hidden sm:flex')}>
          {children}
        </div>
      </div>

      {/* ── New Conversation Dialog ── */}
      <Dialog open={showNew} onOpenChange={v => { setShowNew(v); if (!v) resetDialog(); }}>
        <DialogContent className="max-w-md gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-4 border-b border-border/50">
            <DialogTitle className="flex items-center gap-2">
              <PenSquare className="h-4 w-4 text-primary" />
              New Message
            </DialogTitle>
          </DialogHeader>

          <div className="px-5 py-4 space-y-4">
            {/* Selected chips */}
            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-muted/40 border border-border/50">
                {selectedUsers.map(u => (
                  <span key={u.id} className="inline-flex items-center gap-1.5 bg-primary/20 border border-primary/40 text-primary text-xs rounded-full px-2.5 py-1 font-medium">
                    <AvatarDisplay profilePictureUrl={u.profilePictureUrl} avatarConfig={u.avatarConfig} size={16} />
                    @{u.username}
                    <button onClick={() => toggleSelectUser(u)} className="hover:text-destructive ml-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Group name field — only when 2+ people selected */}
            {selectedUsers.length > 1 && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Group Name</label>
                <Input
                  placeholder={`e.g. ${selectedUsers.map(u => u.username).join(', ')}`}
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  maxLength={50}
                  className="text-sm"
                />
              </div>
            )}

            {/* Search field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {selectedUsers.length === 0 ? 'To' : 'Add more people'}
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  ref={searchRef}
                  className="w-full h-10 rounded-lg bg-muted/60 border border-input pl-9 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                  placeholder="Search by username…"
                  value={searchQuery}
                  onChange={e => handleSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Results */}
            <div className="min-h-[80px] max-h-56 overflow-y-auto space-y-1 -mx-1 px-1">
              {searching ? (
                <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
              ) : searchResults.length > 0 ? (
                searchResults.map(u => {
                  const isSelected = !!selectedUsers.find(x => x.id === u.id);
                  return (
                    <button key={u.id} onClick={() => toggleSelectUser(u)}
                      className={cn(
                        'w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                        isSelected ? 'bg-primary/15 border border-primary/30' : 'hover:bg-muted/60 border border-transparent',
                      )}
                    >
                      <AvatarDisplay profilePictureUrl={u.profilePictureUrl} avatarConfig={u.avatarConfig} size={38} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">@{u.username}</p>
                      </div>
                      {isSelected
                        ? <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">✓</span>
                        : <UserPlus className="h-4 w-4 text-muted-foreground shrink-0" />
                      }
                    </button>
                  );
                })
              ) : searchQuery ? (
                <p className="text-center text-sm text-muted-foreground py-6">No users found for &ldquo;{searchQuery}&rdquo;</p>
              ) : (
                <p className="text-center text-xs text-muted-foreground py-6">Type a username to search</p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 pb-5">
            {selectedUsers.length > 1 && (
              <p className="text-xs text-muted-foreground text-center mb-3">
                <Users className="h-3 w-3 inline mr-1" />
                {selectedUsers.length + 1} people · Group chat
              </p>
            )}
            <Button className="w-full" disabled={selectedUsers.length === 0 || creating} onClick={handleStartConversation}>
              {creating
                ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                : selectedUsers.length > 1
                  ? <><Users className="h-4 w-4 mr-2" />Create Group Chat ({selectedUsers.length + 1} people)</>
                  : selectedUsers.length === 1
                    ? <><MessageCircle className="h-4 w-4 mr-2" />Open Chat with @{selectedUsers[0].username}</>
                    : 'Select someone first'
              }
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
