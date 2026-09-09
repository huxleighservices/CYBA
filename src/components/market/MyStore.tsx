'use client';

import { useState, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useFirebase, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import {
  collection, query, where, doc, addDoc, setDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { MARKET_TIER_ITEM_CAP, type MarketBoostTier } from '@/lib/boost-subscriptions';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import { Loader2, Edit, Trash2, ShoppingBag, Package, PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';

export type MarketListing = {
  id: string;
  sellerId: string;
  sellerUsername: string;
  title: string;
  description: string;
  price?: number | null;
  ccPrice?: number | null;
  imageUrl?: string | null;
  active: boolean;
  createdAt?: any;
};

function ListingForm({
  item,
  sellerId,
  sellerUsername,
  onClose,
}: {
  item?: MarketListing;
  sellerId: string;
  sellerUsername: string;
  onClose: () => void;
}) {
  const { firestore, storage } = useFirebase();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [form, setForm] = useState({
    title: item?.title ?? '',
    description: item?.description ?? '',
    price: item?.price?.toString() ?? '',
    ccPrice: item?.ccPrice?.toString() ?? '',
    imageUrl: item?.imageUrl ?? '',
    active: item?.active ?? true,
  });

  const set = (f: string, v: any) => setForm(p => ({ ...p, [f]: v }));

  const handleImageUpload = async (file: File) => {
    const path = `market_listings/${sellerId}/${uuidv4()}.${file.name.split('.').pop()}`;
    const sRef = storageRef(storage, path);
    const task = uploadBytesResumable(sRef, file);
    await new Promise<void>((resolve, reject) => {
      task.on('state_changed', s => setUploadPct(Math.round(s.bytesTransferred / s.totalBytes * 100)), reject, resolve);
    });
    const url = await getDownloadURL(task.snapshot.ref);
    set('imageUrl', url);
    setUploadPct(0);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast({ variant: 'destructive', title: 'Title required' }); return; }
    setSaving(true);
    try {
      const data = {
        sellerId,
        sellerUsername,
        title: form.title.trim(),
        description: form.description.trim(),
        price: form.price ? parseFloat(form.price) : null,
        ccPrice: form.ccPrice ? parseInt(form.ccPrice) : null,
        imageUrl: form.imageUrl || null,
        active: form.active,
      };
      if (item) {
        await setDoc(doc(firestore, 'market_listings', item.id), data, { merge: true });
      } else {
        await addDoc(collection(firestore, 'market_listings'), { ...data, createdAt: serverTimestamp() });
      }
      toast({ title: item ? 'Listing updated!' : 'Listing created!' });
      onClose();
    } catch {
      toast({ variant: 'destructive', title: 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 py-2">
      <div>
        <label className="text-xs text-muted-foreground block mb-1">Title *</label>
        <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Item name" />
      </div>
      <div>
        <label className="text-xs text-muted-foreground block mb-1">Description</label>
        <Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Price (USD) — leave blank to disable</label>
          <Input type="number" step="0.01" min="0" value={form.price} onChange={e => set('price', e.target.value)} placeholder="e.g. 9.99" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Price (CC) — leave blank to disable</label>
          <Input type="number" min="0" value={form.ccPrice} onChange={e => set('ccPrice', e.target.value)} placeholder="e.g. 500" />
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground block mb-1">Product Image</label>
        {form.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={form.imageUrl} alt="preview" className="w-full h-32 object-cover rounded-lg mb-2" />
        )}
        <div className="flex gap-2">
          <Input value={form.imageUrl} onChange={e => set('imageUrl', e.target.value)} placeholder="Image URL or upload below" className="flex-1 text-sm" />
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Upload</Button>
        </div>
        {uploadPct > 0 && <p className="text-xs text-muted-foreground mt-1">Uploading… {uploadPct}%</p>}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }} />
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)} id="listing-active" />
        <label htmlFor="listing-active" className="text-sm">Active (visible to buyers)</label>
      </div>
      <DialogFooter>
        <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          {item ? 'Save Changes' : 'Create Listing'}
        </Button>
      </DialogFooter>
    </div>
  );
}

