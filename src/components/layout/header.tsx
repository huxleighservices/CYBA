'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  ShoppingBag,
  Newspaper,
  Trophy,
  Menu,
  Gem,
  Target,
  RotateCw,
  Search,
  PlusCircle,
  Star,
  Wallet,
  MessageCircle,
  Instagram,
  Youtube,
  Facebook,
  ExternalLink,
  Shield,
  Home,
  UserCircle,
  Bell,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { AvatarDisplay } from '@/components/AvatarDisplay';
import type { AvatarConfig } from '@/lib/avatar-assets';
import { doc, addDoc, collection, serverTimestamp, getDoc } from 'firebase/firestore';
import { computeLevel } from '@/lib/levels';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { NotificationBell } from '@/components/NotificationBell';
import { HelpButton, HELP_LINKS, SOCIALS } from '@/components/layout/HelpButton';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';


const ADMIN_EMAILS = ['contactcyba@gmail.com', 'z1mmerman@yahoo.com'];

const navLinks = [
  { href: '/', label: 'Central', icon: Newspaper, isNew: false },
  { href: '/cybaquests', label: 'CYBAQuests', icon: Target, isNew: true },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy, isNew: false },
  { href: '/winners-wheel', label: "CYBAWHEEL", icon: RotateCw, isNew: true },
  { href: '/boosts', label: 'Boosts', icon: Gem, isNew: false },
  { href: '/rewards', label: 'Rewards', icon: Star, isNew: false },
  { href: '/market', label: 'Market', icon: ShoppingBag, isNew: false },
  { href: '/messages', label: 'Messages', icon: MessageCircle, isNew: false },
];

type HeaderUserProfile = {
  avatarConfig?: AvatarConfig;
  profilePictureUrl?: string;
  postCount?: number;
  levelOverride?: string;
  supportGiven?: number;
  username?: string;
  cybaCoinBalance?: number;
  payoutBalance?: number;
  adminAccess?: { tabs?: string[] };
};

function useHasAdminAccess(userProfile?: HeaderUserProfile | null) {
  const { user } = useFirebase();
  return (
    (user?.email && ADMIN_EMAILS.includes(user.email)) ||
    (userProfile?.adminAccess?.tabs?.length ?? 0) > 0
  );
}

function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative hidden md:block">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search..."
        className="h-9 w-40 lg:w-52 rounded-full bg-muted pl-9 pr-4 text-sm outline-none focus:ring-1 focus:ring-primary transition-all"
      />
    </form>
  );
}

function AuthButton({ userProfile }: { userProfile?: HeaderUserProfile | null }) {
  const { user, isUserLoading } = useFirebase();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient || isUserLoading) {
    return <div className="flex items-center gap-3 h-9" />;
  }

  if (!user) {
    return (
      <div className="flex items-center gap-3">
        <SearchBar />
        <HelpButton className="hidden md:flex" />
        <Button variant="outline" size="sm" asChild>
          <Link href="/login">Sign In</Link>
        </Button>
        <Button size="sm" asChild className="hidden md:inline-flex">
          <Link href="/signup">Create Account</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 md:gap-3">
      {/* Wallet + CC + Cash balance — shown at every breakpoint, sized to fit its content */}
      <Link
        href="/wallet"
        className="flex items-center gap-1 md:gap-1.5 shrink-0 whitespace-nowrap bg-card border border-border rounded-full px-2 md:px-3 py-1 hover:border-primary/50 transition-colors"
        title="Open Wallet"
      >
        <Wallet className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground shrink-0" />
        {/* Mobile: coin icon + amount only */}
        <span className="flex items-center gap-0.5 md:hidden">
          <Image src="/CCoin.png?v=2" alt="CC" width={12} height={12} />
          <span className="text-xs font-bold text-yellow-400 tabular-nums">
            {(userProfile?.cybaCoinBalance ?? 0).toLocaleString()}
          </span>
        </span>
        {/* Desktop: full balance row */}
        <span className="hidden md:flex items-center gap-2">
          <span className="flex items-center gap-0.5">
            <Image src="/CCoin.png?v=2" alt="CC" width={14} height={14} />
            <span className="text-sm font-bold text-yellow-400 tabular-nums">
              {(userProfile?.cybaCoinBalance ?? 0).toLocaleString()}
            </span>
          </span>
          {(userProfile?.payoutBalance ?? 0) > 0 && (
            <>
              <span className="text-border/60">·</span>
              <span className="text-sm font-bold text-green-400 tabular-nums">
                ${(userProfile?.payoutBalance ?? 0).toFixed(2)}
              </span>
            </>
          )}
        </span>
      </Link>

      {/* Search, Create, Notifications, and Avatar move to the mobile bottom nav —
          desktop keeps them here in the top bar. */}
      <div className="hidden md:flex items-center gap-3">
        <Link
          href="/create"
          title="Create post"
          className="shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 transition-colors"
        >
          <PlusCircle className="h-4 w-4 shrink-0" />
          Create
        </Link>
        <NotificationBell />
        <Link href={userProfile?.username ? `/u/${userProfile.username}` : '/profile'} className="shrink-0">
          <AvatarDisplay
            avatarConfig={userProfile?.avatarConfig}
            profilePictureUrl={userProfile?.profilePictureUrl}
            size={36}
            level={computeLevel(userProfile?.postCount, userProfile?.supportGiven, undefined, userProfile?.levelOverride)}
          />
        </Link>
        <SearchBar />
        <HelpButton />
      </div>
    </div>
  );
}

