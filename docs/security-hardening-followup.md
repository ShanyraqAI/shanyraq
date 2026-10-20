# Security remediation follow-up

> Historical snapshot. Current full-checkout results and remaining release gates are recorded in [Final security verification](security-final-verification.md); validation limitations below describe the earlier partial-checkout stage.

This continues PR #31. It supersedes the earlier remediation document's statements about remaining dev advisories, CSP and the global recorder. It is not a production acceptance or an assertion that every risk is closed.

## Changes

- Removed the unused installed shadcn CLI dependency (generated UI components are retained). Its registry/ts-morph/fast-glob chain was the largest source of development advisories. Do not reintroduce the generator until its dependency chain is reviewed.
- Scoped the `@next/eslint-plugin-next@16.4.2` `fast-glob` dependency to the pinned npm alias `tinyglobby@0.2.15`. This is an intentional, API-reviewed replacement, not an arbitrary version override: the installed Next plugin uses only `globSync(pattern, { onlyDirectories: true })` in `get-root-dirs`. Tests execute that actual plugin helper with brace/directory patterns and execute Next's no-img-element lint rule. Review/retest this override whenever upgrading Next's ESLint plugin. The Next rules were not disabled or downgraded.
- Full lockfile audit now reports **zero findings**, including development dependencies. Advisory databases can change; the CI audit remains a gate, not a permanent guarantee.
- Removed global Clarity recording and its runtime package. The previous path check started a recorder on login/register/public routes but did not stop it on client navigation to private pages. Reintroducing analytics requires explicit privacy/consent and lifecycle isolation review, not merely another pathname check.
- Added a per-request cryptographic CSP nonce in `src/proxy.ts`, forwarding the same policy to Next's renderer and the browser. Incoming nonce/CSP values are replaced. Production scripts cannot use unsafe-inline or unsafe-eval, and connect-src no longer grants arbitrary HTTPS. Guest connections stay same-origin. Inline **styles** remain permitted for React/Radix/chart compatibility. This is not a claim to have removed every unsafe-inline directive.
- Root HTML is dynamically rendered and marked private/no-store to avoid sharing per-request nonces. This intentionally trades public HTML caching for CSP safety. Next's static assets remain outside the proxy matcher.
- Rate limiting no longer trusts arbitrary x-real-ip/x-forwarded-for headers by default. On Vercel it uses the platform's x-vercel-forwarded-for header. On another platform set TRUSTED_CLIENT_IP_HEADER to an allowlisted single-address header **only if ingress overwrites it**. Comma-separated chains and invalid IPs collapse to the fail-closed unknown bucket; IPv6 is canonicalized. An unconfigured self-hosted deployment will share that bucket, so configure/test ingress before rollout.
- TTLock accepts x-ttlock-callback-token header authentication. Legacy URL-token authentication is disabled by default and requires TTLOCK_CALLBACK_ALLOW_QUERY_TOKEN=true. Do not switch a live callback without verifying provider header support or a trusted gateway. If legacy mode is unavoidable, redact URLs at every logging layer and rotate the existing token separately; this patch cannot erase historical logs. Header transport alone is not a provider signature or payload-authenticity protocol.
- TTLock bodies are byte-bounded while streaming; malformed out-of-range dates/types return 400 instead of reaching event writes. Secret-like payload fields continue to be removed.
- The read-only deployment schema gate now requires TelegramCommandReceipt; it never runs migrations.
- Added a least-privilege CI workflow using a disposable PostgreSQL service, full checkout, locked install, audit, lint/typecheck, unit/security/integration tests and build. It uses no production secrets, migrations against production, or deploy step. CI still needs to run successfully before merge.

## Validation actually performed

- Clean `npm ci --ignore-scripts --no-audit --no-fund`, Prisma generate, package/lockfile consistency and changed-source ESLint passed.
- `npm run test:security-hardening`: **16/16** passed, using actual policy/proxy/route/plugin code with mocked DB boundaries where appropriate.
- A minimal, isolated **production Next.js 16.4.2 fixture** using the same proxy/policy built successfully. Chromium verified hydration, interactive buttons and SPA navigation without CSP violations/page errors. This is not the full application's build or integration compatibility test.
- PostgreSQL **16.14**, bound only to localhost, ran `test:security-hardening:db`. Twelve concurrent duplicate deliveries committed one business mutation/receipt; different identity was rejected; thrown command work rolled back both state and receipt and then retried successfully. The synthetic business mutation uses RateLimitBucket, not a real subscription grant or payment. No Telegram/provider API was called.
- The actual Telegram receipt migration SQL was separately applied to a fresh disposable PostgreSQL database. Prisma could read/write it and a duplicate updateId was rejected. The remaining schema for the concurrency test was created with Prisma db push. **The entire historical migration chain was not executed locally.** CI must run migrate deploy on a clean service.
- Full `npm audit --package-lock-only --ignore-scripts`: **0 vulnerabilities**.
- GitHub secret-scanning API could not run: Advanced Security is not enabled. No successful full-history secret scan is claimed.

## Still gated / not done

- Full repository source/build/typecheck, existing test suites and real CI status cannot be confirmed from this partial local snapshot. GitHub check-runs access returns 403. A complete authorized checkout (or repository archive) and access to CI results are required. The earlier 43 regression tests passed in the first remediation pass; they were not rerun in this follow-up's partial snapshot.
- Paid/manual entitlement reconciliation still needs a product decision. Preserve purchased access; do not silently let /end revoke a paid subscription. Confirm whether a manual grant is an independent source of write access and which active plan supplies capacity when grants overlap paid access.
- OTP enrollment/recovery is not implemented; unsafe phone signup remains disabled. Provider selection, credentials, consent, delivery limits and recovery policy must be defined before reopening it.
- No production deployment, production migration, token rotation, paid action, live callback reconfiguration, backup restoration, branch-protection change or Channex production enablement has occurred.
- Staging acceptance, trusted ingress configuration, provider certification/fencing, distributed AI concurrency/dollar budget, secret-history scan and infrastructure/backup controls remain release requirements. Code fixes and local tests do not substitute for those checks.
