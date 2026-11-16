# Cue & Coffee — Snooker + Café

Next.js / TypeScript workspace for a Nepal-based snooker club and café. Phase 2 adds database-backed staff authentication, permissions, staff management and security auditing. Phase 1’s responsive shell, components and explicitly fictional dashboard remain. Phase 3 now adds live snooker sessions, versioned pricing, admin pricing approvals, pending checkout and an admin menu catalog. Café ordering, payment processing and inventory operations remain planned.

## Run locally

Requires **Node.js 24.7+** (Node 24 LTS recommended), npm and PostgreSQL. Authentication uses Node's built-in Argon2id implementation; Node 22 is no longer supported. No extra password dependency is needed.

```sh
npm ci
cp .env.example .env
npm run db:generate
docker compose up -d db
npm run db:deploy
```

In `.env`, set `APP_ORIGIN` to the exact origin you will open (default `http://localhost:3000`). Configure `DATABASE_URL`, then set `ALLOW_DEV_SEED=true`, `DEV_OWNER_EMAIL` and a unique `DEV_OWNER_PASSWORD` of 12–128 characters. Development bootstrap passwords of 8–11 characters are accepted only with a mandatory password change on first login; the replacement must have at least 12 characters. No default staff credentials are supplied.

```sh
npm run db:seed
npm run dev
```

Open http://localhost:3000/login. After seeding, remove `DEV_OWNER_PASSWORD` and disable `ALLOW_DEV_SEED`. The seed loads `.env`, refuses production, creates the development business/settings idempotently, and provisions one owner only if the business has **no staff at all**. It never overwrites credentials, changes an existing role or creates financial records. Running it again preserves existing accounts. Business selection defaults to `development-club`; production must use an intentionally provisioned business and `BUSINESS_SLUG`.

Production uses HTTPS, an explicit HTTPS `APP_ORIGIN`, and a separately provisioned initial owner through trusted database administration using `hashPassword`. Do not run the development seed against production. There is no public registration or unauthenticated password-reset endpoint.

If installation was interrupted (missing package files or truncated SWC binaries), stop the server and run `npm ci`, then remove `.next` and restart. Do not add transitive dependencies to mask an incomplete installation.

## Authentication and access

- `/login`: email/password login; generic invalid-credential responses; database-shared attempt limits.
- `/change-password`: required after account creation or administrative reset; all old sessions are revoked.
- `/staff`: owner/admin staff directory, account creation, roles, operational areas, status and temporary-password resets. Mutations require the acting administrator's current password.
- `/audit`: owner-only security events, with safe metadata and UTC timestamps.
- All operational pages are authenticated and permission checked. Direct API calls enforce the same policy; unauthenticated APIs return 401 and forbidden APIs return 403.
- Sessions last eight hours, are restored from HTTP-only cookies on refresh, and are invalidated on logout or staff security changes. No password hash or session token appears in JSON responses or client props.
- Owners/admins/managers retain the labeled sample dashboard. Cashiers/staff receive an operational overview without financial reporting.

Assigning ADMIN delegates a fixed set of daily-management capabilities. Administrators cannot manage owners or other administrators, grant ownership, or configure arbitrary permissions. STAFF starts with no operational area; assign TABLES, CAFE or BOTH explicitly. See [the full role matrix and security design](docs/permissions.md).

## Checks

```sh
npm run db:validate
npm run typecheck
npm run lint
npm test
npm run build
```

Unit and HTTP-boundary tests run without PostgreSQL. Database integration tests require a **disposable database whose name ends in `_test`**. They delete suite accounts/audit data and clear the rate-limit table in that test database. Never point them at a real workspace.

```sh
# Create snooker_cafe_test in your local PostgreSQL instance first.
export TEST_DATABASE_URL='postgresql://snooker:snooker@localhost:5432/snooker_cafe_test?schema=public'
export DATABASE_URL="$TEST_DATABASE_URL"
npm run db:deploy
npm run test:integration
```

The 15 database integration cases exercise real Prisma queries/transactions and route handlers; only the Next request cookie context and page navigation interrupts are mocked. They cover valid/invalid login, expiration, logout, disabled accounts, direct API bypass, role enforcement, staff provisioning, escalation attempts, forced password changes, session revocation and concurrent last-owner demotions.

For browser tests, use the normal **development** database and a seeded owner. Configure `E2E_OWNER_EMAIL` and `E2E_OWNER_PASSWORD`, install Chromium (`npx playwright install chromium`) and run `npm run test:e2e`. Playwright starts the server with `APP_ORIGIN=http://127.0.0.1:3000`; stop any existing server using a different origin first. Phase 1 workflows now sign in before exercising the original dashboard. Tests also check unauthenticated routes/APIs and cross-origin rejection. Repeated runs may hit intentional login limits; wait for the window or clean expired records.

In sandboxes that block Turbopack worker ports, validate the production build with `npm run build -- --webpack`.

Actual execution results and remaining runtime validation are in [docs/verification.md](docs/verification.md). A passing build does not validate database concurrency or browser behavior.

## Database and maintenance

Phase 1 models: `Business`, versioned `BusinessSettings`. Phase 2 adds `Staff`, `Session`, `LoginRateLimit`, `AuditLog`, and the `Role` / `OperationalArea` enums. Apply the committed migrations with `npm run db:deploy`; generate the client after schema changes. All timestamps are PostgreSQL `timestamptz`.

Run `npm run db:auth-cleanup` periodically to remove expired sessions and rate-limit windows. Expiration is enforced immediately even before cleanup. Audit events are intentionally retained; plan backups, retention and restricted database access before production use. There are no audit update/delete APIs.

## Project layout

- `src/app/(workspace)`: protected dashboard, future-module placeholders, staff and audit pages. URLs are unchanged.
- `src/app/login`, `src/app/change-password`: authentication screens.
- `src/app/api`: authenticated JSON routes and same-origin mutations.
- `src/lib/auth`: password hashing, validation, session/rate-limit services, permissions, page and HTTP guards.
- `src/features/staff/server`: transactional staff management.
- `src/components`: existing UI primitives, responsive shell and new auth/staff forms.
- `src/features/dashboard/fixtures.ts`: isolated fictional dashboard data.
- `prisma`: schema, migrations, guarded seed and expired-auth-data cleanup.
- `tests/integration`, `tests/e2e`: database/API and browser checks.

The orange, black and off-white theme remains. Typography uses Inter and Plus Jakarta Sans via Google Fonts with sans-serif fallbacks. Phase 3 session operations are implemented; payment settlement, café ordering logic and real financial reporting remain outside scope.


## Phase 3 — snooker operations and pricing approvals

Apply the new `20261116010000_session_pricing` migration, then configure `/pricing` and create tables in `/tables` as an owner/admin. Staff assigned table operations can run sessions and request price adjustments; only owners/admins can approve them at `/pricing-reviews`. `/session-history` preserves the original calculations and every switch/review. `/menu` manages the catalog only.

See [Phase 3 design, API, setup and limits](docs/phase3.md), [actual verification results](docs/phase3-verification.md), and [changed files](docs/phase3-files.md). The existing Phase 2 verification document is historical; Phase 3 acceptance requires the new migration and database/browser tests.
