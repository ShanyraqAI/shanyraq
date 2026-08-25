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
 * Shared plumbing for mock providers.
 *
 * Simulates realistic behaviour (latency, credential validation, incremental
 * feeds) without touching the network. Each concrete provider supplies its
 * identity, inventory catalogue and reservation templates.
 *
 * Replacing a mock with a real implementation means replacing these helpers
 * with HTTP calls — the ChannelProvider contract stays identical.
 */

// ---------------------------------------------------------------------------
// Deterministic pseudo-randomness so demos are reproducible
// ---------------------------------------------------------------------------

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Simulation helpers
// ---------------------------------------------------------------------------

const SIMULATED_LATENCY_MS = 350;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function validateMockCredentials(credentials: ChannelCredentials, expectedPrefix: string): ConnectionTestResult {
  if (!credentials.propertyId.trim()) return { ok: false, error: "Property ID is required" };
  if (!credentials.username.trim()) return { ok: false, error: "Username is required" };
  if (credentials.apiKey.trim().length < 4) return { ok: false, error: `${expectedPrefix} API key looks invalid (too short)` };
  return { ok: true, message: `Authenticated with ${expectedPrefix} as ${credentials.username}` };
}

export interface MockReservationTemplate {
  externalRoomTypeId: string;
  guestName: string;
  guestEmail: string;
  guestCountry: string;
  offsetFromToday: number; // arrival N days from today
  nights: number;
  adults: number;
  children: number;
  baseAmount: number;
  cancelled?: boolean;
}

export interface MockProviderConfig {
  code: import("@/lib/constants").ChannelCode;
  label: string;
  inventory: ExternalInventory;
  reservationTemplates: MockReservationTemplate[];
  /** Batch size per sync — keeps each sync visibly productive but bounded. */
  batchLimit: number;
}

export abstract class BaseMockProvider implements ChannelProvider {
  abstract readonly code: import("@/lib/constants").ChannelCode;
  protected abstract config: MockProviderConfig;

  async verifyCredentials(credentials: ChannelCredentials): Promise<ConnectionTestResult> {
    await sleep(SIMULATED_LATENCY_MS);
    return validateMockCredentials(credentials, this.config.label);
  }

  async fetchExternalInventory(_context: ChannelConnectionContext): Promise<ExternalInventory> {
    await sleep(200);
    return structuredClone(this.config.inventory);
  }

  async pullReservations(context: ChannelConnectionContext): Promise<PullReservationsResult> {
    await sleep(SIMULATED_LATENCY_MS);
    const start = context.importCursor;
    const end = Math.min(start + this.config.batchLimit, this.config.reservationTemplates.length);
    const slice = this.config.reservationTemplates.slice(start, end);

    // Stable external ids derived from connection + template index.
    const today = utcToday();
    const reservations = slice.map((t, i) => ({
      externalId: `${this.config.code}-${context.connectionId.slice(-6)}-${String(start + i + 1).padStart(3, "0")}`,
      externalRoomTypeId: t.externalRoomTypeId,
      guestName: t.guestName,
      guestEmail: t.guestEmail,
      guestCountry: t.guestCountry,
      checkIn: toISO(addDaysUtc(today, t.offsetFromToday)),
      checkOut: toISO(addDaysUtc(today, t.offsetFromToday + t.nights)),
      adults: t.adults,
      children: t.children,
      currency: "KZT",
      totalAmount: t.baseAmount * t.nights,
      status: (t.cancelled ? "CANCELLED" : "CONFIRMED") as "CANCELLED" | "CONFIRMED",
      notes: `Imported from ${this.config.label} (mock feed)`,
    }));

    return {
      reservations,
      hasMore: end < this.config.reservationTemplates.length,
    };
  }

  async pushAvailability(
    _context: ChannelConnectionContext,
    updates: AvailabilityUpdate[],
  ): Promise<{ accepted: number }> {
    await sleep(Math.min(600, 120 + updates.length));
    return { accepted: updates.length };
  }

  async pushRates(_context: ChannelConnectionContext, updates: RateUpdate[]): Promise<{ accepted: number }> {
    await sleep(Math.min(600, 120 + updates.length));
    return { accepted: updates.length };
  }

  async cancelExternalReservation(context: ChannelConnectionContext, externalReservationId: string): Promise<void> {
    await sleep(SIMULATED_LATENCY_MS);
    void context;
    void externalReservationId;
  }
}

// ---------------------------------------------------------------------------
// Date helpers (local to mocks to avoid circular imports)
// ---------------------------------------------------------------------------

function utcToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function addDaysUtc(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

function toISO(date: Date): string {
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${date.getUTCFullYear()}-${p(date.getUTCMonth() + 1)}-${p(date.getUTCDate())}`;
}
