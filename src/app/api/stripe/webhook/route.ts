import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '../../firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { AD_TIER_INCLUDED_UPSELLS, OVERLAP_CASHBACK_PCT, type AdTierKey } from '@/lib/ad-drop';
import { createNotificationAdmin } from '@/lib/notifications-admin';
import { classifyCcBundle, DEFAULT_CC_BUNDLES } from '@/lib/cybacoin-bundles';

// Maps product name keywords → internal boost type key (order matters: longest match first)
function classifyBoost(productName: string): string | null {
  const n = productName.toLowerCase();
  if (n.includes('zone pass ultimate') || n.includes('zonepass ultimate')) return 'zone_pass_ultimate';
  if (n.includes('zone pass pro') || n.includes('zonepass pro')) return 'zone_pass_pro';
  if (n.includes('zone pass') || n.includes('zonepass')) return 'zone_pass';
  if (n.includes('payout')) return 'payout_boost';
  if (n.includes('market')) return 'market_boost';
  if (n.includes('radio')) return 'radio_boost';
  if (n.includes('spotlight')) return 'spotlight_boost';
  return null;
}

const AD_TIER_DAYS_FALLBACK: Record<AdTierKey, number> = { day7: 7, day14: 14, day30: 30 };

// Classifies a PROMO BLAST product name into one of the 5 products: a duration tier, or an
// upsell. Matches both "promo blast" (current name) and the legacy "ad drop" keyword so any
// Stripe products already configured under the old name keep working after the rename.
function isPromoBlastProduct(n: string): boolean {
  return n.includes('promo blast') || n.includes('ad drop');
}

function classifyAdDropTier(productName: string): AdTierKey | null {
  const n = productName.toLowerCase();
  if (!isPromoBlastProduct(n)) return null;
  if (n.includes('30')) return 'day30';
  if (n.includes('14')) return 'day14';
  if (n.includes('7')) return 'day7';
  return null;
}

function isUnskippableUpsell(productName: string): boolean {
  const n = productName.toLowerCase();
  return isPromoBlastProduct(n) && n.includes('unskippable');
}

function isMediaQuestUpsell(productName: string): boolean {
  const n = productName.toLowerCase();
  return isPromoBlastProduct(n) && (n.includes('cybaquest') || n.includes('media quest'));
}

async function activateAdTier(adId: string, expectedUserId: string, tier: AdTierKey, amountTotalCents: number | null): Promise<void> {
  const adRef = adminDb.collection('ads').doc(adId);
  const adSnap = await adRef.get();
  if (!adSnap.exists) {
    console.warn(`[stripe webhook] Ad ${adId} not found`);
    return;
  }
  const adData = adSnap.data();
  if (adData?.userId !== expectedUserId) {
    console.warn(`[stripe webhook] Ad ${adId} userId mismatch — refusing to activate`);
    return;
  }
  if (adData?.status !== 'pending_payment') {
    console.warn(`[stripe webhook] Ad ${adId} already processed (status=${adData?.status})`);
    return;
  }

  const configSnap = await adminDb.collection('settings').doc('adDropConfig').get();
  const configData = configSnap.data();
  const days = configData?.tiers?.[tier]?.days ?? AD_TIER_DAYS_FALLBACK[tier];
  const now = new Date();

  // Add-ons bundled free with this tier (e.g. Premium includes all 3) activate alongside the
  // base tier itself — no separate Stripe line item needed for those.
  const included = AD_TIER_INCLUDED_UPSELLS[tier] ?? [];
  await adRef.update({
    status: 'active',
    tier,
    durationDays: days,
    activatedAt: FieldValue.serverTimestamp(),
    expiresAt: new Date(now.getTime() + days * 24 * 60 * 60 * 1000),
    ...(included.includes('unskippable') ? { unskippable: true } : {}),
    ...(included.includes('mediaQuest') ? { wantsMediaQuest: true } : {}),
  });
  console.log(`✅ Ad ${adId} activated (${tier})`);

  // Overlap cash-back: this user bought a new promo slot while another one they own is still
  // active (i.e. hasn't expired) — credit 25% of the new purchase's BASE tier price (upsells
  // excluded, since amountTotalCents here is the tier checkout only, not an upsell purchase) as
  // real wallet cash (payoutBalance). Every purchase creates its own new `ads` doc (there's no
  // single renewable slot), so "overlap" concretely means "bought again before the previous one
  // ran out."
  if (amountTotalCents != null) {
    try {
      const otherActiveSnap = await adminDb
        .collection('ads')
        .where('userId', '==', expectedUserId)
        .where('status', '==', 'active')
        .get();
      const hasOtherActive = otherActiveSnap.docs.some(d => {
        if (d.id === adId) return false;
        const expiresAt = d.data().expiresAt;
        const ms = typeof expiresAt === 'number' ? expiresAt : expiresAt?.toMillis?.() ?? 0;
        return ms > now.getTime();
      });
      if (hasOtherActive) {
        const bonusCash = Math.round((amountTotalCents / 100) * OVERLAP_CASHBACK_PCT * 100) / 100;
        if (bonusCash > 0) {
          const userRef = adminDb.collection('users').doc(expectedUserId);
          await userRef.update({ payoutBalance: FieldValue.increment(bonusCash) });
          await userRef.collection('cashTransactions').add({
            type: 'promo_blast_purchase',
            amount: bonusCash,
            description: 'Overlap cash-back — bought a new promo slot before your last one expired',
            timestamp: FieldValue.serverTimestamp(),
          });
          await createNotificationAdmin(expectedUserId, {
            type: 'promo_renewal_bonus',
            actorId: 'system',
            actorUsername: 'CYBAZONE',
            message: `You earned $${bonusCash.toFixed(2)} cash back for renewing your promo slot early!`,
            linkTo: '/wallet',
          });
          console.log(`🎁 Overlap cash-back: $${bonusCash} to ${expectedUserId}`);
        }
      }
    } catch (err) {
      console.error('Overlap cash-back check failed:', err);
    }
  }
}

