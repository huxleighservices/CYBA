'use client';

import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import Image from 'next/image';

export interface WeeklyWinner {
  rank: number;
  name: string;
  cybaIg?: string;
  cybaCoin: number;
}

export interface WeeklyWinnersData {
  winners: WeeklyWinner[];
  weekOf: number;  // ms timestamp of the Saturday this was captured
  setAt: number;
}

const RANK_EMOJI = ['🥇', '🥈', '🥉'];

export function WeeklyWinnersTicker() {
  const { firestore } = useFirebase();

  const docRef = useMemoFirebase(
    () => doc(firestore, 'settings', 'weeklyWinners'),
    [firestore]
  );
  const { data } = useDoc<WeeklyWinnersData>(docRef);

  if (!data?.winners?.length) return null;

  const weekLabel = data.weekOf
    ? new Date(data.weekOf).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  // Build a single pass of ticker content — duplicated for seamless loop
  const TickerContent = () => (
    <span className="inline-flex items-center gap-0 whitespace-nowrap">
      {/* Title badge */}
      <span className="inline-flex items-center gap-2 px-6">
        <span className="text-yellow-300 text-xs font-black tracking-[0.2em] uppercase">
          ✦ CYBA Weekly Winners ✦
        </span>
        {weekLabel && (
          <span className="text-yellow-600 text-xs">Week of {weekLabel}</span>
        )}
      </span>

      {/* Separator */}
      <span className="text-yellow-700 px-2 select-none">◆</span>

      {/* Winners */}
      {data.winners.map((w, i) => (
        <span key={i} className="inline-flex items-center gap-2 px-5">
          <span className="text-base leading-none">{RANK_EMOJI[i]}</span>
          <span className="text-yellow-100 font-bold text-sm tracking-wide">{w.name}</span>
          <span className="text-yellow-700 text-xs">—</span>
          <Image src="/CCoin.png?v=2" alt="" width={13} height={13} className="opacity-90" />
          <span className="text-yellow-300 text-xs font-semibold tabular-nums">
            {w.cybaCoin.toLocaleString()}
          </span>
          {i < data.winners.length - 1 && (
            <span className="text-yellow-800 pl-4 select-none">·</span>
          )}
        </span>
      ))}

      {/* End separator before loop */}
      <span className="text-yellow-700 px-4 select-none">◆◆◆</span>
    </span>
  );

  return (
    <div className="w-full overflow-hidden bg-gradient-to-r from-yellow-950 via-yellow-900/70 to-yellow-950 border-y border-yellow-600/30 shadow-[0_0_24px_rgba(234,179,8,0.12)] py-2">
      {/* Duplicated content for seamless infinite scroll */}
      <div className="ticker-loop inline-flex whitespace-nowrap will-change-transform">
        <TickerContent />
        <TickerContent />
      </div>
    </div>
  );
}
