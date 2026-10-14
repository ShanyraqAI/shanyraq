# Guest communications — implementation status

This branch implements the first working vertical slice of the attached Guest Communication specification. It is **not completion of the entire specification**, and is not yet approved for production rollout.

## Verified architecture

Audited against main commit `1bbb4b1894e0d614c54ddba610a68fafbc9a025f`:

- Next.js 16.3.3 App Router, React 19, TypeScript, Tailwind v4 and the existing shadcn components.
- PostgreSQL + Prisma 6.12.0. No separate SQLite implementation was introduced.
- Existing sessions, membership permissions, Hotel workspace, RentalProperty, Room, Guest and Reservation are reused.
- Existing document generation is reused. Signing requests freeze the complete generated PDF rather than replacing the document system.
- Existing phone normalization is retained for display. A valid guest phone is no longer required for manual sharing.
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
10. A single «Отправить» button invokes native Web Share for text-only and text-with-photos messages. The operating system lists available applications. Text copying and per-photo downloads are explicit fallbacks. Files load **before** the share tap to preserve mobile user activation.
11. The share menu does not preselect a contact or guarantee that the selected application transmits text and files together. The operator selects WhatsApp, Telegram or another available app and verifies the recipient. If file sharing is unsupported, only text is shared and photos can be downloaded.
12. Real action history with pagination. DRAFT, MANUAL_WHATSAPP_OPENED and SHARE_RETURNED are explicitly not sent/delivered/read evidence. The manual event is operator/browser-reported, not a provider receipt.
13. Database tenant/unit foreign keys, default-template uniqueness, bounded bodies, same-origin write checks, membership checks, scope headers, rate limits, private/no-store media and JSON, audit metadata without passwords or message bodies.
14. Communication UI is marked for Clarity masking. The service worker excludes communication settings from offline page caching and upgrades its page-cache version to remove old cached pages. No communication data is put in localStorage or offline mutation queues.

## Latest scope clarification: sharing and signing

The user explicitly removed the requirement for an official WhatsApp integration. Provider credentials, Business API setup, webhooks and provider delivery receipts are **out of scope**, not prerequisites or pending setup. No automatic send is implemented or implied.

- On step 2 of «Сообщение гостю», opt into «Добавить ссылку на документ» and open «Документ для онлайн-подписания», choose an existing PDF generated for this reservation, set its link lifetime (1–14 days) and create the link. It is appended to the final message preview without overwriting the editable source text.
- If no PDF exists, create it with the existing «Документы» button first. New links replace earlier pending links for the same document; the composer uses the latest issued link in the final preview rather than appending a stale one.
- Guest page: `/guest/documents#<capability>`, no account required. The full original PDF must be opened before UI consent controls become available. Opening is an operator action, **not proof that the guest read every page**.
- Signing requires a typed name, two unchecked-by-default explicit confirmations, the frozen PDF hash and the known consent version in a deliberate POST. Loading, link previews and downloading PDF cannot sign.
- This is self-asserted consent by the holder of a link, **not Kazakhstan qualified EDS and not verified identity**. The UI says so before signing. Legal suitability of this confirmation for a specific contract must be reviewed independently.
- The original PDF bytes and SHA-256 are frozen when the link is issued. Consent version/text, declared name, UTC signing time, document ID, original PDF hash and an evidence checksum are stored separately. Staff and the guest can download a JSON confirmation; the original PDF does not acquire a cryptographic signature.
- Tokens are server-generated 256-bit random values; the signing table stores only their SHA-256. The capability stays in a URL fragment and guest API POST bodies, never URL paths/queries or audit metadata. The authorized outbound message snapshot necessarily contains its link; treat those private snapshots as sensitive. Raw capabilities are shown only at issuance, not retrievable from signing history.
- Reissue/revoke, expiry, unsigned reservation modification and cancellation invalidate access. Signing locks the request and reservation to serialize with edits/cancellation. Signed evidence remains stored; expiry/revocation blocks guest access but does not delete the staff evidence.
- Guest responses/page are no-store, no-referrer, noindex. Guest CSP excludes third-party scripts/connections. The service worker does not cache guest pages or API data. Links should be opened as full navigations from the selected messaging app, not embedded in analytics-enabled public pages.
- Tenant permissions and scope checks apply to issuance, revocation and staff evidence access. The server checks an inserted signing request is still valid before preparing the message. The OS share operation is not evidence of sending/delivery or of who received it.

