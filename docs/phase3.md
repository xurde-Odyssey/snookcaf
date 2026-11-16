# Phase 3 — sessions, pricing history and admin adjustments

## Scope and repository inspection

The repository contained Phase 2 identity/RBAC and Phase 1 sample UI, but no Phase 3 tables, menu, session, pricing or checkout implementation. This change adds that foundation in the existing App Router / Prisma / server-service architecture. The authentication model `Session` remains unchanged; play sessions are named `SnookerSession` to avoid confusing identity sessions with play.

Implemented: admin table/menu catalog CRUD using archive/restore rather than permanent deletion; global versioned hourly/frame rates; fixed table default play type; running/paused play sessions; atomic type switches; frame entry at completion; pending checkout; proposals; admin approval/rejection; requester cancellation; complete per-session pricing history. No café ordering, payments, refunds, receipts or “Paid” status is added.

## Setup

Use Node 24.7+ and PostgreSQL, with the existing `.env` settings. Apply the migration as the database owner (the SQL uses the trusted `btree_gist` extension):

```sh
npm run db:generate
npm run db:deploy
npm run db:seed # Development bootstrap only, if not already provisioned.
npm run dev
```

Sign in as an owner/admin. Set **Play rates** at `/pricing`, then add tables at `/tables`. No rates or sample operational records are silently seeded. Existing users, roles, credentials, business settings and dashboard fixtures are preserved. The prior “Workspace is not configured” error still requires a successful business/owner seed in the connected development database; this phase does not bypass login or automatically provision identities.

## Data and migration

Migration: `prisma/migrations/20261116010000_session_pricing/migration.sql`.

- `SnookerTable`: business-scoped number, name, fixed default type, archive timestamp.
- `MenuItem`: editable name/Decimal price and archive timestamp; catalog only.
- `PricingVersion`: append-only, per-business versioned hourly/frame rates and actor.
- `SnookerSession`: table-number snapshot, starter, original/current type, revision, lifecycle timestamps, calculated reference, approved amount/difference/reason/actor/time.
- `SessionPricingSegment`: sequence, saved pricing version and rate, type, timestamps, active clock, billable seconds, frames and calculated amount.
- `SessionAdjustment`: immutable proposal details, requester, proposed amount/reason, reference, review decision, actual approving amount, reviewer/time/reason. Completed review records cannot be rewritten.
- `PendingCheckout`: exactly one per finished session, reference, nullable payable amount, PENDING or AWAITING_APPROVAL.
- `SessionPricingEvent`: append-only actor/timestamp/allowlisted metadata history. Also mirrored to existing AuditLog.
- `OperationReceipt`: immutable idempotency key/fingerprint/result ID scoped to the business.

SQL adds a partial unique active-session index per table, one open segment per session, one requested/one approved adjustment per session, and a GiST exclusion constraint over segment timestamp ranges. Checks reject negative values and inconsistent review metadata. Triggers prevent rewriting saved rates, closed calculations, finalized reference amounts, accepted approvals, events and Phase 3 audit entries. Closed frame segments can receive their initially missing frame count/calculation exactly once at finalization. Deferred constraint triggers validate finalized reference sums, pending requests, approval records and checkout/session agreement at transaction commit.

The exclusion and deferred-constraint design follows PostgreSQL's [range constraints](https://www.postgresql.org/docs/15/rangetypes.html) and [constraint trigger semantics](https://www.postgresql.org/docs/15/sql-createtrigger.html). The SQL was source-reviewed but could not be applied in this sandbox; runtime migration/constraint verification remains required.

## Calculation policy

All server monetary calculations use Prisma Decimal. API money inputs are decimal strings, nonnegative, at most two fractional digits, capped at Rs. 99,999,999.99. Frames are integers from 0 through 10,000 per segment; zero completed frames is explicit, never inferred. A session supports up to 100 segments.

Hourly active milliseconds are converted to Decimal seconds, accumulated on pause, switch or finish, and multiplied by the segment's saved hourly rate / 3600. Pauses clear `activeSince`; resume starts a new active interval. Switching while paused does not restart the clock. Frame-wise segments use entered counts and their saved frame rate; elapsed time never becomes a frame count.

Round each completed segment once to two decimals using ROUND_HALF_UP, then sum those rounded components. There is no minimum duration, rounding up to a whole hour, or automatic discount. New rates affect new segments only; changing global rates never changes an existing open or closed snapshot.

Example:

| Segment | Calculation | Reference |
|---|---|---:|
| Hourly | 1,800 seconds × Rs. 400 / 3,600 | Rs. 200.00 |
| Frame-wise | 2 frames × Rs. 100 | Rs. 200.00 |
| Total | Sum of saved segments | Rs. 400.00 |
| Admin approval | Explicit final charge and reason | Rs. 350.00 |
| Difference | 350 − 400 | −Rs. 50.00 |

`calculatedAmount` remains 400.00, `approvedFinalAmount` becomes 350.00, and the one checkout becomes PENDING for 350.00. Without a custom approval, approvedFinalAmount stays null and the pending checkout uses the reference total. This distinguishes “no adjustment” from a manually approved charge.

## Lifecycle and approvals

