# Minimal apartment catalog / phone editor

This follow-up implements the owner's visual-reference request without turning the product into a booking marketplace or copying an unrelated landing/navigation system.

## Guest view

- Direct catalog entry, not an introductory landing page. No dashboard shell, notifications, burger, favorites, account tabs or bottom navigation.
- Warm Shanyraq green/ivory palette is scoped to the catalog component; no global application redesign.
- Photo-first cards: selected cover, title (two-line preview), public area, capacity, concise description and owner-provided advantages. A card opens the apartment itself.
- Apartment page: large swipe/scroll-snap gallery, arrows, keyboard controls and thumbnails; full description, advantages, arrival/departure facts, optional host contact. No fabricated amenities or placeholder stock photography in production.
- Dates/guest count live in a collapsible control. On the apartment page the gallery comes first; the filter sits with the facts. Existing full-period availability/pricing is reused. Selection is retained in the URL between catalog and apartment.
- No booking, payment or inventory-hold action. No extra bottom menu or sticky CTA bar. Publication remains explicitly opt-in.

## Owner: no site builder required

Open **Квартиры → квартира → Настроить страницу квартиры**. Dedicated authenticated route: `/dashboard/rooms/[roomId]/catalog`.

1. Upload one or several photos directly from the phone using the existing protected upload API. Up to six images, JPEG/PNG/WebP, 4 MB each; existing image decoding/re-encoding strips GPS/EXIF. HEIC is explicitly not supported. No third-party image storage integration was added.
2. Choose which images are public, reorder them with direct buttons and choose the cover. Inline confirmation can remove an image from the shared apartment photo library (and future messages); immutable prepared messages keep their existing attachments. Just hiding an image from the catalog is the non-destructive checkbox action.
3. Enter a title, area and description. Tap common advantages only when true, or write custom advantages one per line. Existing text is not replaced by invented defaults.
4. Optional contact link, existing tariff and rules are in a secondary expandable section.
5. Check public-content safety, then save a private draft or enable **Показывать в каталоге** and save/publish. Upload alone never publishes a file. Reload retains saved content; upload/error does not reset unsaved description/advantages. Preview clearly shows the saved version, not unsaved changes.

Owner-only preview photos are authorized separately: live OWNER membership + exact tenant, even if the listing is unpublished. Adding `?preview=true` never grants a guest or another tenant access. Public photo URLs still require a published listing and a selected, non-archived photo. Both responses are no-store; preview responses vary by cookie.

No new database tables, migrations, feature flags, production enablement or application dependencies were required for this design follow-up. Existing release blockers in `release.md` remain.

## Reproduce acceptance

Run the existing isolated PostgreSQL fixture generator first, with a fresh `GUEST_STAY_FIXTURE_PATH` on every complete E2E retry. Then start the production build locally with `.env` loaded:

```bash
npm run lint
npm run typecheck
npm run test:guest-stay
RUN_GUEST_STAY_DB_TESTS=1 GUEST_STAY_FIXTURE_PATH=/absolute/private/catalog-fixture.json npm run test:guest-stay:db
npm run build
node --env-file=.env node_modules/next/dist/bin/next start
# Separate terminal; provide system Chromium or install Playwright Chromium.
CHROMIUM_PATH=/path/to/chromium GUEST_STAY_FIXTURE_PATH=/absolute/private/catalog-fixture.json CATALOG_TEST_OUTPUT=/absolute/private/catalog-browser npm run test:catalog:browser
```

`test-catalog-browser.mjs` uses real HTTP/Prisma-backed application flows: unauthenticated denial; phone editing and upload/reorder; draft/reload; protected unpublished-photo preview; explicit publication; no public app menus; gallery/description/advantages; 320/360/390/430/768/1440 widths on catalog/detail/editor; existing availability and URL selection retention; oversized-file error preserving edits; removal; unpublication blocking both JSON and image bytes. Browser fixtures use existing repository imagery as clearly synthetic local test data, never as production apartment photos.

## Local acceptance results

- Production build, repository-wide ESLint and TypeScript: PASS.
- Full unit suite: 255 PASS, 4 intentional SKIP, 0 FAIL (259 total).
- Real isolated PostgreSQL guest-stay suite: 34 PASS, including authenticated unpublished-photo preview and cross-tenant denial.
- Built-app catalog/editor browser suite: 10 scenario groups PASS. All three routes fit 320/360/390/430/768/1440 px (18 route/width combinations); expanded apartment filters also fit every width, including usable date inputs in the desktop sidebar.
- Existing guest-stay browser regression: 12 scenarios PASS and 10 viewport checks PASS.
- Representative generated screenshots were visually reviewed for phone catalog/detail/editor and desktop list/detail. Test-only imagery and deliberately hostile/long fixture text are not production listing content.

All runs used disposable loopback PostgreSQL and local production-built Chromium. Physical iOS/Android, native photo picker/keyboard, hosted Preview/CI and live-provider tests were NOT RUN. No merge, production migration, deployment or flag enablement was performed. The pre-existing dependency advisories and billing-test/disabled-feature mismatch documented in `release.md` remain unresolved; these local passes are not a production-readiness claim.