## Guided mobile UX and actionable setup failures

- The default Communications tab is «Отправка». Its three-step guide and booking shortcut remain available even if workspace data cannot load.
- The composer separates Text → Optional additions → Review/send. Ready text is personalized from the reservation; the standard check-in text omits absent optional values rather than inventing them. Active saved defaults remain selectable.
- «Свой текст» starts a separate draft; toggling modes and returning between steps do not erase it. Copying ready text over an existing own draft requires an explicit replacement choice, including when editing from review. Drafts remain only in the open editor, not localStorage; closing/reloading does not persist them.
- Photos and signing links are optional and selected deliberately. The final preview shows the actual immutable prepared message. Back/edit resets its preparation key while keeping operator choices; retries of unchanged preparation remain idempotent.
- Template creation has two steps: text, then name/unit/default settings. New templates are active by default; language and archive/draft settings are optional advanced controls. Existing template status is preserved on edit.
- The sheet has a scrollable content region and a separate safe-area-aware action footer, not an overlapping sticky button. Form controls and main tap targets are at least 44px tall.
- Missing tables/columns, database configuration, temporary connectivity and authorization failures have distinct safe responses. The UI provides incident references and owner-only setup guidance without exposing ORM exceptions, SQL or credentials.
- `scripts/check-communications-schema.mjs` is a **read-only** Vercel build gate. It checks the six feature models' generated scalar/enum columns and nullable recipient phone. It does not certify every constraint/index or run migrations. A missing schema fails the build rather than publishing a known-broken feature.
- Preview migrations are intentionally not automatic. Configure a separate preview database, apply reviewed migrations to that database explicitly, and set the preview HTTPS `APP_URL`. Do not change production to repair a preview. The existing production migration behavior is unchanged.
- The screenshot's live error has not been reproduced against its Vercel environment. Missing migrations are a possible explanation, not a verified diagnosis; the actual preview URL and server incident/logs are still needed.

## Remaining original specification work

| Specification area | Status / next implementation |
| --- | --- |
| Communication overview with period metrics and upcoming missing instructions | Not implemented. The current history is an action log, not provider metrics. |
| Full starter catalogue and richer template purpose/channel settings | Partial. Extend existing template models/editor; do not add fake signing/payment variables. |
| Official WhatsApp Business Platform | Removed from scope by the user. No integration or credentials required. |
| Provider credentials, number/account verification and disconnect | Removed from scope. |
| Signed webhooks, incoming message handling and delivery/read/error receipts | Removed from scope; manual states are not provider receipts. |
| Documents, custom rules templates and document versions | Existing generated documents are retained; requested new constructor/version workflow is not implemented. |
| Guest signing links | Implemented for existing generated PDFs with expiry/revocation, frozen original PDF and separate consent evidence. No qualified EDS or identity verification. |
| AI onboarding/configuration wizard | Not implemented. Existing AI support endpoint was identified; approved structured output, secret redaction and operator confirmation still required. |
| Automatic triggers, schedules, queue/retries/cancellation/deduplication | Not implemented. No fake automation switches or jobs that silently perform manual sends. |
| Communication-specific tariff entitlements/quotas | Not implemented. Technical photo/body limits are not tariff limits. |
| Archive retention and storage lifecycle | Archived photo bytes are retained for prepared message snapshots. Define a retention/deletion policy and storage quota before a broad rollout. |
| Full interface localization | Partial. Template language metadata and the mobile navigation label are supported; the communication editor currently uses Russian labels. |
| Full regression suite and device-level PWA testing | Pending full checkout, staging environment and real iOS/Android devices. |

## Migration and rollout

Migrations: `20261014060000_guest_communications/migration.sql` and `20261014070000_document_signing_links/migration.sql`.

The first migration adds five communication tables and an additional Reservation composite unique index. It does not rename old entities, reset a database or rewrite bookings. Review the new indexes and BYTEA storage approach for the expected deployment size before applying.

