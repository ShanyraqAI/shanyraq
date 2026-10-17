# Catalog / guest stay audit (main 4526b2c)

| Area | Already exists | Extend | Create |
| --- | --- | --- | --- |
| Tenant/inventory | Hotel workspace → RentalProperty SINGLE_UNIT/GROUPED_UNITS → RoomType → Room, composite tenant FKs | Explicit Room publication; never another apartment entity | CatalogListing |
| Calendar | active PENDING/CONFIRMED/CHECKED_IN; half-open UTC business dates, staysConflict for turnover; Availability closures/min/max | Read-only period query with per-unit conflicts and type-level restrictions; timezone today | No second calendar |
| Prices | computeStayTotal + RatePlan/Rate overrides/restrictions | Explicit published rate plan or unknown total | No payment ledger |
| Room UI | private apartment profile/edit, ApartmentShare shares text, not public publication | Publication controls and public preview | Catalog pages |
| Guests/bookings | Reservation requires Guest.fullName, Guest is shared across bookings | Separate invitation submission; do NOT manufacture Guest name | Non-inventory preliminary GuestStay, optional canonical Reservation |
| Communications | room profiles contain exact address/Wi-Fi/keys; private photo bytes and templates; handoff not delivery | Secret DTO only after explicit owner grant, chosen public photo IDs only | Stable encrypted invitation capability |
| Documents | immutable GeneratedDocument snapshots, PDF renderer; AgreementBundle/Item/Event, legacy signing | Bind existing non-OTP bundle to invitation; same consent implementation, no second guest link | Review/access events |
| Payments | Kaspi methods and GuestPaymentRequest, separate deposit/balance, feature gate | Keep existing optional host payment action, never mark paid from form | No new ledger/provider |
| Authorization | CurrentMembership, section permissions, owner-only agreements, billing write guard | Live membership OWNER required for publication/review/grant/rotation; no MANAGER upgrade | No new role |
| Security | bounded JSON bodies, same-origin, DB rate limits, private response helpers, no-referrer /guest, static-only SW, fixed sitemap | Isolate /guest/stay from prior SPA analytics; no token URL path/query; no-store APIs | AES-GCM sealed random tokens, expiry/revocation, revision CAS |
| Schema gate | read-only DMMF check; payment/agreement flags default off | New-model checks only behind new flags | additive migration |

## State contract (before UI)

Publication, form (EMPTY/DRAFT/SUBMITTED/CORRECTION), review (PENDING/ACCEPTED), manual original check, owner access grant and payments are independent. Every mutation uses CAS version and serialized tenant locks. Submitted data never mutates Guest or Reservation. Preliminary stays never reserve inventory and must be explicitly linked to a matching active canonical booking before grant; collection works before linking. A canonical booking's PENDING already blocks inventory; invitations do not change it.

The same /guest/stay#<random token> persists through form/waiting/access. Fragment is not sent in HTTP request URLs. Tokens are hash-indexed and AES-GCM encrypted for authorized retrieval; key rotation without retained key invalidates retrieval. Reads do not issue tokens or acknowledgements. Revoke/rotate closes future responses, not previously seen door codes.

Public DTOs explicitly list title/description/public location/amenities/selected photo endpoint/capacity/default times/period availability/optional tariff total. Private DTOs include only this stay's form, agreed amount and accepted documents; communication profiles are queried only after access checks. No identity uploads.

Existing agreements conservatively invalidate on booking/profile/rules changes. This remains fail-closed; owner must issue/rebind a current bundle. OTP-required bundles are not attached to the no-SMS invitation path. No fake acknowledgement when the agreement flag is off.
