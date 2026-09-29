import "server-only";

export type ChannexEnvironment = "staging" | "production";

export type ChannexErrorKind =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "RATE_LIMITED"
  | "UNAVAILABLE"
  | "TIMEOUT"
  | "NETWORK"
  | "INVALID_RESPONSE"
  | "CONFIGURATION";

export interface ChannexPropertySummary {
  id: string;
  title: string;
  currency: string | null;
  timezone: string | null;
  propertyType: string | null;
  isActive: boolean | null;
}

export interface ChannexPropertyList {
  properties: ChannexPropertySummary[];
  total: number;
}

export interface ChannexRoomTypeSummary {
  id: string;
  title: string;
  propertyId: string | null;
}

export interface ChannexRatePlanSummary {
  id: string;
  title: string;
  propertyId: string | null;
  roomTypeId: string | null;
}

export interface ChannexPropertyInput {
  title: string;
  currency: string;
  timezone: string;
  property_type: string;
  address?: string;
  city?: string;
  country?: string;
  settings: {
    allow_availability_autoupdate_on_modification: false;
    allow_availability_autoupdate_on_cancellation: false;
    min_stay_type: "both";
    state_length: number;
  };
}

export interface ChannexRoomTypeInput {
  property_id: string;
  title: string;
  count_of_rooms: number;
  occ_adults: number;
  occ_children: 0;
  occ_infants: 0;
  default_occupancy: number;
  facilities: never[];
  room_kind: "room";
  content?: { description: string };
}

export interface ChannexRatePlanInput {
  property_id: string;
  room_type_id: string;
  title: string;
  currency: string;
  sell_mode: "per_room";
  rate_mode: "manual";
  meal_type: "breakfast" | "room_only";
  options: Array<{ occupancy: number; is_primary: true; rate: string }>;
}

export interface ChannexAvailabilityValue {
  property_id: string;
  room_type_id: string;
  date?: string;
  date_from?: string;
  date_to?: string;
  availability: number;
}

export interface ChannexRestrictionValue {
  property_id: string;
  rate_plan_id: string;
  date?: string;
  date_from?: string;
  date_to?: string;
  rate: number;
  min_stay_arrival: number;
  min_stay_through: number;
  max_stay: number;
  stop_sell: boolean;
  closed_to_arrival: boolean;
  closed_to_departure: boolean;
}

export interface ChannexBookingRoom {
  roomTypeId: string | null;
  ratePlanId: string | null;
  otaUniqueId: string | null;
  checkIn: string;
  checkOut: string;
  amount: number;
  adults: number;
  children: number;
}

export interface ChannexBookingRevisionPayload {
  id: string;
  propertyId: string;
  bookingId: string;
  uniqueId: string;
  systemId: string | null;
  otaReservationCode: string | null;
  otaName: string;
  status: "new" | "modified" | "cancelled";
  rooms: ChannexBookingRoom[];
  customer: { name: string; surname: string; email: string | null; phone: string | null; country: string | null };
  arrivalHour: string | null;
  currency: string;
  notes: string | null;
  insertedAt: string | null;
  amount: number | null;
  otaCommission: number | null;
  paymentCollect: "property" | "ota" | null;
  paymentType: string | null;
  services: Array<{ name: string; type: string; totalPrice: number; excluded: boolean | null; roomIndex: number | null }>;
}

export interface ChannexWebhookSummary {
  id: string;
  propertyId: string | null;
  callbackUrl: string;
  eventMask: string;
  isActive: boolean;
}

export interface ChannexOneTimeTokenInput {
  property_id: string;
  username: string;
  group_id?: string;
}

export class ChannexApiError extends Error {
  readonly name = "ChannexApiError";

  constructor(
    message: string,
    readonly kind: ChannexErrorKind,
    readonly options: {
      status?: number;
      providerCode?: string;
      retryable?: boolean;
      retryAfterMs?: number;
    } = {},
  ) {
    super(message);
  }

  get status() {
    return this.options.status;
  }

  get providerCode() {
    return this.options.providerCode;
  }

  get retryable() {
    return this.options.retryable ?? false;
  }

  get retryAfterMs() {
    return this.options.retryAfterMs;
  }
}