1. Starting uses the table's default play type and current global rate snapshot. Archived or occupied tables cannot start sessions.
2. Staff with table-operation access may pause/resume/switch. A switch atomically closes the current segment, records its type and duration/calculation, creates the next snapshot and records old/new types. Closed frame segments can await completion counts; the switch itself never adjusts charges.
3. Finish requires a count for every frame segment. All segments close, reference totals are computed, an outstanding checkout is created and the table is released atomically.
4. Ordinary finish moves directly to PENDING_CHECKOUT at the reference amount, with no admin approval needed.
5. Finish with a proposal moves to PENDING_REVIEW / AWAITING_APPROVAL. Checkout `amount` remains null; its reference obligation is retained. The table is still available for new play.
6. A proposal can also be made after ordinary finalization while the checkout is still unadjusted. It moves that same checkout to AWAITING_APPROVAL; no second checkout is created.
7. An owner/admin signs into their own account, opens `/pricing-reviews`, reviews all segments and enters an explicit amount and nonempty reason. The server records the current authenticated approver; approver IDs and permissions from the browser are rejected.
8. **Use Calculated Amount** rejects the proposal and restores reference pricing. The requester may cancel their own pending proposal, also restoring the full reference. Both decisions are audited. A dialog's Cancel / Return button only closes the dialog; it does not cancel approval state.
9. Approved custom amounts are final for Phase 3 and cannot be silently rewritten or proposed again. Every past proposal/rejection/cancellation remains visible.

A table is available whenever it has no RUNNING/PAUSED session. Availability is derived, avoiding a separate stale table-status flag. Archived tables retain sessions and cannot be edited/archived while occupied.

## Permissions and endpoints

New `session.adjust_final_charge`: OWNER/ADMIN only. MANAGER/CASHIER/STAFF cannot approve/reject pricing, even by direct requests. There is no new custom-grant editor; the existing fixed role policy is preserved. `tables.operate` continues to control starts, pauses, switches, finishes and proposals, including STAFF explicitly assigned TABLES/BOTH. `tables.view` controls full session history. New `tables.manage`, `menu.manage`, `pricing.manage` default to OWNER/ADMIN only.

| Endpoint | Operation and permission |
|---|---|
| GET `/api/snooker/catalog?kind=tables` | Table availability and active session details; tables.view |
| GET `/api/snooker/catalog?kind=menu` | Menu including archived items; menu.manage |
| GET `/api/snooker/catalog?kind=pricing` | Latest 50 pricing versions; pricing.manage |
| POST `/api/snooker/catalog` | table.create/update, menu.create/update, pricing.set; corresponding manage permission |
| GET `/api/snooker/sessions` | Latest 100 sessions with complete segment/event history; tables.view |
| GET `/api/snooker/sessions?review=true` | Latest 100 pending reviews; session.adjust_final_charge |
| POST `/api/snooker/sessions` | Start with tableId and requestId; tables.operate |
| GET `/api/snooker/sessions/[id]` | Business-scoped full details; tables.view |
| POST `/api/snooker/sessions/[id]` | pause/resume/switch/finish/propose/cancel or admin approve/reject |

Every mutation accepts a UUID `requestId`; session commands also require the last observed `revision`. Unknown fields are rejected. Approval takes `adjustmentId`, `amount` (string), and `reason`. Finish takes `frames: [{segmentId, count}]` and optionally `proposal: {amount, reason}`. No endpoint accepts an authoritative clock, applied rate, reference calculation, staff role or approver identity from the browser.

All writes reuse the business-row transaction lock already used by identity updates. Current session/role is checked again inside the lock, preventing races with deactivation and role revocation. Coarse per-business serialization is intentional for this phase. Revision checks reject stale commands, and immutable receipts make exact retries safe. Reusing a key for a different request/actor/target returns 409. Exact retries return the session's current state rather than creating duplicate segments, approvals or checkouts. Client mutations retain the request key after a network failure.

## UI routes

- `/tables`: available/occupied/paused/archived tables, admin CRUD, start, pause/resume, switch, frame entry and finish.
- `/pricing`: global rates with append-only rate history.
- `/menu`: admin menu catalog create/edit/archive/restore.
- `/session-history`: recent sessions, complete segment breakdown, proposal/review history, timeline and outstanding checkout.
- `/pricing-reviews`: admin queue and approval dialog.

All pages use existing shell, Button, Radix Modal, typography and orange/black/off-white styles. The sidebar now scrolls to accommodate the new destinations. Forms expose pending/error/empty states. No “Paid” label or payment button exists in these workspaces.

## Testing and limitations

See [Phase 3 verification](phase3-verification.md) for actual results. Tests include arithmetic, permissions, validation, real-PostgreSQL services/route handlers, concurrent operations and database constraints. The deterministic browser test drives the full 400 → 350 flow with separate staff/admin logins.

Run database tests only against a dedicated database ending in `_test`; apply all migrations there first. Phase 3 tests create uniquely named businesses and retain immutable audit records. Drop/recreate the disposable database between test runs when desired; do not disable history triggers. The legacy Phase 2 suite still clears its test accounts and rate limits, so never run these suites against production or a shared active workspace.

```sh
export TEST_DATABASE_URL='postgresql://snooker:snooker@localhost:5432/snooker_cafe_test?schema=public'
DATABASE_URL="$TEST_DATABASE_URL" npm run db:deploy
DATABASE_URL="$TEST_DATABASE_URL" npm run test:integration
npm run test:e2e:phase3
```

Install Playwright Chromium first. The Phase 3 browser suite starts a separate server on 127.0.0.1:3103 and uses only the specified test database. Its clock is controlled through a local file, never an HTTP endpoint. `PHASE3_TEST_CLOCK_FILE` is accepted only in non-production mode with a `_test` database; it fails closed otherwise. Production and normal development use the server clock. Do not run multiple browser suites against the same test-clock file simultaneously.

Remaining limitations: migration and database constraints have not been runtime-verified here; browser visual/interaction acceptance is blocked by sandbox ports. Recent-list caps (100 sessions/reviews, 50 rate versions) are explicit, not pagination; full per-session history remains available by ID through the API. There is no settlement/payment workflow, custom permission-grant UI, menu ordering, or edit of an already approved financial result. The business-wide lock trades concurrency throughput for straightforward integrity and should be profiled before larger deployments.
