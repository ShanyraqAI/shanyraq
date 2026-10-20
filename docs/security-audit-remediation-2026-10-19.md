# Security audit remediation — 2026-10-19

> Historical snapshot. Current full-checkout results and remaining release gates are recorded in [Final security verification](security-final-verification.md); validation limitations below describe the earlier partial-checkout stage.

Base: `4526b2cec307fd6d8ef566c45a3d9ef9dab388d1`. This is a **draft remediation**, not a production release or a claim that the entire repository is secure.

## Implemented

- AI support: IP-wide budget independent of client chatId, shared per-user budget, global 500-request/hour ceiling, byte-bounded JSON before parsing. This is a request/token ceiling, not a dollar-accurate gateway budget or a distributed concurrency cap.
- Login: independent IP and shared account limits; phone formatting cannot reset the account bucket. Existing phone lookup semantics are intentionally preserved; no destructive identity merge/migration.
- New phone registrations disabled on the server until ownership verification exists; email/Google registration and existing phone login retained. Registration UI no longer offers the disabled flow.
- Production session cookies always use Secure, even with a misconfigured HTTP APP_URL.
- Batch room capacity includes requested count under the existing organization lock. Room-name generation is bounded and rejects duplicates/unsafe numeric suffixes.
- Room create/update/delete audit entries commit inside the same transaction as business writes.
- Financial writes require stable operation UUIDs; business records, audit and operation receipts commit together. Reports form and expense client retain the key for retries. Reusing a key for a different payload fails closed.
- Decimal-string money validation replaces exact comparisons of binary floating-point intermediates; refund balance checks use Decimal and a reservation row lock.
- Cancellation/no-show cannot clear MAINTENANCE, OUT_OF_ORDER or CLEANING; the business date uses the hotel's timezone.
- Telegram administrative commands only execute in the allowlisted user's own private chat. Update receipt and mutations use one transaction; failed HTTP replies can be retried without another grant. Audit attribution uses the stable Telegram user id, not a mutable username.
- Channex finalization takes the same property queue lock as enqueue, locks the job row and verifies worker ownership. Late workers cannot finalize another worker's local lease, and rerunRequested cannot be lost between read and write. This does not prove remote-provider ordering under overlapping workers.
- Dependencies: Next.js and eslint-config-next pinned to 16.4.2, sharp to 0.35.5; compatible transitive fixes applied to the lockfile.

## Validation actually performed

- `npm ci --ignore-scripts --no-audit --no-fund`: passed against the updated lockfile; no application lifecycle scripts or production secrets used.
- `prisma generate`: passed.
- `prisma validate`: passed with a dummy localhost connection string; no database connection or migration executed.
- ESLint over the available source and regression harness: passed.
- `npm run test:security-audit`: 43 isolated tests passed. Actual source is transpiled and executed with controlled DB/auth/provider boundary mocks. Tests cover money, bounded bodies, room names/capacity, financial retry/rollback, private Telegram authorization and update replay, AI chatId rotation, session Secure, phone-registration fail-closed, room cancellation, Channex rerun/lease fencing and account-wide limiting.
- Updated lockfile `npm audit --omit=dev --package-lock-only --ignore-scripts`: **0** reported vulnerabilities.
- Full audit still reports **9 high**, all in development-tool dependency chains (Next ESLint/fast-glob/micromatch/braces and shadcn/ts-morph). No critical findings remain in that scan. Do not resolve by blindly downgrading Next tooling to v14 or applying `audit fix --force`.

## Important validation limitation

Only selected files could be retrieved through authenticated GitHub MCP; ordinary git clone lacked authorization. This local tree is not a full checkout. A partial TypeScript run still reports missing imports and implicit-any diagnostics from missing context. It is **not** a passing full typecheck. Full `tsc`, build, existing suites, PostgreSQL concurrency/fault-injection, migration application and live integration tests remain mandatory before merge. No production application endpoint was called; no payment, Telegram send, deployment or production schema mutation was executed.

## Required deployment steps (not performed)

1. Review the migration `20261019180000_telegram_command_receipts` and integrate it into the project's reviewed-release migration process. Apply it before enabling the updated Telegram webhook. Without it the bot fails closed (503), rather than executing non-idempotent commands.
2. Run full lint/typecheck/build and existing test suites from a full checkout. Test receipts and audit rollback against an isolated PostgreSQL database, including concurrent requests and a lost response after commit.
3. Verify login/registration, expense entry, reports payment form, cancellation, Telegram duplicate delivery and Channex lease recovery on staging.
4. Confirm trusted ingress handling of client IP headers; application headers are not a substitute for proxy trust configuration. Set gateway budget alerts and distributed concurrency limits at the gateway/ingress if required.
5. Deploy only after review; do not auto-merge this draft.

## Unresolved decisions and operational hardening

- **Entitlements policy:** SubscriptionGrant and BillingSubscription remain independent. Decide whether a manual grant overrides an expired online subscription, which plan supplies capacity, and whether /end should affect paid access. Changing this silently could either revoke purchased access or expand access. A single effective-entitlement resolver and UI reconciliation need that decision.
- **Phone ownership:** OTP enrollment and recovery are not implemented. The unsafe signup path is disabled, not relabeled as verified. Existing `+7...`/`7...` identities require a collision review before E.164 migration.
- **Dev dependencies:** nine high advisories above remain. Resolve by reviewing upstream fixes or deliberately replacing affected development tools, not by an unreviewed downgrade/override.
- **CSP:** unsafe-inline and broad connect-src are unchanged. Nonce/CSP rollout needs full-page rendering and analytics/integration compatibility testing; no confirmed XSS was claimed in the audit.
- **TTLock:** query-string callback secret remains compatible with the existing provider. Move to provider-supported signed/header authentication, or explicitly redact query strings in every ingress/logging system and rotate the token. Provider configuration and actual logs were not accessible or changed.
- **Channel operation:** production Channex enablement, provider certification and more frequent recovery scheduling were not invented or enabled. Current staging/mock boundaries remain. Daily fallback cron frequency must be reviewed with hosting-plan limits and an inventory-lag SLO.
- **Infrastructure:** secret/history scanning, environment separation, least-privilege DB credentials, branch protection, PII redaction and backup/restore validation still require repository/infrastructure checks beyond this patch.

The goal is to close verified defects without claiming that tests with mocks replace production-equivalent acceptance.
