import type { Metadata } from 'next';
import './globals.css';
import { Header } from '@/components/layout/header';
import { Toaster } from '@/components/ui/toaster';
import { VideoBackground } from '@/components/layout/VideoBackground';
import { FirebaseClientProvider } from '@/firebase';
import { Footer } from '@/components/layout/footer';

export const metadata: Metadata = {
  title: 'CYBA Galaxy',
  description: 'CYBA Music Marketing Agency',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased min-h-screen bg-background text-foreground flex flex-col">
        <FirebaseClientProvider>
          <VideoBackground />
          <div className="relative z-10 flex flex-col flex-grow">
            <Header />
            <main className="flex-grow">{children}</main>
            <Footer />
            <Toaster />
          </div>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
