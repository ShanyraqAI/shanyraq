/**
 * Closed-beta feature switches.
 *
 * Keep unfinished product areas in the codebase while removing their entry
 * points and server-side actions from the customer experience. Re-enable a
 * feature only after its release gate has been completed.
 */
export const PRODUCT_AVAILABILITY = {
  channels: false,
  billing: false,
} as const;

export type ProductFeature = keyof typeof PRODUCT_AVAILABILITY;

export function isProductFeatureAvailable(feature: ProductFeature): boolean {
  return PRODUCT_AVAILABILITY[feature];
}

