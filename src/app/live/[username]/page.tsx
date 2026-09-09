'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Live Broadcasting — TEMPLATE ONLY, per explicit instruction: do not build real
 * streaming/payment-gating logic yet. This is just the scaffold (route + entry point)
 * so the "Go Live" button has somewhere to send members, matching the visual pattern
 * already used for the Subnets-placeholder ("Coming Soon") before Subnet was built for real.
 *
 * Future real build (not now): a `liveStatus` field on the user doc, viewer count tracking,
 * a per-session CC admission price set by the host, and viewer-side payment gating —
 * mirroring the Subnet creator-to-creator billing pattern once a streaming vendor is chosen.
 */
export default function LivePlaceholderPage() {
  const params = useParams();
  const username = typeof params?.username === 'string' ? params.username : '';

  return (
    <div className="container mx-auto px-4 pt-16 pb-16 max-w-lg text-center">
      <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-card/30 p-12">
        <Radio className="h-12 w-12 mx-auto mb-4 text-primary/50" />
        <h1 className="text-2xl font-bold font-headline mb-2">Live Streaming — Coming Soon</h1>
        <p className="text-muted-foreground mb-6">
          {username ? `@${username} hasn't gone live yet — this feature is on the way.` : 'This feature is on the way.'}
        </p>
        <Button asChild variant="outline">
          <Link href="/">Back to Central</Link>
        </Button>
      </div>
    </div>
  );
}
