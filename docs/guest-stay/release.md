# Catalog / guest stay: review and Preview release

## Status and scope

Draft for review, not a production-readiness claim. Based on `main` commit `4526b2cec307fd6d8ef566c45a3d9ef9dab388d1` (rechecked before opening the PR). The uploaded archive's Git commit matches that main. No production migration, deployment, feature enablement, SMS, paid sends, or merge was performed.

The implementation uses real Prisma persistence and existing booking/availability/pricing/communication/document services, not mock business endpoints. Synthetic data is confined to disposable loopback PostgreSQL tests.

For the photo-first catalog and simplified phone editor follow-up, see [catalog design](./catalog-design.md).

## Working paths

- Owner explicitly publishes public fields and selected photos from the unit profile. Existing units remain private. Units list has catalog copy/open actions; profile has catalog/unit links and owner preview.
- `/catalog/[workspace-slug]` and `/catalog/[workspace-slug]/[listing-id]` show public data, date/guest-count availability and optional owner-selected tariff total. They cannot create/hold a reservation or take payment. Uncertain data stays unknown. Read responses are not cached; focus/30-second refresh rechecks availability.
- Owner creates a GuestStay from an existing reservation, or a nonblocking preliminary record directly from the unit (no invented Guest name). Sending a form never changes calendar inventory. A preliminary record must be explicitly linked to a matching canonical active reservation before access can be granted; the existing reservation workflow owns conflict checks and inventory.
- One `/guest/stay#<random capability>` evolves from form to waiting to check-in details. Owner form/check-in messages use this same URL. Drafts are explicitly saved on the server; reload retains them. The fragment is not sent in HTTP URLs. It is retained in browser history for return visits, so it must be treated as a sensitive bearer link.
- Form data is scoped to this stay. It does not overwrite shared Guest data or another reservation. Required fields/arrival and identity-original requirement can be configured; per-stay exceptions require resubmission/review.
- Owner review, original-document-at-arrival mark, document consent and explicit access grant are separate decisions. History records actor, timestamp, action and reason. No identity upload endpoint exists.
- Existing owner-issued non-OTP AgreementBundle can be attached. The same guest page renders exact document snapshots, PDF downloads and existing consent/evidence logic, with immutable accepted history retained. A GET/view is not consent. A missing/stale required bundle or disabled agreement module blocks submission/grant, never fakes success.
- Exact address, entry instructions, Wi-Fi, selected entrance photos, parking and checkout text are fetched only after access checks. Existing communication profile supplies private instructions; policy adds private parking/checkout text and selected entrance photos. Cancelled/checked-out bookings, expired/revoked/rotated capabilities or stale reviewed revisions stop further authorization.
- Payment amount/deposit and explanatory payment method text reuse the canonical reservation. Existing optional GuestPaymentRequest/Kaspi flow is unchanged. No payment is marked received by form submission or consent.
- Copy/share actions prepare/handoff text only: delivery is never inferred. Native share is invoked directly from the user click; cancellation and unsupported clipboard have explicit fallback messages.

## State contract

`CatalogListing.published` is independent of `GuestStay.formState` (`EMPTY / DRAFT / SUBMITTED / CORRECTION`), owner review, original-check mark, accepted agreement evidence and `accessGrantedAt`. Payment state remains in existing models. Submitted + acknowledged is not identity verification, payment or entry permission.

Version/CAS and transactional locks prevent stale/duplicate/concurrent writes. Owner membership is rechecked server-side for the tenant; MANAGER is not promoted. Writes use existing origin, scope, rate-limit and billing guards (emergency revocation is allowed). Server capability storage is SHA-256 lookup + AES-256-GCM sealed random token, not plaintext storage or a guessable booking ID. Response DTOs explicitly select public/private fields. New capability queries use a dedicated Prisma client without query/parameter logging.

## Additive schema and flags

1. `20261018000000_catalog_guest_stay`: CatalogListing, GuestStayPolicy, GuestStay, GuestStayEvent, tenant/composite constraints and indexes.
2. `20261018001000_guest_stay_instructions_history`: private parking/checkout/entrance-photo policy and accepted bundle history.

Historical migrations are unchanged. Existing Guest/Reservation fields and meanings are not renamed. Nothing is automatically published or granted.

Flags default off in `.env.example`:

- `PUBLIC_CATALOG_ENABLED=true`: catalog + publication UI.
- `GUEST_STAY_ENABLED=true`: invitation collection/review/access UI and API.
- `GUEST_STAY_SECRET`: server-only stable 32-byte lowercase hex key (required when guest stays enabled); never `NEXT_PUBLIC_*`. Generate with `openssl rand -hex 32`; store in deployment secrets, not source/logs. Loss/rotation without retained decryption key makes existing invitation URLs unavailable for owner retrieval.
- `GUEST_DOCUMENT_BUNDLES_ENABLED=true`: existing module required if this stay requires agreement. Leave `DOCUMENT_SMS_ENABLED=false` for this no-SMS path.
- `APP_URL`: exact HTTPS Preview origin, or `http://localhost:3000` for loopback development. Local production-mode HTTP tests use synthetic server-issued session cookies; this is not an authentication shortcut in the application.

