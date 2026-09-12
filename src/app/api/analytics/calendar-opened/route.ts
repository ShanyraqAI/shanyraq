import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { recordAnalyticsEventSafely } from "@/lib/analytics/service";

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const allowedOrigins = new Set([new URL(request.url).origin]);
  if (process.env.APP_URL) allowedOrigins.add(new URL(process.env.APP_URL).origin);
  return allowedOrigins.has(new URL(origin).origin);
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false }, { status: 403 });
  const user = await getSessionUser();
  if (!user?.hotelId) return NextResponse.json({ ok: false }, { status: 401 });

  let rangeDays: number | undefined;
  try {
    const body = await request.json() as { rangeDays?: unknown };
    if ([7, 14, 30].includes(Number(body.rangeDays))) rangeDays = Number(body.rangeDays);
  } catch {
    // Invalid optional metadata does not prevent recording the page view.
  }

  await recordAnalyticsEventSafely({
    eventType: "calendar_opened",
    userId: user.id,
    organizationId: user.organizationId,
    hotelId: user.hotelId,
    sessionId: user.sessionId,
    entityType: "Hotel",
    entityId: user.hotelId,
    metadata: { rangeDays: rangeDays ?? 14 },
  });
  return NextResponse.json({ ok: true });
}