export function MyStore({ userId, username }: { userId: string; username: string }) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<MarketListing | null>(null);

  const myListingsQuery = useMemoFirebase(
    () => query(collection(firestore, 'market_listings'), where('sellerId', '==', userId)),
    [firestore, userId]
  );
  const { data: listingsRaw } = useCollection<MarketListing>(myListingsQuery);
  const listings = useMemo(
    () => [...(listingsRaw ?? [])].sort((a: any, b: any) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)),
    [listingsRaw]
  );

  const userDocRef = useMemoFirebase(() => doc(firestore, 'users', userId), [firestore, userId]);
  const { data: userDoc } = useDoc<{ marketBoostTier?: MarketBoostTier }>(userDocRef);
  const itemCap = MARKET_TIER_ITEM_CAP[userDoc?.marketBoostTier ?? 'base'];
  const atCap = listings.length >= itemCap;

  const handleToggleActive = async (item: MarketListing) => {
    await setDoc(doc(firestore, 'market_listings', item.id), { active: !item.active }, { merge: true });
    toast({ title: item.active ? 'Listing hidden' : 'Listing activated' });
  };

  const handleDelete = async (item: MarketListing) => {
    if (!confirm(`Permanently delete "${item.title}"? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(firestore, 'market_listings', item.id));
      toast({ title: 'Listing deleted' });
    } catch {
      toast({ variant: 'destructive', title: 'Could not delete listing', description: 'Please try again.' });
    }
  };

  return (
    <div className="mb-12">
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Listing</DialogTitle></DialogHeader>
          <ListingForm sellerId={userId} sellerUsername={username} onClose={() => setCreateOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editItem} onOpenChange={open => !open && setEditItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Listing</DialogTitle></DialogHeader>
          {editItem && <ListingForm item={editItem} sellerId={userId} sellerUsername={username} onClose={() => setEditItem(null)} />}
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold font-headline flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-blue-400" /> My Store
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage your Market Boost listings — {listings.length}/{itemCap === Infinity ? '∞' : itemCap} used
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} disabled={atCap} title={atCap ? 'Upgrade your Market Boost tier for more listings' : undefined}>
          <PlusCircle className="w-4 h-4 mr-2" /> New Listing
        </Button>
      </div>

      {!listings?.length ? (
        <div className="text-center py-10 border border-dashed border-blue-500/30 rounded-2xl text-muted-foreground">
          <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No listings yet. Create your first listing to start selling!</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings.map(item => (
            <div key={item.id} className={cn(
              'border rounded-xl overflow-hidden flex flex-col',
              item.active ? 'border-blue-500/30 bg-blue-950/10' : 'border-zinc-700/40 opacity-60'
            )}>
              {item.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.imageUrl} alt={item.title} className="w-full h-32 object-cover" />
              )}
              <div className="p-3 flex-1">
                <p className="font-semibold text-sm">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
                <div className="flex gap-3 mt-2 text-xs">
                  {item.price ? <span className="text-green-400 font-bold">${item.price.toFixed(2)}</span> : null}
                  {item.ccPrice ? <span className="text-yellow-400 font-bold">{item.ccPrice.toLocaleString()} CC</span> : null}
                </div>
              </div>
              <div className="flex gap-2 p-3 pt-0 border-t border-white/[0.06] mt-auto">
                <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => handleToggleActive(item)}>
                  {item.active ? 'Hide' : 'Show'}
                </Button>
                <Button size="sm" variant="outline" className="text-xs" onClick={() => setEditItem(item)}>
                  <Edit className="w-3 h-3" />
                </Button>
                <Button size="sm" variant="ghost" className="text-xs text-destructive hover:text-destructive" onClick={() => handleDelete(item)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