function MainNav({ hasAdminAccess }: { hasAdminAccess: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
      <TooltipProvider>
        {navLinks.map((link) => (
          <Tooltip key={link.href}>
            <TooltipTrigger asChild>
              <Button
                asChild
                variant="ghost"
                size="icon"
                className={cn(
                  'relative rounded-full w-12 h-12',
                  pathname === link.href ? 'bg-muted text-primary' : 'text-foreground/60'
                )}
              >
                <Link href={link.href}>
                  <link.icon className="h-6 w-6" />
                  <span className="sr-only">{link.label}</span>
                  {link.isNew && (
                    <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[9px] font-bold px-1 py-0.5 rounded-full leading-none">
                      NEW
                    </span>
                  )}
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{link.label}</p>
            </TooltipContent>
          </Tooltip>
        ))}
        {hasAdminAccess && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                variant="ghost"
                size="icon"
                className={cn(
                  'relative rounded-full w-12 h-12',
                  pathname === '/admin' ? 'bg-muted text-cyan-400' : 'text-cyan-400/70'
                )}
              >
                <Link href="/admin">
                  <Shield className="h-6 w-6" />
                  <span className="sr-only">Admin Panel</span>
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Admin Panel</p>
            </TooltipContent>
          </Tooltip>
        )}
      </TooltipProvider>
    </nav>
  );
}

