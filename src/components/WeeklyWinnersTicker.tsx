'use client';

import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

export interface WeeklyWinner {
  rank: number;
  name: string;
  cybaIg?: string;
  cybaCoin?: number;
  posts?: number;
  support?: number;
  profilePictureUrl?: string | null;
  avatarConfig?: any | null;
}

export interface WeeklyWinnersData {
  winners: WeeklyWinner[];
  weekOf: number;
  setAt: number;
}

const RANK_LABEL = ['#1', '#2', '#3', '#4', '#5', '#6', '#7', '#8', '#9', '#10'];

export function WeeklyWinnersTicker() {
  const { firestore } = useFirebase();

  const docRef = useMemoFirebase(
    () => doc(firestore, 'settings', 'weeklyWinners'),
    [firestore]
  );
  const { data } = useDoc<WeeklyWinnersData>(docRef);

  if (!data?.winners?.length) return null;

  const TickerContent = () => (
    <span className="inline-flex items-center gap-0 font-mono whitespace-nowrap">
      {data.winners.map((w, i) => (
        <span key={i} className="inline-flex items-center gap-0 px-0">
          {/* Rank + name */}
          <span className="inline-flex items-center gap-1.5 px-4">
            <span className="text-green-400 font-black text-[10px] tracking-wider">{RANK_LABEL[i]}</span>
            <span className="text-white font-bold text-[11px] uppercase tracking-widest">{w.name}</span>
          </span>

          {/* Post count */}
          <span className="text-green-700 text-[10px] select-none">│</span>
          <span className="inline-flex items-center gap-1 px-2.5">
            <span className="text-[10px]">📝</span>
            <span className="text-cyan-300 text-[10px] font-bold tabular-nums">{(w.posts ?? 0).toLocaleString()}</span>
            <span className="text-green-600/60 text-[9px] font-mono uppercase tracking-wider">posts</span>
          </span>

          {/* Support count */}
          <span className="text-green-700 text-[10px] select-none">│</span>
          <span className="inline-flex items-center gap-1 px-2.5">
            <span className="text-[10px]">❤️</span>
            <span className="text-pink-300 text-[10px] font-bold tabular-nums">{(w.support ?? 0).toLocaleString()}</span>
            <span className="text-green-600/60 text-[9px] font-mono uppercase tracking-wider">supp</span>
          </span>

          {/* Separator between entries */}
          <span className="text-green-600/50 text-[10px] px-2 select-none">◆</span>
        </span>
      ))}
    </span>
  );

  return (
    <div className="w-full overflow-hidden bg-black border-y border-green-500/25 relative flex items-center" style={{ height: 30 }}>
      <style>{`
        @keyframes ticker-8bit {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .ticker-8bit {
          animation: ticker-8bit 40s steps(480, end) infinite;
        }
      `}</style>

      {/* Fixed left stamp */}
      <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center bg-black border-r border-green-500/30 px-2.5 shrink-0 shadow-[4px_0_8px_rgba(0,0,0,0.8)]">
        <span className="text-green-400 text-[9px] font-mono font-black tracking-[0.18em] uppercase whitespace-nowrap">
          ▶ TOP CYBAS
        </span>
      </div>

      {/* Scrolling ticker */}
      <div className="ticker-8bit inline-flex whitespace-nowrap will-change-transform items-center h-full" style={{ paddingLeft: 110 }}>
        <TickerContent />
        <TickerContent />
      </div>
    </div>
  );
}
