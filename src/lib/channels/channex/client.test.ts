import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { ChannexApiError, createChannexClient } from "./client";

const originalEnvironment = {
  apiKey: process.env.CHANNEX_STAGING_API_KEY,
  baseUrl: process.env.CHANNEX_STAGING_BASE_URL,
  timeout: process.env.CHANNEX_REQUEST_TIMEOUT_MS,
  retries: process.env.CHANNEX_MAX_RETRIES,
};

afterEach(() => {
  restore("CHANNEX_STAGING_API_KEY", originalEnvironment.apiKey);
  restore("CHANNEX_STAGING_BASE_URL", originalEnvironment.baseUrl);
  restore("CHANNEX_REQUEST_TIMEOUT_MS", originalEnvironment.timeout);
  restore("CHANNEX_MAX_RETRIES", originalEnvironment.retries);
});

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function propertyResponse(properties: unknown[], meta = { page: 1, total: properties.length }) {
  return new Response(JSON.stringify({ data: properties, meta }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

test("lists every accessible property without returning contact details", async () => {
  process.env.CHANNEX_STAGING_API_KEY = "staging-secret-key";
  const requests: { url: string; init?: RequestInit }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    requests.push({ url: String(input), init });
    return propertyResponse([
      {
        id: "property-1",
        attributes: {
          title: "Алматы, Абая 10",
          currency: "KZT",
          timezone: "Asia/Almaty",
          property_type: "apartment",
          is_active: true,
          email: "guest@example.test",
          phone: "+70000000000",
        },
      },
    ]);
  };

  const result = await createChannexClient({ environment: "staging", fetchImpl }).listProperties();

  assert.deepEqual(result, {
    properties: [{
      id: "property-1",
      title: "Алматы, Абая 10",
      currency: "KZT",
      timezone: "Asia/Almaty",
      propertyType: "apartment",
      isActive: true,
    }],
    total: 1,
  });
  assert.match(requests[0].url, /^https:\/\/staging\.channex\.io\/api\/v1\/properties\?/);
  assert.equal(new Headers(requests[0].init?.headers).get("user-api-key"), "staging-secret-key");
  assert.equal(JSON.stringify(result).includes("guest@example.test"), false);
});

test("follows Channex pagination", async () => {
  process.env.CHANNEX_STAGING_API_KEY = "staging-secret-key";
  let requestCount = 0;
  const fetchImpl: typeof fetch = async () => {
    requestCount++;
    return propertyResponse([
      { id: `property-${requestCount}`, attributes: { title: `Объект ${requestCount}` } },
    ], { page: requestCount, total: 2 });
  };

  const result = await createChannexClient({ environment: "staging", fetchImpl }).listProperties();
  assert.equal(requestCount, 2);
  assert.deepEqual(result.properties.map((property) => property.id), ["property-1", "property-2"]);
});

test("maps authentication and validation responses to safe errors", async () => {
  process.env.CHANNEX_STAGING_API_KEY = "never-expose-this-key";

  for (const scenario of [
    { status: 401, kind: "UNAUTHORIZED", code: "unauthorized" },
    { status: 403, kind: "FORBIDDEN", code: "forbidden" },
    { status: 404, kind: "NOT_FOUND", code: "resource_not_found" },
    { status: 422, kind: "VALIDATION", code: "validation_error" },
  ] as const) {
    const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({
      errors: {
        code: scenario.code,
        title: "Sensitive provider title",
        details: { guest: ["Иван Иванов"], api_key: ["never-expose-this-key"] },
      },
    }), { status: scenario.status });

    await assert.rejects(
      createChannexClient({ environment: "staging", fetchImpl, maxRetries: 0 }).listProperties(),
      (error: unknown) => {
        assert.ok(error instanceof ChannexApiError);
        assert.equal(error.kind, scenario.kind);
        assert.equal(error.status, scenario.status);
        assert.equal(error.providerCode, scenario.code);
        assert.doesNotMatch(error.message, /Иван|never-expose-this-key|Sensitive/);
        return true;
      },
    );
  }
});

test("retries safe GET requests for 429 and temporary 5xx responses", async () => {
  process.env.CHANNEX_STAGING_API_KEY = "staging-secret-key";
  const responses = [
    new Response(JSON.stringify({ errors: { code: "http_too_many_requests" } }), {
      status: 429,
      headers: { "retry-after": "0" },
    }),
    new Response(JSON.stringify({ errors: { code: "temporary" } }), { status: 503 }),
    propertyResponse([]),
  ];
  let requestCount = 0;
  const fetchImpl: typeof fetch = async () => responses[requestCount++];

  const result = await createChannexClient({ environment: "staging", fetchImpl, maxRetries: 2 }).listProperties();
  assert.deepEqual(result, { properties: [], total: 0 });
  assert.equal(requestCount, 3);
});

test("reports an exhausted rate limit separately", async () => {
  process.env.CHANNEX_STAGING_API_KEY = "staging-secret-key";
  const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({
    errors: { code: "http_too_many_requests" },
  }), { status: 429, headers: { "retry-after": "42" } });

  await assert.rejects(
    createChannexClient({ environment: "staging", fetchImpl, maxRetries: 0 }).listProperties(),
    (error: unknown) => {
      assert.ok(error instanceof ChannexApiError);
      assert.equal(error.kind, "RATE_LIMITED");
      assert.equal(error.retryable, true);
      assert.equal(error.retryAfterMs, 42_000);
      return true;
    },
  );
});

