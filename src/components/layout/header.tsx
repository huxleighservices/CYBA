'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  User,
  LogOut,
  Instagram,
  Youtube,
  Facebook,
  Home,
  Users,
  ShoppingBag,
  PenSquare,
  Trophy,
  Menu,
  Sparkles,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
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

const navLinks = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/membership', label: 'Membership', icon: Users },
  { href: '/merch', label: 'CYBAMERCH', icon: ShoppingBag },
  { href: '/blog', label: 'Blog', icon: PenSquare },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/extras', label: 'Boosts/Rewards', icon: Sparkles },
];

function AuthButton() {
  const { firestore, auth, user, isUserLoading } = useFirebase();
  const [isClient, setIsClient] = useState(false);

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile } = useDoc<{ cybaCoinBalance?: number }>(userDocRef);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient || isUserLoading) {
    return <div className="flex items-center gap-2 h-9" />;
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/login">Sign In</Link>
        </Button>
        <Button size="sm" asChild>
          <Link href="/signup">Create Account</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2 text-primary">
        <Image src="/CCoin.png?v=2" alt="Cybacoin" width={32} height={32} />
        <span className="font-bold">{userProfile?.cybaCoinBalance || 0}</span>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <User className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">My Account</p>
              <p className="text-xs leading-none text-muted-foreground">
                {user.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/profile">
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => auth.signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function MainNav() {
  const pathname = usePathname();
  const row1Links = navLinks.slice(0, 3);
  const row2Links = navLinks.slice(3);

  const renderLinks = (links: typeof navLinks) => (
    <div className="flex items-center justify-center space-x-6 lg:space-x-8">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            'text-sm font-medium transition-colors hover:text-primary',
            pathname === link.href ? 'text-primary' : 'text-foreground/60'
          )}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );

  return (
    <nav className="hidden md:flex flex-col items-center space-y-2">
      {renderLinks(row1Links)}
      {renderLinks(row2Links)}
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
              <span className="text-xl font-bold">CYBA</span>
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
      <div className="container mx-auto flex h-24 items-center">
        {/* Left side */}
        <div className="flex items-center gap-6">
          <MobileNav />
          <Link href="/" className="flex items-center space-x-2">
            <Image src="/cyblogo.png" alt="CYBA Logo" width={50} height={50} className="animate-slow-spin" />
            <span className="hidden font-bold sm:inline-block">CYBA</span>
          </Link>
        </div>

        {/* Center */}
        <div className="flex flex-1 items-center justify-center">
          <MainNav />
        </div>

        {/* Right side */}
        <div className="flex items-center justify-end gap-4">
          <div className="hidden md:flex items-center gap-2">
            <a
              href="https://www.instagram.com/cybazone/?hl=en"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="ghost" size="icon">
                <Instagram className="h-5 w-5" />
                <span className="sr-only">Instagram</span>
              </Button>
            </a>
            <a
              href="https://www.youtube.com/hashtag/cyba"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="ghost" size="icon">
                <Youtube className="h-5 w-5" />
                <span className="sr-only">YouTube</span>
              </Button>
            </a>
            <a
              href="https://www.facebook.com/people/Cybazone/61570841902450/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="ghost" size="icon">
                <Facebook className="h-5 w-5" />
                <span className="sr-only">Facebook</span>
              </Button>
            </a>
          </div>
          <AuthButton />
        </div>
      </div>
    </header>
  );
}
