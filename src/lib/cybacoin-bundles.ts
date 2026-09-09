export type CcBundleKey = 'small' | 'medium' | 'large';

export interface CcBundleConfig {
  name: string;
  amount: number; // CYBACOIN granted
  priceLabel: string;
  buttonLink: string;
}

export type CcBundlesConfig = Record<CcBundleKey, CcBundleConfig>;

export const CC_BUNDLE_ORDER: CcBundleKey[] = ['small', 'medium', 'large'];

export const DEFAULT_CC_BUNDLES: CcBundlesConfig = {
  small:  { name: 'Small Bag',  amount: 10000, priceLabel: '$4.99',  buttonLink: '' },
  medium: { name: 'Medium Bag', amount: 25000, priceLabel: '$9.99',  buttonLink: '' },
  large:  { name: 'Large Bag',  amount: 50000, priceLabel: '$17.99', buttonLink: '' },
};

/** Classifies a Stripe product name into a CYBACOIN bundle key. Product names must contain
 *  "cybacoin bundle" plus the tier keyword ("small", "medium", or "large"). */
export function classifyCcBundle(productName: string): CcBundleKey | null {
  const n = productName.toLowerCase();
  if (!n.includes('cybacoin bundle') && !n.includes('cc bundle')) return null;
  if (n.includes('small')) return 'small';
  if (n.includes('medium')) return 'medium';
  if (n.includes('large')) return 'large';
  return null;
}
