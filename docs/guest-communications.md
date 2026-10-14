# Guest communications — implementation status

This branch implements the first working vertical slice of the attached Guest Communication specification. It is **not completion of the entire specification**, and is not yet approved for production rollout.

## Verified architecture

Audited against main commit `1bbb4b1894e0d614c54ddba610a68fafbc9a025f`:

- Next.js 16.3.3 App Router, React 19, TypeScript, Tailwind v4 and the existing shadcn components.
- PostgreSQL + Prisma 6.12.0. No separate SQLite implementation was introduced.
- Existing sessions, membership permissions, Hotel workspace, RentalProperty, Room, Guest and Reservation are reused.
- Existing document generation remains unchanged; this branch does not replace it with another document system.
- Existing WhatsApp phone normalization and `wa.me` helper are reused.
- Existing light-green mobile palette, desktop palette and Sheet/Button components are reused.

## Implemented

1. `Коммуникации` in the desktop secondary navigation and the PWA `Ещё` menu, gated by RESERVATIONS permission.
2. Persistent per-unit guest-facing name, address, map link, Wi-Fi, key instructions, rules/guide links and support phone.
3. Owner-only editing; authorized reservation staff can prepare guest messages.
4. Editable templates scoped to the current workspace or a specific unit: Russian/Kazakh/English labels, draft/active/archive states, default selection, copies, optimistic version checks, immutable stored versions.
5. Five starter texts (check-in instructions, confirmation, Wi-Fi, checkout reminder, thanks). The full 16-template catalogue is not implemented yet.
6. Variable insertion at the cursor, unknown-token validation, missing-data warnings and final-message validation. No payment-status or signing variables are invented where a safe source is unavailable.
7. A full-screen mobile composer and desktop sheet from both existing reservation-detail components. Reservation, guest, unit and workspace are checked server-side.
8. Private photo upload: JPEG/PNG/WebP, maximum 4 MiB input, decoding and JPEG re-encoding, EXIF/GPS stripping, maximum 1600 px, maximum 1 MiB stored file, six active photos per unit. HEIC is explicitly unsupported.
9. Selection of photos, personalized preview, immutable DRAFT snapshot, idempotent preparation keys, and retained attachments when a photo is archived.
10. Manual `wa.me` text handoff, Web Share file handoff when supported, text copying and per-photo download fallback. Files load **before** the share tap to preserve mobile user activation.
11. The share menu does not preselect a contact or guarantee that WhatsApp transmits text and files together. The UI tells the operator to select WhatsApp and verify the contact, with copying fallback.
12. Real action history with pagination. DRAFT, MANUAL_WHATSAPP_OPENED and SHARE_RETURNED are explicitly not sent/delivered/read evidence. The manual event is operator/browser-reported, not a provider receipt.
13. Database tenant/unit foreign keys, default-template uniqueness, bounded bodies, same-origin write checks, membership checks, scope headers, rate limits, private/no-store media and JSON, audit metadata without passwords or message bodies.
14. Communication UI is marked for Clarity masking. The service worker excludes communication settings from offline page caching and upgrades its page-cache version to remove old cached pages. No communication data is put in localStorage or offline mutation queues.

## Remaining specification work

