'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

const SPLASH_SESSION_KEY = 'cybazone_splash_shown';
const SPLASH_VISIBLE_MS = 1400;
const SPLASH_FADE_MS = 350;

export function SplashScreen() {
  const [visible, setVisible] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem(SPLASH_SESSION_KEY)) return;
    sessionStorage.setItem(SPLASH_SESSION_KEY, '1');
    setVisible(true);

    const fadeTimer = setTimeout(() => setFadingOut(true), SPLASH_VISIBLE_MS);
    const hideTimer = setTimeout(() => setVisible(false), SPLASH_VISIBLE_MS + SPLASH_FADE_MS);
    return () => { clearTimeout(fadeTimer); clearTimeout(hideTimer); };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center transition-opacity"
      style={{
        background: 'radial-gradient(circle at 50% 40%, #9333ea, #4c0e8f 65%, #2a0a52)',
        opacity: fadingOut ? 0 : 1,
        transitionDuration: `${SPLASH_FADE_MS}ms`,
      }}
    >
      <style>{`
        @keyframes cyba-splash-glitch {
          0%   { clip-path: inset(0 0 0 0); transform: translate(0, 0); }
          6%   { clip-path: inset(10% 0 60% 0); transform: translate(-3px, 0); }
          12%  { clip-path: inset(60% 0 5% 0); transform: translate(3px, 0); }
          18%  { clip-path: inset(0 0 0 0); transform: translate(0, 0); }
          46%  { clip-path: inset(0 0 0 0); transform: translate(0, 0); }
          52%  { clip-path: inset(30% 0 40% 0); transform: translate(2px, -1px); }
          58%  { clip-path: inset(0 0 0 0); transform: translate(0, 0); }
          100% { clip-path: inset(0 0 0 0); transform: translate(0, 0); }
        }
        .cyba-splash-logo { animation: cyba-splash-glitch 1.4s steps(1) infinite; }
        .cyba-splash-logo::before,
        .cyba-splash-logo::after {
          content: '';
          position: absolute;
          inset: 0;
          background-image: url('/logo-white.png');
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
          mix-blend-mode: screen;
          opacity: 0;
        }
        .cyba-splash-logo::before { animation: cyba-splash-glitch-r 1.4s steps(1) infinite; }
        .cyba-splash-logo::after { animation: cyba-splash-glitch-b 1.4s steps(1) infinite; }
        @keyframes cyba-splash-glitch-r {
          0%, 46%, 58%, 100% { opacity: 0; transform: translate(0,0); }
          6% { opacity: 0.7; transform: translate(4px, 0); filter: drop-shadow(0 0 0 #ff3d3d); }
          12% { opacity: 0.5; transform: translate(-3px, 1px); }
          52% { opacity: 0.6; transform: translate(3px, 0); }
        }
        @keyframes cyba-splash-glitch-b {
          0%, 46%, 58%, 100% { opacity: 0; transform: translate(0,0); }
          6% { opacity: 0.7; transform: translate(-4px, 0); }
          12% { opacity: 0.5; transform: translate(3px, -1px); }
          52% { opacity: 0.6; transform: translate(-3px, 0); }
        }
      `}</style>
      <div className="relative w-32 h-32 sm:w-40 sm:h-40 cyba-splash-logo">
        <Image src="/logo-white.png" alt="CYBAZONE" fill className="object-contain" priority />
      </div>
    </div>
  );
}
