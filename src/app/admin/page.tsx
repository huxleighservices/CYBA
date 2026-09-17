'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import {
  Shield, PlusCircle, Trash2, Edit, Loader2, Ban, CheckCircle, AlertTriangle, Download,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import {
  useFirebase, useCollection, useDoc, useMemoFirebase,
  setDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking,
} from '@/firebase';
import {
  collection, doc, serverTimestamp, query, where, orderBy,
  writeBatch, getDocs, getDoc, updateDoc, deleteDoc, setDoc, limit, addDoc, increment,
} from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
  DialogTrigger, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { avatarOptions } from '@/lib/avatar-assets';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { WHEEL_PRIZES } from '@/lib/wheel';
import { QUESTS, type CustomQuest, type QuestSubmission } from '@/lib/quests';
import { DEFAULT_CC_RATES, mergeWithDefaults, type CCRates, type CCRatesByLevel } from '@/lib/cc-rewards';
import { DEFAULT_LEVEL_THRESHOLDS, type LevelThresholds } from '@/lib/levels';
import { sendSystemDM } from '@/lib/system-dm';
import { CC_BUNDLE_ORDER, DEFAULT_CC_BUNDLES, type CcBundlesConfig } from '@/lib/cybacoin-bundles';
import type { KeywordResponder } from '@/lib/keyword-responders';
import {
  DEFAULT_BOOST_SUBSCRIPTION_RATES, BOOST_SUBSCRIPTION_TYPES, MARKET_TIER_EXTRA_RATE, DEFAULT_RADIO_EXTRA_SLOT_COST_CC,
  type BoostSubscriptionRates, type BoostSubscriptionType, type BoostSubscriptionDescriptions, type MarketBoostTier,
} from '@/lib/boost-subscriptions';
import { DEFAULT_AD_DROP_CONFIG, AD_TIER_ORDER, type AdDropConfig, type AdDoc, type AdTierKey } from '@/lib/ad-drop';
import { logTransaction, logCashTransaction } from '@/lib/transactions';
import { createNotification } from '@/lib/notifications';
import { useRouter } from 'next/navigation';
import type { AccessoryStyle, AccessoryUnlock } from '@/lib/avatar3d-config';
import { ACCESSORY_OPTIONS, ACCESSORY_DEFAULTS } from '@/lib/avatar3d-config';

const ADMIN_EMAILS = ['contactcyba@gmail.com', 'z1mmerman@yahoo.com'];

// ─────────────────────────────────────────────
//  Schemas
// ─────────────────────────────────────────────
const shopItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  price: z.coerce.number().min(0),
  cybaCoinPrice: z.coerce.number().min(0).optional(),
  imageUrl: z.string().url().or(z.literal('')),
  buyNowUrl: z.string().url().or(z.literal('')),
  stockQuantity: z.coerce.number().int().min(0),
});

const membershipSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  price: z.coerce.number().min(0),
  features: z.string().min(1),
  buttonText: z.string().min(1),
  buttonLink: z.string().min(1),
});

const extraSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  price: z.coerce.number().min(0),
  priceCurrency: z.enum(['usd', 'cc']).default('usd'),
  cybaCoinPrice: z.coerce.number().min(0).optional(),
  features: z.string().min(1),
  buttonText: z.string().min(1),
  buttonLink: z.string().min(1),
  cancelLink: z.string().optional(),
  type: z.enum(['boost', 'reward']),
  order: z.number().optional(),
  requiresSubmission: z.boolean().default(false),
  submissionPayoutType: z.enum(['none', 'cybacoin', 'cash']).default('none'),
  submissionPayoutAmount: z.coerce.number().min(0).optional(),
});

// ─────────────────────────────────────────────
//  User Management (with Ban)
// ─────────────────────────────────────────────
const ALL_ADMIN_TABS = [
  { value: 'users',        label: '👥 Users' },
  { value: 'posts',        label: '🔍 Post Audit' },
  { value: 'wheel',        label: '🎡 Wheel' },
  { value: 'quests',       label: '🗺️ Quests' },
  { value: 'submissions',  label: '📥 Submissions' },
  { value: 'cashouts',     label: '💸 Cash Outs' },
  { value: 'weeklypayout', label: '🏆 Weekly Payout' },
  { value: 'reviews',      label: '⭐ Reviews' },
  { value: 'market',       label: '🛒 Market' },
  { value: 'radio',        label: '📻 Radio' },
  { value: 'shoutouts',    label: '⚡ Shoutouts' },
  { value: 'curator',      label: '🎬 Curator' },
  { value: 'boosts',       label: '🚀 Boosts' },
  { value: 'rewards',      label: '🎁 Rewards' },
  { value: 'shop',         label: '🛍️ Merch' },
  { value: 'memberships',  label: '🏆 Tiers' },
  { value: 'avatars',      label: '🎨 Avatars' },
  { value: 'levels',       label: '🏅 Levels' },
  { value: 'ccrates',      label: '💰 CC Rates' },
  { value: 'ccsubs',       label: '📅 CC Subs' },
  { value: 'addrop',       label: '📢 PROMO BLAST' },
  { value: 'faq',          label: '❓ FAQ' },
  { value: 'messaging',    label: '📨 Mass Message' },
];

function AdminAccessDialog({ userId, username, currentTabs }: { userId: string; username: string; currentTabs: string[] }) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(currentTabs);
  const [saving, setSaving] = useState(false);

  const toggle = (val: string) =>
    setSelected(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(firestore, 'users', userId), {
        adminAccess: selected.length > 0 ? { tabs: selected } : null,
      });
      toast({ title: 'Admin access updated', description: selected.length === 0 ? 'Access removed.' : `${selected.length} tab(s) granted.` });
      setOpen(false);
    } catch {
      toast({ variant: 'destructive', title: 'Failed to update access' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (v) setSelected(currentTabs); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={`text-xs ${currentTabs.length > 0 ? 'border-cyan-600 text-cyan-400 hover:bg-cyan-950' : ''}`}>
          {currentTabs.length > 0 ? `🔐 ${currentTabs.length} tab${currentTabs.length > 1 ? 's' : ''}` : '🔐 Access'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Admin Access — @{username}</DialogTitle>
          <DialogDescription>Check the tabs this member can access in the admin panel. Uncheck all to revoke admin access.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 py-2 max-h-72 overflow-y-auto pr-1">
          {ALL_ADMIN_TABS.map(tab => (
            <label key={tab.value} className="flex items-center gap-2 cursor-pointer rounded-lg border border-border/40 px-3 py-2 hover:bg-muted/30 transition-colors">
              <input
                type="checkbox"
                checked={selected.includes(tab.value)}
                onChange={() => toggle(tab.value)}
                className="accent-primary"
              />
              <span className="text-xs">{tab.label}</span>
            </label>
          ))}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSelected([])}>Clear All</Button>
          <Button variant="outline" size="sm" onClick={() => setSelected(ALL_ADMIN_TABS.map(t => t.value))}>Grant All</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UserManagement() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const usersRef = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: users, isLoading } = useCollection<{
    username: string; email: string; membershipTier?: string; levelOverride?: string; instagramHandle?: string; banned?: boolean; cybaCoinBalance?: number; payoutBalance?: number; payoutEnrolled?: boolean; cashApp?: string; venmo?: string; spotlightBoost?: boolean; marketBoost?: boolean; radioBoost?: boolean; isCurator?: boolean; adminAccess?: { tabs: string[] };
  }>(usersRef);

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    const q = search.toLowerCase().trim();
    if (!q) return users;
    return users.filter(u =>
      u.username?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
    );
  }, [users, search]);

  const membershipsRef = useMemoFirebase(() => collection(firestore, 'memberships'), [firestore]);
  const { data: memberships } = useCollection<{ name: string }>(membershipsRef);

  const handleTierChange = (userId: string, tierName: string) => {
    setDocumentNonBlocking(doc(firestore, 'users', userId), { membershipTier: tierName }, { merge: true });
  };

  // Level override is a separate concept from membershipTier ("Tier" — Zone Pass, from Stripe).
  // This manually forces a user's computed Level (Spark/Charge/Surge/Storm) for CC-rate purposes.
  const handleLevelOverrideChange = (userId: string, level: string) => {
    setDocumentNonBlocking(doc(firestore, 'users', userId), { levelOverride: level }, { merge: true });
  };

  const handlePayoutToggle = async (userId: string, currentlyEnrolled: boolean) => {
    await updateDoc(doc(firestore, 'users', userId), { payoutEnrolled: !currentlyEnrolled });
    toast({ title: currentlyEnrolled ? 'Payout Boost removed' : 'Payout Boost enrolled' });
  };

  const handleSpotlightToggle = async (userId: string, current: boolean) => {
    await updateDoc(doc(firestore, 'users', userId), { spotlightBoost: !current });
    toast({ title: current ? 'Spotlight Boost off' : 'Spotlight Boost on' });
  };

  const handleMarketToggle = async (userId: string, current: boolean) => {
    await updateDoc(doc(firestore, 'users', userId), { marketBoost: !current });
    toast({ title: current ? 'Market Boost off' : 'Market Boost on' });
  };

  const handleRadioToggle = async (userId: string, current: boolean) => {
    await updateDoc(doc(firestore, 'users', userId), { radioBoost: !current });
    toast({ title: current ? 'Radio Boost off' : 'Radio Boost on' });
  };

  const handleCuratorToggle = async (userId: string, current: boolean) => {
    await updateDoc(doc(firestore, 'users', userId), { isCurator: !current });
    toast({ title: current ? 'Curator removed' : 'Curator granted', description: current ? 'Posts will no longer glow green.' : 'Posts will now glow green in Central.' });
  };

  const handleBanToggle = async (userId: string, currentlyBanned: boolean) => {
    await updateDoc(doc(firestore, 'users', userId), { banned: !currentlyBanned });
    toast({
      title: currentlyBanned ? 'User Unbanned' : 'User Banned',
      description: currentlyBanned ? 'User can access the site again.' : 'User has been banned.',
    });
  };

  const handleCoinAdjust = async (userId: string, amount: number) => {
    const userRef = doc(firestore, 'users', userId);
    const userSnap = await getDocs(query(collection(firestore, 'users'), where('id', '==', userId), limit(1)));
    if (!userSnap.empty) {
      await updateDoc(userRef, { cybaCoinBalance: amount });
      toast({ title: 'Balance updated', description: `Set to ${amount} CYBACOIN.` });
    }
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle>User Management</CardTitle>
            <CardDescription>
              {users?.length ?? 0} member{users?.length !== 1 ? 's' : ''} · Manage tiers, balances, and access.
            </CardDescription>
          </div>
          <Input
            placeholder="Search username or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-64 h-8 text-sm"
          />
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Instagram</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>CC Balance</TableHead>
              <TableHead>Cash Balance</TableHead>
              <TableHead>Cash App</TableHead>
              <TableHead>Venmo</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Level Override</TableHead>
              <TableHead>Payout</TableHead>
              <TableHead>Spotlight</TableHead>
              <TableHead>Market</TableHead>
              <TableHead>Radio</TableHead>
              <TableHead>Curator</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow key={user.id} className={user.banned ? 'opacity-50' : ''}>
                <TableCell className="font-medium">
                  <Link href={`/u/${user.username}`} className="hover:underline text-primary">
                    {user.username}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {user.instagramHandle ? `@${user.instagramHandle}` : '—'}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{user.email}</TableCell>
                <TableCell>
                  <CoinEditor userId={user.id} current={user.cybaCoinBalance ?? 0} />
                </TableCell>
                <TableCell>
                  <CashEditor userId={user.id} current={user.payoutBalance ?? 0} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  <PayoutMethodEditor userId={user.id} current={user.cashApp ?? ''} field="cashApp" color="text-green-400" placeholder="$cashtag" />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  <PayoutMethodEditor userId={user.id} current={user.venmo ?? ''} field="venmo" color="text-blue-400" placeholder="@venmo-handle" />
                </TableCell>
                <TableCell>
                  <Select value={user.membershipTier || ''} onValueChange={(v) => handleTierChange(user.id, v)}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=" ">None</SelectItem>
                      {memberships?.map((t) => (
                        <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={user.levelOverride || ''} onValueChange={(v) => handleLevelOverrideChange(user.id, v)}>
                    <SelectTrigger className="w-28">
                      <SelectValue placeholder="Auto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=" ">Auto</SelectItem>
                      <SelectItem value="spark">⚡ Spark</SelectItem>
                      <SelectItem value="charge">🔋 Charge</SelectItem>
                      <SelectItem value="surge">🌊 Surge</SelectItem>
                      <SelectItem value="storm">⛈️ Storm</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" onClick={() => handlePayoutToggle(user.id, !!user.payoutEnrolled)}
                    className={user.payoutEnrolled ? 'border-green-600 text-green-400 hover:bg-green-950 text-xs' : 'text-xs'}>
                    {user.payoutEnrolled ? '🏦 On' : 'Off'}
                  </Button>
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" onClick={() => handleSpotlightToggle(user.id, !!user.spotlightBoost)}
                    className={user.spotlightBoost ? 'border-purple-600 text-purple-400 hover:bg-purple-950 text-xs' : 'text-xs'}>
                    {user.spotlightBoost ? '⭐ On' : 'Off'}
                  </Button>
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" onClick={() => handleMarketToggle(user.id, !!user.marketBoost)}
                    className={user.marketBoost ? 'border-blue-600 text-blue-400 hover:bg-blue-950 text-xs' : 'text-xs'}>
                    {user.marketBoost ? '🛒 On' : 'Off'}
                  </Button>
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" onClick={() => handleRadioToggle(user.id, !!user.radioBoost)}
                    className={user.radioBoost ? 'border-amber-600 text-amber-400 hover:bg-amber-950 text-xs' : 'text-xs'}>
                    {user.radioBoost ? '📻 On' : 'Off'}
                  </Button>
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" onClick={() => handleCuratorToggle(user.id, !!user.isCurator)}
                    className={user.isCurator ? 'border-green-600 text-green-400 hover:bg-green-950 text-xs' : 'text-xs'}>
                    {user.isCurator ? '🟢 On' : 'Off'}
                  </Button>
                </TableCell>
                <TableCell>
                  <AdminAccessDialog
                    userId={user.id}
                    username={user.username ?? ''}
                    currentTabs={user.adminAccess?.tabs ?? []}
                  />
                </TableCell>
                <TableCell>
                  {user.banned
                    ? <Badge variant="destructive">Banned</Badge>
                    : <Badge variant="outline" className="text-green-400 border-green-600">Active</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant={user.banned ? 'outline' : 'destructive'}
                    size="sm"
                    onClick={() => handleBanToggle(user.id, !!user.banned)}
                    className={!user.banned ? '' : 'border-green-600 text-green-400 hover:bg-green-950'}
                  >
                    {user.banned ? <><CheckCircle className="w-4 h-4 mr-1" />Unban</> : <><Ban className="w-4 h-4 mr-1" />Ban</>}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function CoinEditor({ userId, current }: { userId: string; current: number }) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(current);

  const save = async () => {
    await updateDoc(doc(firestore, 'users', userId), { cybaCoinBalance: val });
    toast({ title: 'Balance updated' });
    setEditing(false);
  };

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-yellow-400 hover:underline text-sm tabular-nums">
        <Image src="/CCoin.png?v=2" alt="" width={12} height={12} />
        {current.toLocaleString()}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <Input type="number" value={val} onChange={e => setVal(Number(e.target.value))} className="w-24 h-7 text-sm" />
      <Button size="sm" className="h-7 px-2" onClick={save}>✓</Button>
      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditing(false)}>✕</Button>
    </div>
  );
}

function CashEditor({ userId, current }: { userId: string; current: number }) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(current);

  const save = async () => {
    await updateDoc(doc(firestore, 'users', userId), { payoutBalance: val });
    toast({ title: 'Cash balance updated' });
    setEditing(false);
  };

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="text-green-400 hover:underline text-sm tabular-nums">
        ${current.toFixed(2)}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <Input type="number" step="0.01" min="0" value={val} onChange={e => setVal(Number(e.target.value))} className="w-24 h-7 text-sm" />
      <Button size="sm" className="h-7 px-2" onClick={save}>✓</Button>
      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditing(false)}>✕</Button>
    </div>
  );
}

function PayoutMethodEditor({
  userId, current, field, color, placeholder,
}: { userId: string; current: string; field: 'cashApp' | 'venmo'; color: string; placeholder: string }) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(current);

  const save = async () => {
    await updateDoc(doc(firestore, 'users', userId), { [field]: val.trim() });
    toast({ title: `${field === 'cashApp' ? 'Cash App' : 'Venmo'} updated` });
    setEditing(false);
  };

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="text-sm hover:underline">
        {current ? <span className={color}>{current}</span> : <span className="text-muted-foreground/40">—</span>}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <Input value={val} onChange={e => setVal(e.target.value)} placeholder={placeholder} className="w-28 h-7 text-sm" />
      <Button size="sm" className="h-7 px-2" onClick={save}>✓</Button>
      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditing(false)}>✕</Button>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Post Audit