The second migration adds DocumentSigningRequest and its tenant/document foreign keys and constraints, a GeneratedDocument composite index, and makes the communication phone nullable. Set `APP_URL` to the canonical **HTTPS** staging/production origin (HTTP is accepted only for localhost development). Review BYTEA retention/storage limits and back up evidence before rollout.

1. Back up the target staging database and review the SQL.
2. Apply existing migrations and this migration **in a dedicated staging database**.
3. Generate Prisma Client and run the tests below.
4. Run the full application lint and production build in a full checkout. The existing `npm run build` invokes the migration script: never run it against production casually.
5. Test owner/staff/no-access sessions, cross-hotel switching, all photo formats/errors, cancellations, retries and actual WhatsApp handoff on iOS Safari/PWA and Android Chrome/PWA.
6. Review the complete PR, then deploy with the existing release process. This branch was not merged into main and no production migration was run.

## Reproducible tests

```sh
npm run test:communications
npm run test:document-signing
```

Server integration tests require a separately migrated, explicitly disposable PostgreSQL database whose name ends in `_test`:

```sh
COMMUNICATIONS_TEST_DATABASE_URL='<isolated PostgreSQL test URL>' \
COMMUNICATIONS_TEST_DISPOSABLE=1 \
npm run test:communications:db
```

No `.env` file is loaded by that test script. It overrides the Prisma URL only after validating the explicit test configuration, creates synthetic rows with a unique prefix and cleans up only its own rows. It never resets/truncates the database or deletes unrelated tenants.

## Validation performed in this session

- 24 pure tests (20 communications + 4 signing security tests): rendering, missing/unknown/malformed/prototype tokens, nonrecursive expansion, message bounds, phone normalization/URL encoding, HTTPS links, allowed manual states, attachment bounds and streamed request limits.
- New pure checks also cover optional-value automatic text, saved vs built-in template IDs, source-text immutability, link deduplication, safe database-error classification and preservation of typed API errors.
- Prisma schema validation and client generation succeeded.
- Strict TypeScript check of the new communication slice and its fetched dependencies succeeded. This is not a full-repository typecheck.
- ESLint ran on all changed TS/TSX/JS files without errors or warnings.
- The additive migration applied to a generated baseline schema in an isolated local PostgreSQL engine (PGlite). Ten checks covered cross-tenant/unit foreign keys, states, empty photos, default uniqueness, duplicate request keys and preservation of the preexisting synthetic reservation. This is not a full historical-migration-chain test.
- The real Prisma service and the committed integration-test script were run against that isolated engine through a local PostgreSQL wire bridge. Tenant guards, optimistic concurrency, immutable snapshots, template versions, idempotency, final-token checks, foreign attachments, manual states, CSRF and scoped workspace passed.
- Actual new React components were tested in a local Chromium harness with **synthetic API fixtures**, at 390px and 1280px. Profile edits, token insertion, text/photo selection, preparation, native text-only/file sharing, signing-link insertion, explicit guest consent, signed state and no horizontal overflow were checked. Component screenshots were inspected. This is not end-to-end authentication or an actual WhatsApp transmission.
- Signing integration tests passed: actual original PDF rendering/hash, no signing on load, explicit consent required, idempotent signing, immutable PDF after signing, tenant isolation, replacement/revocation, cancellation and expiry. Tests used synthetic guests and the isolated local PostgreSQL engine, not production.
- The updated wizard was tested with synthetic API fixtures: ready/custom retention (including edit from review), two-step active/default template save, optional photo/link selection, fresh preparation keys after edits, text-only fallback, safe setup errors, and no mobile/desktop horizontal overflow. The scroll region was checked not to overlap the action footer. Mobile and desktop screenshots were inspected; native sharing was mocked, not performed on real devices.
- The read-only deployment gate passed against the isolated migrated schema and failed as expected against a separate pre-feature baseline. No migrations or guest-row queries were performed by the gate.
- No real guests were contacted. No provider credentials were requested or fabricated. No production database was accessed.
- Full application build/lint, full historical migrations, existing-booking regression and real iOS/Android app transmission remain unverified. No production deployment or migrations were performed.