The deployment schema gate is read-only: off flags do not require new tables; on flags reject a missing schema/key. While `GUEST_STAY_ENABLED=true`, Clarity is disabled at the root for the entire deployment so an already-injected SPA recorder cannot follow navigation into private guest content. This deliberately trades analytics for privacy until a recorder-isolation design is separately reviewed.

## Test evidence

All tests below ran against this checkout on Linux/Node 24 and local PostgreSQL 16 UTF8. Full browser testing used the built Next.js application, not component fixtures. Final commands are reproducible below. Prior locator failures were fixed and the full browser scenario rerun; they are not counted as passes from the failed attempt.

| Check | Result | Evidence / boundary |
| --- | --- | --- |
| Full production build | PASS | `npm run build`: Prisma generation, complete Next compilation, whole-project TypeScript and route generation |
| Whole-project typecheck | PASS | `npm run typecheck` / `tsc --noEmit` |
| Whole-project ESLint | PASS | `npm run lint` |
| Full unit suite (including release/SW tests) | PASS / SKIP | 255 passed, zero failed, 4 opt-in legacy PostgreSQL cases skipped in that run; do not count skips as passed |
| New policy unit tests | PASS | 7 policy + 2 presentation, included in full suite |
| New real PostgreSQL scenarios | PASS | 34: protected unpublished-photo preview, tenant/role, public whitelist/photos, full-range availability, boundaries/capacity/restrictions, retries/concurrency, drafts/corrections, independent consent/review/original/grant, private instructions/photos, revoke/rotate/expiry/cancel/checkout and accepted evidence |
| Clean + additive upgrade and disabled-schema checks | PASS | 6: all baseline migrations, legacy behavior with no new tables, gates off/on, preservation through upgrade, no autopublication |
| Existing agreement PostgreSQL suite | PASS | 21 checks; no real SMS |
| Existing communications/signing suite | PASS | Real PostgreSQL; identical replay retained, changed-content replay rejected. Fixed an old test expectation that contradicted the unchanged main service |
| Existing reliability suite | PASS | 8 scenario groups: guest identity separation, replay/atomic audit, multiroom rollback, channel revision order, import and bounded guest history |
| Existing inventory/booking/import PostgreSQL tests | PASS | 9 tests including nested checks, no skips. Fixed copied fixture reusing the source reservation's unique sequence number; no production booking behavior changed |
| Legacy billing opt-in PostgreSQL test | FAIL (existing rollout/test mismatch) | `getSubscription()` returns null because unchanged `PRODUCT_AVAILABILITY.billing` is hard-disabled in main, while the old test expects a live trial. Did not enable billing or weaken its gate to make the test pass |
| Built-app browser/HTTP | PASS | 12 scenarios, real owner booking UI → same guest URL → draft/reload → submit → owner review/grant → access → revoke/offline/rotation; preapproval HTML/API/RSC/prefetch/URL and analytics checks; native-share AbortError simulation and unsupported clipboard fallback |
| Viewport matrix | PASS | 320/360/390/430/1440 portrait, plus landscape variants (844-wide mobile, 1440 desktop): 10 combinations for form and catalog; overflow and visible-button bounds; reduced-height input focus check |
| Manual visual inspection | PASS (limited) | Inspected generated full-page screenshots of 320px form and 390px authorized page with intentionally long names/address; no horizontal overflow/clipped actions observed. Not a full manual device acceptance run |
| Actual iOS Safari/Android Chrome, real OS keyboard and native share delivery | NOT RUN | Chromium viewport emulation and rejection simulation are not physical-device evidence |
| Hosted Preview, CI and production smoke | NOT RUN | Local built-app E2E only; no deployment performed |
| Live Kaspi/payment provider, Resend, Mobizon and paid delivery | NOT RUN | Existing code reused; no external provider/network-send acceptance test |
| Dependency security audit | FAIL (release gate) | `npm audit`: 18 advisories (2 moderate, 14 high, 2 critical, including Next and proxy-addr). Playwright is not reported vulnerable. No broad/breaking audit auto-fix was applied; advisories require separate triage before release |
| Legal sufficiency / identity verification | NOT RUN | Link possession/checkbox/original mark is not identity certification or a legal opinion |

## Reproduce locally (disposable databases only)

For ordinary manual authentication, see [Локальный вход](./local-auth.md). There is no universal demo password; production accounts are not copied into the local database.