test("reports exhausted temporary server failures as unavailable", async () => {
  process.env.CHANNEX_STAGING_API_KEY = "staging-secret-key";
  const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({
    errors: { code: "service_unavailable", title: "Internal provider details" },
  }), { status: 503 });

  await assert.rejects(
    createChannexClient({ environment: "staging", fetchImpl, maxRetries: 0 }).listProperties(),
    (error: unknown) => {
      assert.ok(error instanceof ChannexApiError);
      assert.equal(error.kind, "UNAVAILABLE");
      assert.equal(error.status, 503);
      assert.equal(error.retryable, true);
      assert.doesNotMatch(error.message, /Internal provider details/);
      return true;
    },
  );
});

test("aborts requests after the configured timeout", async () => {
  process.env.CHANNEX_STAGING_API_KEY = "staging-secret-key";
  const fetchImpl: typeof fetch = (_input, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
  });

  await assert.rejects(
    createChannexClient({ environment: "staging", fetchImpl, timeoutMs: 100, maxRetries: 0 }).listProperties(),
    (error: unknown) => {
      assert.ok(error instanceof ChannexApiError);
      assert.equal(error.kind, "TIMEOUT");
      assert.equal(error.retryable, true);
      return true;
    },
  );
});

test("rejects unsafe base URLs before making a request", () => {
  process.env.CHANNEX_STAGING_API_KEY = "staging-secret-key";
  process.env.CHANNEX_STAGING_BASE_URL = "http://example.test/api/v1?key=secret";
  assert.throws(
    () => createChannexClient({ environment: "staging" }),
    (error: unknown) => error instanceof ChannexApiError && error.kind === "CONFIGURATION",
  );
});

test("creates a property with the documented envelope and never retries POST", async () => {
  process.env.CHANNEX_STAGING_API_KEY = "staging-secret-key";
  const requests: RequestInit[] = [];
  const fetchImpl: typeof fetch = async (_input, init) => {
    requests.push(init ?? {});
    return new Response(JSON.stringify({ data: { id: "property-created" } }), { status: 201 });
  };
  const client = createChannexClient({ environment: "staging", fetchImpl, maxRetries: 3 });
  const result = await client.createProperty({
    title: "Апартаменты на Абая",
    currency: "KZT",
    timezone: "Asia/Almaty",
    property_type: "apartment",
    country: "KZ",
    settings: {
      allow_availability_autoupdate_on_modification: false,
      allow_availability_autoupdate_on_cancellation: false,
      min_stay_type: "both",
      state_length: 500,
    },
  });
  assert.deepEqual(result, { id: "property-created" });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].method, "POST");
  assert.deepEqual(JSON.parse(String(requests[0].body)), {
    property: {
      title: "Апартаменты на Абая",
      currency: "KZT",
      timezone: "Asia/Almaty",
      property_type: "apartment",
      country: "KZ",
      settings: {
        allow_availability_autoupdate_on_modification: false,
        allow_availability_autoupdate_on_cancellation: false,
        min_stay_type: "both",
        state_length: 500,
      },
    },
  });
});