export interface ChannexClient {
  listProperties(): Promise<ChannexPropertyList>;
  createProperty(input: ChannexPropertyInput): Promise<{ id: string }>;
  listRoomTypes(propertyId: string): Promise<ChannexRoomTypeSummary[]>;
  createRoomType(input: ChannexRoomTypeInput): Promise<{ id: string }>;
  listRatePlans(propertyId: string): Promise<ChannexRatePlanSummary[]>;
  createRatePlan(input: ChannexRatePlanInput): Promise<{ id: string }>;
  pushAvailability(values: ChannexAvailabilityValue[]): Promise<{ taskIds: string[] }>;
  pushRestrictions(values: ChannexRestrictionValue[]): Promise<{ taskIds: string[] }>;
  listBookingRevisionFeed(propertyId: string): Promise<ChannexBookingRevisionPayload[]>;
  getBookingRevision(revisionId: string): Promise<ChannexBookingRevisionPayload>;
  acknowledgeBookingRevision(revisionId: string): Promise<void>;
  listWebhooks(propertyId: string): Promise<ChannexWebhookSummary[]>;
  createWebhook(input: {
    property_id: string;
    callback_url: string;
    event_mask: "booking";
    headers: Record<string, string>;
    is_active: true;
    send_data: true;
  }): Promise<{ id: string }>;
  createOneTimeToken(input: ChannexOneTimeTokenInput): Promise<{ token: string }>;
}

export interface CreateChannexClientOptions {
  environment: ChannexEnvironment;
  timeoutMs?: number;
  maxRetries?: number;
  fetchImpl?: typeof fetch;
}

const DEFAULT_BASE_URLS: Record<ChannexEnvironment, string> = {
  staging: "https://staging.channex.io/api/v1",
  production: "https://app.channex.io/api/v1",
};

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 2;
const MAX_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 3;
const MAX_PAGES = 100;
const PAGE_SIZE = 100;

function integerOption(value: number | undefined, fallback: number, minimum: number, maximum: number, name: string) {
  const resolved = value ?? fallback;
  if (!Number.isInteger(resolved) || resolved < minimum || resolved > maximum) {
    throw configurationError(`${name} должен быть целым числом от ${minimum} до ${maximum}.`);
  }
  return resolved;
}

function environmentInteger(name: string): number | undefined {
  const raw = process.env[name]?.trim();
  if (!raw) return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value)) throw configurationError(`${name} должен содержать целое число.`);
  return value;
}

function configurationError(message: string) {
  return new ChannexApiError(message, "CONFIGURATION");
}

function apiKey(environment: ChannexEnvironment) {
  const name = environment === "staging" ? "CHANNEX_STAGING_API_KEY" : "CHANNEX_PRODUCTION_API_KEY";
  const value = process.env[name]?.trim();
  if (!value) throw configurationError(`Не настроен серверный ключ Channex для окружения ${environment}.`);
  return value;
}

function baseUrl(environment: ChannexEnvironment) {
  const name = environment === "staging" ? "CHANNEX_STAGING_BASE_URL" : "CHANNEX_PRODUCTION_BASE_URL";
  const raw = process.env[name]?.trim() || DEFAULT_BASE_URLS[environment];

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw configurationError(`${name} содержит некорректный URL.`);
  }

  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw configurationError(`${name} должен быть HTTPS URL без credentials, query или fragment.`);
  }

  return parsed.toString().replace(/\/$/, "");
}

function safeProviderCode(value: unknown) {
  return typeof value === "string" && /^[a-z0-9_.-]{1,80}$/i.test(value) ? value : undefined;
}

function errorCode(payload: unknown) {
  if (!payload || typeof payload !== "object") return undefined;
  const errors = (payload as { errors?: unknown }).errors;
  if (!errors || typeof errors !== "object" || Array.isArray(errors)) return undefined;
  return safeProviderCode((errors as { code?: unknown }).code);
}

function retryAfterMs(response: Response) {
  const raw = response.headers.get("retry-after")?.trim();
  if (!raw) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 60_000);
  const timestamp = Date.parse(raw);
  if (Number.isNaN(timestamp)) return undefined;
  return Math.min(Math.max(timestamp - Date.now(), 0), 60_000);
}

function retryDelay(attempt: number, response?: Response) {
  const requested = response ? retryAfterMs(response) : undefined;
  if (requested !== undefined) return Math.min(requested, 5_000);
  return Math.min(250 * 2 ** attempt, 2_000);
}

