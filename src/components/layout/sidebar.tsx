'use client';

import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import Link from 'next/link';
import Image from 'next/image';
import {
  Home,
  Users,
  ShoppingBag,
  PenSquare,
  MessageSquare,
} from 'lucide-react';
import { usePathname } from 'next/navigation';

const navLinks = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/membership', label: 'Membership', icon: Users },
  { href: '/merch', label: 'Merch', icon: ShoppingBag },
  { href: '/blog', label: 'Blog', icon: PenSquare },
  { href: '/cybaboard', label: 'Cybaboard', icon: MessageSquare },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader>
        <Link href="/" className="flex items-center gap-2">
          <Image src="/cyblogo.png" alt="CYBA Logo" width={30} height={30} />
          <span className="text-xl font-bold">CYBA</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {navLinks.map((link) => (
            <SidebarMenuItem key={link.href}>
              <SidebarMenuButton asChild isActive={pathname === link.href}>
                <Link href={link.href}>
                  <link.icon className="h-5 w-5" />
                  <span>{link.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
