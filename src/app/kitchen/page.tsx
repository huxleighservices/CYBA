'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useFirebase, useMemoFirebase, useCollection } from '@/firebase';
import {
  collection, query, where, orderBy, doc, updateDoc,
  serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { ChefHat, Clock, CheckCircle2, Flame, AlertCircle, Utensils, RefrigeratorIcon, Wind, Star, Wine } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

type Station = 'grill' | 'fryer' | 'cold' | 'prep' | 'expo' | 'bar';

type OrderItem = {
  name: string;
  quantity: number;
  modifications: string[];
  station: Station;
  steps: string[];
  estimatedMinutes: number;
};

type Ticket = {
  id: string;
  ticketNumber: number;
  transcript: string;
  items: OrderItem[];
  notes?: string;
  totalEstimatedMinutes: number;
  status: 'new' | 'in-progress' | 'done';
  deviceId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

// ── Constants ──────────────────────────────────────────────────────────────

const STATION_META: Record<Station, { label: string; color: string; Icon: React.ElementType }> = {
  grill:  { label: 'Grill',   color: 'bg-orange-600',  Icon: Flame           },
  fryer:  { label: 'Fryer',   color: 'bg-yellow-600',  Icon: Wind            },
  cold:   { label: 'Cold',    color: 'bg-cyan-600',    Icon: RefrigeratorIcon },
  prep:   { label: 'Prep',    color: 'bg-emerald-600', Icon: Utensils        },
  expo:   { label: 'Expo',    color: 'bg-purple-600',  Icon: Star            },
  bar:    { label: 'Bar',     color: 'bg-pink-600',    Icon: Wine            },
};

const STATUS_COLUMNS = [
  { status: 'new',         label: 'New Orders',  headerClass: 'border-green-500  text-green-400'  },
  { status: 'in-progress', label: 'In Progress', headerClass: 'border-yellow-500 text-yellow-400' },
  { status: 'done',        label: 'Done',        headerClass: 'border-gray-600   text-gray-500'   },
] as const;

// ── Helpers ────────────────────────────────────────────────────────────────

function useElapsed(ts: Timestamp | undefined): string {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  if (!ts) return '—';
  const secs = Math.floor((Date.now() - ts.toMillis()) / 1000);
  if (secs < 60)  return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}

function elapsedMs(ts: Timestamp | undefined): number {
  if (!ts) return 0;
  return Date.now() - ts.toMillis();
}

// ── Sub-components ─────────────────────────────────────────────────────────

function TimerBadge({ ticket }: { ticket: Ticket }) {
  const elapsed = useElapsed(ticket.createdAt);
  const ms = elapsedMs(ticket.createdAt);
  const overdue = ticket.status !== 'done' && ms > ticket.totalEstimatedMinutes * 60_000;
  return (
    <div className={cn(
      'flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded-full border',
      overdue
        ? 'border-red-500 text-red-400 bg-red-950/40 animate-pulse'
        : 'border-white/20 text-white/60 bg-white/5',
    )}>
      {overdue ? <AlertCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      {elapsed}
    </div>
  );
}

function StationBadge({ station }: { station: Station }) {
  const meta = STATION_META[station] ?? STATION_META.prep;
  const Icon = meta.Icon;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-white px-2 py-0.5 rounded', meta.color)}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

function TicketCard({ ticket, onAdvance }: { ticket: Ticket; onAdvance: (t: Ticket) => void }) {
  const nextStatus: Record<string, string> = {
    'new':         'Start',
    'in-progress': 'Complete',
    'done':        '',
  };
  const nextLabel = nextStatus[ticket.status] ?? '';

  return (
    <div className={cn(
      'rounded-xl border p-4 flex flex-col gap-3 transition-all',
      ticket.status === 'new'         && 'border-green-500/50  bg-green-950/20',
      ticket.status === 'in-progress' && 'border-yellow-500/50 bg-yellow-950/20',
      ticket.status === 'done'        && 'border-gray-700/50   bg-gray-900/30 opacity-60',
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-2xl font-black font-mono leading-none',
            ticket.status === 'new'         && 'text-green-400',
            ticket.status === 'in-progress' && 'text-yellow-400',
            ticket.status === 'done'        && 'text-gray-500',
          )}>
            #{String(ticket.ticketNumber).padStart(3, '0')}
          </span>
        </div>
        <TimerBadge ticket={ticket} />
      </div>

      {/* Items */}
      <div className="space-y-3">
        {ticket.items.map((item, i) => (
          <div key={i} className="rounded-lg bg-black/30 border border-white/10 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-semibold text-white text-sm">
                {item.quantity > 1 && <span className="text-yellow-400 mr-1">{item.quantity}×</span>}
                {item.name}
              </span>
              <StationBadge station={item.station as Station} />
            </div>

            {item.modifications.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {item.modifications.map((mod, j) => (
                  <span key={j} className="text-[10px] bg-orange-950/50 border border-orange-500/30 text-orange-300 rounded px-1.5 py-0.5">
                    {mod}
                  </span>
                ))}
              </div>
            )}

            <ol className="space-y-1 mt-1">
              {item.steps.map((step, j) => (
                <li key={j} className="flex gap-2 text-xs text-white/70">
                  <span className="shrink-0 w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-bold text-white/50 mt-0.5">
                    {j + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>

            <div className="text-[10px] text-white/40 mt-1">
              Est. {item.estimatedMinutes} min
            </div>
          </div>
        ))}
      </div>

      {/* Notes */}
      {ticket.notes && (
        <div className="text-xs text-amber-400/80 bg-amber-950/20 border border-amber-500/20 rounded px-3 py-2">
          ⚠ {ticket.notes}
        </div>
      )}

      {/* Action */}
      {nextLabel && (
        <button
          onClick={() => onAdvance(ticket)}
          className={cn(
            'w-full rounded-lg py-2 text-sm font-semibold transition-colors',
            ticket.status === 'new'
              ? 'bg-green-600 hover:bg-green-500 text-white'
              : 'bg-yellow-600 hover:bg-yellow-500 text-white',
          )}
        >
          {ticket.status === 'in-progress' && <CheckCircle2 className="inline h-4 w-4 mr-1 -mt-0.5" />}
          {nextLabel}
        </button>
      )}

      {/* Device tag */}
      <div className="text-[9px] text-white/20 font-mono truncate">
        {ticket.deviceId} · {ticket.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function KitchenPage() {
  const { firestore } = useFirebase();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Subscribe to tickets from the last 8 hours
  const cutoff = new Date(Date.now() - 8 * 60 * 60 * 1000);
  const ticketsQuery = useMemoFirebase(
    () => query(
      collection(firestore, 'kitchen_tickets'),
      where('createdAt', '>=', cutoff),
      orderBy('createdAt', 'desc'),
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [firestore],
  );
  const { data: tickets } = useCollection<Ticket>(ticketsQuery);

  // Beep on new ticket
  const prevCountRef = useRef<number | null>(null);
  useEffect(() => {
    if (!tickets) return;
    const newCount = tickets.filter(t => t.status === 'new').length;
    if (prevCountRef.current !== null && newCount > prevCountRef.current) {
      // Synthesise a short beep via Web Audio
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } catch {}
    }
    prevCountRef.current = newCount;
  }, [tickets]);

  const handleAdvance = useCallback(async (ticket: Ticket) => {
    const next = ticket.status === 'new' ? 'in-progress' : 'done';
    await updateDoc(doc(firestore, 'kitchen_tickets', ticket.id), {
      status: next,
      updatedAt: serverTimestamp(),
    });
  }, [firestore]);

  const byStatus = (status: string) =>
    (tickets ?? []).filter(t => t.status === status);

  const newCount        = byStatus('new').length;
  const inProgressCount = byStatus('in-progress').length;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col select-none">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-black/40 shrink-0">
        <div className="flex items-center gap-3">
          <ChefHat className="h-7 w-7 text-orange-400" />
          <span className="text-xl font-black tracking-tight">KitchenBot</span>
          <span className="text-xs text-white/30 font-mono">KDS</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {newCount > 0 && (
            <span className="flex items-center gap-1.5 bg-green-600/20 border border-green-500/40 text-green-400 px-3 py-1 rounded-full font-semibold animate-pulse">
              <span className="h-2 w-2 rounded-full bg-green-400 inline-block" />
              {newCount} new
            </span>
          )}
          {inProgressCount > 0 && (
            <span className="flex items-center gap-1.5 bg-yellow-600/20 border border-yellow-500/40 text-yellow-400 px-3 py-1 rounded-full font-semibold">
              {inProgressCount} cooking
            </span>
          )}
          <span className="text-white/30 font-mono text-xs">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </header>

      {/* Station legend */}
      <div className="flex items-center gap-3 px-6 py-2 border-b border-white/5 bg-black/20 shrink-0 overflow-x-auto">
        {Object.entries(STATION_META).map(([key, { label, color, Icon }]) => (
          <div key={key} className="flex items-center gap-1.5 shrink-0">
            <span className={cn('w-2.5 h-2.5 rounded-sm', color)} />
            <span className="text-xs text-white/40 flex items-center gap-1">
              <Icon className="h-3 w-3" /> {label}
            </span>
          </div>
        ))}
      </div>

      {/* Kanban columns */}
      <div className="flex-1 grid grid-cols-3 gap-0 divide-x divide-white/5 overflow-hidden">
        {STATUS_COLUMNS.map(({ status, label, headerClass }) => {
          const col = byStatus(status);
          return (
            <div key={status} className="flex flex-col overflow-hidden">
              {/* Column header */}
              <div className={cn('flex items-center justify-between px-5 py-3 border-b-2 shrink-0', headerClass)}>
                <span className="font-bold text-sm uppercase tracking-widest">{label}</span>
                <span className="text-lg font-black font-mono">{col.length}</span>
              </div>
              {/* Scrollable cards */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {col.length === 0 ? (
                  <div className="text-center py-16 text-white/20 text-sm">
                    {status === 'new' ? 'Waiting for orders…' : 'None'}
                  </div>
                ) : (
                  col.map(ticket => (
                    <TicketCard key={ticket.id} ticket={ticket} onAdvance={handleAdvance} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
