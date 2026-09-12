import { get } from "@vercel/blob";
import { getSessionUser } from "@/lib/auth/session";
import { isManagedAvatar } from "@/lib/avatar";

export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const [{ userId }, user] = await Promise.all([params, getSessionUser()]);
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (user.id !== userId) return new Response("Forbidden", { status: 403 });
  if (!isManagedAvatar(user.avatarUrl)) return new Response("Not found", { status: 404 });

  const result = await get(user.avatarUrl, { access: "private" });
  if (!result || result.statusCode !== 200) return new Response(null, { status: result?.statusCode ?? 404 });
  return new Response(result.stream, {
    headers: {
      "Content-Type": result.blob.contentType,
      "Content-Length": String(result.blob.size),
      "Cache-Control": "private, max-age=300",
      ETag: result.blob.etag,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
