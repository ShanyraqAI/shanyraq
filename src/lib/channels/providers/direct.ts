import type { ChannelCode } from "@/lib/constants";
import type {
  AvailabilityUpdate,
  ChannelConnectionContext,
  ChannelCredentials,
  ChannelProvider,
  ConnectionTestResult,
  ExternalInventory,
  PullReservationsResult,
  RateUpdate,
} from "../types";

/**
 * DirectProvider — Shanyraq's own sales channel (website/phone/walk-in).
 *
 * Direct reservations are created in-house via Reservations UI, so there is no
 * external feed to pull and nothing to push. The provider exists so the rest
 * of the system can treat every source uniformly.
 */
export class DirectProvider implements ChannelProvider {
  readonly code: ChannelCode = "direct";

  async verifyCredentials(_credentials: ChannelCredentials): Promise<ConnectionTestResult> {
    return { ok: true, message: "Direct channel is built into Shanyraq" };
  }

  async fetchExternalInventory(_context: ChannelConnectionContext): Promise<ExternalInventory> {
    return { roomTypes: [], ratePlans: [] };
  }

  async pullReservations(_context: ChannelConnectionContext): Promise<PullReservationsResult> {
    return { reservations: [], hasMore: false };
  }

  async pushAvailability(
    _context: ChannelConnectionContext,
    _updates: AvailabilityUpdate[],
  ): Promise<{ accepted: number }> {
    return { accepted: 0 };
  }

  async pushRates(_context: ChannelConnectionContext, _updates: RateUpdate[]): Promise<{ accepted: number }> {
    return { accepted: 0 };
  }

  async cancelExternalReservation(_context: ChannelConnectionContext, _externalReservationId: string): Promise<void> {
    // Direct cancellations are handled internally.
  }
}