function sleep(delayMs: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}

function isRetryableStatus(status: number) {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

async function jsonPayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function responseError(response: Response, payload: unknown) {
  const providerCode = errorCode(payload);
  const common = { status: response.status, providerCode };

  switch (response.status) {
    case 401:
      return new ChannexApiError("Channex отклонил API-ключ.", "UNAUTHORIZED", common);
    case 403:
      return new ChannexApiError("API-ключ не имеет доступа к запрошенному ресурсу Channex.", "FORBIDDEN", common);
    case 404:
      return new ChannexApiError("Запрошенный ресурс Channex не найден.", "NOT_FOUND", common);
    case 422:
      return new ChannexApiError("Channex отклонил параметры запроса.", "VALIDATION", common);
    case 429:
      return new ChannexApiError("Превышен лимит запросов Channex.", "RATE_LIMITED", {
        ...common,
        retryable: true,
        retryAfterMs: retryAfterMs(response),
      });
    default:
      if (response.status >= 500) {
        return new ChannexApiError("Channex временно недоступен.", "UNAVAILABLE", {
          ...common,
          retryable: true,
        });
      }
      return new ChannexApiError("Channex вернул ошибку запроса.", "INVALID_RESPONSE", common);
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

function parseProperty(value: unknown): ChannexPropertySummary {
  if (!value || typeof value !== "object") throw invalidResponse();
  const item = value as { id?: unknown; attributes?: unknown };
  if (typeof item.id !== "string" || !item.attributes || typeof item.attributes !== "object") {
    throw invalidResponse();
  }
  const attributes = item.attributes as Record<string, unknown>;
  if (typeof attributes.title !== "string") throw invalidResponse();

  return {
    id: item.id,
    title: attributes.title,
    currency: stringValue(attributes.currency),
    timezone: stringValue(attributes.timezone),
    propertyType: stringValue(attributes.property_type),
    isActive: typeof attributes.is_active === "boolean" ? attributes.is_active : null,
  };
}

function parsePropertyPage(payload: unknown) {
  if (!payload || typeof payload !== "object") throw invalidResponse();
  const response = payload as { data?: unknown; meta?: unknown };
  if (!Array.isArray(response.data)) throw invalidResponse();

  const meta = response.meta && typeof response.meta === "object" ? response.meta as Record<string, unknown> : {};
  const page = typeof meta.page === "number" && Number.isInteger(meta.page) && meta.page > 0 ? meta.page : 1;
  const total = typeof meta.total === "number" && Number.isInteger(meta.total) && meta.total >= 0
    ? meta.total
    : response.data.length;

  return { properties: response.data.map(parseProperty), page, total };
}

function relationshipId(value: unknown, name: string) {
  if (!value || typeof value !== "object") return null;
  const attributes = (value as { attributes?: unknown }).attributes;
  if (attributes && typeof attributes === "object") {
    const direct = (attributes as Record<string, unknown>)[`${name}_id`];
    if (typeof direct === "string") return direct;
  }
  const relationships = (value as { relationships?: unknown }).relationships;
  if (!relationships || typeof relationships !== "object") return null;
  const relationship = (relationships as Record<string, unknown>)[name];
  if (!relationship || typeof relationship !== "object") return null;
  const data = (relationship as { data?: unknown }).data;
  return data && typeof data === "object" && typeof (data as { id?: unknown }).id === "string"
    ? (data as { id: string }).id
    : null;
}

function parseTitledResource(value: unknown) {
  if (!value || typeof value !== "object") throw invalidResponse();
  const item = value as { id?: unknown; attributes?: unknown };
  const attributes = item.attributes && typeof item.attributes === "object"
    ? item.attributes as Record<string, unknown>
    : null;
  if (typeof item.id !== "string" || !attributes || typeof attributes.title !== "string") throw invalidResponse();
  return { item, id: item.id, title: attributes.title };
}

function parseCollection(payload: unknown) {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { data?: unknown }).data)) {
    throw invalidResponse();
  }
  return (payload as { data: unknown[] }).data;
}

function collectionTotal(payload: unknown, fallback: number) {
  if (!payload || typeof payload !== "object") return fallback;
  const meta = (payload as { meta?: unknown }).meta;
  if (!meta || typeof meta !== "object") return fallback;
  const total = (meta as { total?: unknown }).total;
  return typeof total === "number" && Number.isInteger(total) && total >= 0 ? total : fallback;
}