// ─────────────────────────────────────────────
function PostAudit() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const postsQuery = useMemoFirebase(
    () => query(collection(firestore, 'cybazone_posts'), orderBy('timestamp', 'desc'), limit(200)),
    [firestore]
  );
  const { data: posts, isLoading } = useCollection<{
    authorUsername: string; authorId: string; content: string;
    timestamp: any; likeCount: number; commentCount: number; imageUrl?: string;
  }>(postsQuery);

  const filtered = useMemo(() => {
    if (!search.trim()) return posts;
    const q = search.toLowerCase();
    return posts?.filter(p =>
      p.authorUsername?.toLowerCase().includes(q) ||
      p.content?.toLowerCase().includes(q)
    );
  }, [posts, search]);

  const handleDelete = async (postId: string, authorId: string) => {
    if (!confirm('Permanently delete this post and all its comments?')) return;
    setDeleting(postId);
    try {
      const commentsSnap = await getDocs(collection(firestore, 'cybazone_posts', postId, 'comments'));
      const batch = writeBatch(firestore);
      commentsSnap.forEach(d => batch.delete(d.ref));
      batch.delete(doc(firestore, 'cybazone_posts', postId));
      await batch.commit();
      sendSystemDM(
        firestore,
        authorId,
        'We have removed your post because it goes against our community guidelines. If you feel this was done in error, please message us.',
      ).catch(() => {});
      toast({ title: 'Post deleted' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Delete failed' });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Post Audit</CardTitle>
        <CardDescription>View and delete any post from any user. Showing latest 200.</CardDescription>
      </CardHeader>
      <CardContent>
        <Input
          placeholder="Filter by username or content..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="mb-4 max-w-sm"
        />
        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Author</TableHead>
                <TableHead>Content</TableHead>
                <TableHead>Stats</TableHead>
                <TableHead>Time</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered?.map((post) => (
                <TableRow key={post.id}>
                  <TableCell className="font-medium text-sm whitespace-nowrap">{post.authorUsername}</TableCell>
                  <TableCell className="max-w-xs">
                    <p className="text-sm text-muted-foreground truncate">{post.content}</p>
                    {post.imageUrl && (
                      <Badge variant="outline" className="text-xs mt-1">has image</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    ♥ {post.likeCount ?? 0} · 💬 {post.commentCount ?? 0}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {post.timestamp?.toDate ? formatDistanceToNow(post.timestamp.toDate(), { addSuffix: true }) : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={deleting === post.id}
                      onClick={() => handleDelete(post.id, post.authorId)}
                    >
                      {deleting === post.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
//  CYBAWHEEL Management
// ─────────────────────────────────────────────
function WheelManagement() {
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const configRef = useMemoFirebase(() => doc(firestore, 'settings', 'wheelConfig'), [firestore]);
  const { data: config, isLoading } = useDoc<{ prizes: typeof WHEEL_PRIZES }>(configRef);

  const prizes = config?.prizes ?? WHEEL_PRIZES;
  const [localPrizes, setLocalPrizes] = useState(prizes);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocalPrizes(config?.prizes ?? WHEEL_PRIZES);
  }, [config]);

  const updatePrize = (idx: number, field: string, value: any) => {
    setLocalPrizes(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  };

  const save = async () => {
    setSaving(true);
    try {
      await setDoc(doc(firestore, 'settings', 'wheelConfig'), { prizes: localPrizes }, { merge: true });
      toast({ title: 'Wheel config saved!' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!confirm('Reset wheel to default prizes?')) return;
    await setDoc(doc(firestore, 'settings', 'wheelConfig'), { prizes: WHEEL_PRIZES }, { merge: true });
    toast({ title: 'Wheel reset to defaults' });
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle>CYBAWHEEL</CardTitle>
          <CardDescription>Customize the 10 prize segments. Coin values, labels, emojis, and how often each one hits (weight).</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={reset}>Reset Defaults</Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Save Wheel
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Segment</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Emoji</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Weight</TableHead>
              <TableHead>Color</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {localPrizes.map((prize, i) => (
              <TableRow key={prize.id}>
                <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{prize.type}</Badge>
                </TableCell>
                <TableCell>
                  <Input value={prize.label} onChange={e => updatePrize(i, 'label', e.target.value)} className="w-16 h-7 text-sm" />
                </TableCell>
                <TableCell>
                  <Input value={prize.emoji} onChange={e => updatePrize(i, 'emoji', e.target.value)} className="w-14 h-7 text-sm" />
                </TableCell>
                <TableCell>
                  <Input value={prize.description} onChange={e => updatePrize(i, 'description', e.target.value)} className="w-48 h-7 text-sm" />
                </TableCell>
                <TableCell>
                  {prize.type === 'coins' ? (
                    <Input type="number" value={prize.value ?? ''} onChange={e => updatePrize(i, 'value', Number(e.target.value))} className="w-16 h-7 text-sm" />
                  ) : (
                    <span className="text-xs text-muted-foreground">{prize.value ?? '—'}</span>
                  )}
                </TableCell>
                <TableCell>
                  <Input type="number" min={0} value={prize.weight ?? 1} onChange={e => updatePrize(i, 'weight', Number(e.target.value))} className="w-16 h-7 text-sm" title="Higher = more common" />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <input type="color" value={prize.color} onChange={e => updatePrize(i, 'color', e.target.value)} className="w-8 h-7 rounded cursor-pointer border border-border" />
                    <span className="text-xs text-muted-foreground">{prize.color}</span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
//  CYBAQuests Management
// ─────────────────────────────────────────────
function QuestManagement() {
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const configRef = useMemoFirebase(() => doc(firestore, 'settings', 'questConfig'), [firestore]);
  const { data: config, isLoading } = useDoc<{ overrides: Record<string, any> }>(configRef);

  const [overrides, setOverrides] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [editQuestId, setEditQuestId] = useState<string | null>(null);

  useEffect(() => { setOverrides(config?.overrides ?? {}); }, [config]);

  const getOverride = (questId: string) => overrides[questId] ?? {};
  const setOverride = (questId: string, field: string, value: any) => {
    setOverrides(prev => ({ ...prev, [questId]: { ...prev[questId], [field]: value } }));
  };
  const setReqTarget = (questId: string, reqIdx: number, value: number) => {
    const existing = overrides[questId]?.requirementTargets ?? QUESTS.find(q => q.id === questId)!.requirements.map(r => r.target);
    const updated = [...existing];
    updated[reqIdx] = value;
    setOverride(questId, 'requirementTargets', updated);
  };

  const save = async () => {
    setSaving(true);
    try {
      await setDoc(doc(firestore, 'settings', 'questConfig'), { overrides }, { merge: true });
      toast({ title: 'Quest config saved!' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!confirm('Reset all quests to defaults?')) return;
    await setDoc(doc(firestore, 'settings', 'questConfig'), { overrides: {} });
    setOverrides({});
    toast({ title: 'Quests reset to defaults' });
  };

  const editingQuest = editQuestId ? QUESTS.find(q => q.id === editQuestId) : null;

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  return (
    <>
      <Dialog open={!!editQuestId} onOpenChange={open => !open && setEditQuestId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {editingQuest && (() => {
            const ov = getOverride(editingQuest.id);
            return (
              <>
                <DialogHeader>
                  <DialogTitle>Edit Quest: {editingQuest.nodeEmoji} {editingQuest.title}</DialogTitle>
                  <DialogDescription>Override any field. Leave unchanged to use the default value.</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div className="space-y-3 col-span-2 sm:col-span-1">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Title</label>
                      <Input value={ov.title ?? editingQuest.title} onChange={e => setOverride(editingQuest.id, 'title', e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Node Emoji</label>
                      <Input value={ov.nodeEmoji ?? editingQuest.nodeEmoji} onChange={e => setOverride(editingQuest.id, 'nodeEmoji', e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Difficulty</label>
                      <Select value={ov.difficulty ?? editingQuest.difficulty} onValueChange={v => setOverride(editingQuest.id, 'difficulty', v)}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['easy', 'medium', 'hard', 'legendary'].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">💰 Reward Coins</label>
                        <Input type="number" value={ov.rewardCoins ?? editingQuest.reward.coins} onChange={e => setOverride(editingQuest.id, 'rewardCoins', Number(e.target.value))} className="h-8 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">🏅 Reward Title</label>
                        <Input value={ov.rewardTitle ?? editingQuest.reward.title ?? ''} onChange={e => setOverride(editingQuest.id, 'rewardTitle', e.target.value)} className="h-8 text-sm" placeholder="optional" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">🎖 Reward Badge</label>
                      <Input value={ov.rewardBadge ?? editingQuest.reward.badge ?? ''} onChange={e => setOverride(editingQuest.id, 'rewardBadge', e.target.value)} className="h-8 text-sm" placeholder="optional" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Requirement Targets</label>
                      <div className="space-y-1">
                        {editingQuest.requirements.map((req, ri) => {
                          const targets = ov.requirementTargets ?? editingQuest.requirements.map(r => r.target);
                          return (
                            <div key={ri} className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-28 shrink-0">{req.icon} {req.label}</span>
                              <Input type="number" value={targets[ri]} onChange={e => setReqTarget(editingQuest.id, ri, Number(e.target.value))} className="h-7 text-sm" />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3 col-span-2 sm:col-span-1">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Description</label>
                      <Textarea value={ov.description ?? editingQuest.description} onChange={e => setOverride(editingQuest.id, 'description', e.target.value)} rows={3} className="text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Flavor Text</label>
                      <Textarea value={ov.flavorText ?? editingQuest.flavorText} onChange={e => setOverride(editingQuest.id, 'flavorText', e.target.value)} rows={3} className="text-sm" />
                    </div>
                  </div>
                </div>
                <DialogFooter className="mt-4">
                  <DialogClose asChild><Button variant="secondary">Done</Button></DialogClose>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>CYBAQuests</CardTitle>
            <CardDescription>Override any quest field. Click ✏️ to edit all details.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={reset}>Reset Defaults</Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Save All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {QUESTS.map(quest => {
              const ov = getOverride(quest.id);
              const targets = ov.requirementTargets ?? quest.requirements.map(r => r.target);
              const rewardCoins = ov.rewardCoins ?? quest.reward.coins;
              const hasOverrides = Object.keys(ov).length > 0;
              return (
                <div key={quest.id} className={cn('border rounded-lg p-4 space-y-3', hasOverrides ? 'border-primary/40 bg-primary/5' : 'border-border')}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{ov.nodeEmoji ?? quest.nodeEmoji} {ov.title ?? quest.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{ov.description ?? quest.description}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-xs">{ov.difficulty ?? quest.difficulty}</Badge>
                      {hasOverrides && <Badge variant="default" className="text-[10px]">modified</Badge>}
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setEditQuestId(quest.id)}>
                        <Edit className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {quest.requirements.map((req, ri) => (
                      <div key={ri}>
                        <label className="text-xs text-muted-foreground block mb-1">{req.icon} {req.label}</label>
                        <Input type="number" value={targets[ri]} onChange={e => setReqTarget(quest.id, ri, Number(e.target.value))} className="h-8 text-sm" />
                      </div>
                    ))}
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">💰 Reward CC</label>
                      <Input type="number" value={rewardCoins} onChange={e => setOverride(quest.id, 'rewardCoins', Number(e.target.value))} className="h-8 text-sm" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// ─────────────────────────────────────────────
//  Shared Extra Form (Boosts & Rewards)
// ─────────────────────────────────────────────
function ExtraForm({
  item,
  forcedType,
  existingItems = [],
  onDelete,
}: {
  item?: any;
  forcedType: 'boost' | 'reward';
  existingItems?: any[];
  onDelete: (id: string, name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const defaultValues = useMemo(() => item
    ? {
        ...item,
        features: Array.isArray(item.features) ? item.features.join('\n') : '',
        priceCurrency: item.priceCurrency ?? 'usd',
        cybaCoinPrice: item.cybaCoinPrice ?? 0,
        type: forcedType,
        requiresSubmission: item.requiresSubmission ?? false,
        submissionPayoutType: item.submissionPayoutType ?? 'none',
        submissionPayoutAmount: item.submissionPayoutAmount ?? 0,
      }
    : { name: '', description: '', price: 0, priceCurrency: 'usd' as const, cybaCoinPrice: 0, features: '', buttonText: '', buttonLink: '', cancelLink: '', type: forcedType, requiresSubmission: false, submissionPayoutType: 'none' as const, submissionPayoutAmount: 0 },
  [item, forcedType]);

  const form = useForm<z.infer<typeof extraSchema>>({ resolver: zodResolver(extraSchema), defaultValues });
  const priceCurrency = form.watch('priceCurrency');
  const requiresSubmission = form.watch('requiresSubmission');
  const submissionPayoutType = form.watch('submissionPayoutType');

  useEffect(() => { if (open) form.reset(defaultValues); }, [form, open, defaultValues]);

  const onSubmit = (values: z.infer<typeof extraSchema>) => {
    const features = values.features.split('\n').filter(Boolean);
    const isNew = !item;
    const order = isNew ? existingItems.length + 1 : (item.order ?? existingItems.length + 1);
    const data = { ...values, features, order, type: forcedType, cybaCoinPrice: values.cybaCoinPrice || null };
    if (item) {
      setDocumentNonBlocking(doc(firestore, 'extras', item.id), data, { merge: true });
      toast({ title: 'Updated!' });
    } else {
      addDocumentNonBlocking(collection(firestore, 'extras'), data);
      toast({ title: 'Created!' });
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {item
          ? <Button variant="outline" size="icon"><Edit className="h-4 w-4" /></Button>
          : <Button><PlusCircle className="mr-2 h-4 w-4" />New {forcedType === 'boost' ? 'Boost' : 'Reward'}</Button>
        }
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit' : 'Create'} {forcedType === 'boost' ? 'Boost' : 'Reward'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              {/* Price currency toggle */}
              <FormField control={form.control} name="priceCurrency" render={({ field }) => (
                <FormItem className="flex items-center justify-between border rounded-lg p-3">
                  <div>
                    <FormLabel>Price Currency</FormLabel>
                    <FormDescription>USD (dollars) or CC (CYBACOIN)</FormDescription>
                  </div>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <span className={field.value === 'cc' ? 'text-muted-foreground text-sm' : 'font-medium text-sm'}>USD $</span>
                      <Switch checked={field.value === 'cc'} onCheckedChange={c => field.onChange(c ? 'cc' : 'usd')} />
                      <span className={field.value === 'usd' ? 'text-muted-foreground text-sm' : 'font-medium text-sm'}>CC 🪙</span>
                    </div>
                  </FormControl>
                </FormItem>
              )} />

              {/* Requires media submission toggle — only for reward type */}
              {forcedType === 'reward' && (
                <FormField control={form.control} name="requiresSubmission" render={({ field }) => (
                  <FormItem className="flex items-center justify-between border rounded-lg p-3 border-violet-500/30 bg-violet-950/10">
                    <div>
                      <FormLabel>Requires Media Submission?</FormLabel>
                      <FormDescription>User uploads media for admin approval before reward is granted.</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )} />
              )}

              {/* Submission payout — only when requiresSubmission is on */}
              {forcedType === 'reward' && requiresSubmission && (
                <>
                  <FormField control={form.control} name="submissionPayoutType" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payout on Approval</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No payout</SelectItem>
                            <SelectItem value="cybacoin">CYBACOIN</SelectItem>
                            <SelectItem value="cash">Cash (USD)</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  {submissionPayoutType !== 'none' && (
                    <FormField control={form.control} name="submissionPayoutAmount" render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {submissionPayoutType === 'cybacoin' ? 'CYBACOIN Amount' : 'USD Amount'}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step={submissionPayoutType === 'cash' ? '0.01' : '1'}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                </>
              )}

              {(['name', 'description', 'price', 'buttonText', 'buttonLink', 'cancelLink'] as const).map(f => (
                <FormField key={f} control={form.control} name={f} render={({ field }) => (
                  <FormItem>
                    <FormLabel className="capitalize">
                      {f === 'price'
                        ? `Primary Price (${priceCurrency === 'usd' ? 'USD — e.g. 9.99' : 'CYBACOIN — e.g. 500'})`
                        : f.replace(/([A-Z])/g, ' $1')}
                    </FormLabel>
                    <FormControl>
                      {f === 'description'
                        ? <Textarea {...field} rows={2} />
                        : <Input type={f === 'price' ? 'number' : 'text'} step={f === 'price' && priceCurrency === 'usd' ? '0.01' : undefined} {...field} />
                      }
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              ))}

              {/* Optional second CC price */}
              <FormField control={form.control} name="cybaCoinPrice" render={({ field }) => (
                <FormItem>
                  <FormLabel>Also Accept CYBACOIN? (optional)</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} step={1} placeholder="0 = disabled" {...field} />
                  </FormControl>
                  <FormDescription>
                    Show a second &quot;Buy with CC&quot; button alongside the primary price. Leave 0 to disable.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="space-y-3">
              <FormField control={form.control} name="features" render={({ field }) => (
                <FormItem className="h-full flex flex-col">
                  <FormLabel>Features (one per line)</FormLabel>
                  <FormControl><Textarea {...field} rows={12} className="flex-1" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <DialogFooter className="col-span-2 flex justify-between">
              <div>
                {item && (
                  <Button type="button" variant="destructive" onClick={() => {
                    if (confirm(`Delete "${item.name}"?`)) { onDelete(item.id, item.name); setOpen(false); }
                  }}>
                    <Trash2 className="w-4 h-4 mr-1" />Delete
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                <Button type="submit">Save</Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
//  Boosts Management
// ─────────────────────────────────────────────
function BoostsManagement() {
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const boostsQuery = useMemoFirebase(
    () => query(collection(firestore, 'extras'), where('type', '==', 'boost'), orderBy('order')),
    [firestore]
  );
  const { data: boosts, isLoading } = useCollection(boostsQuery);

  const handleDelete = (id: string, name: string) => {
    deleteDocumentNonBlocking(doc(firestore, 'extras', id));
    toast({ title: 'Deleted', description: `"${name}" removed.` });
  };

  const handleOrderChange = async (item: any, newOrder: number) => {
    if (item.order === newOrder || !boosts) return;
    const batch = writeBatch(firestore);
    const swap = boosts.find(i => i.order === newOrder);
    batch.update(doc(firestore, 'extras', item.id), { order: newOrder });
    if (swap && typeof item.order !== 'undefined') batch.update(doc(firestore, 'extras', swap.id), { order: item.order });
    await batch.commit();
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Boosts</CardTitle>
          <CardDescription>Create and manage paid boosts. Supports USD or CYBACOIN pricing.</CardDescription>
        </div>
        <ExtraForm forcedType="boost" existingItems={boosts ?? []} onDelete={handleDelete} />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {boosts?.map(item => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>
                  {item.priceCurrency === 'cc'
                    ? <span className="text-yellow-400 font-bold">{item.price?.toLocaleString()} CC</span>
                    : <span>${item.price?.toFixed(2)}</span>
                  }
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{item.priceCurrency === 'cc' ? 'CYBACOIN' : 'USD'}</Badge>
                </TableCell>
                <TableCell>
                  <Select value={item.order?.toString()} onValueChange={v => handleOrderChange(item, parseInt(v))}>
                    <SelectTrigger className="w-16"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: boosts?.length ?? 1 }, (_, i) => i + 1).map(n => (
                        <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Button
                    variant={item.soldOut ? 'destructive' : 'outline'}
                    size="sm"
                    className="text-xs"
                    onClick={() => updateDoc(doc(firestore, 'extras', item.id), { soldOut: !item.soldOut })}
                  >
                    {item.soldOut ? 'Sold Out' : 'In Stock'}
                  </Button>
                </TableCell>
                <TableCell className="text-right">
                  <ExtraForm item={item} forcedType="boost" existingItems={boosts ?? []} onDelete={handleDelete} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
//  Rewards Management (reward-type extras)
// ─────────────────────────────────────────────
function RewardsManagement() {
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const rewardsQuery = useMemoFirebase(
    () => query(collection(firestore, 'extras'), where('type', '==', 'reward'), orderBy('order')),
    [firestore]
  );
  const { data: rewards, isLoading } = useCollection(rewardsQuery);

  const handleDelete = (id: string, name: string) => {
    deleteDocumentNonBlocking(doc(firestore, 'extras', id));
    toast({ title: 'Deleted', description: `"${name}" removed.` });
  };

  const handleOrderChange = async (item: any, newOrder: number) => {
    if (item.order === newOrder || !rewards) return;
    const batch = writeBatch(firestore);
    const swap = rewards.find(i => i.order === newOrder);
    batch.update(doc(firestore, 'extras', item.id), { order: newOrder });
    if (swap && typeof item.order !== 'undefined') batch.update(doc(firestore, 'extras', swap.id), { order: item.order });
    await batch.commit();
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-10">
      {/* Reward-type extras */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Rewards</CardTitle>
            <CardDescription>
              Purchasable reward items. Supports USD or CYBACOIN pricing. Profile wallpapers are managed in code.
            </CardDescription>
          </div>
          <ExtraForm forcedType="reward" existingItems={rewards ?? []} onDelete={handleDelete} />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rewards?.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    {item.priceCurrency === 'cc'
                      ? <span className="text-yellow-400 font-bold">{item.price?.toLocaleString()} CC</span>
                      : <span>${item.price?.toFixed(2)}</span>
                    }
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{item.priceCurrency === 'cc' ? 'CYBACOIN' : 'USD'}</Badge>
                  </TableCell>
                  <TableCell>
                    {item.requiresSubmission
                      ? <Badge className="text-xs bg-violet-600 text-white">📎 Submission</Badge>
                      : <span className="text-xs text-muted-foreground">Standard</span>}
                  </TableCell>
                  <TableCell>
                    <Select value={item.order?.toString()} onValueChange={v => handleOrderChange(item, parseInt(v))}>
                      <SelectTrigger className="w-16"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: rewards?.length ?? 1 }, (_, i) => i + 1).map(n => (
                          <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant={item.soldOut ? 'destructive' : 'outline'}
                      size="sm"
                      className="text-xs"
                      onClick={() => updateDoc(doc(firestore, 'extras', item.id), { soldOut: !item.soldOut })}
                    >
                      {item.soldOut ? 'Sold Out' : 'In Stock'}
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">
                    <ExtraForm item={item} forcedType="reward" existingItems={rewards ?? []} onDelete={handleDelete} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Shop / Merch Management
// ─────────────────────────────────────────────
function ShopManagement() {
  const { firestore } = useFirebase();
  const shopRef = useMemoFirebase(() => collection(firestore, 'merchandise'), [firestore]);
  const { data: shopItems, isLoading } = useCollection(shopRef);
  const handleDelete = (id: string) => {
    if (confirm('Delete this item?')) deleteDocumentNonBlocking(doc(firestore, 'merchandise', id));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div><CardTitle>Merch / Market</CardTitle><CardDescription>Create, edit, and delete market items.</CardDescription></div>
        <ShopForm />
      </CardHeader>
      <CardContent>
        {isLoading ? <Loader2 className="animate-spin" /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead><TableHead>Price</TableHead><TableHead>CC Price</TableHead><TableHead>Stock</TableHead><TableHead>Sold Out</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shopItems?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>${item.price?.toFixed(2)}</TableCell>
                  <TableCell>{item.cybaCoinPrice ?? '—'}</TableCell>
                  <TableCell>{item.stockQuantity}</TableCell>
                  <TableCell>
                    <Button
                      variant={item.soldOut ? 'destructive' : 'outline'}
                      size="sm"
                      className="text-xs"
                      onClick={() => updateDoc(doc(firestore, 'merchandise', item.id), { soldOut: !item.soldOut })}
                    >
                      {item.soldOut ? 'Sold Out' : 'In Stock'}
                    </Button>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <ShopForm item={item} />
                    <Button variant="destructive" size="icon" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

type MerchOrder = {
  id: string;
  userId: string;
  username: string;
  itemName: string;
  paidWith: 'cybacoin' | 'wallet_cash';
  amount: number;
  status: 'pending' | 'shipped';
  orderedAt?: any;
  trackingNumber?: string;
};

function MerchOrdersManagement() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [filter, setFilter] = useState<'pending' | 'shipped' | 'all'>('pending');
  const [shippingFor, setShippingFor] = useState<string | null>(null);
  const [tracking, setTracking] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  const ordersQuery = useMemoFirebase(
    () => filter === 'all'
      ? query(collection(firestore, 'merch_orders'), limit(100))
      : query(collection(firestore, 'merch_orders'), where('status', '==', filter), limit(100)),
    [firestore, filter]
  );
  const { data: ordersRaw, isLoading } = useCollection<MerchOrder>(ordersQuery);
  const orders = useMemo(
    () => [...(ordersRaw ?? [])].sort((a: any, b: any) => (b.orderedAt?.seconds ?? 0) - (a.orderedAt?.seconds ?? 0)),
    [ordersRaw]
  );

  const handleMarkShipped = async (order: MerchOrder) => {
    setSaving(order.id);
    try {
      await updateDoc(doc(firestore, 'merch_orders', order.id), {
        status: 'shipped',
        trackingNumber: tracking.trim() || null,
        shippedAt: serverTimestamp(),
      });
      await sendSystemDM(
        firestore,
        order.userId,
        tracking.trim()
          ? `Your CYBAMERCH order (${order.itemName}) has shipped! Tracking number: ${tracking.trim()}`
          : `Your CYBAMERCH order (${order.itemName}) has shipped!`,
      );
      setShippingFor(null);
      setTracking('');
      toast({ title: 'Marked as shipped!', description: `@${order.username} notified.` });
    } catch {
      toast({ variant: 'destructive', title: 'Action failed' });
    } finally {
      setSaving(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Merch Orders</CardTitle>
        <CardDescription>Fulfill CYBAMERCH orders and notify buyers with tracking info.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4 flex-wrap">
          {(['pending', 'shipped', 'all'] as const).map(f => (
            <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} className="capitalize" onClick={() => setFilter(f)}>
              {f === 'pending' && '📦 '}
              {f === 'shipped' && '🚚 '}
              {f}
            </Button>
          ))}
        </div>
        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
        ) : !orders?.length ? (
          <div className="text-center py-10 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
            No {filter === 'all' ? '' : filter} merch orders.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map(order => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">@{order.username}</TableCell>
                  <TableCell>{order.itemName}</TableCell>
                  <TableCell>
                    {order.paidWith === 'cybacoin' ? `${order.amount.toLocaleString()} CC` : `$${order.amount.toFixed(2)}`}
                  </TableCell>
                  <TableCell>
                    <Badge className={cn('text-xs capitalize', order.status === 'pending' ? 'bg-yellow-600' : 'bg-green-600')}>
                      {order.status}
                    </Badge>
                    {order.trackingNumber && <p className="text-[10px] text-muted-foreground mt-0.5">#{order.trackingNumber}</p>}
                  </TableCell>
                  <TableCell className="text-right">
                    {order.status === 'pending' && (
                      shippingFor === order.id ? (
                        <div className="flex items-center gap-2 justify-end">
                          <Input
                            placeholder="Tracking # (optional)"
                            value={tracking}
                            onChange={e => setTracking(e.target.value)}
                            className="h-7 text-xs w-40"
                          />
                          <Button size="sm" variant="outline" onClick={() => { setShippingFor(null); setTracking(''); }}>✕</Button>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-500 text-white"
                            disabled={saving === order.id}
                            onClick={() => handleMarkShipped(order)}
                          >
                            {saving === order.id ? <Loader2 className="w-3 h-3 animate-spin" /> : '✓ Ship'}
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" className="bg-green-600 hover:bg-green-500 text-white" onClick={() => setShippingFor(order.id)}>
                          Mark Shipped
                        </Button>
                      )
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function ShopForm({ item }: { item?: any }) {
  const [open, setOpen] = useState(false);
  const { firestore, storage } = useFirebase();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const defaults = item
    ? { ...item, imageUrl: item.imageUrl || '', buyNowUrl: item.buyNowUrl || '', cybaCoinPrice: item.cybaCoinPrice ?? undefined }
    : { name: '', description: '', price: 0, cybaCoinPrice: undefined, imageUrl: '', buyNowUrl: '', stockQuantity: 0 };
  const form = useForm<z.infer<typeof shopItemSchema>>({ resolver: zodResolver(shopItemSchema), defaultValues: defaults });

  useEffect(() => { if (open) form.reset(defaults); }, [item, open]);

  const handleImageFile = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `merchandise/${uuidv4()}.${ext}`;
      const fileRef = storageRef(storage, path);
      const task = uploadBytesResumable(fileRef, file, { contentType: file.type });
      const url = await new Promise<string>((resolve, reject) => {
        task.on('state_changed', () => {}, reject, async () => resolve(await getDownloadURL(task.snapshot.ref)));
      });
      form.setValue('imageUrl', url, { shouldValidate: true });
    } catch {
      toast({ variant: 'destructive', title: 'Image upload failed' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onSubmit = (values: z.infer<typeof shopItemSchema>) => {
    const data = { ...values, cybaCoinPrice: values.cybaCoinPrice || null };
    if (item) { setDocumentNonBlocking(doc(firestore, 'merchandise', item.id), data, { merge: true }); toast({ title: 'Item updated!' }); }
    else { addDocumentNonBlocking(collection(firestore, 'merchandise'), data); toast({ title: 'Item created!' }); }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {item ? <Button variant="outline" size="icon"><Edit className="h-4 w-4" /></Button> : <Button><PlusCircle className="mr-2 h-4 w-4" />New Item</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{item ? 'Edit' : 'Create'} Merch Item</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            {([['name', 'text'], ['description', 'textarea'], ['price', 'number'], ['cybaCoinPrice', 'number'], ['stockQuantity', 'number'], ['buyNowUrl', 'text']] as [string, string][]).map(([f, t]) => (
              <FormField key={f} control={form.control} name={f as any} render={({ field }) => (
                <FormItem>
                  <FormLabel className="capitalize">{f.replace(/([A-Z])/g, ' $1')}</FormLabel>
                  <FormControl>
                    {t === 'textarea' ? <Textarea {...field} rows={3} /> : <Input type={t} step={f === 'price' ? '0.01' : undefined} {...field} />}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            ))}
            <FormField control={form.control} name="imageUrl" render={({ field }) => (
              <FormItem>
                <FormLabel>Product Image</FormLabel>
                <FormControl>
                  <div className="space-y-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }}
                      className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:px-3 file:py-1.5 file:text-sm"
                      disabled={uploading}
                    />
                    {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {field.value && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={field.value} alt="Preview" className="h-24 w-24 object-cover rounded-lg border border-border" />
                    )}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
              <Button type="submit" disabled={uploading}>Save</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
//  Membership Management
// ─────────────────────────────────────────────
function MembershipManagement() {
  const { firestore } = useFirebase();
  const membershipsRef = useMemoFirebase(() => collection(firestore, 'memberships'), [firestore]);
  const { data: memberships, isLoading } = useCollection(membershipsRef);
  const handleDelete = (id: string) => { if (confirm('Delete this tier?')) deleteDocumentNonBlocking(doc(firestore, 'memberships', id)); };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div><CardTitle>Membership Tiers</CardTitle><CardDescription>Create, edit, and delete membership tiers.</CardDescription></div>
        <MembershipForm />
      </CardHeader>
      <CardContent>
        {isLoading ? <Loader2 className="animate-spin" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Price</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {memberships?.map(item => (
                <TableRow key={item.id}>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>${item.price?.toFixed(2)}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <MembershipForm item={item} />
                    <Button variant="destructive" size="icon" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function MembershipForm({ item }: { item?: any }) {
  const [open, setOpen] = useState(false);
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const defaultValues = useMemo(() => item
    ? { ...item, features: Array.isArray(item.features) ? item.features.join('\n') : '' }
    : { name: '', description: '', price: 0, features: '', buttonText: '', buttonLink: '' }, [item]);
  const form = useForm<z.infer<typeof membershipSchema>>({ resolver: zodResolver(membershipSchema), defaultValues });
  useEffect(() => { if (open) form.reset(defaultValues); }, [form, open, defaultValues]);

  const onSubmit = (values: z.infer<typeof membershipSchema>) => {
    const data = { ...values, features: values.features.split('\n').filter(Boolean) };
    if (item) { setDocumentNonBlocking(doc(firestore, 'memberships', item.id), data, { merge: true }); toast({ title: 'Updated!' }); }
    else { addDocumentNonBlocking(collection(firestore, 'memberships'), data); toast({ title: 'Created!' }); }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {item ? <Button variant="outline" size="icon"><Edit className="h-4 w-4" /></Button> : <Button><PlusCircle className="mr-2 h-4 w-4" />New Tier</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{item ? 'Edit' : 'Create'} Tier</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            {(['name', 'description', 'price', 'features', 'buttonText', 'buttonLink'] as const).map(f => (
              <FormField key={f} control={form.control} name={f} render={({ field }) => (
                <FormItem>
                  <FormLabel className="capitalize">{f === 'features' ? 'Features (one per line)' : f}</FormLabel>
                  <FormControl>{f === 'features' || f === 'description' ? <Textarea {...field} rows={f === 'features' ? 5 : 3} /> : <Input type={f === 'price' ? 'number' : 'text'} step={f === 'price' ? '0.01' : undefined} {...field} />}</FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            ))}
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
//  Avatar Management — 3D Accessory Unlocks
// ─────────────────────────────────────────────
function AvatarManagement() {
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const cfgRef = useMemoFirebase(
    () => doc(firestore, 'settings', 'avatarAccessories'),
    [firestore]
  );
  const { data: rawCfg } = useDoc<Record<AccessoryStyle, AccessoryUnlock>>(cfgRef);

  const [cfg, setCfg] = useState<Record<AccessoryStyle, AccessoryUnlock>>(ACCESSORY_DEFAULTS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (rawCfg) {
      setCfg({ ...ACCESSORY_DEFAULTS, ...rawCfg });
    }
  }, [rawCfg]);

  const setField = (
    acc: AccessoryStyle,
    field: keyof AccessoryUnlock,
    value: string | number | undefined
  ) => {
    setCfg(prev => ({
      ...prev,
      [acc]: { ...prev[acc], [field]: value },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(firestore, 'settings', 'avatarAccessories'), cfg);
      toast({ title: 'Avatar accessory settings saved' });
    } catch {
      toast({ variant: 'destructive', title: 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle>3D Avatar Accessory Unlocks</CardTitle>
            <CardDescription>
              Configure unlock requirements for each avatar accessory. Changes are saved to Firestore and read at runtime.
            </CardDescription>
          </div>
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Save Changes
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {ACCESSORY_OPTIONS.map(opt => {
            const current = cfg[opt.value] ?? ACCESSORY_DEFAULTS[opt.value];
            return (
              <div key={opt.value} className="flex flex-wrap items-center gap-3 p-3 rounded-lg border bg-card/50">
                <div className="flex items-center gap-2 min-w-[140px]">
                  <span className="text-xl">{opt.emoji}</span>
                  <span className="text-sm font-medium">{opt.label}</span>
                </div>
                {/* Unlock type */}
                <Select
                  value={current.type}
                  onValueChange={v => setField(opt.value, 'type', v)}
                >
                  <SelectTrigger className="w-32 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="level">Level Required</SelectItem>
                    <SelectItem value="coins">CC Cost</SelectItem>
                  </SelectContent>
                </Select>
                {/* Level picker */}
                {current.type === 'level' && (
                  <Select
                    value={current.requiredLevel ?? 'spark'}
                    onValueChange={v => setField(opt.value, 'requiredLevel', v)}
                  >
                    <SelectTrigger className="w-32 h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="spark">⚡ Spark</SelectItem>
                      <SelectItem value="charge">🔋 Charge</SelectItem>
                      <SelectItem value="surge">🌊 Surge</SelectItem>
                      <SelectItem value="storm">⛈️ Storm</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {/* CC cost */}
                {current.type === 'coins' && (
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={0}
                      value={current.ccCost ?? 0}
                      onChange={e => setField(opt.value, 'ccCost', Number(e.target.value))}
                      className="w-24 h-8 text-sm"
                    />
                    <span className="text-xs text-muted-foreground">CC</span>
                  </div>
                )}
                {/* Status badge */}
                <Badge
                  variant="outline"
                  className={cn(
                    'ml-auto text-xs',
                    current.type === 'free'
                      ? 'border-green-600 text-green-400'
                      : current.type === 'level'
                      ? 'border-blue-600 text-blue-400'
                      : 'border-amber-600 text-amber-400'
                  )}
                >
                  {current.type === 'free'
                    ? 'Free'
                    : current.type === 'level'
                    ? `🔒 ${current.requiredLevel ?? 'spark'}`
                    : `🪙 ${current.ccCost ?? 0} CC`}
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
//  Level Threshold Management
// ─────────────────────────────────────────────
function LevelManagement() {
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const cfgRef = useMemoFirebase(() => doc(firestore, 'settings', 'levelConfig'), [firestore]);
  const { data: rawCfg } = useDoc<Partial<LevelThresholds>>(cfgRef);

  const [cfg, setCfg] = useState<LevelThresholds>(DEFAULT_LEVEL_THRESHOLDS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCfg(rawCfg ? { ...DEFAULT_LEVEL_THRESHOLDS, ...rawCfg } : DEFAULT_LEVEL_THRESHOLDS);
  }, [rawCfg]);

  const set = (key: keyof LevelThresholds, val: string) => {
    setCfg(prev => ({ ...prev, [key]: parseInt(val, 10) || 0 }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(firestore, 'settings', 'levelConfig'), cfg);
      toast({ title: 'Level thresholds saved' });
    } catch {
      toast({ variant: 'destructive', title: 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const rows: { level: string; emoji: string; postsKey: keyof LevelThresholds; supKey: keyof LevelThresholds }[] = [
    { level: 'Charge 🔋', emoji: '🔋', postsKey: 'charge_posts', supKey: 'charge_support' },
    { level: 'Surge 🌊',  emoji: '🌊', postsKey: 'surge_posts',  supKey: 'surge_support'  },
    { level: 'Storm ⛈️',  emoji: '⛈️', postsKey: 'storm_posts',  supKey: 'storm_support'  },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Level Thresholds</CardTitle>
        <CardDescription>Set the minimum posts &amp; supports required to reach each level.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Level</th>
                <th className="text-center py-2 px-4 text-muted-foreground font-medium">Min Posts</th>
                <th className="text-center py-2 px-4 text-muted-foreground font-medium">Min Supports</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/40">
                <td className="py-2 pr-4 font-semibold text-yellow-400">⚡ Spark</td>
                <td className="py-2 px-4 text-center text-muted-foreground">0</td>
                <td className="py-2 px-4 text-center text-muted-foreground">0</td>
              </tr>
              {rows.map(r => (
                <tr key={r.level} className="border-b border-border/40">
                  <td className="py-2 pr-4 font-semibold">{r.level}</td>
                  <td className="py-1.5 px-4">
                    <Input type="number" min={0} value={cfg[r.postsKey]} onChange={e => set(r.postsKey, e.target.value)} className="h-8 text-sm text-center" />
                  </td>
                  <td className="py-1.5 px-4">
                    <Input type="number" min={0} value={cfg[r.supKey]} onChange={e => set(r.supKey, e.target.value)} className="h-8 text-sm text-center" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button onClick={handleSave} disabled={saving} className="mt-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Save Thresholds
        </Button>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
//  CC Rates Management
// ─────────────────────────────────────────────
const LEVELS = ['spark', 'charge', 'surge', 'storm'] as const;
const LEVEL_LABELS: Record<string, string> = {
  spark: '⚡ Spark', charge: '🔋 Charge', surge: '🌊 Surge', storm: '⛈️ Storm',
};

function CCRatesManagement() {
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const ratesRef = useMemoFirebase(() => doc(firestore, 'settings', 'ccRates'), [firestore]);
  const { data: rawRates } = useDoc<Partial<CCRates>>(ratesRef);

  // Local editable state — seeded from Firestore (or defaults) once loaded
  const [rates, setRates] = useState<CCRates>(DEFAULT_CC_RATES);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRates(rawRates ? mergeWithDefaults(rawRates) : DEFAULT_CC_RATES);
  }, [rawRates]);

  const setRate = (
    section: 'post' | 'engagement',
    key: string,
    level: typeof LEVELS[number],
    value: number,
  ) => {
    setRates(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: {
          ...(prev[section] as any)[key],
          [level]: isNaN(value) ? 0 : value,
        },
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(firestore, 'settings', 'ccRates'), rates);
      toast({ title: 'CC Rates saved' });
    } catch {
      toast({ variant: 'destructive', title: 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Reset all CC rates to defaults?')) return;
    setSaving(true);
    try {
      await setDoc(doc(firestore, 'settings', 'ccRates'), DEFAULT_CC_RATES);
      setRates(DEFAULT_CC_RATES);
      toast({ title: 'CC Rates reset to defaults' });
    } catch {
      toast({ variant: 'destructive', title: 'Reset failed' });
    } finally {
      setSaving(false);
    }
  };

  const RateTable = ({
    section,
    rows,
    rowLabels,
  }: {
    section: 'post' | 'engagement';
    rows: string[];
    rowLabels: Record<string, string>;
  }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 pr-4 text-muted-foreground font-medium w-32">Type</th>
            {LEVELS.map(l => (
              <th key={l} className="text-center py-2 px-2 text-muted-foreground font-medium">
                {LEVEL_LABELS[l]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row} className="border-b border-border/40">
              <td className="py-2 pr-4 font-semibold capitalize">{rowLabels[row]}</td>
              {LEVELS.map(level => {
                const current = ((rates[section] as any)[row] as CCRatesByLevel)[level];
                const def = ((DEFAULT_CC_RATES[section] as any)[row] as CCRatesByLevel)[level];
                const changed = current !== def;
                return (
                  <td key={level} className="py-1.5 px-2">
                    <div className="relative">
                      <Input
                        type="number"
                        min={0}
                        step={50}
                        value={current}
                        onChange={e => setRate(section, row, level, parseInt(e.target.value, 10))}
                        className={cn('h-8 text-sm text-center pr-1', changed && 'border-primary/60 bg-primary/5')}
                      />
                      {changed && (
                        <span className="absolute -top-1.5 -right-1.5 w-2 h-2 bg-primary rounded-full" title={`Default: ${def}`} />
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>CC Earning Rates</CardTitle>
          <CardDescription>
            Set how many CYBACOIN each action earns per level. Changes apply instantly site-wide.
            A purple dot means the value differs from the default.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Post earnings */}
          <div>
            <h3 className="font-semibold mb-1">Post Earnings</h3>
            <p className="text-xs text-muted-foreground mb-3">CC awarded to the author when a post is created.</p>
            <RateTable
              section="post"
              rows={['text', 'image', 'video']}
              rowLabels={{ text: '📝 Text', image: '📸 Image', video: '🎬 Video' }}
            />
          </div>

          <Separator />

          {/* Engagement earnings */}
          <div>
            <h3 className="font-semibold mb-1">Engagement Earnings</h3>
            <p className="text-xs text-muted-foreground mb-3">CC awarded to the user for outward engagement on others&apos; posts.</p>
            <RateTable
              section="engagement"
              rows={['like', 'comment', 'share']}
              rowLabels={{ like: '❤️ Like', comment: '💬 Comment', share: '🔁 Share' }}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Rates
            </Button>
            <Button variant="outline" onClick={handleReset} disabled={saving}>
              Reset to Defaults
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
//  CC Boost Subscriptions Management
// ─────────────────────────────────────────────
function CCSubsManagement() {
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const ratesRef = useMemoFirebase(() => doc(firestore, 'settings', 'boostSubscriptionRates'), [firestore]);
  const { data: rawRates } = useDoc<Partial<BoostSubscriptionRates> & {
    descriptions?: BoostSubscriptionDescriptions;
    marketTierExtraRate?: Partial<Record<MarketBoostTier, number>>;
    radioExtraSlotCost?: number;
  }>(ratesRef);

  const [rates, setRates] = useState<BoostSubscriptionRates>(DEFAULT_BOOST_SUBSCRIPTION_RATES);
  const [descriptions, setDescriptions] = useState<BoostSubscriptionDescriptions>({});
  const [marketTierExtraRate, setMarketTierExtraRate] = useState<Record<MarketBoostTier, number>>(MARKET_TIER_EXTRA_RATE);
  const [radioExtraSlotCost, setRadioExtraSlotCost] = useState<number>(DEFAULT_RADIO_EXTRA_SLOT_COST_CC);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRates(rawRates ? { ...DEFAULT_BOOST_SUBSCRIPTION_RATES, ...rawRates } : DEFAULT_BOOST_SUBSCRIPTION_RATES);
    setDescriptions(rawRates?.descriptions ?? {});
    setMarketTierExtraRate({ ...MARKET_TIER_EXTRA_RATE, ...rawRates?.marketTierExtraRate });
    setRadioExtraSlotCost(rawRates?.radioExtraSlotCost ?? DEFAULT_RADIO_EXTRA_SLOT_COST_CC);
  }, [rawRates]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(firestore, 'settings', 'boostSubscriptionRates'), { ...rates, descriptions, marketTierExtraRate, radioExtraSlotCost });
      toast({ title: 'CC Subscription rates saved' });
    } catch {
      toast({ variant: 'destructive', title: 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const ROWS: { key: BoostSubscriptionType; label: string }[] = [
    { key: 'payout', label: '🏦 Payout' },
    { key: 'radio', label: '📻 Radio' },
    { key: 'market', label: '🛒 Market' },
    { key: 'spotlight', label: '⭐ Spotlight' },
    { key: 'adFree', label: '🚫 Promo-Free' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>CC Boost Subscriptions</CardTitle>
        <CardDescription>
          Weekly CYBACOIN cost and description for each boost. Deducted automatically each week —
          if a user&apos;s balance can&apos;t cover it, their boost auto-pauses until they have enough again.
          Rates shown are launch placeholders — confirm before launch.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {ROWS.map(({ key, label }) => (
          <div key={key} className="space-y-2 border-b border-border/40 pb-4 last:border-0 last:pb-0">
            <div className="flex items-center gap-3">
              <span className="w-28 text-sm font-semibold shrink-0">{label}</span>
              <Input
                type="number"
                min={0}
                step={50}
                value={rates[key]}
                onChange={e => setRates(prev => ({ ...prev, [key]: isNaN(parseInt(e.target.value, 10)) ? 0 : parseInt(e.target.value, 10) }))}
                className="h-9 w-32"
              />
              <span className="text-xs text-muted-foreground">CC / week</span>
            </div>
            <Textarea
              value={descriptions[key] ?? ''}
              onChange={e => setDescriptions(prev => ({ ...prev, [key]: e.target.value }))}
              placeholder="Leave blank to use the built-in default description"
              rows={2}
              className="text-sm"
            />
          </div>
        ))}

        <div className="space-y-2 border-t border-border/40 pt-4">
          <span className="text-sm font-semibold">🛒 Market Boost tier upcharges</span>
          <p className="text-xs text-muted-foreground">Extra weekly CC on top of the base Market rate above, for the Mid and Top listing-cap tiers.</p>
          <div className="flex flex-wrap gap-4">
            {(['mid', 'top'] as MarketBoostTier[]).map(tier => (
              <div key={tier} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground capitalize w-10">{tier}</span>
                <Input
                  type="number"
                  min={0}
                  step={50}
                  value={marketTierExtraRate[tier]}
                  onChange={e => setMarketTierExtraRate(prev => ({ ...prev, [tier]: isNaN(parseInt(e.target.value, 10)) ? 0 : parseInt(e.target.value, 10) }))}
                  className="h-9 w-28"
                />
                <span className="text-xs text-muted-foreground">CC / week</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2 border-t border-border/40 pt-4">
          <span className="text-sm font-semibold">📻 Radio extra video slot</span>
          <p className="text-xs text-muted-foreground">One-time CC cost for a Radio Boost member to buy an extra monthly video submission slot.</p>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              step={100}
              value={radioExtraSlotCost}
              onChange={e => setRadioExtraSlotCost(isNaN(parseInt(e.target.value, 10)) ? 0 : parseInt(e.target.value, 10))}
              className="h-9 w-28"
            />
            <span className="text-xs text-muted-foreground">CC</span>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="mt-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Save Rates & Descriptions
        </Button>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
//  AD DROP Management
// ─────────────────────────────────────────────
const AD_STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-950/40 border border-green-500/30 text-green-400',
  pending_payment: 'bg-muted/40 border border-border text-muted-foreground',
  expired: 'bg-red-950/40 border border-red-500/30 text-red-400',
};

const AD_TIER_LABELS: Record<AdTierKey, string> = {
  day7: '7-Day Tier',
  day14: '14-Day Tier',
  day30: '30-Day Tier',
};

function AdDropManagement() {
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const configRef = useMemoFirebase(() => doc(firestore, 'settings', 'adDropConfig'), [firestore]);
  const { data: rawConfig } = useDoc<Partial<AdDropConfig>>(configRef);
  const [config, setConfig] = useState<AdDropConfig>(DEFAULT_AD_DROP_CONFIG);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setConfig(rawConfig ? {
      ...DEFAULT_AD_DROP_CONFIG,
      ...rawConfig,
      tiers: { ...DEFAULT_AD_DROP_CONFIG.tiers, ...rawConfig.tiers },
      unskippable: { ...DEFAULT_AD_DROP_CONFIG.unskippable, ...rawConfig.unskippable },
      mediaQuest: { ...DEFAULT_AD_DROP_CONFIG.mediaQuest, ...rawConfig.mediaQuest },
    } : DEFAULT_AD_DROP_CONFIG);
  }, [rawConfig]);

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      await setDoc(doc(firestore, 'settings', 'adDropConfig'), config);
      toast({ title: 'PROMO BLAST settings saved' });
    } catch {
      toast({ variant: 'destructive', title: 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const adsRef = useMemoFirebase(
    () => query(collection(firestore, 'ads'), orderBy('createdAt', 'desc')),
    [firestore]
  );
  const { data: ads, isLoading } = useCollection<AdDoc & { createdAt?: any; expiresAt?: any }>(adsRef);

  const handleRemoveAd = async (adId: string) => {
    if (!confirm('Remove this promo? This cannot be undone.')) return;
    try {
      await deleteDoc(doc(firestore, 'ads', adId));
      toast({ title: 'Promo removed' });
    } catch {
      toast({ variant: 'destructive', title: 'Failed to remove promo' });
    }
  };

  const activeCount = ads?.filter(a => a.status === 'active').length ?? 0;
  const mediaQuestFlagged = ads?.filter((a: any) => a.wantsMediaQuest).length ?? 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>PROMO BLAST Settings</CardTitle>
          <CardDescription>
            Cash-only promo slots, no active-slot cap. {activeCount} currently active.
            {mediaQuestFlagged > 0 && (
              <span className="block mt-1 text-amber-400 font-semibold">
                ⚠ {mediaQuestFlagged} promo{mediaQuestFlagged !== 1 ? 's' : ''} waiting on a Media CYBAQUEST to be created — see below.
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <p className="text-sm font-semibold mb-2">Duration tiers</p>
            <div className="space-y-3">
              {AD_TIER_ORDER.map(key => (
                <div key={key} className="grid sm:grid-cols-[110px_100px_1fr] gap-2 items-center">
                  <span className="text-xs text-muted-foreground">{AD_TIER_LABELS[key]}</span>
                  <Input
                    value={config.tiers[key].priceLabel}
                    onChange={e => setConfig(prev => ({ ...prev, tiers: { ...prev.tiers, [key]: { ...prev.tiers[key], priceLabel: e.target.value } } }))}
                    placeholder="$4.99"
                  />
                  <Input
                    value={config.tiers[key].buttonLink}
                    onChange={e => setConfig(prev => ({ ...prev, tiers: { ...prev.tiers, [key]: { ...prev.tiers[key], buttonLink: e.target.value } } }))}
                    placeholder="https://buy.stripe.com/..."
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold mb-2">Upsells</p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="grid sm:grid-cols-[110px_100px_1fr] gap-2 items-center">
                  <span className="text-xs text-muted-foreground">Unskippable</span>
                  <Input
                    value={config.unskippable.priceLabel}
                    onChange={e => setConfig(prev => ({ ...prev, unskippable: { ...prev.unskippable, priceLabel: e.target.value } }))}
                    placeholder="$2.99"
                  />
                  <Input
                    value={config.unskippable.buttonLink}
                    onChange={e => setConfig(prev => ({ ...prev, unskippable: { ...prev.unskippable, buttonLink: e.target.value } }))}
                    placeholder="https://buy.stripe.com/..."
                  />
                </div>
                <Input
                  value={config.unskippable.description}
                  onChange={e => setConfig(prev => ({ ...prev, unskippable: { ...prev.unskippable, description: e.target.value } }))}
                  placeholder="Description shown to buyers"
                  className="text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <div className="grid sm:grid-cols-[110px_100px_1fr] gap-2 items-center">
                  <span className="text-xs text-muted-foreground">CYBAQUEST</span>
                  <Input
                    value={config.mediaQuest.priceLabel}
                    onChange={e => setConfig(prev => ({ ...prev, mediaQuest: { ...prev.mediaQuest, priceLabel: e.target.value } }))}
                    placeholder="$9.99"
                  />
                  <Input
                    value={config.mediaQuest.buttonLink}
                    onChange={e => setConfig(prev => ({ ...prev, mediaQuest: { ...prev.mediaQuest, buttonLink: e.target.value } }))}
                    placeholder="https://buy.stripe.com/..."
                  />
                </div>
                <Input
                  value={config.mediaQuest.description}
                  onChange={e => setConfig(prev => ({ ...prev, mediaQuest: { ...prev.mediaQuest, description: e.target.value } }))}
                  placeholder="Description shown to buyers"
                  className="text-xs"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">30-Day (Premium) slots include both add-ons free. 14-Day (Standard) slots include CYBAQUEST free, with Unskippable offered as a paid extra. 7-Day (Value) slots include nothing free — both are offered as paid extras.</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Skip cost (CC)</label>
              <Input
                type="number" min={0}
                value={config.skipCostCC}
                onChange={e => setConfig(prev => ({ ...prev, skipCostCC: parseInt(e.target.value, 10) || 0 }))}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                CC reward per promo watched — <span className="text-amber-400 font-semibold">PLACEHOLDER, confirm before launch</span>
              </label>
              <Input
                type="number" min={0}
                value={config.watchRewardCC}
                onChange={e => setConfig(prev => ({ ...prev, watchRewardCC: parseInt(e.target.value, 10) || 0 }))}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                USD → CC rate — <span className="text-amber-400 font-semibold">PLACEHOLDER, confirm before launch</span>
              </label>
              <Input
                type="number" min={0}
                value={config.usdToCcRate}
                onChange={e => setConfig(prev => ({ ...prev, usdToCcRate: parseInt(e.target.value, 10) || 0 }))}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Renewing early (buying a new slot before an old one expires) credits 15% of the new base price × this rate, as CYBACOIN.
              </p>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Every Stripe product name above must contain &quot;promo blast&quot; plus its distinguishing keyword
            (&quot;7&quot;, &quot;14&quot;, &quot;30&quot;, &quot;unskippable&quot;, or &quot;media cybaquest&quot;/&quot;media quest&quot;),
            and each must collect the same two custom fields: CYBAZONE username and Ad ID. (Existing products still
            using &quot;ad drop&quot; keep working too — the webhook recognizes both.)
          </p>
          <Button onClick={handleSaveConfig} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Settings
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Promo Slot Performance</CardTitle>
          <CardDescription>Aggregate stats across all promos, any status.</CardDescription>
        </CardHeader>
        <CardContent>
          {(() => {
            const all = ads ?? [];
            const totalViews = all.reduce((s, a) => s + (a.viewCount ?? 0), 0);
            const totalClicks = all.reduce((s, a) => s + (a.clickCount ?? 0), 0);
            const totalWatch = all.reduce((s, a) => s + (a.totalWatchSeconds ?? 0), 0);
            const overallCtr = totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(1) : '—';
            const avgWatch = totalViews > 0 ? (totalWatch / totalViews).toFixed(1) : '—';
            const activeCount = all.filter(a => a.status === 'active').length;
            const tierCounts = { day7: 0, day14: 0, day30: 0 } as Record<AdTierKey, number>;
            all.forEach(a => { if (a.tier && tierCounts[a.tier as AdTierKey] !== undefined) tierCounts[a.tier as AdTierKey]++; });
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="rounded-lg border border-border/40 p-3">
                  <p className="text-2xl font-bold">{all.length}</p>
                  <p className="text-xs text-muted-foreground">Total Slots ({activeCount} active)</p>
                </div>
                <div className="rounded-lg border border-border/40 p-3">
                  <p className="text-2xl font-bold">{totalViews.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Total Views</p>
                </div>
                <div className="rounded-lg border border-border/40 p-3">
                  <p className="text-2xl font-bold">{overallCtr}%</p>
                  <p className="text-xs text-muted-foreground">Click-Through Rate</p>
                </div>
                <div className="rounded-lg border border-border/40 p-3">
                  <p className="text-2xl font-bold">{avgWatch}s</p>
                  <p className="text-xs text-muted-foreground">Avg. View Duration</p>
                </div>
                <div className="col-span-2 sm:col-span-4 text-xs text-muted-foreground">
                  By tier — Value (7d): {tierCounts.day7} · Standard (14d): {tierCounts.day14} · Premium (30d): {tierCounts.day30}
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Promos</CardTitle>
          <CardDescription>Remove any promo regardless of status. Views/clicks/watch time are tracked from the PROMO BLAST popup.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : !ads || ads.length === 0 ? (
            <p className="text-sm text-muted-foreground">No promos yet.</p>
          ) : (
            <div className="space-y-2">
              {ads.map((ad: any) => {
                const views = ad.viewCount ?? 0;
                const clicks = ad.clickCount ?? 0;
                const ctr = views > 0 ? ((clicks / views) * 100).toFixed(1) : '—';
                const avgWatch = views > 0 ? ((ad.totalWatchSeconds ?? 0) / views).toFixed(1) : '—';
                return (
                  <div key={ad.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/40 px-3 py-2">
                    <div className="flex items-center gap-3 min-w-0">
                      {ad.mediaType === 'image' ? (
                        <img src={ad.mediaUrl} alt="" className="h-10 w-10 rounded object-cover shrink-0" />
                      ) : (
                        <video src={ad.mediaUrl} className="h-10 w-10 rounded object-cover shrink-0" muted />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">@{ad.username}</p>
                        <p className="text-xs text-muted-foreground truncate">{ad.buttonText} → {ad.buttonLink}</p>
                        <p className="text-[10px] text-muted-foreground/80">
                          {views} views · {clicks} clicks · {ctr}% CTR · avg {avgWatch}s watched
                        </p>
                        {ad.questInstructions && (
                          <p className="text-[10px] text-amber-400/90 truncate">🎯 &quot;{ad.questInstructions}&quot;</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {ad.unskippable && <Badge className="text-[10px] bg-orange-950/40 border border-orange-500/30 text-orange-400">Unskippable</Badge>}
                      {ad.wantsMediaQuest && <Badge className="text-[10px] bg-amber-950/40 border border-amber-500/30 text-amber-400">CYBAQUEST</Badge>}
                      <Badge className={cn('text-[10px]', AD_STATUS_BADGE[ad.status])}>{ad.status}</Badge>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleRemoveAd(ad.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
//  CYBACOIN Bundle Management
// ─────────────────────────────────────────────
function CcBundleManagement() {
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const configRef = useMemoFirebase(() => doc(firestore, 'settings', 'cybaCoinBundles'), [firestore]);
  const { data: rawConfig } = useDoc<Partial<CcBundlesConfig>>(configRef);
  const [config, setConfig] = useState<CcBundlesConfig>(DEFAULT_CC_BUNDLES);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setConfig(rawConfig ? { ...DEFAULT_CC_BUNDLES, ...rawConfig } : DEFAULT_CC_BUNDLES);
  }, [rawConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(firestore, 'settings', 'cybaCoinBundles'), config);
      toast({ title: 'CYBACOIN Bundle settings saved' });
    } catch {
      toast({ variant: 'destructive', title: 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>CYBACOIN Bundles</CardTitle>
        <CardDescription>Fiat purchase tiers for CYBACOIN, sold from the Wallet page.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {CC_BUNDLE_ORDER.map(key => (
          <div key={key} className="grid sm:grid-cols-[100px_90px_90px_1fr] gap-2 items-center">
            <span className="text-xs text-muted-foreground">{config[key].name}</span>
            <Input
              value={config[key].amount}
              type="number" min={0}
              onChange={e => setConfig(prev => ({ ...prev, [key]: { ...prev[key], amount: parseInt(e.target.value, 10) || 0 } }))}
              placeholder="10000"
            />
            <Input
              value={config[key].priceLabel}
              onChange={e => setConfig(prev => ({ ...prev, [key]: { ...prev[key], priceLabel: e.target.value } }))}
              placeholder="$4.99"
            />
            <Input
              value={config[key].buttonLink}
              onChange={e => setConfig(prev => ({ ...prev, [key]: { ...prev[key], buttonLink: e.target.value } }))}
              placeholder="https://buy.stripe.com/..."
            />
          </div>
        ))}
        <p className="text-[11px] text-muted-foreground">
          Each Stripe product name must contain &quot;cybacoin bundle&quot; plus its tier keyword (&quot;small&quot;, &quot;medium&quot;, or &quot;large&quot;), and collect one custom field: CYBAZONE username.
        </p>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Settings
        </Button>
      </CardContent>
    </Card>
  );
}

// Live streaming is template-only so far (see src/app/live/[username]/page.tsx) — this is just
// the stats section's placeholder shell, ready to wire up once real streaming exists.
function LiveStreamingStatsStub() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Live Streaming Analytics</CardTitle>
        <CardDescription>Placeholder — real data once Live Broadcasting is built out.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3 text-center opacity-50">
          <div className="rounded-lg border border-dashed border-border/40 p-3">
            <p className="text-2xl font-bold">—</p>
            <p className="text-xs text-muted-foreground">Streams Hosted</p>
          </div>
          <div className="rounded-lg border border-dashed border-border/40 p-3">
            <p className="text-2xl font-bold">—</p>
            <p className="text-xs text-muted-foreground">Most Viewed Creator</p>
          </div>
          <div className="rounded-lg border border-dashed border-border/40 p-3">
            <p className="text-2xl font-bold">—</p>
            <p className="text-xs text-muted-foreground">CC Volume Transacted</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
//  FAQ Management
// ─────────────────────────────────────────────
type FaqItem = { q: string; a: string };

const DEFAULT_FAQS: FaqItem[] = [
  { q: 'What is CYBAZONE?', a: 'CYBAZONE is a creator community where creatives and their supporters connect, share, and lift each other up.' },
  { q: 'What are CYBACoins?', a: 'CYBACoins are the in-platform currency you earn by engaging with the community. Use them in the Shop or to Boost content.' },
  { q: 'How do I earn CYBACoins?', a: 'You earn CYBACoins by posting content, supporting other creators, and completing CYBAQuests.' },
  { q: 'How do Boosts work?', a: 'Boosts increase the visibility of a post in the feed, helping creators reach a wider audience.' },
  { q: 'How do I contact support?', a: 'Visit our Contact Us page or reach out through our social media channels.' },
];

function FAQManagement() {
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const faqRef = useMemoFirebase(() => doc(firestore, 'settings', 'faq'), [firestore]);
  const { data } = useDoc<{ items: FaqItem[] }>(faqRef);

  const [items, setItems] = useState<FaqItem[]>(DEFAULT_FAQS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.items?.length) setItems(data.items);
  }, [data]);

  const update = (i: number, field: 'q' | 'a', value: string) => {
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  };

  const addItem = () => setItems(prev => [...prev, { q: '', a: '' }]);

  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));

  const moveItem = (i: number, dir: -1 | 1) => {
    const next = i + dir;
    if (next < 0 || next >= items.length) return;
    setItems(prev => {
      const arr = [...prev];
      [arr[i], arr[next]] = [arr[next], arr[i]];
      return arr;
    });
  };

  const handleSave = async () => {
    const valid = items.filter(it => it.q.trim() && it.a.trim());
    if (!valid.length) { toast({ variant: 'destructive', title: 'No valid FAQ items' }); return; }
    setSaving(true);
    try {
      await setDoc(doc(firestore, 'settings', 'faq'), { items: valid });
      toast({ title: 'FAQ saved' });
    } catch {
      toast({ variant: 'destructive', title: 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Reset FAQ to defaults?')) return;
    setSaving(true);
    try {
      await setDoc(doc(firestore, 'settings', 'faq'), { items: DEFAULT_FAQS });
      setItems(DEFAULT_FAQS);
      toast({ title: 'FAQ reset to defaults' });
    } catch {
      toast({ variant: 'destructive', title: 'Reset failed' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>FAQ Editor</CardTitle>
          <CardDescription>Add, edit, reorder, or remove FAQ items. Changes go live instantly on the FAQ page.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item, i) => (
            <div key={i} className="border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Q{i + 1}</span>
                <div className="flex items-center gap-1 ml-auto">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveItem(i, -1)} disabled={i === 0}>
                    ↑
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveItem(i, 1)} disabled={i === items.length - 1}>
                    ↓
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeItem(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <Input
                placeholder="Question"
                value={item.q}
                onChange={e => update(i, 'q', e.target.value)}
                className="font-medium"
              />
              <Textarea
                placeholder="Answer"
                value={item.a}
                onChange={e => update(i, 'a', e.target.value)}
                rows={3}
                className="text-sm resize-none"
              />
            </div>
          ))}

          <Button variant="outline" onClick={addItem} className="w-full">
            <PlusCircle className="h-4 w-4 mr-2" /> Add Question
          </Button>

          <Separator />

          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save FAQ
            </Button>
            <Button variant="outline" onClick={handleReset} disabled={saving}>
              Reset to Defaults
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Custom Quest Management (Media Submission)
// ─────────────────────────────────────────────
const EMPTY_CUSTOM_QUEST: Omit<CustomQuest, 'id' | 'createdAt'> = {
  title: '',
  description: '',
  flavorText: '',
  nodeEmoji: '⭐',
  difficulty: 'medium',
  order: 50,
  isMediaQuest: false,
  mediaInstructions: '',
  payout: { type: 'cybacoin', amount: 100 },
  unlockPrice: null,
  showOnRewardsPage: false,
  active: true,
  weeklySlots: 0,
  slotResetDay: 0,
  requiredLevel: undefined,
  milestoneType: undefined,
  milestoneThreshold: undefined,
};

function CustomQuestForm({
  item,
  onClose,
}: {
  item?: CustomQuest;
  onClose: () => void;
}) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Omit<CustomQuest, 'id' | 'createdAt'>>(
    item
      ? {
          title: item.title,
          description: item.description,
          flavorText: item.flavorText ?? '',
          nodeEmoji: item.nodeEmoji,
          difficulty: item.difficulty,
          order: item.order ?? 50,
          isMediaQuest: item.isMediaQuest ?? false,
          mediaInstructions: item.mediaInstructions ?? '',
          payout: item.payout,
          unlockPrice: item.unlockPrice ?? null,
          showOnRewardsPage: item.showOnRewardsPage ?? false,
          active: item.active,
          weeklySlots: item.weeklySlots ?? 0,
          slotResetDay: item.slotResetDay ?? 0,
          requiredLevel: item.requiredLevel ?? undefined,
          milestoneType: item.milestoneType ?? undefined,
          milestoneThreshold: item.milestoneThreshold ?? undefined,
        }
      : { ...EMPTY_CUSTOM_QUEST }
  );

  const set = (field: string, value: any) => setForm(p => ({ ...p, [field]: value }));
  const setPayout = (field: string, value: any) => setForm(p => ({ ...p, payout: { ...p.payout, [field]: value } }));
  const setUnlock = (field: string, value: any) =>
    setForm(p => ({ ...p, unlockPrice: p.unlockPrice ? { ...p.unlockPrice, [field]: value } : { currency: 'cc', amount: 500, [field]: value } }));

  const handleSave = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      toast({ variant: 'destructive', title: 'Title and description are required.' });
      return;
    }
    if (form.isMediaQuest && !form.mediaInstructions?.trim()) {
      toast({ variant: 'destructive', title: 'Media instructions are required for media quests.' });
      return;
    }
    setSaving(true);
    try {
      // Strip undefined values — Firestore rejects them in updateDoc
      const cleanForm = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== undefined));
      if (item) {
        await updateDoc(doc(firestore, 'custom_quests', item.id), cleanForm);
        toast({ title: 'Quest updated!' });
      } else {
        await addDoc(collection(firestore, 'custom_quests'), { ...cleanForm, createdAt: serverTimestamp() });
        toast({ title: 'Quest created!' });
      }
      onClose();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">

      {/* Quest type toggle */}
      <div className="flex items-center justify-between border rounded-xl p-3 border-primary/30 bg-primary/5">
        <div>
          <p className="text-sm font-semibold">{form.isMediaQuest ? '📸 Media Quest' : '⭐ Regular Quest'}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {form.isMediaQuest
              ? 'User uploads a photo/video for admin approval.'
              : 'User claims instantly — no upload needed.'}
          </p>
        </div>
        <Switch checked={!!form.isMediaQuest} onCheckedChange={v => set('isMediaQuest', v)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground block mb-1">Title</label>
          <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Quest title" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Emoji</label>
          <Input value={form.nodeEmoji} onChange={e => set('nodeEmoji', e.target.value)} className="h-8" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Difficulty</label>
          <Select value={form.difficulty} onValueChange={v => set('difficulty', v)}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['easy', 'medium', 'hard', 'legendary'].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Display Order</label>
          <Input type="number" min={1} value={form.order ?? 50} onChange={e => set('order', Number(e.target.value))} className="h-8" />
        </div>
        <div className="flex items-center gap-2 mt-5">
          <Switch checked={form.active} onCheckedChange={v => set('active', v)} />
          <label className="text-xs text-muted-foreground">Active</label>
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground block mb-1">Description</label>
        <Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} />
      </div>
      <div>
        <label className="text-xs text-muted-foreground block mb-1">Flavor Text</label>
        <Textarea value={form.flavorText} onChange={e => set('flavorText', e.target.value)} rows={1} placeholder={'"A quote or tagline."'} />
      </div>
      {form.isMediaQuest && (
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Media Instructions (shown to user on submit)</label>
          <Textarea value={form.mediaInstructions ?? ''} onChange={e => set('mediaInstructions', e.target.value)} rows={2} placeholder="e.g. Upload a photo of your workspace" />
        </div>
      )}

      {/* Weekly slot limits (media quests only) */}
      {form.isMediaQuest && (
        <div className="border border-border rounded-xl p-3 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Weekly Slot Limit</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Max Submissions / Week (0 = unlimited)</label>
              <Input type="number" min={0} value={form.weeklySlots ?? 0}
                onChange={e => set('weeklySlots', Math.max(0, parseInt(e.target.value, 10) || 0))} className="h-8" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Resets On</label>
              <Select value={String(form.slotResetDay ?? 0)} onValueChange={v => set('slotResetDay', parseInt(v, 10))}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((d, i) => (
                    <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Auto-tracked milestone (non-media quests only) — claim gates on a live counter instead
          of a submission. Currently only PROMO BLAST click-throughs. */}
      {!form.isMediaQuest && (
        <div className="border border-border rounded-xl p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Auto-Tracked Milestone</p>
            <Switch
              checked={form.milestoneType === 'promo_clicks'}
              onCheckedChange={c => {
                set('milestoneType', c ? 'promo_clicks' : undefined);
                if (!c) set('milestoneThreshold', undefined);
              }}
            />
          </div>
          {form.milestoneType === 'promo_clicks' && (
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                PROMO BLAST click-throughs needed (all-time, across every promo the member has run)
              </label>
              <Input
                type="number" min={1} value={form.milestoneThreshold ?? ''}
                onChange={e => set('milestoneThreshold', parseInt(e.target.value, 10) || undefined)}
                className="h-8" placeholder="e.g. 50"
              />
            </div>
          )}
        </div>
      )}

      {/* Level gate */}
      <div className="border border-border rounded-xl p-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Level Requirement</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Required Level (optional)</label>
            <Select
              value={form.requiredLevel ?? 'none'}
              onValueChange={v => set('requiredLevel', v === 'none' ? undefined : v)}
            >
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No requirement</SelectItem>
                <SelectItem value="spark">⚡ Spark</SelectItem>
                <SelectItem value="charge">🔋 Charge</SelectItem>
                <SelectItem value="surge">🌊 Surge</SelectItem>
                <SelectItem value="storm">⛈️ Storm</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Users below this level see the quest but can't participate until they level up.</p>
      </div>

      {/* Payout */}
      <div className="border border-border rounded-xl p-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          {form.isMediaQuest ? 'Payout (on media approval)' : 'Payout (instant on claim)'}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Type</label>
            <Select value={form.payout.type} onValueChange={v => setPayout('type', v)}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cybacoin">CYBACOIN</SelectItem>
                <SelectItem value="cash">Cash (USD)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">{form.payout.type === 'cybacoin' ? 'Amount (CC)' : 'Amount ($)'}</label>
            <Input type="number" step={form.payout.type === 'cash' ? '0.01' : '1'} min={0}
              value={form.payout.amount} onChange={e => setPayout('amount', Number(e.target.value))} className="h-8" />
          </div>
        </div>
      </div>

      {/* Unlock Price (buy to unlock) */}
      <div className="border border-border rounded-xl p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Switch
            checked={!!form.unlockPrice}
            onCheckedChange={v => set('unlockPrice', v ? { currency: 'cc', amount: 500 } : null)}
          />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Buyable Unlock</p>
        </div>
        {form.unlockPrice && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Currency</label>
                <Select value={form.unlockPrice.currency} onValueChange={v => setUnlock('currency', v)}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cc">CYBACOIN</SelectItem>
                    <SelectItem value="cash">Cash (Stripe)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">{form.unlockPrice.currency === 'cc' ? 'Price (CC)' : 'Price ($)'}</label>
                <Input type="number" min={0} value={form.unlockPrice.amount}
                  onChange={e => setUnlock('amount', Number(e.target.value))} className="h-8" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={!!form.showOnRewardsPage} onCheckedChange={v => set('showOnRewardsPage', v)} />
              <label className="text-xs text-muted-foreground">Also show on Rewards page</label>
            </div>
          </>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
          {item ? 'Save Changes' : 'Create Quest'}
        </Button>
      </div>
    </div>
  );
}

function CustomQuestManagement() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [editItem, setEditItem] = useState<CustomQuest | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const questsQuery = useMemoFirebase(
    () => query(collection(firestore, 'custom_quests'), orderBy('createdAt', 'desc')),
    [firestore]
  );
  const { data: quests, isLoading } = useCollection<CustomQuest>(questsQuery);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this quest? Existing submissions will still exist.')) return;
    await deleteDoc(doc(firestore, 'custom_quests', id));
    toast({ title: 'Quest deleted' });
  };

  const handleToggleActive = async (q: CustomQuest) => {
    await updateDoc(doc(firestore, 'custom_quests', q.id), { active: !q.active });
    toast({ title: q.active ? 'Quest hidden' : 'Quest made active' });
  };

  return (
    <>
      <Dialog open={!!editItem} onOpenChange={open => !open && setEditItem(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Quest: {editItem?.nodeEmoji} {editItem?.title}</DialogTitle>
          </DialogHeader>
          {editItem && <CustomQuestForm item={editItem} onClose={() => setEditItem(null)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Custom Quest</DialogTitle>
            <DialogDescription>Toggle the quest type: Regular quests are claimed instantly; Media quests require an upload for admin approval.</DialogDescription>
          </DialogHeader>
          <CustomQuestForm onClose={() => setCreateOpen(false)} />
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Custom Quests</CardTitle>
            <CardDescription>Regular quests are claimed instantly. Media quests require a photo/video upload for approval.</CardDescription>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <PlusCircle className="w-4 h-4 mr-1" /> New Quest
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
          ) : !quests?.length ? (
            <div className="text-center py-10 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
              No custom quests yet. Create one above.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quest</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead>Payout</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quests.map(q => (
                  <TableRow key={q.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{q.nodeEmoji} {q.title}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-xs">{q.description}</div>
                    </TableCell>
                    <TableCell>
                      {q.isMediaQuest
                        ? <Badge variant="outline" className="text-xs text-blue-400 border-blue-500/40">📸 Media</Badge>
                        : <Badge variant="outline" className="text-xs text-yellow-400 border-yellow-500/40">⭐ Regular</Badge>
                      }
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">{q.difficulty}</Badge>
                    </TableCell>
                    <TableCell>
                      {q.payout.type === 'cybacoin'
                        ? <span className="text-yellow-400 font-bold text-sm">{q.payout.amount.toLocaleString()} CC</span>
                        : <span className="text-green-400 font-bold text-sm">${q.payout.amount.toFixed(2)}</span>
                      }
                    </TableCell>
                    <TableCell>
                      <button onClick={() => handleToggleActive(q)}>
                        {q.active
                          ? <Badge className="bg-green-600 text-white text-xs">Active</Badge>
                          : <Badge variant="outline" className="text-xs text-muted-foreground">Hidden</Badge>
                        }
                      </button>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={() => setEditItem(q)}>
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(q.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// ─────────────────────────────────────────────
//  Quest Submissions (Media Approval)
// ─────────────────────────────────────────────
function QuestSubmissions() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [reviewNote, setReviewNote] = useState('');
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  // Only load media quest submissions (no orderBy to avoid needing a composite index)
  const subsQuery = useMemoFirebase(
    () => query(collection(firestore, 'quest_submissions'), where('submissionType', '==', 'quest'), limit(200)),
    [firestore]
  );
  const { data: rawSubmissions, isLoading } = useCollection<QuestSubmission & { payout?: { type: string; amount: number } }>(subsQuery);
  const allSubmissions = useMemo(
    () => [...(rawSubmissions ?? [])].sort((a: any, b: any) => (b.submittedAt?.seconds ?? 0) - (a.submittedAt?.seconds ?? 0)),
    [rawSubmissions]
  );
  const submissions = filter === 'all' ? allSubmissions : allSubmissions.filter(s => s.status === filter);

  // Media instructions live on the quest definition, not the submission doc — look them up by
  // questId so reviewers see "what did we ask them to do?" inline next to each submission.
  const customQuestsQuery = useMemoFirebase(() => collection(firestore, 'custom_quests'), [firestore]);
  const { data: customQuests } = useCollection<CustomQuest>(customQuestsQuery);
  const mediaInstructionsByQuestId = useMemo(() => {
    const map = new Map<string, string>();
    (customQuests ?? []).forEach(q => { if (q.mediaInstructions) map.set(q.id, q.mediaInstructions); });
    return map;
  }, [customQuests]);

  const handleApprove = async (sub: QuestSubmission & { payout?: { type: string; amount: number } }) => {
    setActing(sub.id);
    try {
      // Update submission status
      await updateDoc(doc(firestore, 'quest_submissions', sub.id), {
        status: 'approved',
        reviewedAt: serverTimestamp(),
        reviewNote: '',
      });

      let notifMessage = 'Your submission was approved!';
      let notifLink = '/cybaquests';

      // Issue payout
      const payout = sub.payout;
      if (payout && payout.amount > 0) {
        if (payout.type === 'cybacoin') {
          await updateDoc(doc(firestore, 'users', sub.userId), {
            cybaCoinBalance: increment(payout.amount),
          });
          await logTransaction(firestore, sub.userId, {
            type: 'quest_media_payout',
            amount: payout.amount,
            description: `Submission Approved: ${sub.questTitle ?? 'Submission'}`,
          });
          notifMessage = `"${sub.questTitle ?? 'Your submission'}" approved! +${payout.amount.toLocaleString()} CC added to your wallet.`;
          notifLink = '/wallet';
        } else if (payout.type === 'cash') {
          await updateDoc(doc(firestore, 'users', sub.userId), {
            payoutBalance: increment(payout.amount),
          });
          await logCashTransaction(firestore, sub.userId, {
            type: 'quest_payout',
            amount: payout.amount,
            description: `Submission Approved: ${sub.questTitle ?? 'Submission'}`,
          });
          notifMessage = `"${sub.questTitle ?? 'Your submission'}" approved! $${payout.amount.toFixed(2)} added to your cash balance.`;
          notifLink = '/wallet';
        }
      } else {
        notifMessage = `"${sub.questTitle ?? 'Your submission'}" was approved!`;
      }
      toast({ title: 'Approved!', description: `Payout issued to @${sub.username}.` });

      // Send bell notification to user
      await createNotification(firestore, sub.userId, {
        type: 'submission_approved',
        actorId: 'system',
        actorUsername: 'CYBAZONE',
        message: notifMessage,
        linkTo: notifLink,
      });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Action failed' });
    } finally {
      setActing(null);
    }
  };

  const handleReject = async (sub: QuestSubmission) => {
    setActing(sub.id);
    try {
      await updateDoc(doc(firestore, 'quest_submissions', sub.id), {
        status: 'rejected',
        reviewedAt: serverTimestamp(),
        reviewNote,
      });

      // Send bell notification to user
      const title = sub.questTitle ?? sub.rewardName ?? 'Your submission';
      await createNotification(firestore, sub.userId, {
        type: 'submission_rejected',
        actorId: 'system',
        actorUsername: 'CYBAZONE',
        message: `"${title}" was not approved.${reviewNote ? ` Reason: ${reviewNote}` : ''}`,
        linkTo: '/cybaquests',
      });

      setReviewingId(null);
      setReviewNote('');
      toast({ title: 'Submission rejected.' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Action failed' });
    } finally {
      setActing(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submissions</CardTitle>
        <CardDescription>Review media submissions for quests. Approving issues the payout automatically.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filter tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'default' : 'outline'}
              className="capitalize"
              onClick={() => setFilter(f)}
            >
              {f === 'pending' && '⏳ '}
              {f === 'approved' && '✅ '}
              {f === 'rejected' && '❌ '}
              {f}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
        ) : !submissions?.length ? (
          <div className="text-center py-10 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
            No {filter === 'all' ? '' : filter} submissions.
          </div>
        ) : (
          <div className="space-y-4">
            {submissions.map(sub => (
              <div key={sub.id} className={cn(
                'border rounded-xl p-4 space-y-3',
                sub.status === 'pending'  && 'border-blue-500/30 bg-blue-950/10',
                sub.status === 'approved' && 'border-green-500/30 bg-green-950/10',
                sub.status === 'rejected' && 'border-red-500/30 bg-red-950/10',
              )}>
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">
                        {sub.questTitle ?? 'Quest Submission'}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      by <span className="text-foreground font-medium">@{sub.username}</span>
                      {' · '}
                      {sub.submittedAt?.toDate ? formatDistanceToNow(sub.submittedAt.toDate(), { addSuffix: true }) : '—'}
                    </p>
                    {sub.questId && mediaInstructionsByQuestId.get(sub.questId) && (
                      <p className="text-xs text-amber-400/90 mt-1">
                        🎯 Asked: &quot;{mediaInstructionsByQuestId.get(sub.questId)}&quot;
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {sub.payout && sub.payout.amount > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {sub.payout.type === 'cybacoin'
                          ? `${sub.payout.amount.toLocaleString()} CC`
                          : `$${sub.payout.amount.toFixed(2)}`}
                      </Badge>
                    )}
                    <Badge
                      className={cn(
                        'text-xs capitalize',
                        sub.status === 'pending'  && 'bg-blue-600',
                        sub.status === 'approved' && 'bg-green-600',
                        sub.status === 'rejected' && 'bg-red-600',
                      )}
                    >
                      {sub.status}
                    </Badge>
                  </div>
                </div>

                {/* Media preview */}
                <div className="rounded-lg overflow-hidden border border-border bg-black/30 max-h-64 flex items-center justify-center">
                  {sub.mediaType === 'video' ? (
                    <video src={sub.mediaUrl} controls className="max-h-64 max-w-full" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sub.mediaUrl} alt="submission" className="max-h-64 max-w-full object-contain" />
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs"
                  onClick={async () => {
                    // iOS Safari ignores <a download> silently — open directly instead
                    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
                    if (isIOS) {
                      window.open(sub.mediaUrl, '_blank');
                      return;
                    }
                    try {
                      const res = await fetch(sub.mediaUrl);
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `submission-${sub.id}.${sub.mediaType === 'video' ? 'mp4' : 'jpg'}`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    } catch {
                      window.open(sub.mediaUrl, '_blank');
                    }
                  }}
                >
                  <Download className="w-3.5 h-3.5 mr-1" /> Download Media
                </Button>

                {/* Review note if rejected */}
                {sub.status === 'rejected' && sub.reviewNote && (
                  <p className="text-xs text-red-400/80 bg-red-950/20 rounded px-3 py-2 border border-red-500/20">
                    Note: {sub.reviewNote}
                  </p>
                )}

                {/* Actions — only for pending */}
                {sub.status === 'pending' && (
                  <div className="space-y-2">
                    {reviewingId === sub.id ? (
                      <div className="space-y-2">
                        <Input
                          placeholder="Rejection reason (optional)"
                          value={reviewNote}
                          onChange={e => setReviewNote(e.target.value)}
                          className="h-8 text-sm"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => { setReviewingId(null); setReviewNote(''); }}>
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={acting === sub.id}
                            onClick={() => handleReject(sub)}
                          >
                            {acting === sub.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                            Confirm Reject
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-500 text-white"
                          disabled={acting === sub.id}
                          onClick={() => handleApprove(sub)}
                        >
                          {acting === sub.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle className="w-3.5 h-3.5 mr-1" />}
                          Approve &amp; Pay Out
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={acting === sub.id}
                          onClick={() => setReviewingId(sub.id)}
                        >
                          <Ban className="w-3.5 h-3.5 mr-1" /> Reject
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
//  Cash Out Requests
// ─────────────────────────────────────────────
type CashoutRequest = {
  id: string;
  userId: string;
  username: string;
  amount: number;
  status: 'pending' | 'fulfilled';
  requestedAt: any;
  fulfilledAt?: any;
  adminNote?: string;
};

function CashOutRequests() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [filter, setFilter] = useState<'pending' | 'fulfilled' | 'all'>('pending');
  const [fulfilling, setFulfilling] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [noteFor, setNoteFor] = useState<string | null>(null);

  const requestsQuery = useMemoFirebase(
    () => filter === 'all'
      ? query(collection(firestore, 'cashout_requests'), limit(100))
      : query(collection(firestore, 'cashout_requests'), where('status', '==', filter), limit(100)),
    [firestore, filter]
  );
  const { data: requestsRaw, isLoading } = useCollection<CashoutRequest>(requestsQuery);
  const requests = useMemo(
    () => [...(requestsRaw ?? [])].sort((a: any, b: any) => (b.requestedAt?.seconds ?? 0) - (a.requestedAt?.seconds ?? 0)),
    [requestsRaw]
  );

  const handleFulfill = async (req: CashoutRequest) => {
    setFulfilling(req.id);
    try {
      await updateDoc(doc(firestore, 'cashout_requests', req.id), {
        status: 'fulfilled',
        fulfilledAt: serverTimestamp(),
        adminNote: adminNote || '',
      });
      // Actually deduct the paid-out amount from the user's wallet balance — previously this
      // only logged a transaction without touching payoutBalance, so a "fulfilled" request left
      // the balance untouched and the same amount could be requested again indefinitely.
      await updateDoc(doc(firestore, 'users', req.userId), {
        payoutBalance: increment(-req.amount),
      });
      // Log the fulfillment on the user's cash transaction history
      await logCashTransaction(firestore, req.userId, {
        type: 'cashout_fulfilled',
        amount: -req.amount,
        description: `Cash Out Fulfilled: $${req.amount.toFixed(2)}${adminNote ? ` — ${adminNote}` : ''}`,
      });
      setNoteFor(null);
      setAdminNote('');
      toast({ title: 'Marked as fulfilled!', description: `$${req.amount.toFixed(2)} payout for @${req.username} recorded.` });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Action failed' });
    } finally {
      setFulfilling(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cash Out Requests</CardTitle>
        <CardDescription>
          Users request their cash balance via CashApp/Venmo. Mark as fulfilled once paid on your end.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filter */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {(['pending', 'fulfilled', 'all'] as const).map(f => (
            <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} className="capitalize" onClick={() => setFilter(f)}>
              {f === 'pending'   && '💸 '}
              {f === 'fulfilled' && '✅ '}
              {f}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
        ) : !requests?.length ? (
          <div className="text-center py-10 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
            No {filter === 'all' ? '' : filter} cash out requests.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map(req => (
                <TableRow key={req.id}>
                  <TableCell className="font-medium">@{req.username}</TableCell>
                  <TableCell className="font-bold text-green-400">${req.amount.toFixed(2)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {req.requestedAt?.toDate ? formatDistanceToNow(req.requestedAt.toDate(), { addSuffix: true }) : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge className={cn(
                      'text-xs capitalize',
                      req.status === 'pending'   && 'bg-yellow-600',
                      req.status === 'fulfilled' && 'bg-green-600',
                    )}>
                      {req.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center gap-2 justify-end">
                      {req.status === 'pending' && (
                        noteFor === req.id ? (
                          <>
                            <Input
                              placeholder="Note (e.g. sent via CashApp)"
                              value={adminNote}
                              onChange={e => setAdminNote(e.target.value)}
                              className="h-7 text-xs w-48"
                            />
                            <Button size="sm" variant="outline" onClick={() => { setNoteFor(null); setAdminNote(''); }}>✕</Button>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-500 text-white"
                              disabled={fulfilling === req.id}
                              onClick={() => handleFulfill(req)}
                            >
                              {fulfilling === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : '✓ Done'}
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" className="bg-green-600 hover:bg-green-500 text-white" onClick={() => setNoteFor(req.id)}>
                            Mark Fulfilled
                          </Button>
                        )
                      )}
                      {req.status === 'fulfilled' && (
                        <span className="text-xs text-muted-foreground">
                          {req.fulfilledAt?.toDate ? formatDistanceToNow(req.fulfilledAt.toDate(), { addSuffix: true }) : 'done'}
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={async () => {
                          if (!confirm('Delete this payout request?')) return;
                          await deleteDoc(doc(firestore, 'cashout_requests', req.id));
                          toast({ title: 'Request deleted' });
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
//  Weekly Payouts (history + manual trigger)
// ─────────────────────────────────────────────
type PayoutHistoryEntry = {
  id: string;
  executedAt: any;
  weekOf: number;
  payouts: { rank: number; username: string; amount: number; paid: boolean }[];
};

const LAUNCH_RESET_PHRASE = 'RESET_FOR_LAUNCH';

// One-time, admin-triggered launch reset — zeroes every user's CYBACOIN, level stats, and
// quest progress, then grants a flat 10,000 CC. Meant to be run exactly once, at actual
// public launch. Gated behind a typed confirmation phrase so it can't fire accidentally.
function LaunchResetPanel() {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const run = async () => {
    if (confirmText !== LAUNCH_RESET_PHRASE) return;
    if (!confirm('This resets EVERY user\'s CYBACOIN, level, and quest progress, then grants 10,000 CC to each. This cannot be undone. Proceed?')) return;
    setRunning(true);
    try {
      const res = await fetch('/api/admin/trigger-cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: 'launch-reset', confirm: LAUNCH_RESET_PHRASE }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Request failed');
      toast({ title: 'Launch reset complete', description: `${data.usersReset ?? 0} user(s) reset and granted 10,000 CC.` });
      setConfirmText('');
    } catch (e) {
      toast({ variant: 'destructive', title: 'Launch reset failed', description: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="text-destructive">⚠ Launch Reset (one-time, irreversible)</CardTitle>
        <CardDescription>
          Zeroes CYBACOIN, level stats (posts/support), and quest progress for EVERY user, then grants a flat 10,000 CC to each.
          Run this exactly once, at actual public launch — not before. There is no undo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">
            Type <code className="font-mono text-destructive">{LAUNCH_RESET_PHRASE}</code> to enable the button.
          </label>
          <Input
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder={LAUNCH_RESET_PHRASE}
            className="font-mono max-w-xs"
          />
        </div>
        <Button
          variant="destructive"
          disabled={running || confirmText !== LAUNCH_RESET_PHRASE}
          onClick={run}
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Run Launch Reset Now
        </Button>
      </CardContent>
    </Card>
  );
}

function WeeklyPayouts() {
  const { firestore, user: currentUser } = useFirebase();
  const { toast } = useToast();
  const [triggering, setTriggering] = useState<'payout' | 'reset' | 'boost-billing' | 'subnet-billing' | 'cleanup-ads' | 'promo-expiry' | 'cleanup-pulses' | 'backfill-weekly' | 'birthday-gift' | null>(null);

  const historyQuery = useMemoFirebase(
    () => query(
      collection(firestore, 'weekly_payout_history'),
      orderBy('executedAt', 'desc'),
      limit(10)
    ),
    [firestore]
  );
  const { data: history, isLoading } = useCollection<PayoutHistoryEntry>(historyQuery);

  const sendTopCybaMessage = async (topUserId: string, topUsername: string, senderId: string, senderInfo: any) => {
    const AUTO_MSG = `Congrats on being the Top CYBA of the week! What Boost would you like to activate for next week? Market, Radio, or Spotlight?`;
    try {
      const key = [senderId, topUserId].sort().join('_');
      const existing = await getDocs(query(
        collection(firestore, 'conversations'),
        where('participantKey', '==', key),
        limit(1)
      ));
      let convId: string;
      if (!existing.empty) {
        convId = existing.docs[0].id;
      } else {
        const targetSnap = await getDoc(doc(firestore, 'users', topUserId));
        const targetData = targetSnap.data() as any;
        const ref = await addDoc(collection(firestore, 'conversations'), {
          type: 'direct',
          participants: [senderId, topUserId],
          participantKey: key,
          participantInfo: {
            [senderId]: senderInfo,
            [topUserId]: {
              username: targetData?.username ?? topUsername,
              profilePictureUrl: targetData?.profilePictureUrl ?? null,
              avatarConfig: targetData?.avatarConfig ?? null,
            },
          },
          unreadCounts: { [senderId]: 0, [topUserId]: 0 },
          createdAt: serverTimestamp(),
          createdBy: senderId,
          lastMessageAt: serverTimestamp(),
          lastMessage: AUTO_MSG,
        });
        convId = ref.id;
      }
      await addDoc(collection(firestore, 'conversations', convId, 'messages'), {
        senderId,
        senderUsername: senderInfo.username,
        text: AUTO_MSG,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(firestore, 'conversations', convId), {
        lastMessage: AUTO_MSG,
        lastMessageAt: serverTimestamp(),
        [`unreadCounts.${topUserId}`]: increment(1),
      });
    } catch (e) {
      console.error('Auto-message to top CYBA failed:', e);
    }
  };

  const triggerCron = async (endpoint: 'weekly-payout' | 'weekly-reset' | 'weekly-boost-billing' | 'weekly-subnet-billing' | 'cleanup-ads' | 'promo-expiry-warning' | 'cleanup-pulses' | 'backfill-weekly-scores' | 'birthday-gift') => {
    setTriggering(
      endpoint === 'weekly-payout' ? 'payout'
      : endpoint === 'weekly-reset' ? 'reset'
      : endpoint === 'weekly-boost-billing' ? 'boost-billing'
      : endpoint === 'weekly-subnet-billing' ? 'subnet-billing'
      : endpoint === 'promo-expiry-warning' ? 'promo-expiry'
      : endpoint === 'cleanup-pulses' ? 'cleanup-pulses'
      : endpoint === 'backfill-weekly-scores' ? 'backfill-weekly'
      : endpoint === 'birthday-gift' ? 'birthday-gift'
      : 'cleanup-ads'
    );
    try {
      const res = await fetch(`/api/admin/trigger-cron`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Request failed');

      // After weekly payout, auto-message the #1 Top CYBA
      if (endpoint === 'weekly-payout' && data.payouts?.length > 0 && currentUser) {
        const top = data.payouts.find((p: any) => p.rank === 1);
        if (top?.userId) {
          const mySnap = await getDoc(doc(firestore, 'users', currentUser.uid));
          const myData = mySnap.data() as any;
          const senderInfo = {
            username: myData?.username ?? 'Admin',
            profilePictureUrl: myData?.profilePictureUrl ?? null,
            avatarConfig: myData?.avatarConfig ?? null,
          };
          await sendTopCybaMessage(top.userId, top.username, currentUser.uid, senderInfo);
        }
      }

      const titles: Record<typeof endpoint, string> = {
        'weekly-payout': 'Payout run complete!',
        'weekly-reset': 'Leaderboard reset!',
        'weekly-boost-billing': 'Boost billing run complete!',
        'weekly-subnet-billing': 'Subnet billing run complete!',
        'cleanup-ads': 'Ad cleanup complete!',
        'promo-expiry-warning': 'Promo expiry warnings sent!',
        'cleanup-pulses': 'Pulse cleanup complete!',
        'backfill-weekly-scores': 'Weekly leaderboard backfilled!',
        'birthday-gift': 'Birthday gifts sent!',
      };
      const descriptions: Record<typeof endpoint, string> = {
        'weekly-payout': `Paid out ${data.paidCount ?? 0} enrolled user(s).`,
        'weekly-reset': `Reset ${data.usersReset ?? 0} users.`,
        'weekly-boost-billing': `Charged/paused subscriptions across Radio, Market, and Spotlight.`,
        'weekly-subnet-billing': `Charged ${data.results?.charged ?? 0}, revoked ${data.results?.revoked ?? 0} Subnet membership(s).`,
        'cleanup-ads': `Expired and promoted ads processed.`,
        'promo-expiry-warning': `Warned ${data.warned ?? 0} promoter(s) whose slot expires within 3 days.`,
        'cleanup-pulses': `Deleted ${data.deleted ?? 0} expired Pulse(s).`,
        'backfill-weekly-scores': `Updated ${data.usersUpdated ?? 0} user(s) with this week's real post/support counts.`,
        'birthday-gift': `Gifted ${data.gifted ?? 0} member(s) celebrating a birthday today.`,
      };
      toast({ title: titles[endpoint], description: descriptions[endpoint] });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Failed', description: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setTriggering(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Manual triggers */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Payout & Reset</CardTitle>
          <CardDescription>
            Runs automatically every Friday at 11:59 PM EST (payout) and Saturday at 12:01 AM EST (reset) via Cloud Scheduler.
            Use the buttons below to trigger manually if needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            className="bg-green-600 hover:bg-green-500 text-white"
            disabled={!!triggering}
            onClick={() => triggerCron('weekly-payout')}
          >
            {triggering === 'payout' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : '💸 '}
            Run Friday Payout Now
          </Button>
          <Button
            variant="outline"
            disabled={!!triggering}
            onClick={() => triggerCron('weekly-reset')}
          >
            {triggering === 'reset' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : '🔄 '}
            Run Saturday Reset Now
          </Button>
          <Button
            variant="outline"
            disabled={!!triggering}
            onClick={() => triggerCron('weekly-boost-billing')}
          >
            {triggering === 'boost-billing' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : '📅 '}
            Run Boost Billing Now
          </Button>
          <Button
            variant="outline"
            className="border-red-500/50 text-red-400 hover:bg-red-950"
            disabled={!!triggering}
            onClick={() => {
              if (confirm('Backfill this week\'s real post/support counts for every user from their actual activity since Sunday? Safe to run more than once.')) {
                triggerCron('backfill-weekly-scores');
              }
            }}
          >
            {triggering === 'backfill-weekly' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : '🛠️ '}
            Fix Weekly Leaderboard (Backfill)
          </Button>
          <Button
            variant="outline"
            disabled={!!triggering}
            onClick={() => triggerCron('weekly-subnet-billing')}
          >
            {triggering === 'subnet-billing' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : '🔒 '}
            Run Subnet Billing Now
          </Button>
          <Button
            variant="outline"
            disabled={!!triggering}
            onClick={() => triggerCron('cleanup-ads')}
          >
            {triggering === 'cleanup-ads' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : '📢 '}
            Run Ad Cleanup Now
          </Button>
          <Button
            variant="outline"
            disabled={!!triggering}
            onClick={() => triggerCron('promo-expiry-warning')}
          >
            {triggering === 'promo-expiry' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : '⏳ '}
            Run Promo Expiry Warnings Now
          </Button>
          <Button
            variant="outline"
            disabled={!!triggering}
            onClick={() => triggerCron('cleanup-pulses')}
          >
            {triggering === 'cleanup-pulses' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : '✨ '}
            Run Pulse Cleanup Now
          </Button>
          <Button
            variant="outline"
            disabled={!!triggering}
            onClick={() => triggerCron('birthday-gift')}
          >
            {triggering === 'birthday-gift' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : '🎂 '}
            Run Birthday Gifts Now
          </Button>
        </CardContent>
      </Card>

      <LaunchResetPanel />

      {/* Payout history */}
      <Card>
        <CardHeader>
          <CardTitle>Payout History</CardTitle>
          <CardDescription>Last 10 weekly payout runs.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
          ) : !history?.length ? (
            <div className="text-center py-10 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
              No payout history yet.
            </div>
          ) : (
            <div className="space-y-4">
              {history.map(entry => (
                <div key={entry.id} className="border border-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">
                      Week of {entry.weekOf ? new Date(entry.weekOf).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {entry.executedAt?.toDate ? formatDistanceToNow(entry.executedAt.toDate(), { addSuffix: true }) : '—'}
                    </p>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rank</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Prize</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entry.payouts?.map(p => (
                        <TableRow key={p.rank}>
                          <TableCell className="font-bold">#{p.rank}</TableCell>
                          <TableCell>@{p.username}</TableCell>
                          <TableCell className="text-green-400 font-bold">${p.amount.toFixed(2)}</TableCell>
                          <TableCell>
                            {p.paid
                              ? <Badge className="bg-green-600 text-white text-xs">Paid</Badge>
                              : <Badge variant="outline" className="text-xs text-muted-foreground">Not enrolled</Badge>
                            }
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Main Admin Panel
// ────────────────────────────────────────���────
//  Shoutout Management
// ─────────────────────────────────────────────
function ShoutoutManagement() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Quick template create state
  const [newTplName, setNewTplName] = useState('');
  const [newTplText, setNewTplText] = useState('');
  const [addingTpl, setAddingTpl] = useState(false);
  const [savingQuick, setSavingQuick] = useState(false);

  // Auto-shoutout template config
  const configRef = useMemoFirebase(() => doc(firestore, 'settings', 'shoutoutConfig'), [firestore]);
  const { data: shoutoutConfig } = useDoc<Record<string, any>>(configRef);
  const [savingConfig, setSavingConfig] = useState(false);
  const [templates, setTemplates] = useState<Record<string, { enabled: boolean; template: string }>>({});
  const [quickTemplates, setQuickTemplates] = useState<{ name: string; text: string }[]>([]);

  useEffect(() => {
    setTemplates({
      firstPost:     shoutoutConfig?.firstPost     ?? { enabled: true, template: '🎤 @{username} just dropped their first post on CYBAZONE!' },
      questComplete: shoutoutConfig?.questComplete ?? { enabled: true, template: '{emoji} @{username} just completed the "{title}" quest!' },
    });
    setQuickTemplates(shoutoutConfig?.quickTemplates ?? []);
  }, [shoutoutConfig]);

  const handleSaveTemplates = async () => {
    setSavingConfig(true);
    try {
      await setDoc(doc(firestore, 'settings', 'shoutoutConfig'), { ...templates, quickTemplates }, { merge: true });
      toast({ title: 'Templates saved!' });
    } catch {
      toast({ variant: 'destructive', title: 'Failed to save templates' });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleAddQuickTemplate = async () => {
    if (!newTplName.trim() || !newTplText.trim()) return;
    setSavingQuick(true);
    const updated = [...quickTemplates, { name: newTplName.trim(), text: newTplText.trim() }];
    try {
      await setDoc(doc(firestore, 'settings', 'shoutoutConfig'), { quickTemplates: updated }, { merge: true });
      setQuickTemplates(updated);
      setNewTplName('');
      setNewTplText('');
      setAddingTpl(false);
      toast({ title: 'Template added!' });
    } catch {
      toast({ variant: 'destructive', title: 'Failed to add template' });
    } finally {
      setSavingQuick(false);
    }
  };

  const handleDeleteQuickTemplate = async (idx: number) => {
    const updated = quickTemplates.filter((_, i) => i !== idx);
    try {
      await setDoc(doc(firestore, 'settings', 'shoutoutConfig'), { quickTemplates: updated }, { merge: true });
      setQuickTemplates(updated);
      toast({ title: 'Template removed' });
    } catch {
      toast({ variant: 'destructive', title: 'Failed to remove template' });
    }
  };

  const TEMPLATE_META: Record<string, { label: string; hint: string }> = {
    firstPost:     { label: 'First Post', hint: 'Variables: {username}' },
    questComplete: { label: 'Quest Completed', hint: 'Variables: {username}, {emoji}, {title}' },
  };

  const shoutoutsQuery = useMemoFirebase(
    () => query(collection(firestore, 'shoutouts'), orderBy('createdAt', 'desc'), limit(48)),
    [firestore]
  );
  const { data: shoutouts } = useCollection<{ id: string; message: string; type: string; active: boolean; createdAt: any; expiresAt: number }>(shoutoutsQuery);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayCount = (shoutouts ?? []).filter(s => {
    const ms = s.createdAt?.toDate?.()?.getTime?.() ?? 0;
    return ms >= today.getTime();
  }).length;

  const handleSend = async () => {
    if (!message.trim()) return;
    if (todayCount >= 24) {
      toast({ variant: 'destructive', title: 'Daily limit reached (24/day)' });
      return;
    }
    setSending(true);
    try {
      await addDoc(collection(firestore, 'shoutouts'), {
        message: message.trim(),
        type: 'admin',
        active: true,
        createdAt: serverTimestamp(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      });
      toast({ title: 'Shoutout sent!' });
      setMessage('');
    } catch {
      toast({ variant: 'destructive', title: 'Failed to send shoutout' });
    } finally {
      setSending(false);
    }
  };

  const handleDeactivate = (id: string) => {
    updateDoc(doc(firestore, 'shoutouts', id), { active: false });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Send Shoutout</CardTitle>
          <CardDescription>Broadcast a message to the live feed. Max 24 shoutouts per day ({todayCount}/24 used today).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {quickTemplates.length > 0 && (
            <div className="flex flex-wrap gap-2 pb-1">
              {quickTemplates.map((tpl, i) => (
                <button
                  key={i}
                  onClick={() => setMessage(tpl.text)}
                  className="text-xs px-3 py-1.5 rounded-full border border-purple-500/30 bg-purple-950/20 text-purple-300 hover:bg-purple-900/40 transition-colors truncate max-w-[200px]"
                  title={tpl.text}
                >
                  {tpl.name}
                </button>
              ))}
            </div>
          )}
          <Textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            maxLength={120}
            rows={2}
            placeholder="⚡ Big news from CYBAZONE..."
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{message.length}/120</span>
            <Button onClick={handleSend} disabled={sending || !message.trim() || todayCount >= 24} size="sm">
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Send Shoutout
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Auto-Shoutout Templates</CardTitle>
          <CardDescription>Control which events trigger automatic shoutouts and customize their messages.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(templates).map(([key, val]) => (
            <div key={key} className="rounded-lg border border-border/50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{TEMPLATE_META[key]?.label ?? key}</p>
                  <p className="text-xs text-muted-foreground">{TEMPLATE_META[key]?.hint}</p>
                </div>
                <Switch
                  checked={val.enabled}
                  onCheckedChange={v => setTemplates(t => ({ ...t, [key]: { ...t[key], enabled: v } }))}
                />
              </div>
              <Textarea
                value={val.template}
                onChange={e => setTemplates(t => ({ ...t, [key]: { ...t[key], template: e.target.value } }))}
                rows={2}
                className="text-sm resize-none"
                disabled={!val.enabled}
              />
            </div>
          ))}
          <Button size="sm" onClick={handleSaveTemplates} disabled={savingConfig}>
            {savingConfig ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Templates
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Quick Send Templates</CardTitle>
            <CardDescription>Saved shoutout drafts — click a template in the Send box to fill it in instantly.</CardDescription>
          </div>
          <Button size="sm" onClick={() => setAddingTpl(v => !v)}>
            <PlusCircle className="w-4 h-4 mr-1" /> New Template
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {addingTpl && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
              <Input
                placeholder="Template name (e.g. Weekend Challenge)"
                value={newTplName}
                onChange={e => setNewTplName(e.target.value)}
                className="h-8 text-sm"
              />
              <Textarea
                placeholder="Message text (e.g. ⚡ The Weekend Challenge is LIVE! Get posting.)"
                value={newTplText}
                onChange={e => setNewTplText(e.target.value)}
                rows={2}
                maxLength={120}
                className="text-sm resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">{newTplText.length}/120</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setAddingTpl(false); setNewTplName(''); setNewTplText(''); }}>Cancel</Button>
                <Button size="sm" disabled={!newTplName.trim() || !newTplText.trim() || savingQuick} onClick={handleAddQuickTemplate}>
                  {savingQuick ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                  Save Template
                </Button>
              </div>
            </div>
          )}
          {quickTemplates.length === 0 && !addingTpl ? (
            <p className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">No quick templates yet.</p>
          ) : (
            <div className="space-y-2">
              {quickTemplates.map((tpl, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border border-border/50 px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{tpl.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{tpl.text}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0 text-destructive hover:text-destructive h-7 w-7 p-0"
                    onClick={() => handleDeleteQuickTemplate(i)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent Shoutouts</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Message</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(shoutouts ?? []).slice(0, 24).map(s => (
                <TableRow key={s.id} className={!s.active ? 'opacity-40' : ''}>
                  <TableCell className="max-w-xs truncate text-sm">{s.message}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{s.type}</Badge></TableCell>
                  <TableCell>
                    {s.active
                      ? <Badge className="text-xs bg-green-700 text-white">Active</Badge>
                      : <Badge variant="secondary" className="text-xs">Off</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    {s.active && (
                      <Button variant="ghost" size="sm" className="text-xs" onClick={() => handleDeactivate(s.id)}>
                        Deactivate
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Reviews Management
// ─────────────────────────────────────────────
function ReviewsManagement() {
  const { firestore } = useFirebase();
  const reviewsQuery = useMemoFirebase(
    () => query(collection(firestore, 'reviews'), orderBy('createdAt', 'desc'), limit(100)),
    [firestore]
  );
  const { data: reviews } = useCollection<{
    id: string; userId: string; username?: string; rating: number; text: string; anonymous: boolean; createdAt: any;
  }>(reviewsQuery);

  const avgRating = useMemo(() => {
    if (!reviews?.length) return 0;
    return reviews.reduce((s, r) => s + (r.rating ?? 0), 0) / reviews.length;
  }, [reviews]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Platform Reviews</CardTitle>
              <CardDescription>
                {reviews?.length ?? 0} review{reviews?.length !== 1 ? 's' : ''} ·{' '}
                Avg rating: {avgRating ? `${avgRating.toFixed(1)} ★` : '—'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reviewer</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Review</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(reviews ?? []).map(r => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm font-medium">
                    {r.anonymous ? <span className="text-muted-foreground italic">Anonymous</span> : `@${r.username ?? r.userId.slice(0, 8)}`}
                  </TableCell>
                  <TableCell>
                    <span className="text-yellow-400 font-bold">{'★'.repeat(r.rating ?? 0)}</span>
                    <span className="text-muted-foreground/40">{'★'.repeat(5 - (r.rating ?? 0))}</span>
                  </TableCell>
                  <TableCell className="max-w-xs text-sm">{r.text}</TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {r.createdAt?.toDate?.()?.toLocaleDateString?.() ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Market Activity Logs
// ─────────────────────────────────────────────
function MarketActivityLogs() {
  const { firestore } = useFirebase();
  const [search, setSearch] = useState('');

  const listingsQuery = useMemoFirebase(
    () => query(collection(firestore, 'market_listings'), orderBy('createdAt', 'desc'), limit(200)),
    [firestore]
  );
  const { data: listings, isLoading } = useCollection<{
    id: string; sellerId: string; sellerUsername: string; title: string; description: string;
    price?: number | null; ccPrice?: number | null; active: boolean; createdAt: any;
  }>(listingsQuery);

  const filtered = useMemo(() => {
    if (!search.trim()) return listings;
    const q = search.toLowerCase();
    return listings?.filter(l => l.sellerUsername?.toLowerCase().includes(q) || l.title?.toLowerCase().includes(q));
  }, [listings, search]);

  const handleToggle = async (item: any) => {
    await updateDoc(doc(firestore, 'market_listings', item.id), { active: !item.active });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Market Listings Activity</CardTitle>
        <CardDescription>All user listings from Market Boost sellers. Toggle visibility or review.</CardDescription>
      </CardHeader>
      <CardContent>
        <Input placeholder="Filter by seller or title…" value={search} onChange={e => setSearch(e.target.value)} className="mb-4 max-w-sm" />
        {isLoading ? <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Seller</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered?.map(item => (
                <TableRow key={item.id} className={!item.active ? 'opacity-50' : ''}>
                  <TableCell className="font-medium text-sm">@{item.sellerUsername}</TableCell>
                  <TableCell className="text-sm max-w-xs truncate">{item.title}</TableCell>
                  <TableCell className="text-sm">
                    {item.price ? <span className="text-green-400">${item.price.toFixed(2)}</span> : null}
                    {item.ccPrice ? <span className="text-yellow-400 ml-2">{item.ccPrice.toLocaleString()} CC</span> : null}
                  </TableCell>
                  <TableCell>
                    {item.active
                      ? <Badge className="text-xs bg-green-600">Active</Badge>
                      : <Badge variant="secondary" className="text-xs">Hidden</Badge>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {item.createdAt?.toDate ? formatDistanceToNow(item.createdAt.toDate(), { addSuffix: true }) : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => handleToggle(item)}>
                      {item.active ? 'Hide' : 'Show'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
//  Radio Management
// ─────────────────────────────────────────────
function extractPlaylistId(input: string): string {
  const trimmed = input.trim();
  if (/^[A-Za-z0-9_-]+$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    return url.searchParams.get('list') ?? trimmed;
  } catch {
    return trimmed;
  }
}

function RadioManagement() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [playlistInput, setPlaylistInput] = useState('');
  const [saving, setSaving] = useState(false);

  const radioRef = useMemoFirebase(() => doc(firestore, 'settings', 'radio'), [firestore]);
  const { data: current } = useDoc<{ playlistId?: string; active?: boolean }>(radioRef);

  const subsQuery = useMemoFirebase(
    () => query(collection(firestore, 'radio_submissions'), orderBy('submittedAt', 'desc'), limit(200)),
    [firestore]
  );
  const { data: submissionsRaw } = useCollection<{ id: string; userId: string; username: string; youtubeUrl?: string; videoId?: string; mediaUrl?: string; sourceType?: 'youtube' | 'upload'; title?: string; submittedAt: any }>(subsQuery);
  const submissions = useMemo(
    () => [...(submissionsRaw ?? [])].sort((a, b) => (b.submittedAt?.seconds ?? 0) - (a.submittedAt?.seconds ?? 0)),
    [submissionsRaw]
  );

  const handleSave = async () => {
    const id = extractPlaylistId(playlistInput);
    if (!id) return;
    setSaving(true);
    try {
      await setDoc(doc(firestore, 'settings', 'radio'), { playlistId: id, active: true, setAt: serverTimestamp() });
      toast({ title: '📻 Radio playlist updated and activated' });
      setPlaylistInput('');
    } catch {
      toast({ variant: 'destructive', title: 'Failed to save playlist' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!current) return;
    await setDoc(doc(firestore, 'settings', 'radio'), { ...current, active: !current.active });
    toast({ title: current.active ? 'Radio paused' : 'Radio activated' });
  };

  const handleRemoveSub = async (subId: string) => {
    if (!confirm('Remove this submission from the radio queue?')) return;
    await deleteDoc(doc(firestore, 'radio_submissions', subId));
    toast({ title: 'Submission removed' });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>📻 CYBAZONE Radio</CardTitle>
          <CardDescription>
            Set a fallback YouTube playlist. When Radio Boost users have active submissions, those play instead.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {current?.playlistId && (
            <div className="flex items-center justify-between rounded-xl border border-purple-500/30 bg-purple-950/10 px-4 py-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-0.5">Fallback Playlist</p>
                <p className="font-mono text-sm text-white">{current.playlistId}</p>
                <a href={`https://www.youtube.com/playlist?list=${current.playlistId}`} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-400 hover:underline">
                  View on YouTube ↗
                </a>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${current.active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {current.active ? 'LIVE' : 'PAUSED'}
                </span>
                <Button size="sm" variant="outline" onClick={handleToggleActive}>
                  {current.active ? 'Pause' : 'Activate'}
                </Button>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium">YouTube Playlist URL or ID</label>
            <div className="flex gap-2">
              <Input placeholder="https://www.youtube.com/playlist?list=PL… or just the ID" value={playlistInput}
                onChange={e => setPlaylistInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSave()} className="flex-1 font-mono text-sm" />
              <Button onClick={handleSave} disabled={saving || !playlistInput.trim()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save & Go Live'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>🎵 Radio Boost Submissions ({submissions?.length ?? 0})</CardTitle>
          <CardDescription>
            YouTube videos submitted by Radio Boost users. Videos stay active as long as the Radio Boost subscription is active. Remove manually when a subscription lapses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!submissions?.length ? (
            <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
              No submissions this month.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Video</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Remove</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map(sub => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium text-sm">@{sub.username}</TableCell>
                    <TableCell>
                      {sub.sourceType === 'upload' ? (
                        <a href={sub.mediaUrl} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-purple-400 hover:underline truncate max-w-[200px] block">
                          📤 {sub.title || 'Uploaded video'}
                        </a>
                      ) : (
                        <a href={`https://www.youtube.com/watch?v=${sub.videoId}`} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-purple-400 hover:underline font-mono truncate max-w-[200px] block">
                          {sub.title ? `${sub.title} — ` : ''}{sub.videoId}
                        </a>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {sub.submittedAt?.toDate ? formatDistanceToNow(sub.submittedAt.toDate(), { addSuffix: true }) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="destructive" onClick={() => handleRemoveSub(sub.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Mass Messaging
// ─────────────────────────────────────────────
function MassMessaging() {
  const { firestore, user } = useFirebase();
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const usersRef = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: allUsers, isLoading } = useCollection<{ username: string; profilePictureUrl?: string; avatarConfig?: any }>(usersRef);

  const filtered = useMemo(() => {
    if (!allUsers) return [];
    const q = search.toLowerCase().trim();
    return allUsers.filter(u => u.username && (!q || u.username.toLowerCase().includes(q)));
  }, [allUsers, search]);

  const allSelected = filtered.length > 0 && filtered.every(u => selectedIds.has(u.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filtered.forEach(u => next.delete(u.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filtered.forEach(u => next.add(u.id));
        return next;
      });
    }
  };

  const toggleUser = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSend = async () => {
    if (!user || !message.trim() || selectedIds.size === 0) return;
    if (!confirm(`Send this message to ${selectedIds.size} member(s)?`)) return;
    setSending(true);
    let sent = 0;
    try {
      const mySnap = await getDoc(doc(firestore, 'users', user.uid));
      const myData = mySnap.data() as any;
      const myInfo = {
        username: myData?.username ?? 'Admin',
        profilePictureUrl: myData?.profilePictureUrl ?? null,
        avatarConfig: myData?.avatarConfig ?? null,
      };

      for (const targetId of Array.from(selectedIds)) {
        try {
          // Check for existing DM
          const key = [user.uid, targetId].sort().join('_');
          const existing = await getDocs(query(
            collection(firestore, 'conversations'),
            where('participantKey', '==', key),
            limit(1)
          ));

          let convId: string;
          if (!existing.empty) {
            convId = existing.docs[0].id;
          } else {
            const targetSnap = await getDoc(doc(firestore, 'users', targetId));
            const targetData = targetSnap.data() as any;
            const newConv: any = {
              type: 'direct',
              participants: [user.uid, targetId],
              participantKey: key,
              participantInfo: {
                [user.uid]: myInfo,
                [targetId]: {
                  username: targetData?.username ?? 'Member',
                  profilePictureUrl: targetData?.profilePictureUrl ?? null,
                  avatarConfig: targetData?.avatarConfig ?? null,
                },
              },
              unreadCounts: { [user.uid]: 0, [targetId]: 0 },
              createdAt: serverTimestamp(),
              createdBy: user.uid,
              lastMessageAt: serverTimestamp(),
              lastMessage: message.trim(),
            };
            const ref = await addDoc(collection(firestore, 'conversations'), newConv);
            convId = ref.id;
          }

          await addDoc(collection(firestore, 'conversations', convId, 'messages'), {
            senderId: user.uid,
            senderUsername: myInfo.username,
            text: message.trim(),
            createdAt: serverTimestamp(),
          });
          await updateDoc(doc(firestore, 'conversations', convId), {
            lastMessage: message.trim(),
            lastMessageAt: serverTimestamp(),
            [`unreadCounts.${targetId}`]: increment(1),
          });
          sent++;
        } catch (e) {
          console.error('Failed to message', targetId, e);
        }
      }
      toast({ title: `✅ Message sent to ${sent} member(s)` });
      setMessage('');
      setSelectedIds(new Set());
    } catch (e) {
      toast({ variant: 'destructive', title: 'Mass message failed' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>📨 Mass Auto Message</CardTitle>
          <CardDescription>
            Compose a message and select members to send to. Use "Select All" to target every CYBA.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Type your message here..."
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{message.length}/500</span>
            <span>{selectedIds.size} member(s) selected</span>
          </div>
          <Button
            onClick={handleSend}
            disabled={sending || !message.trim() || selectedIds.size === 0}
            className="w-full"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Send to {selectedIds.size} Selected Member{selectedIds.size !== 1 ? 's' : ''}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle>Select Members</CardTitle>
          <div className="flex items-center gap-3">
            <Input
              placeholder="Search members..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 text-sm w-48"
            />
            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                className="accent-primary h-4 w-4"
              />
              Select All
            </label>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-96 overflow-y-auto pr-1">
              {filtered.map(u => (
                <label key={u.id} className="flex items-center gap-3 rounded-lg border border-border/50 px-3 py-2 cursor-pointer hover:bg-muted/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(u.id)}
                    onChange={() => toggleUser(u.id)}
                    className="accent-primary h-4 w-4 shrink-0"
                  />
                  <span className="text-sm font-medium truncate">@{u.username}</span>
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Keyword Auto-Responders (DMs to the CYBAZONE system account)
// ─────────────────────────────────────────────
function KeywordResponderManagement() {
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const configRef = useMemoFirebase(() => doc(firestore, 'settings', 'keywordResponders'), [firestore]);
  const { data: rawConfig } = useDoc<{ responders?: KeywordResponder[] }>(configRef);
  const [responders, setResponders] = useState<KeywordResponder[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setResponders(rawConfig?.responders ?? []); }, [rawConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(firestore, 'settings', 'keywordResponders'), {
        responders: responders.filter(r => r.keyword.trim() && r.reply.trim()),
      });
      toast({ title: 'Auto-responders saved' });
    } catch {
      toast({ variant: 'destructive', title: 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Keyword Auto-Responders</CardTitle>
        <CardDescription>
          When a member DMs the CYBAZONE account with a message containing one of these keywords, CYBAZONE auto-replies with the matching script. Checked top to bottom — put more specific keywords first.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {responders.map((r, i) => (
          <div key={i} className="grid sm:grid-cols-[140px_1fr_auto] gap-2 items-start">
            <Input
              value={r.keyword}
              onChange={e => setResponders(prev => prev.map((p, idx) => idx === i ? { ...p, keyword: e.target.value } : p))}
              placeholder="PROMO"
            />
            <Textarea
              value={r.reply}
              onChange={e => setResponders(prev => prev.map((p, idx) => idx === i ? { ...p, reply: e.target.value } : p))}
              placeholder="Reply script…"
              rows={2}
            />
            <Button variant="ghost" size="icon" onClick={() => setResponders(prev => prev.filter((_, idx) => idx !== i))}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => setResponders(prev => [...prev, { keyword: '', reply: '' }])}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Responder
        </Button>
        <div>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Responders
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
//  Curator Content Management
// ─────────────────────────────────────────────
function CuratorManagement() {
  const { firestore, user } = useFirebase();
  const { toast } = useToast();
  const [urls, setUrls] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Feed post state
  const [postCaption, setPostCaption] = useState('');
  const [postFile, setPostFile] = useState<File | null>(null);
  const [postFilePreview, setPostFilePreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile } = useDoc<{ username: string; avatarConfig?: any; profilePictureUrl?: string }>(userDocRef);

  const videosQuery = useMemoFirebase(
    () => query(collection(firestore, 'curator_videos'), orderBy('createdAt', 'desc'), limit(100)),
    [firestore]
  );
  const { data: videos } = useCollection<{ id: string; videoId: string; youtubeUrl: string; title?: string; createdAt: any }>(videosQuery);

  function extractVideoId(url: string): string | null {
    try {
      const u = new URL(url.trim());
      if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('?')[0];
      return u.searchParams.get('v');
    } catch { return null; }
  }

  const handleBulkAdd = async () => {
    const lines = urls.split(/\n|,/).map(l => l.trim()).filter(Boolean);
    const entries = lines.map(l => ({ url: l, id: extractVideoId(l) })).filter(e => e.id);
    if (!entries.length) {
      toast({ variant: 'destructive', title: 'No valid YouTube URLs found' });
      return;
    }
    setSaving(true);
    try {
      for (const e of entries) {
        await addDoc(collection(firestore, 'curator_videos'), {
          videoId: e.id,
          youtubeUrl: e.url,
          createdAt: serverTimestamp(),
          active: true,
        });
      }
      toast({ title: `✅ ${entries.length} video(s) added to Curator queue` });
      setUrls('');
    } catch {
      toast({ variant: 'destructive', title: 'Failed to add videos' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await deleteDoc(doc(firestore, 'curator_videos', id));
      toast({ title: 'Video removed' });
    } catch {
      toast({ variant: 'destructive', title: 'Failed to remove' });
    } finally {
      setDeleting(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPostFile(file);
    const reader = new FileReader();
    reader.onload = ev => setPostFilePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handlePostToFeed = async () => {
    if (!user || !userProfile) return;
    if (!postCaption.trim() && !postFile) {
      toast({ variant: 'destructive', title: 'Add a caption or upload a file' });
      return;
    }
    setPosting(true);
    try {
      let uploadedUrl: string | null = null;
      let mediaType: 'image' | 'video' | null = null;

      if (postFile && postFilePreview) {
        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileDataUri: postFilePreview,
            fileName: postFile.name,
            fileType: postFile.type,
          }),
        });
        if (!response.ok) throw new Error('Upload failed');
        const { imageUrl } = await response.json();
        uploadedUrl = imageUrl;
        mediaType = postFile.type.startsWith('video/') ? 'video' : 'image';
      }

      await addDoc(collection(firestore, 'cybazone_posts'), {
        authorId: user.uid,
        authorUsername: userProfile.username,
        authorAvatar: userProfile.avatarConfig || {},
        authorProfilePictureUrl: userProfile.profilePictureUrl || null,
        authorLevel: 0,
        content: postCaption.trim(),
        imageUrl: uploadedUrl,
        mediaType: mediaType ?? null,
        timestamp: serverTimestamp(),
        likeCount: 0,
        likedBy: [],
        commentCount: 0,
        repostCount: 0,
        repostedBy: [],
        hashtags: Array.from(new Set(postCaption.match(/#[\w]+/g)?.map(t => t.toLowerCase()) ?? [])),
        isCurator: true,
      });

      toast({ title: '✅ Posted to feed as Curator content' });
      setPostCaption('');
      setPostFile(null);
      setPostFilePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch {
      toast({ variant: 'destructive', title: 'Failed to post to feed' });
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Post to feed */}
      <Card>
        <CardHeader>
          <CardTitle>📤 Post to Feed</CardTitle>
          <CardDescription>
            Upload an image or video and push it directly to the Central feed as a Curator post (green glow).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Caption</label>
            <Textarea
              value={postCaption}
              onChange={e => setPostCaption(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Write a caption… (optional if uploading media)"
              className="text-sm resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">{postCaption.length}/500</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Media (image or video)</label>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleFileChange}
                className="hidden"
                id="curator-feed-upload"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Download className="w-4 h-4 mr-2" />
                Choose File
              </Button>
              {postFile && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="truncate max-w-[200px]">{postFile.name}</span>
                  <button
                    type="button"
                    onClick={() => { setPostFile(null); setPostFilePreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
            {postFilePreview && postFile?.type.startsWith('image/') && (
              <img src={postFilePreview} alt="preview" className="w-40 h-28 object-cover rounded-lg border border-border" />
            )}
            {postFilePreview && postFile?.type.startsWith('video/') && (
              <video src={postFilePreview} controls className="w-64 rounded-lg border border-border" />
            )}
          </div>

          <Button onClick={handlePostToFeed} disabled={posting || (!postCaption.trim() && !postFile)}>
            {posting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
            Post to Feed
          </Button>
        </CardContent>
      </Card>

      {/* YouTube curator queue */}
      <Card>
        <CardHeader>
          <CardTitle>🎬 Curator YouTube Queue</CardTitle>
          <CardDescription>
            Add YouTube videos in bulk. They display automatically throughout Central as Curator content cards.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">YouTube URLs (one per line, or comma-separated)</label>
            <Textarea
              value={urls}
              onChange={e => setUrls(e.target.value)}
              rows={5}
              placeholder="https://www.youtube.com/watch?v=abc123&#10;https://youtu.be/xyz456"
              className="font-mono text-sm resize-none"
            />
          </div>
          <Button onClick={handleBulkAdd} disabled={saving || !urls.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
            Add to Curator Queue
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Curator Queue ({videos?.length ?? 0} videos)</CardTitle>
          <CardDescription>Active Curator videos displayed throughout Central.</CardDescription>
        </CardHeader>
        <CardContent>
          {!videos?.length ? (
            <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
              No Curator videos yet. Add some above.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Preview</TableHead>
                  <TableHead>Video ID</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="text-right">Remove</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(videos ?? []).map(v => (
                  <TableRow key={v.id}>
                    <TableCell>
                      <img
                        src={`https://img.youtube.com/vi/${v.videoId}/default.jpg`}
                        alt={v.videoId}
                        className="w-16 h-10 object-cover rounded"
                      />
                    </TableCell>
                    <TableCell>
                      <a
                        href={`https://www.youtube.com/watch?v=${v.videoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-purple-400 hover:underline font-mono"
                      >
                        {v.videoId}
                      </a>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {v.createdAt?.toDate ? formatDistanceToNow(v.createdAt.toDate(), { addSuffix: true }) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={deleting === v.id}
                        onClick={() => handleDelete(v.id)}
                      >
                        {deleting === v.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
function AdminPanel({ email, allowedTabs }: { email: string; allowedTabs?: string[] }) {
  // allowedTabs = undefined → full admin (all tabs). string[] → sub-admin (filtered tabs).
  const tabs = allowedTabs
    ? ALL_ADMIN_TABS.filter(t => allowedTabs.includes(t.value))
    : ALL_ADMIN_TABS;

  const defaultTab = tabs[0]?.value ?? 'users';
  const hasTab = (v: string) => !allowedTabs || allowedTabs.includes(v);

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-primary/10 p-2.5 rounded-xl">
          <Shield className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-headline">CYBAZONE Admin</h1>
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>
      </div>

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 p-1 mb-6">
          {tabs.map(t => <TabsTrigger key={t.value} value={t.value} className="text-xs">{t.label}</TabsTrigger>)}
        </TabsList>

        {hasTab('users') && <TabsContent value="users"><UserManagement /></TabsContent>}
        {hasTab('posts') && <TabsContent value="posts"><PostAudit /></TabsContent>}
        {hasTab('wheel') && <TabsContent value="wheel"><WheelManagement /></TabsContent>}
        {hasTab('quests') && (
          <TabsContent value="quests">
            <div className="space-y-8">
              <QuestManagement />
              <CustomQuestManagement />
            </div>
          </TabsContent>
        )}
        {hasTab('submissions') && <TabsContent value="submissions"><QuestSubmissions /></TabsContent>}
        {hasTab('cashouts') && <TabsContent value="cashouts"><CashOutRequests /></TabsContent>}
        {hasTab('weeklypayout') && <TabsContent value="weeklypayout"><WeeklyPayouts /></TabsContent>}
        {hasTab('reviews') && <TabsContent value="reviews"><ReviewsManagement /></TabsContent>}
        {hasTab('market') && <TabsContent value="market"><MarketActivityLogs /></TabsContent>}
        {hasTab('radio') && <TabsContent value="radio"><RadioManagement /></TabsContent>}
        {hasTab('shoutouts') && <TabsContent value="shoutouts"><ShoutoutManagement /></TabsContent>}
        {hasTab('curator') && <TabsContent value="curator"><CuratorManagement /></TabsContent>}
        {hasTab('boosts') && <TabsContent value="boosts"><BoostsManagement /></TabsContent>}
        {hasTab('rewards') && <TabsContent value="rewards"><RewardsManagement /></TabsContent>}
        {hasTab('shop') && <TabsContent value="shop" className="space-y-6"><ShopManagement /><MerchOrdersManagement /></TabsContent>}
        {hasTab('memberships') && <TabsContent value="memberships"><MembershipManagement /></TabsContent>}
        {hasTab('avatars') && <TabsContent value="avatars"><AvatarManagement /></TabsContent>}
        {hasTab('levels') && <TabsContent value="levels"><LevelManagement /></TabsContent>}
        {hasTab('ccrates') && <TabsContent value="ccrates"><CCRatesManagement /></TabsContent>}
        {hasTab('ccsubs') && <TabsContent value="ccsubs"><CCSubsManagement /></TabsContent>}
        {hasTab('addrop') && <TabsContent value="addrop" className="space-y-6"><AdDropManagement /><CcBundleManagement /><LiveStreamingStatsStub /></TabsContent>}
        {hasTab('faq') && <TabsContent value="faq"><FAQManagement /></TabsContent>}
        {hasTab('messaging') && <TabsContent value="messaging" className="space-y-6"><MassMessaging /><KeywordResponderManagement /></TabsContent>}
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Page — email-gated access (full admin) OR sub-admin via adminAccess.tabs
// ─────────────────────────────────────────────
export default function AdminPage() {
  const { firestore, user, isUserLoading } = useFirebase();
  const router = useRouter();

  // Load user profile to check for sub-admin access
  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<{
    adminAccess?: { tabs: string[] };
  }>(userDocRef);

  useEffect(() => {
    if (!isUserLoading && !user) router.push('/login?redirect=/admin');
  }, [isUserLoading, user, router]);

  const isFullAdmin = ADMIN_EMAILS.includes(user?.email ?? '');
  const subAdminTabs = userProfile?.adminAccess?.tabs ?? [];
  const isSubAdmin = !isFullAdmin && subAdminTabs.length > 0;
  const hasAccess = isFullAdmin || isSubAdmin;

  if (isUserLoading || (user && isProfileLoading)) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !hasAccess) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <Card className="w-full max-w-sm border-destructive/30 bg-card/50 text-center">
          <CardHeader>
            <div className="mx-auto bg-destructive/10 p-3 rounded-full w-fit mb-2">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>This page is restricted to authorized administrators only.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <AdminPanel
      email={user.email!}
      allowedTabs={isFullAdmin ? undefined : subAdminTabs}
    />
  );
}
