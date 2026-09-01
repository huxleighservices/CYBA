'use client';

import { useMemo, useState } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Heart, MessageCircle, Repeat, TrendingUp, TrendingDown } from 'lucide-react';
import type { EngagementType } from '@/lib/engagement-log';

type EngagementEvent = {
  id: string;
  type: EngagementType;
  direction: 'inward' | 'outward';
  postId: string;
  otherUserId: string;
  timestamp: Timestamp;
};

type DailyBucket = { date: string; label: string; inward: number; outward: number };

const DAYS = 30;
// Categorical slots 1 (blue) + 2 (orange) — adjacent pair, validated CVD-safe ordering.
const COLOR_OUTWARD = { light: '#2a78d6', dark: '#3987e5' };
const COLOR_INWARD = { light: '#eb6834', dark: '#d95926' };

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function AnalyticsTab({ userId }: { userId: string }) {
  const { firestore } = useFirebase();
  const [hovered, setHovered] = useState<DailyBucket | null>(null);

  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - DAYS);
    d.setHours(0, 0, 0, 0);
    return Timestamp.fromDate(d);
  }, []);

  const logQuery = useMemoFirebase(
    () => query(
      collection(firestore, 'users', userId, 'engagementLog'),
      where('timestamp', '>=', since),
      orderBy('timestamp', 'asc'),
    ),
    [firestore, userId, since]
  );
  const { data: events, isLoading } = useCollection<EngagementEvent>(logQuery);

  const { buckets, totals, byType } = useMemo(() => {
    const bucketMap = new Map<string, DailyBucket>();
    const today = new Date();
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = dateKey(d);
      bucketMap.set(key, {
        date: key,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        inward: 0,
        outward: 0,
      });
    }

    const totals = { inward: 0, outward: 0 };
    const byType: Record<EngagementType, { inward: number; outward: number }> = {
      like: { inward: 0, outward: 0 },
      comment: { inward: 0, outward: 0 },
      repost: { inward: 0, outward: 0 },
    };

    (events ?? []).forEach(e => {
      const key = e.timestamp?.toDate ? dateKey(e.timestamp.toDate()) : null;
      const bucket = key ? bucketMap.get(key) : null;
      if (bucket) bucket[e.direction] += 1;
      totals[e.direction] += 1;
      if (byType[e.type]) byType[e.type][e.direction] += 1;
    });

    return { buckets: Array.from(bucketMap.values()), totals, byType };
  }, [events]);

  const maxValue = Math.max(1, ...buckets.map(b => Math.max(b.inward, b.outward)));

  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 mt-6">
      {/* Summary stat tiles */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-border/60">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wide mb-1">
              <TrendingDown className="h-3.5 w-3.5" style={{ color: COLOR_INWARD.dark }} /> Inward (last {DAYS}d)
            </div>
            <p className="text-3xl font-bold tabular-nums">{totals.inward.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">Likes, comments & reposts your posts received</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wide mb-1">
              <TrendingUp className="h-3.5 w-3.5" style={{ color: COLOR_OUTWARD.dark }} /> Outward (last {DAYS}d)
            </div>
            <p className="text-3xl font-bold tabular-nums">{totals.outward.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">Likes, comments & reposts you gave others</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily chart */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Engagement Over Time</CardTitle>
          <CardDescription>Inward vs. outward activity, last {DAYS} days.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Legend */}
          <div className="flex items-center gap-4 mb-3 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLOR_OUTWARD.dark }} /> Outward
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLOR_INWARD.dark }} /> Inward
            </span>
          </div>

          {totals.inward + totals.outward === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No engagement activity yet in this window.</p>
          ) : (
            <div className="relative">
              <div className="flex items-end gap-[3px] h-40 border-b border-border/60">
                {buckets.map(b => (
                  <div
                    key={b.date}
                    className="flex-1 h-full flex items-end gap-[1px] cursor-default"
                    onMouseEnter={() => setHovered(b)}
                    onMouseLeave={() => setHovered(prev => (prev?.date === b.date ? null : prev))}
                  >
                    <div
                      className="flex-1 rounded-t-sm transition-opacity"
                      style={{
                        height: `${(b.outward / maxValue) * 100}%`,
                        backgroundColor: COLOR_OUTWARD.dark,
                        opacity: hovered && hovered.date !== b.date ? 0.35 : 1,
                        minHeight: b.outward > 0 ? 2 : 0,
                      }}
                    />
                    <div
                      className="flex-1 rounded-t-sm transition-opacity"
                      style={{
                        height: `${(b.inward / maxValue) * 100}%`,
                        backgroundColor: COLOR_INWARD.dark,
                        opacity: hovered && hovered.date !== b.date ? 0.35 : 1,
                        minHeight: b.inward > 0 ? 2 : 0,
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>{buckets[0]?.label}</span>
                <span>{buckets[buckets.length - 1]?.label}</span>
              </div>
              {hovered && (
                <div className="mt-2 inline-flex items-center gap-3 rounded-md border border-border/60 bg-card px-3 py-1.5 text-xs">
                  <span className="font-semibold">{hovered.label}</span>
                  <span style={{ color: COLOR_OUTWARD.dark }}>Outward: {hovered.outward}</span>
                  <span style={{ color: COLOR_INWARD.dark }}>Inward: {hovered.inward}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Breakdown by type */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">By Type</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {([
            { type: 'like' as const, icon: Heart, label: 'Likes' },
            { type: 'comment' as const, icon: MessageCircle, label: 'Comments' },
            { type: 'repost' as const, icon: Repeat, label: 'Reposts' },
          ]).map(({ type, icon: Icon, label }) => (
            <div key={type} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-foreground/80">
                <Icon className="h-4 w-4 text-muted-foreground" /> {label}
              </span>
              <span className="flex items-center gap-4 tabular-nums">
                <span style={{ color: COLOR_OUTWARD.dark }}>↑ {byType[type].outward}</span>
                <span style={{ color: COLOR_INWARD.dark }}>↓ {byType[type].inward}</span>
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