function parseCreatedId(payload: unknown) {
  if (!payload || typeof payload !== "object") throw invalidResponse();
  const data = (payload as { data?: unknown }).data;
  if (!data || typeof data !== "object" || typeof (data as { id?: unknown }).id !== "string") throw invalidResponse();
  return { id: (data as { id: string }).id };
}

function requiredString(value: unknown) {
  if (typeof value !== "string" || !value.trim()) throw invalidResponse();
  return value;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function nonNegativeNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number < 0) throw invalidResponse();
  return number;
}

function parseBookingRevision(value: unknown): ChannexBookingRevisionPayload {
  if (!value || typeof value !== "object") throw invalidResponse();
  const resource = value as { id?: unknown; attributes?: unknown };
  const attributes = resource.attributes && typeof resource.attributes === "object"
    ? resource.attributes as Record<string, unknown>
    : null;
  if (!attributes) throw invalidResponse();
  const status = attributes.status;
  if (status !== "new" && status !== "modified" && status !== "cancelled") throw invalidResponse();
  if (!Array.isArray(attributes.rooms)) throw invalidResponse();
  const customer = attributes.customer && typeof attributes.customer === "object"
    ? attributes.customer as Record<string, unknown>
    : {};

  return {
    id: requiredString(resource.id ?? attributes.id),
    propertyId: requiredString(attributes.property_id),
    bookingId: requiredString(attributes.booking_id),
    uniqueId: requiredString(attributes.unique_id),
    systemId: optionalString(attributes.system_id),
    otaReservationCode: optionalString(attributes.ota_reservation_code),
    otaName: requiredString(attributes.ota_name),
    status,
    rooms: attributes.rooms.map((room) => {
      if (!room || typeof room !== "object") throw invalidResponse();
      const item = room as Record<string, unknown>;
      const occupancy = item.occupancy && typeof item.occupancy === "object"
        ? item.occupancy as Record<string, unknown>
        : {};
      return {
        roomTypeId: optionalString(item.room_type_id),
        ratePlanId: optionalString(item.rate_plan_id),
        otaUniqueId: optionalString(item.ota_unique_id),
        checkIn: requiredString(item.checkin_date),
        checkOut: requiredString(item.checkout_date),
        amount: nonNegativeNumber(item.amount),
        adults: Math.max(1, Math.trunc(nonNegativeNumber(occupancy.adults ?? 1))),
        children: Math.trunc(nonNegativeNumber(occupancy.children ?? 0)),
      };
    }),
    customer: {
      name: optionalString(customer.name) ?? "Гость",
      surname: optionalString(customer.surname) ?? "",
      email: optionalString(customer.mail),
      phone: optionalString(customer.phone),
      country: optionalString(customer.country),
    },
    arrivalHour: optionalString(attributes.arrival_hour),
    currency: requiredString(attributes.currency).toUpperCase(),
    notes: optionalString(attributes.notes),
    insertedAt: optionalString(attributes.inserted_at),
    amount: attributes.amount === undefined || attributes.amount === null ? null : nonNegativeNumber(attributes.amount),
    otaCommission: attributes.ota_commission === undefined || attributes.ota_commission === null ? null : nonNegativeNumber(attributes.ota_commission),
    paymentCollect: attributes.payment_collect === "property" || attributes.payment_collect === "ota" ? attributes.payment_collect : null,
    paymentType: optionalString(attributes.payment_type),
    services: Array.isArray(attributes.services) ? attributes.services.flatMap((service) => {
      if (!service || typeof service !== "object") return [];
      const item = service as Record<string, unknown>;
      const roomIndex = item.room_index === undefined || item.room_index === null ? null : Math.trunc(nonNegativeNumber(item.room_index));
      return [{ name: optionalString(item.name) ?? "Услуга", type: optionalString(item.type) ?? "unknown", totalPrice: nonNegativeNumber(item.total_price ?? 0), excluded: typeof item.excluded === "boolean" ? item.excluded : null, roomIndex }];
    }) : [],
  };
}

