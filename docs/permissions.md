# Phase 2 — access and security

## Role/permission matrix

The authoritative policy is `src/lib/auth/permissions.ts`. Unknown permissions are denied; client navigation filtering is only a convenience. Permissions describe future operations but do not implement those operations.

| Permission | OWNER | ADMIN | MANAGER | CASHIER | STAFF |
|---|---|---|---|---|---|
| Dashboard | Full preview | Full preview | Operational preview | Overview | Overview |
| Tables view / permitted operations | Yes | Yes | Yes | Yes | Assigned TABLES/BOTH only |
| Café order / order status | Yes | Yes | Yes | Yes | Assigned CAFE/BOTH only |
| Billing view / settle | Yes | Yes | Yes | Yes | No |
| Refunds | Yes | Yes | No | No | No |
| Inventory operations | Yes | Yes | Yes | No | No |
| Expense entry | Yes | Yes | Yes | No | No |
| Customers | Yes | Yes | No | No | No |
| Staff management | All roles | MANAGER/CASHIER/STAFF only | No | No | No |
| Operational reports | Yes | Yes | Yes | No | No |
| Profit reports | Yes | No | No | No | No |
| Business settings | Yes | Yes | No | No | No |
| Audit logs | Yes | No | No | No | No |
| Owner-role assignment | Yes | No | No | No | No |

ADMIN is fixed delegation granted by an owner, not an unrestricted permission editor. Only owners can create/manage other owners or administrators. There is no ownership-transfer workflow or custom permission-grant endpoint. Owners can add another owner or demote an existing owner only while retaining at least one active owner. STAFF has no operation permissions by default; area assignments grant only the matching operational permissions, never settlement or reporting. Resource-level “assigned table/order” rules belong in Phase 3/4 when those resources exist.

## Authentication

Argon2id: 64 MiB memory, 3 iterations, 1 lane, a fresh 16-byte random salt and a 32-byte hash in PHC format. Verification uses a timing-safe comparison; unknown accounts still perform the KDF. Implementation uses [Node's built-in crypto.argon2](https://nodejs.org/api/crypto.html#cryptoargon2algorithm-parameters-callback), requiring Node 24.7+. The API is marked release candidate in Node 24 documentation; pin and validate the Node runtime used for deployment.

Login passwords are bounded at 128 characters. New/reset passwords require 12–128 characters. Email is trimmed and lowercased. Strict Zod schemas reject unknown keys and invalid roles. Disabled, unknown and incorrect-password attempts receive the same 401 message. Input-validation failures do not echo submitted values.

Sessions contain a random 256-bit token. Only its SHA-256 digest is stored in `Session`; the token is returned only as an HTTP-only cookie, never JSON. Production cookies are `__Host-cue-session`, Secure, SameSite=Lax, Path=/, with no Domain. Local HTTP development uses `cue-session` without Secure. Absolute expiry is eight hours; there is no sliding renewal. Every server request checks expiry, active status, current database role and configured business. There is no JWT role cache or localStorage authentication state.

Every mutation checks Origin against the server-configured `APP_ORIGIN`, rejects cross-site fetches and non-JSON bodies, and reads at most 8 KiB. Do not derive allowed origins from untrusted Host/forwarding headers. Protected API responses use `Cache-Control: no-store`. Login/logout use full document navigation so previously cached React payloads are discarded. Production must use HTTPS end to end or correctly configured TLS termination.

Database-shared atomic fixed-window limits: 10 login attempts per normalized email per 15 minutes; a global 120/minute limit caps KDF work; administrative reauthentication has a 5-attempt/15-minute limit per account. Limits apply to successful attempts too and do not reset on success. Email rate keys store a digest. Client-supplied IP headers are deliberately not trusted. These conservative global limits can affect a busy/shared deployment or be used for denial of service; add trusted edge throttling and tune capacity before production. Rate-limited requests return 429/Retry-After. Rate-limit counters are shared across app processes. Audit failed credential and reauthentication attempts, but do not create an unbounded audit event for every already-throttled request.

## Staff changes and concurrency

Account creation and security changes require both staff-management permission and the actor's current password. Actors cannot gain privileges by supplying a role in a request: the service loads their current role from the session and checks both the existing target role and requested new role.

All identity writes acquire a PostgreSQL `FOR UPDATE` lock on the business row before checking/mutating staff or sessions. This serializes concurrent owner demotions, login issuance, logout, resets, activation and role changes. Reauthentication and hashing happen outside the transaction to shorten lock duration; inside it, the session, current role and unchanged actor password hash are checked again. Last-active-owner checks and all audit writes occur in the same transaction. This coarse per-business lock is appropriate for low-volume identity writes; later operational transactions should not use it unnecessarily.

Any role, area, activation or password update revokes all target sessions. Active status is also checked during each session lookup, so disabling an account rejects even a leftover session. Administrative passwords are temporary: `mustChangePassword` restricts the account to identity lookup, password change and logout until a new password is chosen. Password changes revoke all sessions and require a fresh login. Temporary passwords are entered by an authorized administrator and shared out of band; there is no email delivery, public registration or public recovery link.

Audits include actor, action, target, UTC timestamp and allowlisted metadata such as old/new roles, assigned areas and revoked-session count. Failed login events have no actor and contain an email digest. Passwords, password hashes and raw session tokens are never logged. The UI shows the most recent 100 events and 500 staff accounts; pagination/export is future work. Audit data is application-append-only; restrict direct database credentials and plan immutable external retention if required.

## Route enforcement

`requirePage` redirects unauthenticated users to `/login`, forces temporary-password changes and calls Next `forbidden()` for insufficient permission. `experimental.authInterrupts` enables the custom 403 boundary. Every protected page checks access itself, in addition to the protected layout; this avoids treating a cached layout as the security boundary.

API routes call the same service-layer guards. 401 means missing/expired/disabled session, 403 means forbidden permission or forced password change, 409 handles conflicts/last owner, and 429 means rate limited. The staff services enforce permission checks independently of routes. No server actions currently exist; future actions must call these guarded services or explicitly call `requireUser` inside their transaction.

Phase 3 must additionally authorize resource ownership/business scope and operation-specific permissions, with no trust in UI visibility or client-calculated charges. Existing placeholders provide no table/session, payment or café mutations.


## Phase 3 additions

`session.adjust_final_charge`, `tables.manage`, `menu.manage` and `pricing.manage` default to OWNER/ADMIN only. Existing `tables.operate` permits authorized staff to start/pause/resume/switch/finish and request (not approve) adjusted pricing. STAFF must still be assigned TABLES/BOTH. Admin review, immutable pricing segments, outstanding checkout and audit details are documented in [Phase 3](phase3.md). Previous statements that tables and session mutations were placeholders describe Phase 2 only.
