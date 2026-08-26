// Regenerates src/lib/db-init-sql.ts from prisma/schema.prisma.
// Usage: npm run gen:sql   (run after any schema change)
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const sql = execSync(
  'npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script',
  { cwd: root, encoding: "utf8" },
);

const idempotent = sql
  .replace(/CREATE TABLE /g, "CREATE TABLE IF NOT EXISTS ")
  .replace(/CREATE UNIQUE INDEX /g, "CREATE UNIQUE INDEX IF NOT EXISTS ")
  .replace(/CREATE INDEX /g, "CREATE INDEX IF NOT EXISTS ");

const banner = `// AUTO-GENERATED from prisma/schema.prisma — do not edit by hand.
// Regenerate with: npm run gen:sql
// Idempotent DDL so the app can bootstrap an empty SQLite database at runtime
// (used for the ephemeral demo deployment on Vercel and fresh local clones).

`;

writeFileSync(join(root, "src", "lib", "db-init-sql.ts"), `${banner}export const DB_INIT_SQL: string = \`${idempotent}\`;\n`);
console.log("✓ src/lib/db-init-sql.ts regenerated");
