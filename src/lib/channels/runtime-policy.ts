import { PRODUCT_AVAILABILITY } from "@/lib/product-availability";

/**
 * Channel synchronization is fail-closed. Hiding the channel UI is not enough:
 * every producer and consumer of background work must also honor this gate.
 */
export function channelSyncEnabled(): boolean {
  return PRODUCT_AVAILABILITY.channels;
}

/** Mock providers are only available for explicitly opted-in local development. */
export function mockChannelProvidersEnabled(
  environment = process.env.NODE_ENV,
  optIn = process.env.ALLOW_MOCK_CHANNEL_PROVIDERS,
): boolean {
  return environment !== "production" && optIn === "true";
}