```bash
npm ci
# Copy .env.example to .env; use a NEW local PostgreSQL UTF8 database whose
# name contains "fixture", APP_URL=http://localhost:3000, flags/key as above.
# Verify DATABASE_URL is loopback and contains no customer data FIRST.
npm run db:migrate
npm run lint
npm run typecheck
npm run test:guest-stay
RUN_GUEST_STAY_DB_TESTS=1 GUEST_STAY_FIXTURE_PATH=/absolute/private/stay-fixture.json npm run test:guest-stay:db
RUN_GUEST_STAY_DB_TESTS=1 npm run test:guest-stay:migrations
npm run build
# Separate terminal; start must load .env server flags, not just build-time env.
node --env-file=.env node_modules/next/dist/bin/next start
# Install Playwright Chromium for this machine, or set CHROMIUM_PATH.
# Never commit fixture.json: it contains synthetic test session credentials.
GUEST_STAY_FIXTURE_PATH=/absolute/private/stay-fixture.json GUEST_STAY_TEST_OUTPUT=/absolute/private/browser-results npm run test:guest-stay:browser
```

DB tests refuse non-loopback/non-fixture targets. Migration test creates/drops only its own uniquely named database (local role needs CREATEDB). Integration tests intentionally retain scoped synthetic fixtures for E2E; a second full E2E needs a fresh integration fixture. Browser screenshots can contain authorized synthetic private text; keep output outside the repository. Playwright is a pinned dev dependency, not an application/runtime feature.

Full unit command used:

```bash
node --env-file=.env --require ./scripts/test-server-preload.cjs --import tsx --test --test-concurrency=2 $(find src/lib -name '*.test.ts' -print) scripts/release-safety.test.mjs scripts/service-worker.test.mjs
```

## Preview rollout

1. Review diff, state contract, permission matrix and dependency advisories. Provision a separate UTF8 Preview database; do not point tests or Preview at production.
2. Keep flags off, apply committed migrations to that Preview database with the normal reviewed Prisma migration procedure. Verify existing private bookings/documents/communications/payments/calendar and both inventory modes first.
3. Set Preview-only stable `GUEST_STAY_SECRET` and exact HTTPS `APP_URL`. Enable features only in Preview, and existing agreement module only if needed. Run schema gate/build/CI.
4. Manually publish one deliberately sanitized unit with selected photos; verify private address/keys/Wi-Fi are not in public fields or photo content. Server cannot determine whether owner-supplied free text/photo itself reveals a code.
5. Exercise preliminary → canonical link and existing-reservation paths; document acceptance, correction, review, original-check requirement, explicit grant, same-link return, calendar edits/cancellation/checkout, revoke and key rotation. Never confuse original mark with legal identity verification.
6. On actual iOS/Android, test 320–430px, landscape, keyboard, focus/return, share cancellation, clipboard denial, downloads and bad network. Review accessibility beyond basic semantics/bounds and observed screenshots.
7. Verify no secrets in hosted logs, cache/CDN/RSC/prefetch, analytics/error reporting, public photos or client persistence. Exercise provider tests only with separately approved sandbox credentials; payment and OTP capabilities remain separate.
8. Request explicit production migration/deployment/enablement approval only after all release gates pass. This PR does not authorize those actions.

## Rollback

Disable `GUEST_STAY_ENABLED` and `PUBLIC_CATALOG_ENABLED` in the affected deployment and redeploy. If a selective rollout is being stopped, unpublish listings/revoke individual links first where possible. Keep additive tables and immutable acceptance/audit evidence; no destructive down migration or deletion of existing records. Existing private application paths remain available with flags off, including on a database missing new tables. Revocation stops future responses but cannot erase already viewed/downloaded instructions: rotate exposed real door/key/Wi-Fi credentials using the host's operational process.

## Deliberate exclusions and limitations

- No identity-document upload/storage, biometrics, automated verification, real SMS/OTP in this path, autonomous booking, date hold, catalog payment or new payment ledger.
- Preliminary GuestStay is NOT an inventory hold. Owner explicitly creates/links the canonical reservation using the existing workflow; current secondary UI uses reservation ID, not a new booking picker.
- Existing agreement module invalidates conservatively on booking/profile/rules revision changes. Owner must reissue/rebind a current bundle; historical accepted snapshots remain readable as evidence but never authorize current access.
- Public catalog limited to 90-night queries and first 100 listings, no pagination; scoped to the project's roughly 1–100-unit audience. Owner stay panel shows last 50 rows/events. Capability default lifetime is 90 days.
- Grant can reveal arrival details in advance; no separate scheduled release window. At checkout time in the unit timezone, authorization ends. Guest UI polls every 15 seconds and on focus, hides private content on pagehide/background/error; this is not remote erasure of screenshots, downloads or an already-visible page.
- Resolve dependency advisories and the pre-existing billing test/rollout mismatch before claiming a completely green release suite. Privacy retention/erasure, disaster recovery/key rotation procedure, abuse load tests, broad penetration test, legal review and all live-provider acceptance remain release work, not claims made by this PR.