| Specification area | Status / next implementation |
| --- | --- |
| Communication overview with period metrics and upcoming missing instructions | Not implemented. The current history is an action log, not provider metrics. |
| Full starter catalogue and richer template purpose/channel settings | Partial. Extend existing template models/editor; do not add fake signing/payment variables. |
| Official WhatsApp Business Platform | Not implemented or connected. Verify current Meta documentation, implement a common channel contract and approved-template/24-hour-window policy before any automatic send. |
| Provider credentials, number/account verification and disconnect | Not implemented. Use the existing encrypted credential patterns; never store tokens in client code. |
| Signed webhooks, incoming message handling and delivery/read/error receipts | Not implemented. Manual states must never be upgraded to delivery receipts. |
| Documents, custom rules templates and document versions | Existing generated documents are retained; requested new constructor/version workflow is not implemented. |
| Guest signing links, expiring/revocable hashed tokens, evidence and immutable signed documents | Not implemented. Extend existing GeneratedDocument; do not equate a drawn/typed signature with Kazakhstan qualified EDS. |
| AI onboarding/configuration wizard | Not implemented. Existing AI support endpoint was identified; approved structured output, secret redaction and operator confirmation still required. |
| Automatic triggers, schedules, queue/retries/cancellation/deduplication | Not implemented. No fake automation switches or jobs that silently perform manual sends. |
| Communication-specific tariff entitlements/quotas | Not implemented. Technical photo/body limits are not tariff limits. |
| Archive retention and storage lifecycle | Archived photo bytes are retained for prepared message snapshots. Define a retention/deletion policy and storage quota before a broad rollout. |
| Full interface localization | Partial. Template language metadata and the mobile navigation label are supported; the communication editor currently uses Russian labels. |
| Full regression suite and device-level PWA testing | Pending full checkout, staging environment and real iOS/Android devices. |

## Migration and rollout

Migration: `20261014060000_guest_communications/migration.sql`.

The migration adds five communication tables and an additional Reservation composite unique index. It does not rename old entities, reset a database or rewrite bookings. Review the new indexes and BYTEA storage approach for the expected deployment size before applying.

1. Back up the target staging database and review the SQL.
2. Apply existing migrations and this migration **in a dedicated staging database**.
3. Generate Prisma Client and run the tests below.
4. Run the full application lint and production build in a full checkout. The existing `npm run build` invokes the migration script: never run it against production casually.
5. Test owner/staff/no-access sessions, cross-hotel switching, all photo formats/errors, cancellations, retries and actual WhatsApp handoff on iOS Safari/PWA and Android Chrome/PWA.
6. Review the complete PR, then deploy with the existing release process. This branch was not merged into main and no production migration was run.

## Reproducible tests

```sh
npm run test:communications
```

Server integration tests require a separately migrated, explicitly disposable PostgreSQL database whose name ends in `_test`:

```sh
COMMUNICATIONS_TEST_DATABASE_URL='<isolated PostgreSQL test URL>' \
COMMUNICATIONS_TEST_DISPOSABLE=1 \
npm run test:communications:db
```

No `.env` file is loaded by that test script. It overrides the Prisma URL only after validating the explicit test configuration, creates synthetic rows with a unique prefix and cleans up only its own rows. It never resets/truncates the database or deletes unrelated tenants.

## Validation performed in this session

- 12 pure tests: rendering, missing/unknown/malformed/prototype tokens, nonrecursive expansion, message bounds, phone normalization/URL encoding, HTTPS links, allowed manual states, attachment bounds and streamed request limits.
- Prisma schema validation and client generation succeeded.
- Strict TypeScript check of the new communication slice and its fetched dependencies succeeded. This is not a full-repository typecheck.
- ESLint ran on all changed TS/TSX/JS files without errors or warnings.
- The additive migration applied to a generated baseline schema in an isolated local PostgreSQL engine (PGlite). Ten checks covered cross-tenant/unit foreign keys, states, empty photos, default uniqueness, duplicate request keys and preservation of the preexisting synthetic reservation. This is not a full historical-migration-chain test.
- The real Prisma service and the committed integration-test script were run against that isolated engine through a local PostgreSQL wire bridge. Tenant guards, optimistic concurrency, immutable snapshots, template versions, idempotency, final-token checks, foreign attachments, manual states, CSRF and scoped workspace passed.
- Actual new React components were tested in a local Chromium harness with **synthetic API fixtures**, at 390px and 1280px. Profile edits, token insertion, text/photo selection, preparation, encoded WhatsApp URL and no horizontal overflow were checked. Component screenshots were inspected. This is not end-to-end authentication or an actual WhatsApp transmission.
- No real guests were contacted. No provider credentials were requested or fabricated. No production database was accessed.
- Full application build/lint, existing-booking regression, real iOS/Android share behavior, provider transmission and document signing remain unverified.
