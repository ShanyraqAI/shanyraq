import { PublicError } from "@/server/errors";

const CONFIRMATION = "I_UNDERSTAND_THIS_DELETES_ALL_DATA";

export function assertDisposableDatabase(): void {
  if (process.env.NODE_ENV === "production") throw new PublicError("Destructive database command is disabled in production");
  if (process.env.ALLOW_DESTRUCTIVE_DB_RESET !== CONFIRMATION) {
    throw new PublicError(`Set ALLOW_DESTRUCTIVE_DB_RESET=${CONFIRMATION} to confirm the destructive operation`);
  }
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new PublicError("DATABASE_URL is missing");
  const url = new URL(raw);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const explicitlyAllowed = process.env.DISPOSABLE_DATABASE_NAME;
  const localHost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  const conventionallyDisposable = /(?:^|[_-])(test|dev|demo)$/i.test(databaseName);
  if (!localHost && explicitlyAllowed !== databaseName) {
    throw new PublicError("Remote database is not explicitly allowlisted as disposable");
  }
  if (!conventionallyDisposable && explicitlyAllowed !== databaseName) {
    throw new PublicError("Database name does not identify a disposable test/dev database");
  }
}
