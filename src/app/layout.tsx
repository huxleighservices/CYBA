import type { Metadata } from 'next';
import './globals.css';
import { Header } from '@/components/layout/header';
import { Toaster } from '@/components/ui/toaster';
import { VideoBackground } from '@/components/layout/VideoBackground';
import { FirebaseClientProvider } from '@/firebase';
import { Footer } from '@/components/layout/footer';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/sidebar';

export const metadata: Metadata = {
  title: 'CYBA family',
  description: 'CYBA Music Marketing Agency',
  icons: {
    icon: '/cybaswirl.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head />
      <body className="font-body antialiased min-h-screen bg-background text-foreground flex flex-col">
        <FirebaseClientProvider>
          <SidebarProvider>
            <VideoBackground />
            <AppSidebar />
            <div
              className="relative flex flex-col flex-1 md:ml-[16rem]"
            >
              <Header />
              <main className="flex-grow">{children}</main>
              <Footer />
              <Toaster />
            </div>
          </SidebarProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
