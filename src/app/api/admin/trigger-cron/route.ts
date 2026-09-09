import { NextRequest, NextResponse } from 'next/server';

const ADMIN_EMAILS = ['contactcyba@gmail.com', 'z1mmerman@yahoo.com'];
const ALLOWED_ENDPOINTS = ['weekly-payout', 'weekly-reset', 'weekly-boost-billing', 'weekly-subnet-billing', 'cleanup-ads', 'promo-expiry-warning', 'cleanup-pulses', 'launch-reset'] as const;
type AllowedEndpoint = typeof ALLOWED_ENDPOINTS[number];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint, email, confirm } = body as { endpoint: string; email?: string; confirm?: string };

    if (!ALLOWED_ENDPOINTS.includes(endpoint as AllowedEndpoint)) {
      return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
    }

    // Build the absolute URL to the cron route
    const host = request.headers.get('host') ?? 'localhost:3000';
    const protocol = host.startsWith('localhost') ? 'http' : 'https';
    const cronUrl = `${protocol}://${host}/api/cron/${endpoint}`;

    const res = await fetch(cronUrl, {
      method: 'POST',
      headers: { 'x-cron-secret': process.env.CRON_SECRET ?? '', 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm }),
    });

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
