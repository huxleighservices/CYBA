import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Header } from '@/components/layout/header';
import { Toaster } from '@/components/ui/toaster';
import { VideoBackground } from '@/components/layout/VideoBackground';
import { FirebaseClientProvider } from '@/firebase';
import { BanGate } from '@/components/BanGate';
import { IGHandlePrompt } from '@/components/IGHandlePrompt';
import { TikTokHandlePrompt } from '@/components/TikTokHandlePrompt';
import { JustLandedQuestPrompt } from '@/components/JustLandedQuestPrompt';
import { OnboardingExplainerPopup } from '@/components/OnboardingExplainerPopup';
import { AdDropPopup } from '@/components/AdDropPopup';
import { SplashScreen } from '@/components/layout/SplashScreen';

export const metadata: Metadata = {
  title: 'CYBAZONE',
  description: 'CYBAZONE Creator Community',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/app-icon.png', type: 'image/png' },
    ],
    apple: [
      { url: '/app-icon.png', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#8A2BE2',
  // Do NOT set maximumScale=1 or userScalable=no — iOS ignores touch events
  // more aggressively when zoom is disabled, making tap targets less reliable.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head />
      <body className="font-body antialiased bg-background text-foreground flex flex-col" style={{ minHeight: '100dvh' }}>
        <SplashScreen />
        <FirebaseClientProvider>
          <BanGate>
            <VideoBackground />
            <div className="relative z-10 flex flex-col flex-1">
              <Header />
              {/* pb-14 reserves space for the fixed mobile bottom nav bar (Header renders it below md) */}
              <main className="flex-grow pb-14 md:pb-0">{children}</main>
              <Toaster />
              <IGHandlePrompt />
              <TikTokHandlePrompt />
              <JustLandedQuestPrompt />
              <OnboardingExplainerPopup />
              <AdDropPopup />
            </div>
          </BanGate>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
