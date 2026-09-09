'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import {
  collection, query, orderBy, limit, addDoc, serverTimestamp, where,
  doc, updateDoc, deleteDoc, getDoc, getDocs, writeBatch, arrayRemove, arrayUnion, deleteField,
} from 'firebase/firestore';
import { matchKeywordResponder } from '@/lib/keyword-responders';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import { AvatarDisplay } from '@/components/AvatarDisplay';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Loader2, ArrowLeft, Send, Users, UserCircle, MoreVertical, Pencil, LogOut, Trash2, ImagePlus, X, UserPlus, Search } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import Image from 'next/image';
import type { Conversation } from '../layout';
import { convDisplayName } from '../layout';
import type { AvatarConfig } from '@/lib/avatar-assets';
import { useToast } from '@/hooks/use-toast';

type Message = {
  id: string;
  senderId: string;
  senderUsername: string;
  senderProfilePictureUrl?: string | null;
  senderAvatarConfig?: AvatarConfig | null;
  text: string;
  mediaUrl?: string | null;
  mediaType?: 'image' | 'video' | null;
  sharedPost?: {
    postId: string;
    authorUsername: string;
    authorProfilePictureUrl?: string | null;
    contentSnippet: string;
    imageUrl?: string | null;
    mediaType?: 'image' | 'video' | null;
  } | null;
  sharedPulse?: {
    pulseId: string;
    authorUsername: string;
    authorProfilePictureUrl?: string | null;
    mediaUrl: string;
    mediaType: 'image' | 'video';
  } | null;
  createdAt: any;
};

/** Splits message text on URLs and renders http(s) links as clickable anchors — same
 *  detection pattern used for post content in PostCard/CommentSheet. */