function parseTaskResult(payload: unknown) {
  if (!payload || typeof payload !== "object") throw invalidResponse();
  const result = payload as { data?: unknown; meta?: unknown };
  if (!Array.isArray(result.data)) throw invalidResponse();
  const warnings = result.meta && typeof result.meta === "object"
    ? (result.meta as { warnings?: unknown }).warnings
    : undefined;
  if (Array.isArray(warnings) && warnings.length > 0) {
    throw new ChannexApiError(`Channex отклонил ${warnings.length} записей синхронизации.`, "VALIDATION");
  }
  return {
    taskIds: result.data.map((item) => {
      if (!item || typeof item !== "object" || typeof (item as { id?: unknown }).id !== "string") throw invalidResponse();
      return (item as { id: string }).id;
    }),
  };
}

function parseWebhook(value: unknown): ChannexWebhookSummary {
  if (!value || typeof value !== "object") throw invalidResponse();
  const item = value as { id?: unknown; attributes?: unknown };
  const attributes = item.attributes && typeof item.attributes === "object"
    ? item.attributes as Record<string, unknown>
    : null;
  if (typeof item.id !== "string" || !attributes) throw invalidResponse();
  return {
    id: item.id,
    propertyId: relationshipId(item, "property") ?? optionalString(attributes.property_id),
    callbackUrl: requiredString(attributes.callback_url),
    eventMask: requiredString(attributes.event_mask),
    isActive: attributes.is_active === true,
  };
}

function parseOneTimeToken(value: unknown): { token: string } {
  if (!value || typeof value !== "object") throw invalidResponse();
  const data = (value as { data?: unknown }).data;
  if (!data || typeof data !== "object") throw invalidResponse();
  const token = (data as { token?: unknown }).token;
  if (typeof token !== "string" || !token.trim()) throw invalidResponse();
  return { token };
}

function invalidResponse() {
  return new ChannexApiError("Channex вернул ответ неизвестного формата.", "INVALID_RESPONSE");
}

