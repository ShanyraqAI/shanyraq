// Explicit release step, never called by build. Run only after the immutable artifact passed build/test and migrations were reviewed.
import { spawnSync } from "node:child_process";

if (
  !process.argv.includes("--apply-reviewed-release") ||
  process.env.RELEASE_MIGRATIONS_APPROVED !== "1"
) {
  console.error(
    "Refusing migrations: use the reviewed release command with RELEASE_MIGRATIONS_APPROVED=1 after build/test and backup.",
  );
  process.exit(1);
}
if (process.env.VERCEL_ENV !== "production") {
  console.error(
    "Reviewed release requires production target; refusing to silently skip migrations.",
  );
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL is not set for the reviewed production release; cannot apply migrations.",
  );
  process.exit(1);
}
const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);