function linkifyText(text: string, isMe: boolean) {
  return text.split(/(https?:\/\/[^\s]+)/g).map((part, i) => {
    if (part.startsWith('http')) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className={cn('underline break-all', isMe ? 'text-primary-foreground' : 'text-blue-400')}
        >
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function formatMsgTime(ts: any) {
  if (!ts?.toDate) return '';
  try {
    const d = ts.toDate();
    if (isToday(d)) return format(d, 'h:mm a');
    if (isYesterday(d)) return `Yesterday ${format(d, 'h:mm a')}`;
    return format(d, 'MMM d, h:mm a');
  } catch { return ''; }
}

type DateGroup = { label: string; messages: Message[] };

function buildGroups(messages: Message[]): DateGroup[] {
  const groups: DateGroup[] = [];
  for (const msg of messages) {
    let label = '';
    const d = msg.createdAt?.toDate?.();
    if (d) {
      if (isToday(d)) label = 'Today';
      else if (isYesterday(d)) label = 'Yesterday';
      else label = format(d, 'MMMM d, yyyy');
    }
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.messages.push(msg);
    else groups.push({ label, messages: [msg] });
  }
  return groups;
}

// ── Media bubble ──
function MediaBubble({ mediaUrl, mediaType }: { mediaUrl: string; mediaType: 'image' | 'video' }) {
  if (mediaType === 'video') {
    return (
      <div className="rounded-xl overflow-hidden bg-black max-w-[260px]">
        <video
          src={mediaUrl}
          className="w-full max-h-[200px] object-contain"
          controls
          preload="metadata"
          playsInline
        />
      </div>
    );
  }
  return (
    <div className="relative rounded-xl overflow-hidden max-w-[260px]">
      <Image
        src={mediaUrl}
        alt="Sent image"
        width={260}
        height={260}
        className="object-cover w-full"
        unoptimized
      />
    </div>
  );
}

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const { firestore, storage, user } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();

  const convRef = useMemoFirebase(() => doc(firestore, 'conversations', id), [firestore, id]);
  const { data: conv, isLoading: convLoading } = useDoc<Conversation>(convRef);

  const canRead = !!user && !!conv && conv.participants.includes(user.uid);
  const msgsQuery = useMemoFirebase(
    () => canRead
      ? query(collection(firestore, 'conversations', id, 'messages'), orderBy('createdAt', 'asc'), limit(300))
      : null,
    [firestore, id, canRead],
  );
  const { data: messages, isLoading: msgsLoading } = useCollection<Message>(msgsQuery);

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Media state
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaPreviewUrl = useRef<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const markedReadRef = useRef(false);

  // Group management state
  const [showRename, setShowRename] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState('');
  const [addMemberResults, setAddMemberResults] = useState<{ id: string; username: string; profilePictureUrl?: string; avatarConfig?: AvatarConfig }[]>([]);
  const [addMemberSearching, setAddMemberSearching] = useState(false);
  const [addingMemberId, setAddingMemberId] = useState<string | null>(null);

  useEffect(() => {
    if (!msgsLoading) {
      bottomRef.current?.scrollIntoView({ behavior: messages && messages.length > 1 ? 'smooth' : 'auto' });
    }
  }, [messages, msgsLoading]);

  useEffect(() => {
    if (!user || !conv || !id || markedReadRef.current) return;
    const unread = conv.unreadCounts?.[user.uid] ?? 0;
    if (unread > 0) {
      markedReadRef.current = true;
      updateDoc(doc(firestore, 'conversations', id), {
        [`unreadCounts.${user.uid}`]: 0,
      }).catch(() => {});
    }
  }, [conv, user, id, firestore]);

  useEffect(() => { markedReadRef.current = false; }, [id]);

  // ── Media file selection ──
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Revoke previous object URL
    if (mediaPreviewUrl.current) URL.revokeObjectURL(mediaPreviewUrl.current);

    const isVideo = file.type.startsWith('video/');
    const url = URL.createObjectURL(file);
    mediaPreviewUrl.current = url;
    setMediaFile(file);
    setMediaPreview(url);
    setMediaType(isVideo ? 'video' : 'image');
    // Reset file input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const clearMedia = () => {
    if (mediaPreviewUrl.current) { URL.revokeObjectURL(mediaPreviewUrl.current); mediaPreviewUrl.current = null; }
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Upload media to Firebase Storage ──
  const uploadMedia = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const ext = file.name.split('.').pop() ?? 'bin';
      const path = `messages/${id}/${uuidv4()}.${ext}`;
      const fileRef = storageRef(storage, path);
      const task = uploadBytesResumable(fileRef, file, { contentType: file.type });
      task.on(
        'state_changed',
        (snap) => {
          setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 90));
        },
        reject,
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve(url);
        },
      );
    });
  };

  const handleRename = async () => {
    const name = renameValue.trim();
    if (!name || !conv) return;
    setRenaming(true);
    try {
      await updateDoc(doc(firestore, 'conversations', id), { name });
      setShowRename(false);
      toast({ title: 'Group renamed' });
    } catch {
      toast({ variant: 'destructive', title: 'Could not rename group' });
    } finally {
      setRenaming(false);
    }
  };

  const handleAddMemberSearch = async (val: string) => {
    setAddMemberSearch(val);
    if (!val.trim()) { setAddMemberResults([]); return; }
    setAddMemberSearching(true);
    try {
      const term = val.trim().toLowerCase();
      const highBound = term + String.fromCharCode(0xf8ff);
      const snap = await getDocs(query(
        collection(firestore, 'users'),
        where('username_lowercase', '>=', term),
        where('username_lowercase', '<=', highBound),
        limit(10),
      ));
      const existing = new Set(conv?.participants ?? []);
      setAddMemberResults(
        snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).filter(u => !existing.has(u.id))
      );
    } catch { setAddMemberResults([]); }
    finally { setAddMemberSearching(false); }
  };

  const handleAddMember = async (target: { id: string; username: string; profilePictureUrl?: string; avatarConfig?: AvatarConfig }) => {
    if (!conv) return;
    setAddingMemberId(target.id);
    try {
      await updateDoc(doc(firestore, 'conversations', id), {
        type: 'group',
        participants: arrayUnion(target.id),
        [`participantInfo.${target.id}`]: {
          username: target.username,
          profilePictureUrl: target.profilePictureUrl ?? null,
          avatarConfig: target.avatarConfig ?? null,
        },
        [`unreadCounts.${target.id}`]: 0,
        name: conv.name || conv.participants.map(p => conv.participantInfo?.[p]?.username).filter(Boolean).join(', '),
      });
      toast({ title: `@${target.username} added to the group` });
      setAddMemberResults(prev => prev.filter(u => u.id !== target.id));
    } catch {
      toast({ variant: 'destructive', title: 'Could not add member' });
    } finally {
      setAddingMemberId(null);
    }
  };

  const handleLeaveGroup = async () => {
    if (!user || !conv) return;
    setLeaving(true);
    try {
      const update: Record<string, any> = {
        participants: arrayRemove(user.uid),
        [`participantInfo.${user.uid}`]: deleteField(),
        [`unreadCounts.${user.uid}`]: deleteField(),
      };
      await updateDoc(doc(firestore, 'conversations', id), update);
      toast({ title: 'You left the group' });
      router.push('/messages');
    } catch {
      toast({ variant: 'destructive', title: 'Could not leave group' });
    } finally {
      setLeaving(false);
    }
  };

  const handleDelete = async () => {
    if (!conv) return;
    setDeleting(true);
    try {
      const msgsSnap = await getDocs(collection(firestore, 'conversations', id, 'messages'));
      for (let i = 0; i < msgsSnap.docs.length; i += 500) {
        const batch = writeBatch(firestore);
        msgsSnap.docs.slice(i, i + 500).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      await deleteDoc(doc(firestore, 'conversations', id));
      toast({ title: 'Conversation deleted' });
      router.push('/messages');
    } catch {
      toast({ variant: 'destructive', title: 'Could not delete conversation' });
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if ((!trimmed && !mediaFile) || !user || !conv || sending) return;
    setSending(true);
    setText('');
    setUploadProgress(null);

    const myInfo = conv.participantInfo?.[user.uid];
    const capturedFile = mediaFile;
    const capturedMediaType = mediaType;
    clearMedia();

    try {
      let uploadedUrl: string | null = null;

      if (capturedFile) {
        setUploadProgress(0);
        uploadedUrl = await uploadMedia(capturedFile);
        setUploadProgress(100);
      }

      const msgData: Record<string, any> = {
        senderId: user.uid,
        senderUsername: myInfo?.username ?? 'Unknown',
        senderProfilePictureUrl: myInfo?.profilePictureUrl ?? null,
        senderAvatarConfig: myInfo?.avatarConfig ?? null,
        text: trimmed,
        createdAt: serverTimestamp(),
      };
      if (uploadedUrl) {
        msgData.mediaUrl = uploadedUrl;
        msgData.mediaType = capturedMediaType;
      }

      await addDoc(collection(firestore, 'conversations', id, 'messages'), msgData);

      // Build last-message preview
      let lastMessage = trimmed;
      if (!lastMessage && capturedMediaType) {
        lastMessage = capturedMediaType === 'video' ? '🎬 Video' : '📸 Photo';
      } else if (lastMessage.length > 80) {
        lastMessage = lastMessage.slice(0, 80) + '…';
      }

      const update: Record<string, any> = {
        lastMessage,
        lastMessageAt: serverTimestamp(),
        lastMessageSenderId: user.uid,
      };
      conv.participants.forEach(pid => {
        if (pid !== user.uid) {
          update[`unreadCounts.${pid}`] = (conv.unreadCounts?.[pid] ?? 0) + 1;
        }
      });
      await updateDoc(doc(firestore, 'conversations', id), update);

      // Keyword auto-responder — only fires in a DM with the CYBAZONE system account, and only
      // when the sender isn't CYBAZONE itself (avoids replying to its own auto-replies).
      if (trimmed) {
        const cybazoneId = conv.participants.find(pid => conv.participantInfo?.[pid]?.username?.toLowerCase() === 'cybazone');
        if (cybazoneId && cybazoneId !== user.uid) {
          try {
            const respSnap = await getDoc(doc(firestore, 'settings', 'keywordResponders'));
            const matched = matchKeywordResponder(trimmed, respSnap.data()?.responders);
            if (matched) {
              const cyba = conv.participantInfo[cybazoneId];
              await addDoc(collection(firestore, 'conversations', id, 'messages'), {
                senderId: cybazoneId,
                senderUsername: cyba?.username ?? 'CYBAZONE',
                senderProfilePictureUrl: cyba?.profilePictureUrl ?? null,
                senderAvatarConfig: cyba?.avatarConfig ?? null,
                text: matched.reply,
                createdAt: serverTimestamp(),
              });
              await updateDoc(doc(firestore, 'conversations', id), {
                lastMessage: matched.reply.length > 80 ? matched.reply.slice(0, 80) + '…' : matched.reply,
                lastMessageAt: serverTimestamp(),
                lastMessageSenderId: cybazoneId,
                [`unreadCounts.${user.uid}`]: (conv.unreadCounts?.[user.uid] ?? 0) + 1,
              });
            }
          } catch {
            // Non-critical — never block the user's own message on auto-responder bookkeeping
          }
        }
      }
    } catch (e) {
      console.error('Send failed:', e);
      if (!capturedFile) setText(trimmed); // restore text only if no media upload
      toast({ variant: 'destructive', title: 'Failed to send message' });
    } finally {
      setSending(false);
      setUploadProgress(null);
      inputRef.current?.focus();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, mediaFile, mediaType, user, conv, sending, firestore, id]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // ── Loading ──
  if (convLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!conv) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center px-4">
        <p className="text-muted-foreground">Conversation not found.</p>
        <Button variant="outline" size="sm" asChild><Link href="/messages">← Back</Link></Button>
      </div>
    );
  }

  if (!user || !conv.participants.includes(user.uid)) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-destructive text-sm">You don&apos;t have access to this conversation.</p>
      </div>
    );
  }

  const isGroup = conv.type === 'group';
  const otherId = !isGroup ? conv.participants.find(p => p !== user.uid) ?? '' : '';
  const otherInfo = !isGroup ? conv.participantInfo?.[otherId] : null;
  const displayName = convDisplayName(conv, user.uid);
  const groups = buildGroups(messages ?? []);

  return (
    <div className="flex flex-col" style={{ height: '100%' }}>

      {/* ── Chat header ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-card/60 shrink-0">
        <Button variant="ghost" size="icon" className="sm:hidden h-8 w-8 rounded-full"
          onClick={() => router.push('/messages')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>

        {isGroup ? (
          <div className="relative w-9 h-9 shrink-0">
            {conv.participants.filter(p => p !== user.uid).slice(0, 2).map((uid, i) => (
              <div key={uid} className={cn(
                'absolute w-6 h-6 rounded-full border-2 border-background overflow-hidden',
                i === 0 ? 'top-0 left-0' : 'bottom-0 right-0',
              )}>
                <AvatarDisplay
                  profilePictureUrl={conv.participantInfo?.[uid]?.profilePictureUrl ?? undefined}
                  avatarConfig={conv.participantInfo?.[uid]?.avatarConfig ?? undefined}
                  size={24}
                />
              </div>
            ))}
          </div>
        ) : (
          <Link href={`/u/${otherInfo?.username}`} className="shrink-0">
            <AvatarDisplay
              profilePictureUrl={otherInfo?.profilePictureUrl ?? undefined}
              avatarConfig={otherInfo?.avatarConfig ?? undefined}
              size={36}
            />
          </Link>
        )}

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">
            {isGroup && <Users className="h-3.5 w-3.5 inline mr-1.5 text-muted-foreground" />}
            {displayName}
          </p>
          {isGroup ? (
            <p className="text-xs text-muted-foreground">
              {conv.participants.length} members ·{' '}
              {conv.participants.map(p => conv.participantInfo?.[p]?.username).filter(Boolean).join(', ')}
            </p>
          ) : (
            <Link href={`/u/${otherInfo?.username}`} className="text-xs text-muted-foreground hover:text-primary transition-colors">
              @{otherInfo?.username}
            </Link>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full shrink-0 text-muted-foreground hover:text-foreground">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isGroup && (
              <DropdownMenuItem onClick={() => { setRenameValue(conv.name ?? ''); setShowRename(true); }}>
                <Pencil className="h-4 w-4 mr-2" /> Rename Group
              </DropdownMenuItem>
            )}
            {isGroup && (
              <DropdownMenuItem onClick={() => setShowAddMembers(true)}>
                <UserPlus className="h-4 w-4 mr-2" /> Add Members
              </DropdownMenuItem>
            )}
            {isGroup && (
              <DropdownMenuItem onClick={handleLeaveGroup} disabled={leaving} className="text-yellow-500 focus:text-yellow-500">
                <LogOut className="h-4 w-4 mr-2" /> Leave Group
              </DropdownMenuItem>
            )}
            {isGroup && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={() => setShowDeleteConfirm(true)} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" /> Delete Conversation
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── Rename dialog ── */}
      <Dialog open={showRename} onOpenChange={setShowRename}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Rename Group</DialogTitle></DialogHeader>
          <Input
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            maxLength={50}
            placeholder="Group name…"
            onKeyDown={e => { if (e.key === 'Enter') handleRename(); }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowRename(false)}>Cancel</Button>
            <Button onClick={handleRename} disabled={renaming || !renameValue.trim()}>
              {renaming ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add members dialog ── */}
      <Dialog open={showAddMembers} onOpenChange={v => { setShowAddMembers(v); if (!v) { setAddMemberSearch(''); setAddMemberResults([]); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Members</DialogTitle></DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={addMemberSearch}
              onChange={e => handleAddMemberSearch(e.target.value)}
              placeholder="Search by username…"
              className="pl-9"
              autoFocus
            />
          </div>
          <div className="min-h-[60px] max-h-64 overflow-y-auto space-y-1">
            {addMemberSearching ? (
              <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            ) : addMemberResults.length > 0 ? (
              addMemberResults.map(u => (
                <button key={u.id} onClick={() => handleAddMember(u)} disabled={addingMemberId === u.id}
                  className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/60 disabled:opacity-60"
                >
                  <AvatarDisplay profilePictureUrl={u.profilePictureUrl} avatarConfig={u.avatarConfig} size={32} />
                  <span className="text-sm font-semibold flex-1 truncate">@{u.username}</span>
                  {addingMemberId === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4 text-muted-foreground" />}
                </button>
              ))
            ) : addMemberSearch ? (
              <p className="text-center text-sm text-muted-foreground py-6">No users found</p>
            ) : (
              <p className="text-center text-xs text-muted-foreground py-6">Type a username to search</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation dialog ── */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Conversation?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete all messages for everyone. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Messages area ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {msgsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !messages || messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-16 text-center">
            {isGroup
              ? <Users className="h-12 w-12 text-muted-foreground/30" />
              : <UserCircle className="h-12 w-12 text-muted-foreground/30" />
            }
            <p className="text-sm font-medium">{isGroup ? displayName : `@${displayName}`}</p>
            <p className="text-xs text-muted-foreground">
              {isGroup ? `${conv.participants.length} members · ` : ''}Say hello! 👋
            </p>
          </div>
        ) : (
          <>
            {groups.map((group, gi) => (
              <div key={gi}>
                {group.label && (
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-border/40" />
                    <span className="text-[11px] font-medium text-muted-foreground bg-background/60 px-2 py-0.5 rounded-full border border-border/40">
                      {group.label}
                    </span>
                    <div className="flex-1 h-px bg-border/40" />
                  </div>
                )}

                <div className="space-y-0.5">
                  {group.messages.map((msg, i) => {
                    const isMe = msg.senderId === user.uid;
                    const prevMsg = group.messages[i - 1];
                    const nextMsg = group.messages[i + 1];
                    const isFirstInRun = !prevMsg || prevMsg.senderId !== msg.senderId;
                    const isLastInRun = !nextMsg || nextMsg.senderId !== msg.senderId;
                    const hasMedia = !!msg.mediaUrl && !!msg.mediaType;
                    const hasText = !!msg.text;

                    return (
                      <div key={msg.id} className={cn(
                        'flex gap-2',
                        isMe ? 'flex-row-reverse' : 'flex-row',
                        isFirstInRun ? 'mt-3' : 'mt-0.5',
                      )}>
                        {/* Sender avatar */}
                        <div className="w-8 shrink-0 flex items-end">
                          {!isMe && isLastInRun && (
                            <AvatarDisplay
                              profilePictureUrl={msg.senderProfilePictureUrl ?? undefined}
                              avatarConfig={msg.senderAvatarConfig ?? undefined}
                              size={28}
                            />
                          )}
                        </div>

                        <div className={cn('flex flex-col max-w-[72%] sm:max-w-[60%]', isMe ? 'items-end' : 'items-start')}>
                          {!isMe && isGroup && isFirstInRun && (
                            <span className="text-[11px] font-semibold text-muted-foreground mb-1 ml-3">
                              @{msg.senderUsername}
                            </span>
                          )}

                          {/* Shared post preview */}
                          {msg.sharedPost && (
                            <Link
                              href={`/u/${msg.sharedPost.authorUsername}`}
                              className="flex items-center gap-2.5 rounded-2xl border border-border/50 bg-muted/40 hover:bg-muted/60 transition-colors px-3 py-2 mb-1 max-w-full"
                            >
                              {msg.sharedPost.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={msg.sharedPost.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                              ) : (
                                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                  <Send className="w-4 h-4 text-primary/50" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-[11px] font-semibold text-muted-foreground">@{msg.sharedPost.authorUsername}&apos;s post</p>
                                <p className="text-xs truncate">{msg.sharedPost.contentSnippet || 'Tap to view'}</p>
                              </div>
                            </Link>
                          )}

                          {/* Shared Pulse preview */}
                          {msg.sharedPulse && (
                            <Link
                              href={`/u/${msg.sharedPulse.authorUsername}`}
                              className="flex items-center gap-2.5 rounded-2xl border border-purple-500/40 bg-purple-950/20 hover:bg-purple-950/30 transition-colors px-3 py-2 mb-1 max-w-full"
                            >
                              <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-black">
                                {msg.sharedPulse.mediaType === 'video' ? (
                                  <video src={msg.sharedPulse.mediaUrl} className="w-full h-full object-cover" muted />
                                ) : (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={msg.sharedPulse.mediaUrl} alt="" className="w-full h-full object-cover" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-[11px] font-semibold text-purple-300">✨ @{msg.sharedPulse.authorUsername}&apos;s Pulse</p>
                                <p className="text-xs text-muted-foreground">Tap to view their profile</p>
                              </div>
                            </Link>
                          )}

                          {/* Media bubble (no background wrapper) */}
                          {hasMedia && (
                            <div className={cn(
                              'overflow-hidden',
                              isFirstInRun ? 'rounded-2xl' : isMe ? 'rounded-l-2xl rounded-r-sm' : 'rounded-r-2xl rounded-l-sm',
                              hasText ? 'mb-1' : '',
                            )}>
                              <MediaBubble
                                mediaUrl={msg.mediaUrl!}
                                mediaType={msg.mediaType as 'image' | 'video'}
                              />
                            </div>
                          )}

                          {/* Text bubble */}
                          {hasText && (
                            <div className={cn(
                              'px-3.5 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap',
                              isMe
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'bg-muted/80 text-foreground border border-border/40',
                              isMe ? (
                                isFirstInRun && isLastInRun ? 'rounded-2xl rounded-br-sm' :
                                isFirstInRun ? 'rounded-2xl rounded-br-sm' :
                                isLastInRun ? 'rounded-2xl rounded-tr-sm rounded-br-sm' :
                                'rounded-l-2xl rounded-r-sm'
                              ) : (
                                isFirstInRun && isLastInRun ? 'rounded-2xl rounded-bl-sm' :
                                isFirstInRun ? 'rounded-2xl rounded-bl-sm' :
                                isLastInRun ? 'rounded-2xl rounded-tl-sm rounded-bl-sm' :
                                'rounded-r-2xl rounded-l-sm'
                              ),
                            )}>
                              {linkifyText(msg.text, isMe)}
                            </div>
                          )}

                          {isLastInRun && (
                            <span className="text-[10px] text-muted-foreground mt-1 px-1">
                              {formatMsgTime(msg.createdAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div ref={bottomRef} className="h-1" />
          </>
        )}
      </div>

      {/* ── Input area ── */}
      <div className="px-4 pb-3 pt-2 border-t border-border/50 bg-card/60 shrink-0">

        {/* Media preview strip */}
        {mediaPreview && (
          <div className="mb-2 relative inline-block">
            {mediaType === 'video' ? (
              <video
                src={mediaPreview}
                className="h-24 w-auto max-w-[200px] rounded-xl object-cover border border-border/50 bg-black"
                preload="metadata"
                muted
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaPreview}
                alt="Preview"
                className="h-24 w-auto max-w-[200px] rounded-xl object-cover border border-border/50"
              />
            )}
            <button
              onClick={clearMedia}
              disabled={sending}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-background border border-border flex items-center justify-center hover:bg-muted transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
            {mediaType === 'video' && (
              <span className="absolute bottom-1.5 left-1.5 text-[10px] bg-black/70 text-white rounded px-1.5 py-0.5">
                🎬 Video
              </span>
            )}
          </div>
        )}

        {/* Upload progress bar */}
        {uploadProgress !== null && (
          <div className="mb-2 h-1 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-200"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={handleFileChange}
            disabled={sending}
          />

          {/* Attach button */}
          <Button
            variant="ghost"
            size="icon"
            type="button"
            disabled={sending}
            onClick={() => fileInputRef.current?.click()}
            className="h-[42px] w-[42px] rounded-full shrink-0 text-muted-foreground hover:text-foreground"
          >
            <ImagePlus className="h-5 w-5" />
          </Button>

          <textarea
            ref={inputRef}
            value={text}
            onChange={e => {
              setText(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${isGroup ? displayName : `@${displayName}`}…`}
            rows={1}
            disabled={sending}
            enterKeyHint="send"
            className="flex-1 resize-none rounded-2xl bg-muted/70 border border-border/50 px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground overflow-hidden disabled:opacity-60 touch-manipulation"
            style={{ lineHeight: '1.5', minHeight: '42px', maxHeight: '120px', fontSize: '16px' }}
          />

          <Button
            size="icon"
            className="rounded-full h-[42px] w-[42px] shrink-0"
            disabled={(!text.trim() && !mediaFile) || sending}
            onClick={handleSend}
          >
            {sending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Send className="h-4 w-4" />
            }
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground/50 mt-1.5 text-center select-none">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
