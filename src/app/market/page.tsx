'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from '@/components/ui/card';
import { useFirebase, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import {
  collection, orderBy, query, doc, updateDoc, increment, addDoc,
  serverTimestamp, where, setDoc, getDocs, type Firestore,
} from 'firebase/firestore';
import { Loader2, ShoppingBag } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { SectionHeader } from '@/components/SectionHeader';
import { useToast } from '@/hooks/use-toast';
import { logTransaction, logCashTransaction } from '@/lib/transactions';
import { createNotification } from '@/lib/notifications';
import { cn } from '@/lib/utils';
import { MyStore, type MarketListing } from '@/components/market/MyStore';

// Same admin allowlist used to gate /admin — kept in sync manually since there's no shared
// server-side admin list accessible from client code.
const ADMIN_EMAILS = ['contactcyba@gmail.com', 'z1mmerman@yahoo.com'];

async function notifyAdminsOfMerchOrder(firestore: Firestore, buyerUsername: string, itemName: string) {
  try {
    const snap = await getDocs(query(collection(firestore, 'users'), where('email', 'in', ADMIN_EMAILS)));
    await Promise.all(snap.docs.map(adminDoc => createNotification(firestore, adminDoc.id, {
      type: 'merch_order',
      actorId: 'system',
      actorUsername: 'CYBAZONE',
      message: `New CYBAMERCH order: ${itemName} from @${buyerUsername}. Check the admin panel to fulfill it.`,
      linkTo: '/admin',
    })));
  } catch {
    // Non-critical — never block the purchase on this
  }
}

type UserProfile = {
  username?: string;
  cybaCoinBalance?: number;
  payoutBalance?: number;
  marketBoost?: boolean;
};

export default function MarketPage() {
  const { firestore, storage, user } = useFirebase();
  const { toast } = useToast();
  const [ccBuyingId, setCcBuyingId] = useState<string | null>(null);
  const [cashBuyingId, setCashBuyingId] = useState<string | null>(null);
  const [walletCashBuyingId, setWalletCashBuyingId] = useState<string | null>(null);

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);

  const merchRef = useMemoFirebase(
    () => query(collection(firestore, 'merchandise'), orderBy('name')),
    [firestore]
  );
  const { data: merchandise, isLoading: isLoadingMerch } = useCollection(merchRef);

  // Market boost listings from all sellers
  const listingsQuery = useMemoFirebase(
    () => query(collection(firestore, 'market_listings'), where('active', '==', true)),
    [firestore]
  );
  const { data: listingsRaw2, isLoading: isLoadingListings } = useCollection<MarketListing>(listingsQuery);
  const marketListings = useMemo(
    () => [...(listingsRaw2 ?? [])].sort((a: any, b: any) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)),
    [listingsRaw2]
  );

  const balance = userProfile?.cybaCoinBalance ?? 0;

  const handleCybacoinPurchase = async (item: any) => {
    if (!user || !userProfile) {
      toast({ variant: 'destructive', title: 'Sign in to purchase with CYBACOIN' });
      return;
    }
    const ccPrice = item.cybaCoinPrice ?? 0;
    if (balance < ccPrice) {
      toast({ variant: 'destructive', title: 'Not enough CYBACOIN' });
      return;
    }
    setCcBuyingId(item.id);
    try {
      await updateDoc(doc(firestore, 'users', user.uid), { cybaCoinBalance: increment(-ccPrice) });
      await logTransaction(firestore, user.uid, { type: 'merch_purchase', amount: -ccPrice, description: `Merch (CC): ${item.name}` });
      await addDoc(collection(firestore, 'merch_orders'), {
        userId: user.uid, username: userProfile.username ?? '', itemId: item.id, itemName: item.name,
        paidWith: 'cybacoin', amount: ccPrice, status: 'pending', orderedAt: serverTimestamp(),
      });
      notifyAdminsOfMerchOrder(firestore, userProfile.username ?? user.uid, item.name);
      toast({ title: 'Order placed!', description: `${ccPrice.toLocaleString()} CYBACOIN spent.` });
    } catch {
      toast({ variant: 'destructive', title: 'Purchase failed' });
    } finally {
      setCcBuyingId(null);
    }
  };

  const handleWalletCashMerchPurchase = async (item: any) => {
    if (!user || !userProfile) {
      toast({ variant: 'destructive', title: 'Sign in to purchase with wallet cash' });
      return;
    }
    const price = item.price ?? 0;
    const walletCash = userProfile.payoutBalance ?? 0;
    if (walletCash < price) {
      toast({ variant: 'destructive', title: 'Not enough wallet cash' });
      return;
    }
    setWalletCashBuyingId(item.id);
    try {
      await updateDoc(doc(firestore, 'users', user.uid), { payoutBalance: increment(-price) });
      await logCashTransaction(firestore, user.uid, { type: 'market_purchase', amount: -price, description: `Merch (Wallet Cash): ${item.name}` });
      await addDoc(collection(firestore, 'merch_orders'), {
        userId: user.uid, username: userProfile.username ?? '', itemId: item.id, itemName: item.name,
        paidWith: 'wallet_cash', amount: price, status: 'pending', orderedAt: serverTimestamp(),
      });
      notifyAdminsOfMerchOrder(firestore, userProfile.username ?? user.uid, item.name);
      toast({ title: 'Order placed!', description: `$${price.toFixed(2)} wallet cash spent.` });
    } catch {
      toast({ variant: 'destructive', title: 'Purchase failed' });
    } finally {
      setWalletCashBuyingId(null);
    }
  };

  const handleMarketCCPurchase = async (listing: MarketListing) => {
    if (!user || !userProfile) {
      toast({ variant: 'destructive', title: 'Please sign in to purchase' });
      return;
    }
    if (listing.sellerId === user.uid) {
      toast({ variant: 'destructive', title: "You can't buy your own listing" });
      return;
    }
    const ccPrice = listing.ccPrice ?? 0;
    if (balance < ccPrice) {
      toast({ variant: 'destructive', title: 'Not enough CYBACOIN' });
      return;
    }
    setCcBuyingId(listing.id);
    try {
      await updateDoc(doc(firestore, 'users', user.uid), { cybaCoinBalance: increment(-ccPrice) });
      await logTransaction(firestore, user.uid, { type: 'market_purchase', amount: -ccPrice, description: `Market (CC): ${listing.title}` });

      // Create/find conversation between buyer and seller
      const convId = [user.uid, listing.sellerId].sort().join('_');
      const convRef = doc(firestore, 'conversations', convId);
      const buyerUsername = userProfile.username ?? user.displayName ?? 'Buyer';
      await setDoc(convRef, {
        participants: [user.uid, listing.sellerId],
        participantUsernames: { [user.uid]: buyerUsername, [listing.sellerId]: listing.sellerUsername },
        lastMessage: `🛒 Order: ${listing.title}`,
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      await addDoc(collection(firestore, 'conversations', convId, 'messages'), {
        senderId: 'system',
        senderUsername: 'CYBAZONE',
        text: `🛒 New order: @${buyerUsername} purchased "${listing.title}" for ${ccPrice.toLocaleString()} CC.`,
        createdAt: serverTimestamp(),
      });

      await createNotification(firestore, listing.sellerId, {
        type: 'market_purchase',
        actorId: user.uid,
        actorUsername: buyerUsername,
        message: `@${buyerUsername} purchased your listing "${listing.title}" for ${ccPrice.toLocaleString()} CC!`,
        linkTo: `/messages/${convId}`,
      });

      toast({ title: 'Purchase complete!', description: `Check your messages for order details.` });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Purchase failed' });
    } finally {
      setCcBuyingId(null);
    }
  };

  const handleMarketWalletCashPurchase = async (listing: MarketListing) => {
    if (!user || !userProfile) {
      toast({ variant: 'destructive', title: 'Please sign in to purchase' });
      return;
    }
    if (listing.sellerId === user.uid) {
      toast({ variant: 'destructive', title: "You can't buy your own listing" });
      return;
    }
    const price = listing.price ?? 0;
    const walletCash = userProfile.payoutBalance ?? 0;
    if (walletCash < price) {
      toast({ variant: 'destructive', title: 'Not enough wallet cash' });
      return;
    }
    setWalletCashBuyingId(listing.id);
    try {
      await updateDoc(doc(firestore, 'users', user.uid), { payoutBalance: increment(-price) });
      await logCashTransaction(firestore, user.uid, { type: 'market_purchase', amount: -price, description: `Market (Wallet Cash): ${listing.title}` });

      const convId = [user.uid, listing.sellerId].sort().join('_');
      const convRef = doc(firestore, 'conversations', convId);
      const buyerUsername = userProfile.username ?? user.displayName ?? 'Buyer';
      await setDoc(convRef, {
        participants: [user.uid, listing.sellerId],
        participantUsernames: { [user.uid]: buyerUsername, [listing.sellerId]: listing.sellerUsername },
        lastMessage: `🛒 Order: ${listing.title}`,
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      await addDoc(collection(firestore, 'conversations', convId, 'messages'), {
        senderId: 'system',
        senderUsername: 'CYBAZONE',
        text: `🛒 New order: @${buyerUsername} purchased "${listing.title}" for $${price.toFixed(2)} (wallet cash).`,
        createdAt: serverTimestamp(),
      });

      await createNotification(firestore, listing.sellerId, {
        type: 'market_purchase',
        actorId: user.uid,
        actorUsername: buyerUsername,
        message: `@${buyerUsername} purchased your listing "${listing.title}" for $${price.toFixed(2)} (wallet cash)!`,
        linkTo: `/messages/${convId}`,
      });

      toast({ title: 'Purchase complete!', description: `Check your messages for order details.` });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Purchase failed' });
    } finally {
      setWalletCashBuyingId(null);
    }
  };

  const handleMarketCashPurchase = async (listing: MarketListing) => {
    if (!user || !userProfile) {
      toast({ variant: 'destructive', title: 'Please sign in to purchase' });
      return;
    }
    if (listing.sellerId === user.uid) {
      toast({ variant: 'destructive', title: "You can't buy your own listing" });
      return;
    }
    setCashBuyingId(listing.id);
    try {
      const convId = [user.uid, listing.sellerId].sort().join('_');
      const convRef = doc(firestore, 'conversations', convId);
      const buyerUsername = userProfile.username ?? user.displayName ?? 'Buyer';
      await setDoc(convRef, {
        participants: [user.uid, listing.sellerId],
        participantUsernames: { [user.uid]: buyerUsername, [listing.sellerId]: listing.sellerUsername },
        lastMessage: `🛒 Order request: ${listing.title}`,
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      await addDoc(collection(firestore, 'conversations', convId, 'messages'), {
        senderId: 'system',
        senderUsername: 'CYBAZONE',
        text: `🛒 Purchase request: @${buyerUsername} wants to buy "${listing.title}" for $${listing.price?.toFixed(2)}. Please arrange payment.`,
        createdAt: serverTimestamp(),
      });

      await createNotification(firestore, listing.sellerId, {
        type: 'market_purchase',
        actorId: user.uid,
        actorUsername: buyerUsername,
        message: `@${buyerUsername} wants to buy your listing "${listing.title}" ($${listing.price?.toFixed(2)})!`,
        linkTo: `/messages/${convId}`,
      });

      toast({ title: 'Order request sent!', description: 'The seller has been notified. Check your messages.' });
    } catch {
      toast({ variant: 'destructive', title: 'Failed to send order request' });
    } finally {
      setCashBuyingId(null);
    }
  };

  return (
    <div className="container mx-auto px-4 pt-4 pb-16">
      <SectionHeader title="MARKET" description="Browse CYBAMERCH and products/services from members in the Zone" />
      {user && (
        <Link href="/wallet" className="inline-flex items-center gap-2 bg-card border border-yellow-500/30 rounded-full px-5 py-2 mb-8 hover:border-yellow-400/50 transition-colors">
          <Image src="/CCoin.png?v=2" alt="CC" width={18} height={18} />
          <span className="text-base font-bold text-yellow-400 tabular-nums">{balance.toLocaleString()}</span>
          <span className="text-xs text-muted-foreground">CYBACOIN</span>
        </Link>
      )}

      {/* Market Boost My Store section */}
      {user && userProfile?.marketBoost && userProfile.username && (
        <MyStore userId={user.uid} username={userProfile.username} />
      )}

      {/* Market Boost Listings from all sellers */}
      {(isLoadingListings ? false : (marketListings?.filter(l => l.sellerId !== user?.uid).length ?? 0) > 0) && (
        <div className="mb-12">
          <h2 className="text-2xl font-bold font-headline mb-4 flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-purple-400" /> Community Market
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {marketListings?.filter(l => l.sellerId !== user?.uid).map(listing => (
              <Card key={listing.id} className="flex flex-col overflow-hidden border-purple-500/20 bg-card/50">
                {listing.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={listing.imageUrl} alt={listing.title} className="w-full h-40 object-cover" />
                )}
                <CardContent className="p-4 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold">{listing.title}</p>
                    {listing.shopifyUrl && (
                      <span className="text-[10px] font-bold text-green-400 border border-green-600/40 rounded-full px-1.5 py-0.5 shrink-0">🛍️ Shopify</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">by @{listing.sellerUsername}</p>
                  <p className="text-sm text-foreground/70 mt-2 line-clamp-2">{listing.description}</p>
                </CardContent>
                <CardFooter className="p-4 pt-0 flex-col gap-3">
                  {listing.shopifyUrl ? (
                    <Button asChild size="sm" className="w-full bg-green-600 hover:bg-green-500 text-white">
                      <a href={listing.shopifyUrl} target="_blank" rel="noopener noreferrer">
                        🛍️ Buy on Shopify
                      </a>
                    </Button>
                  ) : listing.price ? (
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xl font-bold text-primary">${listing.price.toFixed(2)}</span>
                      <Button size="sm"
                        onClick={() => user ? handleMarketCashPurchase(listing) : toast({ variant: 'destructive', title: 'Sign in to purchase' })}
                        disabled={cashBuyingId === listing.id}>
                        {cashBuyingId === listing.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buy Now'}
                      </Button>
                    </div>
                  ) : null}
                  {listing.price && user && (userProfile?.payoutBalance ?? 0) > 0 ? (
                    <Button size="sm" variant="outline" className="w-full border-green-500/50 text-green-400"
                      onClick={() => handleMarketWalletCashPurchase(listing)}
                      disabled={walletCashBuyingId === listing.id || (userProfile?.payoutBalance ?? 0) < listing.price}>
                      {walletCashBuyingId === listing.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : (userProfile?.payoutBalance ?? 0) < listing.price
                          ? 'Not enough wallet cash'
                          : `Pay with Wallet Cash ($${(userProfile?.payoutBalance ?? 0).toFixed(2)} avail.)`}
                    </Button>
                  ) : null}
                  {listing.ccPrice ? (
                    <div className="flex items-center justify-between w-full border-t border-primary/10 pt-3">
                      <div className="flex items-center gap-2">
                        <Image src="/CCoin.png?v=2" alt="CC" width={20} height={20} />
                        <span className="font-bold text-yellow-400">{listing.ccPrice.toLocaleString()}</span>
                      </div>
                      <Button size="sm" variant="outline" className="border-yellow-500/50 text-yellow-400"
                        onClick={() => user ? handleMarketCCPurchase(listing) : toast({ variant: 'destructive', title: 'Sign in to purchase' })}
                        disabled={ccBuyingId === listing.id || balance < listing.ccPrice}>
                        {ccBuyingId === listing.id ? <Loader2 className="h-4 w-4 animate-spin" /> : balance < listing.ccPrice ? 'Not enough CC' : 'Buy with CC'}
                      </Button>
                    </div>
                  ) : null}
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* CYBAMERCH */}
      <h2 className="text-2xl font-bold font-headline mb-4">CYBAMERCH</h2>
      {isLoadingMerch ? (
        <div className="flex justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : merchandise && merchandise.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {merchandise.map((item) => {
            const soldOut = item.soldOut === true;
            return (
              <Card key={item.id} className={cn('flex flex-col overflow-hidden border-primary/20 bg-card/50 relative', soldOut && 'opacity-75')}>
                {soldOut && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                    <span className="bg-black/70 text-white font-black text-lg tracking-widest uppercase px-4 py-2 rounded-lg border border-white/20 rotate-[-10deg]">SOLD OUT</span>
                  </div>
                )}
                <CardHeader className="p-0">
                  <div className="aspect-square relative">
                    <Image src={item.imageUrl} alt={item.name} fill className="object-cover" />
                  </div>
                </CardHeader>
                <CardContent className="p-6 flex-grow">
                  <CardTitle className="font-headline text-xl mb-2">{item.name}</CardTitle>
                  <CardDescription className="text-foreground/70 mb-4">{item.description}</CardDescription>
                </CardContent>
                <CardFooter className="p-6 pt-0 flex-col items-stretch space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-2xl font-bold text-primary">${item.price.toFixed(2)}</p>
                    {soldOut ? <Button disabled variant="secondary">Sold Out</Button> : (
                      <Button asChild><Link href={item.buyNowUrl} target="_blank">Buy Now</Link></Button>
                    )}
                  </div>
                  {!soldOut && user && (userProfile?.payoutBalance ?? 0) > 0 && (
                    <div className="flex justify-end">
                      <Button size="sm" variant="outline" className="border-green-500/50 text-green-400"
                        onClick={() => handleWalletCashMerchPurchase(item)}
                        disabled={walletCashBuyingId === item.id || (userProfile?.payoutBalance ?? 0) < item.price}>
                        {walletCashBuyingId === item.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : (userProfile?.payoutBalance ?? 0) < item.price
                            ? 'Not enough wallet cash'
                            : `Pay with Wallet Cash ($${(userProfile?.payoutBalance ?? 0).toFixed(2)})`}
                      </Button>
                    </div>
                  )}
                  {(item.cybaCoinPrice ?? 0) > 0 && (
                    <div className="flex justify-between items-center border-t border-primary/20 pt-4">
                      <div className="flex items-center gap-2">
                        <Image src="/CCoin.png?v=2" alt="CYBACOIN" width={37} height={37} />
                        <p className="text-2xl font-bold text-yellow-400">{item.cybaCoinPrice?.toLocaleString()}</p>
                      </div>
                      {soldOut ? <Button disabled variant="secondary">Sold Out</Button> : (
                        <Button onClick={() => handleCybacoinPurchase(item)} disabled={ccBuyingId === item.id || !user || balance < (item.cybaCoinPrice ?? 0)}
                          variant="outline" className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10">
                          {ccBuyingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : !user ? 'Sign in' : balance < (item.cybaCoinPrice ?? 0) ? 'Not enough CC' : 'Buy with CYBACOIN'}
                        </Button>
                      )}
                    </div>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center text-foreground/60">
          <p>Market is currently empty. Please check back soon!</p>
        </div>
      )}
    </div>
  );
}
