import { PublicError } from "@/server/errors";

export function googleSheetExportUrl(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new PublicError("Укажите корректную ссылку Google Sheets"); }
  if (url.protocol !== "https:" || url.hostname !== "docs.google.com" || url.username || url.password) {
    throw new PublicError("Разрешены только ссылки docs.google.com/spreadsheets");
  }
  const id = /^\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/.exec(url.pathname)?.[1];
  if (!id) throw new PublicError("Не удалось определить идентификатор Google-таблицы");
  const gid = url.searchParams.get("gid") ?? url.hash.match(/gid=(\d+)/)?.[1];
  const exportUrl = new URL(`https://docs.google.com/spreadsheets/d/${id}/export`);
  exportUrl.searchParams.set("format", "xlsx");
  if (gid && /^\d+$/.test(gid)) exportUrl.searchParams.set("gid", gid);
  return exportUrl;
}

export function allowedGoogleSheetRedirect(url: URL) {
  return url.protocol === "https:" && !url.username && !url.password &&
    (url.hostname === "docs.google.com" || url.hostname.endsWith(".googleusercontent.com"));
}
