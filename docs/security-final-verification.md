# Final security verification

This completes the full-checkout validation follow-up for draft PR #31. It supersedes the partial-checkout limitations in the two earlier audit documents, not their release safeguards. No assertion that the entire project is secure or production-approved is made.

## Corrections found by full validation

- Fixed the four TypeScript errors reported by the previous CI run: optional room-form error text, stale Clarity package import, a narrowed environment comparison, and the trusted-client-address environment shape.
- Removing the unused shadcn generator also removed its stylesheet import target. Vendored the exact shadcn 4.22.1 stylesheet with its MIT license; generated UI variants remain available without reinstalling the generator or vulnerable tooling chain.
- Added the request nonce to landing-page JSON-LD. Public and authenticated application pages now render under the strict script CSP in the actual production build, not only a minimal fixture.
- The complete source test runner discovers all checked-in `src/**/*.test.ts` and the release/service-worker/security harnesses. Database-enabled tests require an explicitly selected loopback PostgreSQL database ending in `_test`; no `.env` file is loaded by the runner.
- Corrected stale test fixtures, not production behavior: communications replay must use identical payloads; the reservation overlap fixture must not duplicate the sequence identifier; the isolated billing test enables its future provider branch only inside its worker and restores the descriptor afterward. Production closed-beta billing remains disabled.
- Real concurrent financial HTTP submissions exposed a pool starvation bug hidden by boundary mocks: transactional audit attribution queried sessions through the global connection pool. Session resolution now accepts a session-capable transaction client, and audit writes use that same client. Regression tests also preserve tenant-scoped actor attribution.

## Local verification

All database and browser fixtures used synthetic data in disposable PostgreSQL 16.14 bound only to loopback. No production environment variables, customer DB, live payment, Telegram delivery, TTLock callback or Channex API was used.

- Clean lockfile install with lifecycle scripts disabled; Prisma generate and validate: passed.
- All 44 historical Prisma migrations deployed successfully to a clean local database.
- Full TypeScript, full ESLint and production Next.js build, including the read-only schema gate: passed.
- Complete source/unit/security suite with all four opt-in database flags enabled: **322 passed, zero failed, zero skipped** (including the owner-confirmed entitlement follow-up).
- Reliability and administrative-inbox DB suites: passed. Guest communications, guest payments, document agreements and booking calendar integration scripts: passed.
- Clean migration, rental-property backfill and Channex-property backfill fixtures: passed.
- Full lockfile npm audit including development dependencies: zero reported vulnerabilities at verification time. Advisory data can change.
- Gitleaks 8.30.1 scanned the complete then-current 122-commit history. Exactly two findings were reviewed as a historical synthetic `keyInstructions` fixture and its assertion. `.gitleaksignore` contains only their exact commit/path/rule/line fingerprints; no file-wide suppression, history rewrite or credential revocation was performed. No other matches remained. This is heuristic detection, not proof that no secret ever existed.
- Actual production application: Chromium checked five public and six authenticated pages, session acceptance, rendering/hydration and CSP; no observed CSP violations or page errors. The synthetic session was injected into a local HTTP browser context; this does not certify real TLS/login-cookie enrollment or every interactive workflow.

- Actual Next server-action HTTP replay: six concurrent identical authenticated form submissions produced exactly one financial ledger entry, one receipt and one audit event with the default three-connection pool. A changed amount under the same key was rejected without another ledger write. This used only synthetic local data, not a payment provider.

## CI

The least-privilege workflow uses a disposable PostgreSQL service and no production secrets or deployment step. It runs full-history secret scanning with a pinned Gitleaks archive checksum, clean install, Prisma validation/migrations, full audit, lint/typecheck, complete source tests, database suites/backfill fixtures and build. Checkout/setup-node actions are pinned by commit. A workflow's existence is not a green result; the actual run and commit are reported in PR #31.

## Remaining release gates

- **Entitlement policy resolved:** the owner confirmed independent manual access and grant-only `/end`. Shared authorization/display logic, maximum-not-summed active capacities and paid-record-preserving cancellation are implemented and tested; see [Independent manual and paid access](subscription-entitlements.md). No paid duration or purchased plan is rewritten.
- **Phone ownership:** unsafe phone signup remains disabled. OTP enrollment, identity-collision review and recovery/provider policy are not implemented by these patches.
- **Staging/integrations:** exercise real signup/login and provider flows under HTTPS, CSP, trusted ingress and provider sandbox accounts. Header authentication for TTLock requires provider/gateway confirmation before a live callback switch; log redaction and rotation remain operational work.
- **Operations:** production migrations/release approval, Channex certification and remote ordering, gateway dollar/concurrency limits, least-privilege infrastructure, backups/restore and branch protection require owner review and evidence. A GitHub source scan does not inspect external logs or deployed secret stores.

The owner-confirmed manual/paid entitlement policy is implemented in code. No merge, production deployment/migration, provider reconfiguration, token rotation or infrastructure modification was performed. Keep the PR draft until these release decisions and acceptance checks are complete.
