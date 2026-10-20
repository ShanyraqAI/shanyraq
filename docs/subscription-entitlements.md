# Independent manual and paid access

Confirmed owner policy: a manual grant independently enables access; `/end` cancels only manual grants and must never revoke a purchased subscription.

## Rules

- Online trial/paid access and manual grants are independent sources. Write access exists while at least one source is active.
- A grant starts inclusively at `startsAt` and expires exclusively at `endsAt`. Queued renewals do not enable a future plan early.
- Paid and manual deadlines are never added together or copied between tables. The displayed effective deadline is the latest active entitlement deadline.
- Overlapping active plan limits are not summed. The larger already-granted capacity is retained, so neither a smaller manual plan nor a smaller purchased plan silently removes the other source's rights. When a source expires or is cancelled, only the remaining source supplies capacity.
- `/end` and the admin cancellation button end current and queued manual grants. They do not update `BillingSubscription`, `BillingPayment`, trial dates or purchased plan/duration. Repeated cancellation is harmless; duplicate Telegram update delivery replays its stored response.
- Organization locking serializes manual changes, financial activation and room-capacity checks. Command lookups reuse the command transaction rather than borrowing another pool connection.
- Existing rollout safeguards remain: billing enforcement stays off in closed beta and for grandfathered accounts. This patch does not enable live billing or a new production restriction.

## Consistent presentation

The dashboard and billing page use the same effective access resolver as write authorization. The dashboard shows one effective-access banner instead of contradictory manual-expired and paid-active banners. Administrative controls explicitly say "manual grant" and keep cancellation available only for grants, not paid-only subscriptions. Billing reminder deadlines account for active grants rather than claiming access has ended solely because online billing expired.

## Validation scope

Pure tests cover independent sources, boundaries, future grants, deadlines and maximum-not-summed capacities. Opt-in disposable PostgreSQL tests exercise the actual write guard and room-capacity guard, six concurrent duplicate `/end` handlers through the real receipt transaction, unchanged paid records, cancellation of queued renewals, expiry of all sources and the unchanged closed-beta kill switch. No Telegram send, payment-provider request or production database is involved.