// Upsells can complete before or after the base tier checkout's webhook lands, and the ad may
// already be 'active' by then — so this only verifies ownership, not pending_payment status.
async function applyAdUpsell(adId: string, expectedUserId: string, kind: 'unskippable' | 'mediaQuest'): Promise<void> {
  const adRef = adminDb.collection('ads').doc(adId);
  const adSnap = await adRef.get();
  if (!adSnap.exists) {
    console.warn(`[stripe webhook] Ad ${adId} not found for upsell ${kind}`);
    return;
  }
  const adData = adSnap.data();
  if (adData?.userId !== expectedUserId) {
    console.warn(`[stripe webhook] Ad ${adId} userId mismatch — refusing to apply upsell ${kind}`);
    return;
  }
  const field = kind === 'unskippable' ? 'unskippable' : 'wantsMediaQuest';
  await adRef.update({ [field]: true });
  console.log(`✅ Ad ${adId} upsell applied: ${kind}`);
}

async function applyBoostToUser(userRef: any, boostType: string): Promise<void> {
  const now = new Date().toISOString();
  switch (boostType) {
    case 'payout_boost':
      await userRef.update({ payoutEnrolled: true, payoutEnrolledAt: now, payoutBalance: 0 });
      break;
    case 'market_boost':
      await userRef.update({ marketBoost: true, marketBoostAt: now });
      break;
    case 'radio_boost':
      await userRef.update({ radioBoost: true, radioBoostAt: now });
      break;
    case 'spotlight_boost':
      // Adds one sponsored-post inventory slot (same mechanic as the CC-purchased slots)
      await userRef.update({ 'inventory.sponsored_post.quantity': FieldValue.increment(1) });
      break;
    case 'zone_pass':
      await userRef.update({ membershipTier: 'zone_pass', membershipAt: now });
      break;
    case 'zone_pass_pro':
      await userRef.update({ membershipTier: 'zone_pass_pro', membershipAt: now });
      break;
    case 'zone_pass_ultimate':
      await userRef.update({ membershipTier: 'zone_pass_ultimate', membershipAt: now });
      break;
  }
}

