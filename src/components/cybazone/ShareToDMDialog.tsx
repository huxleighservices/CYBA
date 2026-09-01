'use client';

import { useState } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection, query, where, addDoc, updateDoc, doc, getDoc, getDocs, serverTimestamp, limit,
} from 'firebase/firestore';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { AvatarDisplay } from '@/components/AvatarDisplay';
import { Loader2, Search, Send, MessageCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { Conversation } from '@/app/messages/layout';
import type { AvatarConfig } from '@/lib/avatar-assets';

type SearchUser = {
  id: string;
  username: string;
  profilePictureUrl?: string;
  avatarConfig?: AvatarConfig;
};

export type ShareableContent =
  | {
      kind: 'post';
      postId: string;
      authorUsername: string;
      authorProfilePictureUrl?: string | null;
      contentSnippet: string;
      imageUrl?: string | null;
      mediaType?: 'image' | 'video' | null;
    }
  | {
      kind: 'pulse';
      pulseId: string;
      authorUsername: string;
      authorProfilePictureUrl?: string | null;
      mediaUrl: string;
      mediaType: 'image' | 'video';
    };

export function ShareToDMDialog({
  open,
  onOpenChange,
  content,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: ShareableContent;
}) {
  const { firestore, user } = useFirebase();
  const { toast } = useToast();
  const authorUsername = content.authorUsername;
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);

  const convsQuery = useMemoFirebase(
    () => (user ? query(collection(firestore, 'conversations'), where('participants', 'array-contains', user.uid)) : null),
    [firestore, user],
  );
  const { data: rawConversations, isLoading: convsLoading } = useCollection<Conversation>(convsQuery);
  const conversations = [...(rawConversations ?? [])].sort((a, b) => {
    const ta = a.lastMessageAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
    const tb = b.lastMessageAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0;
    return tb - ta;
  });

  const handleSearch = async (val: string) => {
    setSearchQuery(val);
    if (!val.trim() || !user) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const term = val.trim().toLowerCase();
      const highBound = term + String.fromCharCode(0xf8ff);
      const snap = await getDocs(query(
        collection(firestore, 'users'),
        where('username_lowercase', '>=', term),
        where('username_lowercase', '<=', highBound),
        limit(10),
      ));
      setSearchResults(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).filter(u => u.id !== user.uid));
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  };

  const shareIntoConversation = async (convId: string) => {
    if (!user) return;
    setSendingTo(convId);
    try {
      const convSnap = await getDoc(doc(firestore, 'conversations', convId));
      const conv = convSnap.data() as Conversation | undefined;
      const myInfo = conv?.participantInfo?.[user.uid];

      await addDoc(collection(firestore, 'conversations', convId, 'messages'), {
        senderId: user.uid,
        senderUsername: myInfo?.username ?? 'Someone',
        senderProfilePictureUrl: myInfo?.profilePictureUrl ?? null,
        senderAvatarConfig: myInfo?.avatarConfig ?? null,
        text: '',
        ...(content.kind === 'post' ? {
          sharedPost: {
            postId: content.postId, authorUsername: content.authorUsername,
            authorProfilePictureUrl: content.authorProfilePictureUrl ?? null,
            contentSnippet: content.contentSnippet.slice(0, 140),
            imageUrl: content.imageUrl ?? null,
            mediaType: content.mediaType ?? null,
          },
        } : {
          sharedPulse: {
            pulseId: content.pulseId, authorUsername: content.authorUsername,
            authorProfilePictureUrl: content.authorProfilePictureUrl ?? null,
            mediaUrl: content.mediaUrl,
            mediaType: content.mediaType,
          },
        }),
        createdAt: serverTimestamp(),
      });

      const update: Record<string, any> = {
        lastMessage: content.kind === 'post' ? `📤 Shared a post from @${authorUsername}` : `✨ Shared a Pulse from @${authorUsername}`,
        lastMessageAt: serverTimestamp(),
        lastMessageSenderId: user.uid,
      };
      (conv?.participants ?? []).forEach(pid => {
        if (pid !== user.uid) update[`unreadCounts.${pid}`] = (conv?.unreadCounts?.[pid] ?? 0) + 1;
      });
      await updateDoc(doc(firestore, 'conversations', convId), update);

      toast({ title: 'Shared!' });
      onOpenChange(false);
    } catch {
      toast({ variant: 'destructive', title: 'Failed to share' });
    } finally {
      setSendingTo(null);
    }
  };

  const shareToNewUser = async (target: SearchUser) => {
    if (!user) return;
    setSendingTo(target.id);
    try {
      const key = [user.uid, target.id].sort().join('_');
      const existing = await getDocs(query(collection(firestore, 'conversations'), where('participantKey', '==', key)));
      if (!existing.empty) {
        await shareIntoConversation(existing.docs[0].id);
        return;
      }
      const mySnap = await getDoc(doc(firestore, 'users', user.uid));
      const myData = mySnap.data() as any;
      const participantInfo: Record<string, any> = {
        [user.uid]: {
          username: myData?.username ?? 'Me',
          profilePictureUrl: myData?.profilePictureUrl ?? null,
          avatarConfig: myData?.avatarConfig ?? null,
        },
        [target.id]: {
          username: target.username,
          profilePictureUrl: target.profilePictureUrl ?? null,
          avatarConfig: target.avatarConfig ?? null,
        },
      };
      const convRef = await addDoc(collection(firestore, 'conversations'), {
        type: 'direct',
        participants: [user.uid, target.id],
        participantInfo,
        participantKey: key,
        unreadCounts: { [user.uid]: 0, [target.id]: 0 },
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        lastMessageAt: serverTimestamp(),
        lastMessage: '',
        name: null,
      });
      await shareIntoConversation(convRef.id);
    } catch {
      toast({ variant: 'destructive', title: 'Failed to share' });
      setSendingTo(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-border/50">
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" /> Share to DM
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 py-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              className="w-full h-10 rounded-lg bg-muted/60 border border-input pl-9 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
              placeholder="Search by username…"
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
            />
          </div>

          <div className="max-h-80 overflow-y-auto space-y-1 -mx-1 px-1">
            {searchQuery ? (
              searching ? (
                <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
              ) : searchResults.length > 0 ? (
                searchResults.map(u => (
                  <button key={u.id} disabled={sendingTo === u.id} onClick={() => shareToNewUser(u)}
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/60 border border-transparent disabled:opacity-60"
                  >
                    <AvatarDisplay profilePictureUrl={u.profilePictureUrl} avatarConfig={u.avatarConfig} size={36} />
                    <p className="text-sm font-semibold flex-1 truncate">@{u.username}</p>
                    {sendingTo === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 text-muted-foreground" />}
                  </button>
                ))
              ) : (
                <p className="text-center text-sm text-muted-foreground py-6">No users found</p>
              )
            ) : convsLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <MessageCircle className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No conversations yet — search a username above.</p>
              </div>
            ) : (
              conversations.map(conv => {
                if (!user) return null;
                const isGroup = conv.type === 'group';
                const otherId = conv.participants.find(p => p !== user.uid) ?? '';
                const other = conv.participantInfo?.[otherId];
                const displayName = isGroup ? (conv.name || 'Group Chat') : (other?.username ?? 'Unknown');
                return (
                  <button key={conv.id} disabled={sendingTo === conv.id} onClick={() => shareIntoConversation(conv.id)}
                    className={cn(
                      'w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/60 border border-transparent disabled:opacity-60',
                    )}
                  >
                    <AvatarDisplay profilePictureUrl={other?.profilePictureUrl ?? undefined} avatarConfig={other?.avatarConfig ?? undefined} size={36} />
                    <p className="text-sm font-semibold flex-1 truncate">
                      {isGroup && <span className="text-muted-foreground mr-1">👥</span>}
                      {displayName}
                    </p>
                    {sendingTo === conv.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 text-muted-foreground" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