test("does not automatically retry an ambiguous failed POST", async () => {
  process.env.CHANNEX_STAGING_API_KEY = "staging-secret-key";
  let requestCount = 0;
  const fetchImpl: typeof fetch = async () => {
    requestCount++;
    throw new TypeError("connection reset after upload");
  };
  const client = createChannexClient({ environment: "staging", fetchImpl, maxRetries: 3 });
  await assert.rejects(
    client.createRoomType({
      property_id: "property-1",
      title: "Студия",
      count_of_rooms: 1,
      occ_adults: 2,
      occ_children: 0,
      occ_infants: 0,
      default_occupancy: 2,
      facilities: [],
      room_kind: "room",
    }),
    (error: unknown) => error instanceof ChannexApiError && error.kind === "NETWORK",
  );
  assert.equal(requestCount, 1);
});

test("retries idempotent ARI updates and sends the documented availability envelope", async () => {
  process.env.CHANNEX_STAGING_API_KEY = "staging-secret-key";
  const requests: RequestInit[] = [];
  let attempt = 0;
  const fetchImpl: typeof fetch = async (_input, init) => {
    requests.push(init ?? {});
    attempt++;
    if (attempt === 1) return new Response(JSON.stringify({ errors: { code: "http_too_many_requests" } }), { status: 429, headers: { "retry-after": "0" } });
    return new Response(JSON.stringify({ data: [{ id: "task-1", type: "task" }], meta: { warnings: [] } }), { status: 200 });
  };
  const values = [{
    property_id: "property-1",
    room_type_id: "room-type-1",
    date_from: "2026-09-25",
    date_to: "2026-09-30",
    availability: 2,
  }];
  const result = await createChannexClient({ environment: "staging", fetchImpl, maxRetries: 1 }).pushAvailability(values);
  assert.deepEqual(result, { taskIds: ["task-1"] });
  assert.equal(requests.length, 2);
  assert.deepEqual(JSON.parse(String(requests[1].body)), { values });
});

test("parses the booking revision feed without retaining guarantee data", async () => {
  process.env.CHANNEX_STAGING_API_KEY = "staging-secret-key";
  const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({
    meta: { total: 1 },
    data: [{
      id: "revision-1",
      type: "booking_revision",
      attributes: {
        property_id: "property-1",
        booking_id: "booking-1",
        unique_id: "BDC-42",
        system_id: "system-1",
        ota_reservation_code: "42",
        ota_name: "Booking.com",
        status: "new",
        currency: "KZT",
        amount: "50000.00",
        ota_commission: "7500.00",
        payment_collect: "ota",
        payment_type: "credit_card",
        services: [{ name: "Завтрак", type: "Meal", total_price: "3000", excluded: false, room_index: 0 }],
        arrival_hour: "14:00",
        notes: "Поздний заезд",
        guarantee: { card_number: "4111111111111111" },
        customer: { name: "Aruzhan", surname: "S.", mail: "guest@example.test", phone: "+77000000000", country: "KZ" },
        rooms: [{
          room_type_id: "room-type-1",
          rate_plan_id: "rate-plan-1",
          ota_unique_id: "room-1",
          checkin_date: "2026-10-01",
          checkout_date: "2026-10-03",
          amount: "50000.00",
          occupancy: { adults: 2, children: 1 },
        }],
      },
    }],
  }), { status: 200 });
  const revisions = await createChannexClient({ environment: "staging", fetchImpl }).listBookingRevisionFeed("property-1");
  assert.equal(revisions[0].rooms[0].amount, 50_000);
  assert.equal(revisions[0].amount, 50_000);
  assert.equal(revisions[0].otaCommission, 7_500);
  assert.equal(revisions[0].paymentCollect, "ota");
  assert.equal(revisions[0].services[0].totalPrice, 3_000);
  assert.equal(revisions[0].services[0].roomIndex, 0);
  assert.equal(revisions[0].customer.name, "Aruzhan");
  assert.equal("guarantee" in revisions[0], false);
  assert.equal(JSON.stringify(revisions).includes("4111111111111111"), false);
});