export async function POST(request: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
    apiVersion: '2026-03-25.dahlia',
  });

  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET ?? '');
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    // Primary source: client_reference_id, set via buildStripeUrl()/the boost & CC-bundle
    // checkout links (a real, reliable Payment Link parameter — unlike prefilled_custom_field,
    // which Stripe doesn't actually support and was silently doing nothing). For PROMO BLAST
    // it's "username|adId"; for everything else it's just the username.
    // Falls back to the Stripe Dashboard's "CYBAZONE Username"/"Ad ID" custom fields for any
    // older link still in circulation, or if a buyer fills them in manually.
    const customFields = (session as any).custom_fields ?? [];
    let rawUsername: string | undefined;
    let rawAdIdFromRef: string | undefined;

    if (session.client_reference_id) {
      const [u, a] = session.client_reference_id.split('|');
      rawUsername = u || undefined;
      rawAdIdFromRef = a || undefined;
    }

    if (!rawUsername) {
      const usernameField = customFields.find(
        (f: any) =>
          f.label?.custom?.toLowerCase().includes('cybazone') ||
          f.key?.toLowerCase().includes('cybazone') ||
          f.key?.toLowerCase().includes('username')
      );
      rawUsername = usernameField?.text?.value ?? usernameField?.dropdown?.value ?? undefined;
    }

    if (!rawUsername) {
      console.warn('No CYBAZONE username found (client_reference_id or custom fields)', session.client_reference_id, customFields);
      return NextResponse.json({ received: true });
    }

    const username = rawUsername.trim().toLowerCase().replace(/^@/, '');

    // Fetch the purchased product name to classify what was bought
    let productName = '';
    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
        expand: ['data.price.product'],
      });
      productName = (lineItems.data[0]?.price?.product as any)?.name ?? '';
    } catch (err) {
      console.warn('Could not fetch line items:', err);
    }

    try {
      const snap = await adminDb
        .collection('users')
        .where('username_lowercase', '==', username)
        .limit(1)
        .get();

      if (snap.empty) {
        console.warn(`No user found for username: ${username}`);
        return NextResponse.json({ received: true });
      }

      const userDoc = snap.docs[0];

      if (isPromoBlastProduct(productName.toLowerCase())) {
        // PROMO BLAST purchase (a duration tier or an upsell) — the Ad ID comes from
        // client_reference_id (see above), falling back to the "Ad ID" custom field for older links.
        let adId: string | undefined = rawAdIdFromRef;
        if (!adId) {
          const adIdField = customFields.find(
            (f: any) => f.key?.toLowerCase().includes('adid') || f.label?.custom?.toLowerCase().includes('ad id')
          );
          adId = adIdField?.text?.value;
        }
        if (!adId) {
          console.warn('No Ad ID found (client_reference_id or custom fields) for PROMO BLAST purchase', session.client_reference_id, customFields);
          return NextResponse.json({ received: true });
        }

        const tier = classifyAdDropTier(productName);
        if (tier) {
          await activateAdTier(adId.trim(), userDoc.id, tier, session.amount_total ?? null);
        } else if (isUnskippableUpsell(productName)) {
          await applyAdUpsell(adId.trim(), userDoc.id, 'unskippable');
        } else if (isMediaQuestUpsell(productName)) {
          await applyAdUpsell(adId.trim(), userDoc.id, 'mediaQuest');
        } else {
          console.warn(`Unrecognized AD DROP product name: "${productName}"`);
        }
      } else if (classifyCcBundle(productName)) {
        // CYBACOIN fiat bundle — credit the bundle's CC amount directly.
        const bundleKey = classifyCcBundle(productName)!;
        const amount = DEFAULT_CC_BUNDLES[bundleKey].amount;
        await userDoc.ref.update({ cybaCoinBalance: FieldValue.increment(amount) });
        await userDoc.ref.collection('coinTransactions').add({
          type: 'boost_purchase',
          amount,
          description: `CYBACOIN Bundle: ${DEFAULT_CC_BUNDLES[bundleKey].name}`,
          timestamp: FieldValue.serverTimestamp(),
        });
        console.log(`✅ CC bundle applied [${bundleKey}]: ${rawUsername} (uid: ${userDoc.id}) +${amount}`);
      } else {
        // Determine which boost was purchased from the Stripe product name
        const detected = classifyBoost(productName);
        const boostType = detected ?? 'payout_boost'; // safe default for legacy sessions
        if (!detected) {
          console.warn(`Could not classify boost from product name: "${productName}", defaulting to payout_boost`);
        }
        await applyBoostToUser(userDoc.ref, boostType);
        console.log(`✅ Boost applied [${boostType}]: ${rawUsername} (uid: ${userDoc.id})`);
      }
    } catch (err) {
      console.error('Firestore update failed:', err);
      return NextResponse.json({ error: 'DB update failed' }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
