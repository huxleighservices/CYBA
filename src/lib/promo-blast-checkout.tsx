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

/** Builds the Stripe checkout URL with the standard prefilled username + Ad ID fields shared by all 5 PROMO BLAST products. */
export function buildStripeUrl(buttonLink: string, username: string, adId: string): string {
  return `${buttonLink}`
    + `?prefilled_custom_field[0][value]=${encodeURIComponent(username)}`
    + `&prefilled_custom_field[1][value]=${encodeURIComponent(adId)}`;
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
