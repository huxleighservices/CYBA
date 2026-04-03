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
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { AvatarDisplay } from '@/components/AvatarDisplay';
import type { AvatarConfig } from '@/lib/avatar-assets';
import { doc } from 'firebase/firestore';
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


const navLinks = [
  { href: '/', label: 'Feed', icon: Newspaper, isNew: false },
  { href: '/cybaquests', label: 'CYBAQuests', icon: Target, isNew: true },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy, isNew: false },
  { href: '/winners-wheel', label: "Winner's Wheel", icon: RotateCw, isNew: true },
  { href: '/boosts', label: 'Boosts', icon: Gem, isNew: false },
  { href: '/shop', label: 'Shop', icon: ShoppingBag, isNew: false },
];

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
    <form onSubmit={handleSubmit} className="relative hidden sm:block">
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

function AuthButton() {
  const { firestore, user, isUserLoading } = useFirebase();
  const [isClient, setIsClient] = useState(false);

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile } = useDoc<{
    avatarConfig?: AvatarConfig;
    profilePictureUrl?: string;
    postCount?: number;
    supportGiven?: number;
    username?: string;
    cybaCoinBalance?: number;
  }>(userDocRef);

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
        <Button variant="outline" size="sm" asChild>
          <Link href="/login">Sign In</Link>
        </Button>
        <Button size="sm" asChild>
          <Link href="/signup">Create Account</Link>
        </Button>
      </div>
    );
  }

  const profileHref = userProfile?.username ? `/u/${userProfile.username}` : '/profile';

  return (
    <div className="flex items-center gap-3">
      {/* CybaCoin balance */}
      <div className="hidden sm:flex items-center gap-1.5 bg-card border border-border rounded-full px-3 py-1">
        <Image src="/CCoin.png?v=2" alt="CYBACOIN" width={18} height={18} />
        <span className="text-sm font-bold text-primary tabular-nums">
          {(userProfile?.cybaCoinBalance ?? 0).toLocaleString()}
        </span>
      </div>

      <Link
        href="/create"
        className="shrink-0 rounded-full p-1 text-muted-foreground hover:text-primary transition-colors"
        title="Create post"
      >
        <PlusCircle className="h-7 w-7" />
      </Link>
      <Link href={profileHref} className="shrink-0">
        <AvatarDisplay
          avatarConfig={userProfile?.avatarConfig}
          profilePictureUrl={userProfile?.profilePictureUrl}
          size={36}
          level={computeLevel(userProfile?.postCount, userProfile?.supportGiven)}
        />
      </Link>
      <SearchBar />
    </div>
  );
}

function MainNav() {
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
      </TooltipProvider>
    </nav>
  );
}

function MobileNav() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu />
          <span className="sr-only">Toggle Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="bg-background/80 backdrop-blur-xl p-0">
        <SheetHeader className="p-6">
          <SheetTitle className="sr-only">Mobile Menu</SheetTitle>
          <SheetDescription className="sr-only">Main navigation links for CYBA.</SheetDescription>
          <SheetClose asChild>
            <Link href="/" className="flex items-center gap-2">
              <Image src="/cyblogo.png" alt="CYBA Logo" width={30} height={30} />
              <Image src="https://preview.redd.it/cybazone-2-v0-pg6fhpkr65kg1.png?width=1080&crop=smart&auto=webp&s=6df4067e5f00ad1660deb7f6b1b13dcb326f26f0" alt="CYBAZONE Logo" width={80} height={13} />
            </Link>
          </SheetClose>
        </SheetHeader>
        <div className="flex flex-col h-full px-6 py-4">
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
        </div>
      </SheetContent>
    </Sheet>
  );
}


export function Header() {
  return (
    <header className="sticky top-0 z-20 w-full bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center">
        {/* Left side */}
        <div className="flex items-center gap-2 md:gap-4">
          <MobileNav />
          <Link href="/" className="flex items-center space-x-2">
            <Image src="/cyblogo.png" alt="CYBA Logo" width={40} height={40} className="animate-slow-spin" />
            <div className="hidden sm:block">
              <Image src="https://preview.redd.it/cybazone-2-v0-pg6fhpkr65kg1.png?width=1080&crop=smart&auto=webp&s=6df4067e5f00ad1660deb7f6b1b13dcb326f26f0" alt="CYBAZONE Logo" width={156} height={27} />
            </div>
          </Link>
        </div>

        {/* Center */}
        <div className="flex flex-1 items-center justify-center">
          <MainNav />
        </div>

        {/* Right side */}
        <div className="flex items-center justify-end">
          <AuthButton />
        </div>
      </div>
    </header>
  );
}