function MobileNav({ hasAdminAccess }: { hasAdminAccess: boolean }) {
  const { firestore, user } = useFirebase();
  const { toast } = useToast();
  const [showReview, setShowReview] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewAnon, setReviewAnon] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitReview = async () => {
    if (!user || !reviewText.trim()) return;
    setSubmitting(true);
    try {
      const mySnap = await getDoc(doc(firestore, 'users', user.uid));
      const myData = mySnap.data() as any;
      await addDoc(collection(firestore, 'reviews'), {
        userId: user.uid,
        username: reviewAnon ? null : (myData?.username ?? null),
        rating: reviewRating,
        text: reviewText.trim(),
        anonymous: reviewAnon,
        createdAt: serverTimestamp(),
      });
      toast({ title: '⭐ Review posted!', description: 'Your review is live on the feed.' });
      setShowReview(false);
      setReviewText('');
      setReviewRating(5);
      setReviewAnon(false);
    } catch {
      toast({ variant: 'destructive', title: 'Failed to post review' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden h-9 w-9">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="bg-background/80 backdrop-blur-xl p-0 flex flex-col">
          <SheetHeader className="p-6 shrink-0">
            <SheetTitle className="sr-only">Mobile Menu</SheetTitle>
            <SheetDescription className="sr-only">Main navigation links for CYBA.</SheetDescription>
            <SheetClose asChild>
              <Link href="/" className="flex items-center gap-2">
                <Image src="/cyblogo.png" alt="CYBA Logo" width={30} height={30} />
                <Image src="https://preview.redd.it/cybazone-2-v0-pg6fhpkr65kg1.png?width=1080&crop=smart&auto=webp&s=6df4067e5f00ad1660deb7f6b1b13dcb326f26f0" alt="CYBAZONE Logo" width={80} height={13} />
              </Link>
            </SheetClose>
          </SheetHeader>
          <div className="flex flex-col flex-1 px-6 py-4 min-h-0 overflow-y-auto">
            <nav className="flex flex-col space-y-4">
              {navLinks.map((link) => (
                <SheetClose asChild key={link.href}>
                  <Link
                    href={link.href}
                    className="flex items-center gap-3 text-lg font-medium text-foreground/80 hover:text-primary"
                  >
                    <link.icon className="h-5 w-5" />
                    {link.label}
                    {link.isNew && (
                      <span className="bg-primary text-primary-foreground text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                        NEW
                      </span>
                    )}
                  </Link>
                </SheetClose>
              ))}
            </nav>

            {/* Admin link — only shown to admins/sub-admins */}
            {hasAdminAccess && (
              <SheetClose asChild>
                <Link
                  href="/admin"
                  className="flex items-center gap-3 text-lg font-medium text-cyan-400 hover:text-cyan-300 mt-4"
                >
                  <Shield className="h-5 w-5" />
                  Admin Panel
                </Link>
              </SheetClose>
            )}

            {/* Help & Info section at bottom of mobile nav */}
            <div className="mt-auto pt-6 border-t border-border/30 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Help &amp; Info</p>

              {/* Write a Review — top of submenu */}
              {user && (
                <SheetClose asChild>
                  <button
                    onClick={() => setShowReview(true)}
                    className="flex items-center gap-3 text-sm text-foreground/70 hover:text-yellow-400 py-2 w-full text-left"
                  >
                    <Star className="h-4 w-4 text-yellow-400" />
                    Write a Review
                  </button>
                </SheetClose>
              )}

              {HELP_LINKS.map(({ label, href, icon: Icon }) => (
                <SheetClose asChild key={href}>
                  <Link
                    href={href}
                    className="flex items-center gap-3 text-sm text-foreground/70 hover:text-primary py-2"
                  >
                    <Icon className="h-4 w-4 text-purple-400" />
                    {label}
                  </Link>
                </SheetClose>
              ))}

              {/* Socials */}
              <div className="flex items-center gap-4 pt-3 pb-1">
                {SOCIALS.map(({ label, href, icon: Icon }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="flex flex-col items-center gap-1 text-foreground/50 hover:text-primary transition-colors"
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-[10px]">{label}</span>
                  </a>
                ))}
              </div>

              {/* Developed by */}
              <a
                href="https://www.huxleigh.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-foreground/30 hover:text-foreground/60 pt-1 pb-2 transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                developed by Huxleigh
              </a>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Review dialog — outside Sheet so it survives Sheet close */}
      <Dialog open={showReview} onOpenChange={v => { setShowReview(v); }}>
        <DialogContent className="max-w-md gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-4 border-b border-border/50">
            <DialogTitle className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-400" />
              Write a Review
            </DialogTitle>
          </DialogHeader>
          <div className="px-5 py-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rating</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => setReviewRating(n)}
                    className="text-2xl transition-transform hover:scale-110"
                    style={{ color: n <= reviewRating ? '#fbbf24' : '#374151', textShadow: n <= reviewRating ? '0 0 8px rgba(251,191,36,0.5)' : 'none' }}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your Review</label>
              <Textarea
                placeholder="Share your experience on CYBAZONE…"
                value={reviewText}
                onChange={e => setReviewText(e.target.value)}
                maxLength={300}
                rows={4}
                className="resize-none text-sm"
              />
              <p className="text-xs text-muted-foreground text-right">{reviewText.length}/300</p>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/50 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Post Anonymously</p>
                <p className="text-xs text-muted-foreground">Your username won&apos;t be shown</p>
              </div>
              <Switch checked={reviewAnon} onCheckedChange={setReviewAnon} />
            </div>
          </div>
          <div className="px-5 pb-5">
            <Button
              className="w-full bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 text-white"
              disabled={!reviewText.trim() || submitting}
              onClick={handleSubmitReview}
            >
              {submitting
                ? <span className="flex items-center gap-2"><Star className="h-4 w-4 animate-spin" /> Posting…</span>
                : <span className="flex items-center gap-2"><Star className="h-4 w-4" /> Post Review to Feed</span>
              }
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** IG-style bottom tab bar — mobile only. Desktop keeps everything in the top header. */
function MobileBottomNav({ userProfile }: { userProfile?: HeaderUserProfile | null }) {
  const { user, isUserLoading } = useFirebase();
  const pathname = usePathname();

  if (isUserLoading) return null;

  const tabClass = (active: boolean) =>
    cn('flex-1 h-full flex items-center justify-center', active ? 'text-primary' : 'text-foreground/60');

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 h-14 flex items-stretch bg-background/95 backdrop-blur-md border-t border-border/50">
      <Link href="/" className={tabClass(pathname === '/')}>
        <Home className="h-6 w-6" />
      </Link>
      <Link href="/search" className={tabClass(pathname === '/search')}>
        <Search className="h-6 w-6" />
      </Link>
      <Link href={user ? '/create' : '/login'} className="flex-1 h-full flex items-center justify-center text-primary">
        <PlusCircle className="h-7 w-7" />
      </Link>
      {user ? (
        <div className={tabClass(false)}>
          <NotificationBell />
        </div>
      ) : (
        <Link href="/login" className={tabClass(false)}>
          <Bell className="h-6 w-6" />
        </Link>
      )}
      <Link
        href={user ? (userProfile?.username ? `/u/${userProfile.username}` : '/profile') : '/login'}
        className={tabClass(pathname === '/profile' || (!!userProfile?.username && pathname === `/u/${userProfile.username}`))}
      >
        {user ? (
          <AvatarDisplay
            avatarConfig={userProfile?.avatarConfig}
            profilePictureUrl={userProfile?.profilePictureUrl}
            size={26}
            level={computeLevel(userProfile?.postCount, userProfile?.supportGiven, undefined, userProfile?.levelOverride)}
          />
        ) : (
          <UserCircle className="h-6 w-6" />
        )}
      </Link>
    </nav>
  );
}


export function Header() {
  const { firestore, user } = useFirebase();
  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile } = useDoc<HeaderUserProfile>(userDocRef);
  const hasAdminAccess = useHasAdminAccess(userProfile);

  return (
    <>
      <header className="sticky top-0 z-20 w-full bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center">
          {/* Left side */}
          <div className="flex items-center gap-2 md:gap-4">
            <MobileNav hasAdminAccess={hasAdminAccess} />
            {/* Desktop: icon only, left-aligned — the wordmark sits between here and the wallet (see AuthButton) */}
            <Link href="/" className="hidden md:flex items-center">
              <Image src="/cyblogo.png" alt="CYBA Logo" width={40} height={40} />
            </Link>
          </div>

          {/* Center */}
          <div className="flex flex-1 items-center justify-center">
            {/* Mobile: wordmark takes the prominent center spot in the header */}
            <Link href="/" className="md:hidden">
              <Image src="https://preview.redd.it/cybazone-2-v0-pg6fhpkr65kg1.png?width=1080&crop=smart&auto=webp&s=6df4067e5f00ad1660deb7f6b1b13dcb326f26f0" alt="CYBAZONE Logo" width={130} height={22} />
            </Link>
            <MainNav hasAdminAccess={hasAdminAccess} />
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center justify-end gap-3">
            {/* Wordmark — sits between the icon logo (far left) and the wallet, sized to be noticeable */}
            <Link href="/" className="text-xl font-black tracking-widest text-primary text-glow shrink-0">
              CYBAZONE
            </Link>
            <AuthButton userProfile={userProfile} />
          </div>
          <div className="flex md:hidden items-center justify-end">
            <AuthButton userProfile={userProfile} />
          </div>
        </div>
      </header>
      <MobileBottomNav userProfile={userProfile} />
    </>
  );
}
