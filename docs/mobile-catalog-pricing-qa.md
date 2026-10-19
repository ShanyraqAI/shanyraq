# Mobile catalogue, navigation and nightly pricing

## Changes

- Permission-aware mobile tabs: overview, calendar, bookings, apartments, More. Apartment descendants retain the apartment selection; secondary pages retain More. The sidebar uses the same navigation permission helper.
- More shows only allowed sections. Cleaning opens a real status filter. Payments opens `reports?tab=payments`; report and payment links no longer activate together.
- Mobile header exposes the current property switcher, search and existing notification centre. A successful property switch forces a fresh tenant page. Self-service profile and support are reachable without granting administrative settings rights.
- Apartment catalogue displays the first uploaded, non-archived private communication photo, property status, capacity, floor and base nightly price. Search and server-backed ready/cleaning/repair filters have explicit empty states. Missing, forbidden and failed photos are distinguished. No stock photos or invented apartment records are persisted.
- Existing photo endpoint permissions remain unchanged: only members with RESERVATIONS can read private communication photos, even when they can read ROOMS. Only photo IDs, never photo bytes, enter catalogue props. Owners can upload existing property photos through the property detail/edit workflow.
- Mobile creation and the existing manual-price dialog accept nightly or whole-stay prices. Nightly edits recalculate on date changes; whole-stay edits preserve the total. Switching the displayed basis does not mutate the exact original total through average-price rounding. Tariff reset restores the quoted total. Deposit stays separate. Existing server-side MANUAL pricing and authorization are reused; no database migration.
- Larger touch controls, mobile caption contrast, explicit calendar status labels/legend, keyboard search and wider tablet content. Localized navigation labels in RU/KK. Existing legacy screens are not fully relocalized or redesigned.

## Automated checks performed

```sh
npx tsx --test src/lib/navigation.test.ts src/lib/reservations/manual-price.test.ts
```

Nine tests passed: local decimal separators/minor units, invalid input, nightly multiplication/date changes, whole-stay total preservation, exact tariff total, zero/cap validation, permission filtering, query-driven payments selection and descendant navigation.

Next core-web-vitals + TypeScript ESLint configuration passed on changed TS/TSX files (no errors or warnings). `git diff --check` passed.

Isolated local component browser smoke checks at 320/390/768px: apartment cover failure/missing/restricted states, long property names, catalogue empty search, limited staff tabs, RU/KK pricing/navigation, calendar status legend, nightly editing/recalculation, whole-stay mode, empty invalid amount, exact tariff reset and mobile search expansion/Escape. No page-wide horizontal overflow or runtime exceptions in that harness. Screenshots visually inspected. Desktop pricing field also visually inspected at 1440px.

**Scope of these checks:** the harness rendered the changed client components with local navigation/server/UI adapters and test-only inventory. This was not a running authenticated Next application, a full production build, or an end-to-end database test. No working database was connected and no deployment was performed.

## Required integration checks before merge

- Run the repository's full lint, TypeScript/build and regression suites with its locked dependencies and generated Prisma client. The local workspace used for these changes was a partial source checkout.
- Verify apartment cover responses with real uploaded photos and owner/limited-member sessions; confirm cross-tenant photo requests remain forbidden, failed images show fallback, and no private photo enters a shared image optimizer/cache.
- Check More/sidebar/bottom-tab visibility against OVERVIEW-only, CALENDAR-only, ROOMS-only, RESERVATIONS-only, custom mixed, FULL and OWNER memberships.
- Switch between two properties with different permission sets. Confirm previous property search results, catalogue, offline data and navigation are cleared/refetched.
- Create a booking using a nightly price, change dates and submit; reload detail and verify the persisted total. Repeat whole-stay manual mode, tariff reset, edit booking, rate-plan overrides, paid/deposit cases and offline queue replay. Confirm server still rejects unavailable rooms and invalid payloads.
- Check real global-search/notification overlays, full-screen dialogs, calendar expansion and bottom safe-area spacing on iOS/Android and tablet; test keyboard/zoom and the existing dark theme. These complete routes/overlays were not integration-tested locally.
- Existing design PNG/SVG concepts were references only and were not rewritten. This change does not constitute a complete re-audit of every legacy screen or every reported UX concern.
