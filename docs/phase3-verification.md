# Phase 3 verification — 2026-11-16

| Check | Actual result |
|---|---|
| Prisma generation | Passed, Client 6.19.3 generated |
| Prisma schema validation | Passed |
| TypeScript | Passed |
| ESLint | Passed |
| Unit tests | 20 passed in 6 files (9 new Phase 3 cases) |
| Production Webpack build | Passed with all new page/API routes |
| Migration deploy | Failed P1001: PostgreSQL at localhost:5432 is unreachable from this environment |
| Database integration tests | 28 failed in setup: 15 Phase 2 and 13 Phase 3 tests; no database assertions completed |
| Phase 3 Playwright test | Blocked before execution: test server cannot listen on 127.0.0.1:3103 (EPERM) |

No successful migration application, PostgreSQL concurrency/trigger validation, browser rendering or visual QA is claimed. Schema validation and source review do not validate raw SQL execution. The prior Prisma 6 package.json configuration deprecation warning is unrelated to connectivity.

Passing new unit coverage: thirty-minute hourly calculation, explicit frame counts (including zero), multiple-rate segments, paused-time exclusion and milliseconds, positive/negative adjustment differences, Decimal precision/half-up rounding, reason/amount/approver validation, and OWNER/ADMIN-only pricing/catalog permissions.

Written database coverage: staff switch/finish, 400 reference / 350 approval, automatic table release, one pending checkout, approval queue, pause/switch interactions, global-rate snapshots, missing frame counts, validation/unauthorized direct HTTP requests, rejection/cancellation, duplicate request handling, concurrent starts/finalizations/approvals, immutable history, checkout constraints, and archived catalog records.

The browser scenario uses a deterministic server test clock: starts hourly, advances precisely 30 minutes, switches to frame-wise, records two frames, finishes at Rs. 400, requests Rs. 350, logs out, logs in as an admin, approves with a reason, and checks the preserved reference, audit, pending checkout and available table. It must pass against a migrated disposable database before Phase 3 runtime acceptance.


An intermediate run overlapped the production build with type checking and unit tests: TypeScript encountered generated files being rewritten and the existing Argon2 test exceeded its five-second timeout under build load. Running the checks after the build completed passed (20/20 tests, type check clean). Run the production build separately from standalone type checking; both use `.next/types`.
