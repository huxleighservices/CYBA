import type { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';

export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read video'));
    };
    video.src = url;
  });
}

/**
 * Builds the Stripe checkout URL carrying the CYBAZONE username + Ad ID through to the webhook.
 *
 * NOTE: `prefilled_custom_field[N][value]` is NOT a real Stripe Payment Link parameter — Stripe
 * hosted Payment Links don't support prefilling custom fields via URL at all. That was silently
 * broken this whole time, meaning a buyer would land on checkout with a blank, required "Ad ID"
 * field they have no way to know (it's an internal Firestore doc ID) — so Promo Blast could never
 * actually auto-activate via the webhook. `client_reference_id` IS a real, documented Payment
 * Link parameter that reliably passes a value straight through to the resulting Checkout
 * Session (session.client_reference_id in the webhook), with no action needed from the buyer.
 */
export function buildStripeUrl(buttonLink: string, username: string, adId: string): string {
  const ref = `${username}|${adId}`;
  return `${buttonLink}?client_reference_id=${encodeURIComponent(ref)}`;
}

/**
 * Opens a blank tab synchronously (while still inside the triggering click's user-gesture
 * context) so the browser doesn't block it, then redirects that tab once the real URL is
 * known. Calling window.open() only after an upload/addDoc await resolves loses the gesture
 * context and gets silently blocked in most browsers.
 */
export function openDeferredWindow(): Window | null {
  return window.open('', '_blank');
}

export function redirectDeferredWindow(
  win: Window | null,
  url: string,
  toast: ReturnType<typeof useToast>['toast'],
) {
  if (win) {
    win.location.href = url;
  } else {
    toast({
      title: 'Pop-up blocked',
      description: 'Your browser blocked the payment tab.',
      action: (
        <ToastAction altText="Open payment link" onClick={() => window.open(url, '_blank')}>
          Open payment link
        </ToastAction>
      ),
    });
  }
}
