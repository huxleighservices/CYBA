import { NextRequest, NextResponse } from 'next/server';
import { POST as weeklyPayout } from '../../cron/weekly-payout/route';
import { POST as weeklyReset } from '../../cron/weekly-reset/route';
import { POST as weeklyBoostBilling } from '../../cron/weekly-boost-billing/route';
import { POST as weeklySubnetBilling } from '../../cron/weekly-subnet-billing/route';
import { POST as cleanupAds } from '../../cron/cleanup-ads/route';
import { POST as promoExpiryWarning } from '../../cron/promo-expiry-warning/route';
import { POST as cleanupPulses } from '../../cron/cleanup-pulses/route';
import { POST as launchReset } from '../../cron/launch-reset/route';
import { POST as backfillWeeklyScores } from '../../cron/backfill-weekly-scores/route';
import { POST as birthdayGift } from '../../cron/birthday-gift/route';

const ALLOWED_ENDPOINTS = ['weekly-payout', 'weekly-reset', 'weekly-boost-billing', 'weekly-subnet-billing', 'cleanup-ads', 'promo-expiry-warning', 'cleanup-pulses', 'launch-reset', 'backfill-weekly-scores', 'birthday-gift'] as const;
type AllowedEndpoint = typeof ALLOWED_ENDPOINTS[number];

// Maps each allowed endpoint straight to its route handler, called in-process below — NOT
// over the network. This used to fetch the route's own public HTTPS URL (built from the
// request's Host header), but a server self-fetching its own public domain is unreliable on
// App Hosting's networking (fails near-instantly with a generic HTML error page for every
// endpoint, not just this one) — calling the handler function directly sidesteps that
// entirely and is strictly more reliable regardless of platform networking quirks.
const HANDLERS: Record<AllowedEndpoint, (req: NextRequest) => Promise<Response>> = {
  'weekly-payout': weeklyPayout,
  'weekly-reset': weeklyReset,
  'weekly-boost-billing': weeklyBoostBilling,
  'weekly-subnet-billing': weeklySubnetBilling,
  'cleanup-ads': cleanupAds,
  'promo-expiry-warning': promoExpiryWarning,
  'cleanup-pulses': cleanupPulses,
  'launch-reset': launchReset,
  'backfill-weekly-scores': backfillWeeklyScores,
  'birthday-gift': birthdayGift,
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint, confirm } = body as { endpoint: string; email?: string; confirm?: string };

    if (!ALLOWED_ENDPOINTS.includes(endpoint as AllowedEndpoint)) {
      return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
    }

    const innerRequest = new NextRequest(`http://internal.local/api/cron/${endpoint}`, {
      method: 'POST',
      headers: { 'x-cron-secret': process.env.CRON_SECRET ?? '', 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm }),
    });

    const res = await HANDLERS[endpoint as AllowedEndpoint](innerRequest);
    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
