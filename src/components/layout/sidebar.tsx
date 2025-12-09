'use client';

import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarFooter,
} from '@/components/ui/sidebar';
import Link from 'next/link';
import Image from 'next/image';
import {
  Home,
  Users,
  ShoppingBag,
  PenSquare,
  MessageSquare,
  PanelLeft,
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
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link href="/" className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <Image
            src="/cyblogo.png"
            alt="CYBA Logo"
            width={30}
            height={30}
            className="group-data-[collapsible=icon]:mx-auto"
          />
          <span className="text-xl font-bold group-data-[collapsible=icon]:hidden">
            CYBA
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {navLinks.map((link) => (
            <SidebarMenuItem key={link.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname === link.href}
                tooltip={link.label}
              >
                <Link href={link.href}>
                  <link.icon className="h-5 w-5" />
                  <span>{link.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="hidden md:flex">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarTrigger>
                <PanelLeft className="h-5 w-5" />
                <span>Collapse</span>
            </SidebarTrigger>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
