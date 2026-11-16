# Verification — Phase 2

Executed in this workspace on 2026-11-16 with Node v25.2.1, Next 16.4.6 and Prisma 6.19.3.

| Check | Actual result |
|---|---|
| `npm run db:generate` | Passed; generated Prisma Client 6.19.3 |
| `npm run db:validate` with a placeholder local DATABASE_URL | Passed; schema is valid |
| Prisma migration diff | Passed; generated additive Phase 2 SQL from the Phase 1 schema |
| `npm run typecheck` | Passed, no errors |
| `npm run lint` | Passed, no errors or warnings |
| `npm test` | Passed: 11 tests in 4 files |
| `npm run build` | Initial run passed; final fresh Turbopack rebuild failed because its CSS worker tried to bind a port (`EPERM`) |
| `npm run build -- --webpack` | Passed on final source: optimized production build, TypeScript and route generation |
| `npm run test:integration` against explicit disposable local test URL | Failed: all 15 cases failed in database setup because localhost:5432 was unavailable; no integration assertions completed |
| Production seed guard (`NODE_ENV=production ALLOW_DEV_SEED=true npm run db:seed`) | Correctly refused execution (exit 1) before any database write |
| Local disposable PostgreSQL initialization | Blocked: `initdb` failed with `shmget ... Operation not permitted`; sandbox disallows shared-memory creation |
| `npm run test:e2e` | Blocked before tests: Next could not listen on 127.0.0.1:3000 (`EPERM`) |

The earlier incomplete dependency installation was repaired outside the Phase 2 work: the installed native SWC binary is present and the Webpack production build succeeds. The fresh Turbopack rebuild is constrained by the sandbox, not a missing SWC binding. Prisma prints a warning about the existing `package.json#prisma` configuration being deprecated for Prisma 7; the project remains on Prisma 6.

## Passing coverage

- Existing NPR formatting and Kathmandu date-boundary behavior.
- Salted native Argon2id hashing, successful verification, incorrect password rejection and invalid hash rejection.
- Owner access, admin role restrictions, staff assigned areas, cashier settlement versus reporting restrictions, and no staff settlement permissions.
- Strict server schemas and email normalization.
- Direct unauthenticated staff/read/update/audit/identity requests return 401 without querying protected data; page guards redirect to login.
- Origin/content-type/JSON/body-size protections.
- Production HTTP-only Secure host-only cookie settings and HTTPS configuration enforcement.

## Written but not runtime-verified here

The PostgreSQL integration suite covers successful and generic-failure login, hashed session storage, identity restoration, expiry, logout, disabled accounts, concurrent rate limiting, direct API bypass attempts, authorization, reauthentication, admin escalation, last-owner protection including concurrent demotions, password resets/forced change and session revocation. It calls the real API handlers and services against PostgreSQL, with Next cookie/navigation adapters mocked. Passing compilation is not evidence that these tests pass.

Browser tests retain the Phase 1 interaction checks behind owner sign-in, and add unauthenticated page/API and cross-origin checks. Browser rendering, keyboard behavior of new forms, real HTTP 403 rendering, responsive visual QA, migration application, and seed idempotency are not verified in this environment.

## Finish acceptance locally

1. Use Node 24.7+, configure `.env`, start PostgreSQL and apply both migrations using `npm run db:deploy`.
2. Provision the development owner using explicitly supplied credentials, run the seed twice, and confirm the same account/hash remains. Disable seeding and remove the bootstrap password afterwards.
3. Create a disposable database ending in `_test`, set both DATABASE_URL and TEST_DATABASE_URL to it, apply migrations, then run `npm run test:integration`.
4. Restore the development database configuration. Set E2E_OWNER_EMAIL/E2E_OWNER_PASSWORD, install Playwright Chromium and run `npm run test:e2e` with no conflicting dev server. The test server uses `http://127.0.0.1:3000` as APP_ORIGIN.
5. Verify login/refresh/logout, forced password change, owner/admin staff controls, cashier/staff denied routes, desktop/mobile layout and audit records in a browser.

Phase 2 implementation and compile/unit checks are complete. Database/browser acceptance and production deployment are not complete. Phase 3 can reuse the identity/permission services, but should not be accepted until the pending integration checks pass.