export function createChannexClient(options: CreateChannexClientOptions): ChannexClient {
  const key = apiKey(options.environment);
  const rootUrl = baseUrl(options.environment);
  const timeoutMs = integerOption(
    options.timeoutMs ?? environmentInteger("CHANNEX_REQUEST_TIMEOUT_MS"),
    DEFAULT_TIMEOUT_MS,
    100,
    MAX_TIMEOUT_MS,
    "timeoutMs",
  );
  const maxRetries = integerOption(
    options.maxRetries ?? environmentInteger("CHANNEX_MAX_RETRIES"),
    DEFAULT_MAX_RETRIES,
    0,
    MAX_RETRIES,
    "maxRetries",
  );
  const fetchImpl = options.fetchImpl ?? fetch;

  async function get(path: string): Promise<unknown> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetchImpl(`${rootUrl}/${path.replace(/^\//, "")}`, {
          method: "GET",
          headers: { accept: "application/json", "user-api-key": key },
          cache: "no-store",
          redirect: "error",
          signal: controller.signal,
        });
        const payload = await jsonPayload(response);
        if (response.ok) return payload;

        if (attempt < maxRetries && isRetryableStatus(response.status)) {
          await sleep(retryDelay(attempt, response));
          continue;
        }
        throw responseError(response, payload);
      } catch (error) {
        if (error instanceof ChannexApiError) throw error;
        const timedOut = controller.signal.aborted;
        if (attempt < maxRetries) {
          await sleep(retryDelay(attempt));
          continue;
        }
        throw new ChannexApiError(
          timedOut ? "Время ожидания ответа Channex истекло." : "Не удалось связаться с Channex.",
          timedOut ? "TIMEOUT" : "NETWORK",
          { retryable: true },
        );
      } finally {
        clearTimeout(timeout);
      }
    }
    throw invalidResponse();
  }

  async function post(path: string, body: unknown, retrySafe = false): Promise<unknown> {
    const attempts = retrySafe ? maxRetries : 0;
    for (let attempt = 0; attempt <= attempts; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(`${rootUrl}/${path.replace(/^\//, "")}`, {
          method: "POST",
          headers: { accept: "application/json", "content-type": "application/json", "user-api-key": key },
          body: JSON.stringify(body),
          cache: "no-store",
          redirect: "error",
          signal: controller.signal,
        });
        const payload = await jsonPayload(response);
        if (response.ok) return payload;
        if (attempt < attempts && isRetryableStatus(response.status)) {
          await sleep(retryDelay(attempt, response));
          continue;
        }
        throw responseError(response, payload);
      } catch (error) {
        if (error instanceof ChannexApiError) throw error;
        if (attempt < attempts) {
          await sleep(retryDelay(attempt));
          continue;
        }
        throw new ChannexApiError(
          controller.signal.aborted ? "Время ожидания ответа Channex истекло." : "Не удалось связаться с Channex.",
          controller.signal.aborted ? "TIMEOUT" : "NETWORK",
          { retryable: true },
        );
      } finally {
        clearTimeout(timeout);
      }
    }
    throw invalidResponse();
  }

  async function listAll(path: string, filters: Record<string, string>) {
    const items: unknown[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const params = new URLSearchParams({
        ...filters,
        "pagination[page]": String(page),
        "pagination[limit]": String(PAGE_SIZE),
      });
      const payload = await get(`${path}?${params}`);
      const pageItems = parseCollection(payload);
      items.push(...pageItems);
      const total = collectionTotal(payload, items.length);
      if (pageItems.length === 0 || items.length >= total) return items;
    }
    throw invalidResponse();
  }

  return {
    async listProperties() {
      const properties: ChannexPropertySummary[] = [];
      let page = 1;
      let total = 0;

      while (page <= MAX_PAGES) {
        const params = new URLSearchParams({
          "pagination[page]": String(page),
          "pagination[limit]": String(PAGE_SIZE),
        });
        const result = parsePropertyPage(await get(`properties?${params}`));
        properties.push(...result.properties);
        total = result.total;

        if (properties.length >= total || result.properties.length === 0) break;
        page = result.page + 1;
      }

      if (properties.length < total) throw invalidResponse();
      return { properties, total };
    },
    async createProperty(input) {
      return parseCreatedId(await post("properties", { property: input }));
    },
    async listRoomTypes(propertyId) {
      return (await listAll("room_types", { "filter[property_id]": propertyId })).map((value) => {
        const parsed = parseTitledResource(value);
        return { id: parsed.id, title: parsed.title, propertyId: relationshipId(parsed.item, "property") };
      });
    },
    async createRoomType(input) {
      return parseCreatedId(await post("room_types", { room_type: input }));
    },
    async listRatePlans(propertyId) {
      return (await listAll("rate_plans", { "filter[property_id]": propertyId })).map((value) => {
        const parsed = parseTitledResource(value);
        return {
          id: parsed.id,
          title: parsed.title,
          propertyId: relationshipId(parsed.item, "property"),
          roomTypeId: relationshipId(parsed.item, "room_type"),
        };
      });
    },
    async createRatePlan(input) {
      return parseCreatedId(await post("rate_plans", { rate_plan: input }));
    },
    async pushAvailability(values) {
      if (values.length === 0) return { taskIds: [] };
      return parseTaskResult(await post("availability", { values }, true));
    },
    async pushRestrictions(values) {
      if (values.length === 0) return { taskIds: [] };
      return parseTaskResult(await post("restrictions", { values }, true));
    },
    async listBookingRevisionFeed(propertyId) {
      const params = new URLSearchParams({
        "filter[property_id]": propertyId,
        "order[inserted_at]": "asc",
        "pagination[page]": "1",
        "pagination[limit]": String(PAGE_SIZE),
      });
      return parseCollection(await get(`booking_revisions/feed?${params}`)).map(parseBookingRevision);
    },
    async getBookingRevision(revisionId) {
      const payload = await get(`booking_revisions/${encodeURIComponent(revisionId)}`);
      if (!payload || typeof payload !== "object") throw invalidResponse();
      return parseBookingRevision((payload as { data?: unknown }).data);
    },
    async acknowledgeBookingRevision(revisionId) {
      await post(`booking_revisions/${encodeURIComponent(revisionId)}/ack`, {}, true);
    },
    async listWebhooks(propertyId) {
      return (await listAll("webhooks", { "filter[property_id]": propertyId })).map(parseWebhook);
    },
    async createWebhook(input) {
      return parseCreatedId(await post("webhooks", { webhook: input }));
    },
    async createOneTimeToken(input) {
      return parseOneTimeToken(await post("auth/one_time_token", { one_time_token: input }));
    },
  };
}
