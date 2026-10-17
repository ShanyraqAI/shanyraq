import { createHash } from "node:crypto";
import { getCurrentHotel, getCurrentUser } from "@/lib/tenant";
import { resolveHotelPermissions } from "@/lib/access";
import { getRequestLocale } from "@/lib/locale-server";
import { todayInTimeZone, toISODate } from "@/lib/dates";
import { readOverviewBlock } from "@/lib/dashboard/overview-server";
import { OVERVIEW_BLOCKS, overviewScope, overviewParams, type OverviewBlock } from "@/lib/dashboard/overview-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie, X-Shanyraq-Read-Scope", "X-Content-Type-Options": "nosniff" };
const failure = (status: number) => Response.json({ error: "Обновите рабочий контекст или войдите снова." }, { status, headers });

export async function GET(request: Request) {
  if (process.env.INSTANT_OVERVIEW_ENABLED !== "true") return failure(404);
  const user = await getCurrentUser();
  if (!user?.organizationId || !user.hotelId || !user.role) return failure(401);
  const permissions = resolveHotelPermissions(user);
  if (!permissions.includes("OVERVIEW")) return failure(403);
  const scope = overviewScope(user.id, user.organizationId, user.hotelId, user.role, permissions);
  if (request.headers.get("x-shanyraq-read-scope") !== scope) return failure(409);
  const hotel = await getCurrentHotel();
  if (!hotel || hotel.id !== user.hotelId || hotel.orgId !== user.organizationId) return failure(403);
  const url = new URL(request.url);
  const block = url.searchParams.get("block") as OverviewBlock;
  if (!OVERVIEW_BLOCKS.includes(block)) return failure(400);
  if (block === "recent" && !permissions.includes("RESERVATIONS")) return failure(403);
  const locale = await getRequestLocale(hotel.language);
  const day = toISODate(todayInTimeZone(hotel.timezone));
  if (url.searchParams.get("day") !== day) return failure(409);
  const params = overviewParams({ day, locale });
  try {
    const data = await readOverviewBlock(block, hotel, user, locale);
    const version = `"${createHash("sha256").update(JSON.stringify([scope, params, data])).digest("hex")}"`;
    if (request.headers.get("if-none-match") === version)
      return new Response(null, { status: 304, headers: { ...headers, ETag: version } });
    return Response.json({ scope, params, data, version }, { headers: { ...headers, ETag: version } });
  } catch {
    // No raw Prisma errors, connection strings or guest data in responses/logs.
    return Response.json({ error: "Не удалось обновить обзор. Попробуйте позже." }, { status: 503, headers });
  }
}
