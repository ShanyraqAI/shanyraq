import type { ChannelProvider } from "./types";

/**
 * Provider registry — resolves the adapter for a channel code.
 *
 * MVP wires MockProviders. To go live with a real channel, implement
 * `RealBookingProvider implements ChannelProvider` and swap the entry here.
 * Nothing else in the application changes.
 */

// Imported lazily below to keep this module free of side effects.
import { MockBookingProvider } from "./providers/mock-booking";
import { MockOstrovokProvider } from "./providers/mock-ostrovok";
import { MockKrishaProvider } from "./providers/mock-krisha";
import { DirectProvider } from "./providers/direct";
import { mockChannelProvidersEnabled } from "./runtime-policy";
import { PublicError } from "@/server/errors";

const directProvider = new DirectProvider();
const mockRegistry: Record<string, ChannelProvider> = {
  booking: new MockBookingProvider(),
  ostrovok: new MockOstrovokProvider(),
  krisha: new MockKrishaProvider(),
};

export function getChannelProvider(code: string): ChannelProvider {
  if (code === "direct") return directProvider;
  if (!mockChannelProvidersEnabled()) {
    throw new PublicError("Внешний канал недоступен: промышленный адаптер ещё не подключён.");
  }
  const provider = mockRegistry[code];
  if (!provider) throw new Error(`Unknown channel: ${code}`);
  return provider;
}
