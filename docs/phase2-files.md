# Phase 2 file inventory

No Git metadata is present in this workspace; this inventory records the implementation edits, not a Git diff. No Phase 3 operations were added.

## Created

- `prisma/migrations/20261116000000_auth_staff/migration.sql`
- `prisma/auth-cleanup.ts`
- `src/app/(workspace)/layout.tsx`
- `src/app/(workspace)/staff/page.tsx`
- `src/app/(workspace)/audit/page.tsx`
- `src/app/login/page.tsx`
- `src/app/change-password/page.tsx`
- `src/app/forbidden.tsx`
- `src/app/api/audit/route.ts`
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/logout/route.ts`
- `src/app/api/auth/me/route.ts`
- `src/app/api/auth/password/route.ts`
- `src/app/api/staff/[id]/route.ts`
- `src/app/api/staff/route.ts`
- `src/lib/auth/config.ts`
- `src/lib/auth/errors.ts`
- `src/lib/auth/http.test.ts`
- `src/lib/auth/http.ts`
- `src/lib/auth/page.ts`
- `src/lib/auth/password.test.ts`
- `src/lib/auth/password.ts`
- `src/lib/auth/permissions.test.ts`
- `src/lib/auth/permissions.ts`
- `src/lib/auth/service.ts`
- `src/lib/auth/validation.ts`
- `src/components/auth/auth-form.tsx`
- `src/components/auth/logout-button.tsx`
- `src/components/staff/staff-manager.tsx`
- `src/features/staff/server/service.ts`
- `vitest.integration.config.ts`
- `tests/integration/auth.test.ts`
- `tests/e2e/security.spec.ts`
- `docs/permissions.md`
- `docs/phase2-files.md`

## Moved and modified (URLs preserved)

- `src/app/page.tsx` → `src/app/(workspace)/page.tsx`: independent authentication guard and limited overview for cashier/staff.
- `src/app/[module]/page.tsx` → `src/app/(workspace)/[module]/page.tsx`: permission-checked placeholders.

## Modified

- `prisma/schema.prisma`
- `prisma/seed.ts`
- `.env.example`
- `package.json`
- `package-lock.json`
- `next.config.ts`
- `postcss.config.mjs`
- `vitest.config.ts`
- `playwright.config.ts`
- `src/app/layout.tsx`
- `src/components/layout/app-shell.tsx`
- `src/lib/navigation.ts`
- `tests/e2e/foundation.spec.ts`
- `README.md`
- `docs/architecture.md`
- `docs/verification.md`

Prisma Client and Next route types were regenerated locally. Existing theme, reusable UI primitives, dashboard fixtures and dashboard interaction components are preserved.
