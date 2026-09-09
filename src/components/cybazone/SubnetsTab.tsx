'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useFirebase, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where, orderBy, limit } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Boxes, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PostCard, type CybazonePost } from '@/components/cybazone/PostCard';
import {
  setSubnetRate, approveSubnetMembership, denySubnetMembership, revokeSubnetMember,
  type SubnetConfig, type SubnetMembership,
} from '@/lib/subnets';
import type { CCRates } from '@/lib/cc-rewards';
import { cn } from '@/lib/utils';

export function SubnetsTab({
  currentUserId,
  currentUsername,
  ccRates,
}: {
  currentUserId?: string;
  currentUsername?: string;
  ccRates?: CCRates | null;
}) {
  const [view, setView] = useState<'subscribed' | 'mine'>(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('subnetView') === 'mine'
      ? 'mine' : 'subscribed',
  );

  if (!currentUserId || !currentUsername) {
    return (
      <div className="text-center text-foreground/60 p-12 border-dashed border-2 border-primary/20 bg-card/20 rounded-xl max-w-2xl mx-auto">
        <Boxes className="h-10 w-10 mx-auto mb-3 text-primary/50" />
        <h3 className="text-xl font-bold font-headline mb-2">Sign In Required</h3>
        <p>Sign in to browse and manage Subnets.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex justify-center mb-4">
        <div className="inline-flex rounded-xl border border-border/60 bg-card/60 p-1 gap-1">
          <button
            onClick={() => setView('subscribed')}
            className={cn('px-4 py-1.5 rounded-lg text-sm font-bold transition-all',
              view === 'subscribed' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
          >
            Subscribed
          </button>
          <button
            onClick={() => setView('mine')}
            className={cn('px-4 py-1.5 rounded-lg text-sm font-bold transition-all',
              view === 'mine' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
          >
            My Subnet
          </button>
        </div>
      </div>

      {view === 'subscribed'
        ? <SubscribedView userId={currentUserId} ccRates={ccRates} />
        : <MySubnetView ownerId={currentUserId} ownerUsername={currentUsername} />}
    </div>
  );
}

function SubscribedView({ userId, ccRates }: { userId: string; ccRates?: CCRates | null }) {
  const { firestore } = useFirebase();

  const membershipsQuery = useMemoFirebase(
    () => query(collection(firestore, 'subnet_memberships'), where('memberId', '==', userId), where('status', '==', 'active')),
    [firestore, userId],
  );
  const { data: memberships, isLoading: loadingMemberships } = useCollection<SubnetMembership>(membershipsQuery);

  const ownerIds = useMemo(() => (memberships ?? []).map(m => m.ownerId), [memberships]);
  const subnetAccessOwnerIds = useMemo(() => new Set(ownerIds), [ownerIds]);

  const postsQuery = useMemoFirebase(
    () => ownerIds.length
      ? query(
          collection(firestore, 'cybazone_posts'),
          where('subnetOnly', '==', true),
          where('authorId', 'in', ownerIds.slice(0, 30)),
          orderBy('timestamp', 'desc'),
          limit(50),
        )
      : null,
    [firestore, ownerIds.join(',')],
  );
  const { data: posts, isLoading: loadingPosts } = useCollection<CybazonePost>(postsQuery);

  if (loadingMemberships) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!memberships || memberships.length === 0) {
    return (
      <div className="text-center text-foreground/60 p-12 border-dashed border-2 border-primary/20 bg-card/20 rounded-xl">
        <Boxes className="h-10 w-10 mx-auto mb-3 text-primary/50" />
        <h3 className="text-xl font-bold font-headline mb-2">No Subnets Yet</h3>
        <p>Request access to a creator's Subnet from one of their locked posts to see it here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {memberships.map(m => (
          <Link key={m.id} href={`/u/${m.ownerUsername}`} className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-card/50 px-3 py-1.5 text-xs font-semibold hover:bg-primary/10 transition-colors">
            <Users className="h-3 w-3" /> {m.ownerUsername}
          </Link>
        ))}
      </div>
      {loadingPosts ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : posts && posts.length > 0 ? (
        <div className="space-y-4">
          {posts.map(p => (
            <PostCard key={p.id} post={p} ccRates={ccRates} subnetAccessOwnerIds={subnetAccessOwnerIds} />
          ))}
        </div>
      ) : (
        <p className="text-center text-sm text-muted-foreground py-8">No Subnet posts yet from anyone you're subscribed to.</p>
      )}
    </div>
  );
}

function MySubnetView({ ownerId, ownerUsername }: { ownerId: string; ownerUsername: string }) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [rateInput, setRateInput] = useState('');
  const [savingRate, setSavingRate] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const subnetRef = useMemoFirebase(() => doc(firestore, 'subnets', ownerId), [firestore, ownerId]);
  const { data: subnet } = useDoc<SubnetConfig>(subnetRef);

  const pendingQuery = useMemoFirebase(
    () => query(collection(firestore, 'subnet_memberships'), where('ownerId', '==', ownerId), where('status', '==', 'pending')),
    [firestore, ownerId],
  );
  const { data: pending } = useCollection<SubnetMembership>(pendingQuery);

  const activeQuery = useMemoFirebase(
    () => query(collection(firestore, 'subnet_memberships'), where('ownerId', '==', ownerId), where('status', '==', 'active')),
    [firestore, ownerId],
  );
  const { data: activeMembers } = useCollection<SubnetMembership>(activeQuery);

  const handleSaveRate = async () => {
    const rate = parseInt(rateInput, 10);
    if (!Number.isFinite(rate) || rate <= 0) {
      toast({ variant: 'destructive', title: 'Enter a valid CC amount' });
      return;
    }
    setSavingRate(true);
    try {
      await setSubnetRate(firestore, ownerId, ownerUsername, rate);
      toast({ title: 'Subnet rate updated', description: `${rate.toLocaleString()} CC / week` });
      setRateInput('');
    } catch {
      toast({ variant: 'destructive', title: 'Could not update rate' });
    } finally {
      setSavingRate(false);
    }
  };

  const handleApprove = async (memberId: string) => {
    setBusyId(memberId);
    try {
      await approveSubnetMembership(firestore, ownerId, ownerUsername, memberId);
      toast({ title: 'Member approved' });
    } finally {
      setBusyId(null);
    }
  };
  const handleDeny = async (memberId: string) => {
    setBusyId(memberId);
    try {
      await denySubnetMembership(firestore, ownerId, memberId);
      toast({ title: 'Request denied' });
    } finally {
      setBusyId(null);
    }
  };
  const handleRevoke = async (memberId: string) => {
    setBusyId(memberId);
    try {
      await revokeSubnetMember(firestore, ownerId, ownerUsername, memberId);
      toast({ title: 'Access revoked' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-primary/20 bg-card/50 p-4">
        <p className="text-sm font-semibold mb-1">Weekly Subnet Rate</p>
        <p className="text-xs text-muted-foreground mb-3">
          {subnet?.weeklyRate
            ? `Currently ${subnet.weeklyRate.toLocaleString()} CC / week · ${subnet.memberCount ?? 0} member${subnet.memberCount === 1 ? '' : 's'}`
            : "You haven't set a rate yet — set one to enable posting Subnet-only content."}
        </p>
        <div className="flex gap-2">
          <Input
            type="number"
            min={1}
            placeholder="e.g. 500"
            value={rateInput}
            onChange={e => setRateInput(e.target.value)}
            className="max-w-[160px]"
          />
          <Button onClick={handleSaveRate} disabled={savingRate}>
            {savingRate ? <Loader2 className="h-4 w-4 animate-spin" /> : subnet?.weeklyRate ? 'Update Rate' : 'Set Rate'}
          </Button>
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold mb-2">Pending Requests {pending?.length ? `(${pending.length})` : ''}</p>
        {!pending || pending.length === 0 ? (
          <p className="text-xs text-muted-foreground">No pending requests.</p>
        ) : (
          <div className="space-y-2">
            {pending.map(p => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-card/40 px-3 py-2">
                <Link href={`/u/${p.memberUsername}`} className="text-sm font-semibold hover:underline">{p.memberUsername}</Link>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={busyId === p.memberId} onClick={() => handleApprove(p.memberId)}>Approve</Button>
                  <Button size="sm" variant="ghost" disabled={busyId === p.memberId} onClick={() => handleDeny(p.memberId)}>Deny</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-sm font-semibold mb-2">Active Members {activeMembers?.length ? `(${activeMembers.length})` : ''}</p>
        {!activeMembers || activeMembers.length === 0 ? (
          <p className="text-xs text-muted-foreground">No active members yet.</p>
        ) : (
          <div className="space-y-2">
            {activeMembers.map(m => (
              <div key={m.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-card/40 px-3 py-2">
                <Link href={`/u/${m.memberUsername}`} className="text-sm font-semibold hover:underline">{m.memberUsername}</Link>
                <Button size="sm" variant="ghost" className="text-destructive" disabled={busyId === m.memberId} onClick={() => handleRevoke(m.memberId)}>Revoke</Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
