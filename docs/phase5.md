# Phase 5 — billing, payments and customer credit

## Existing record and totals

`PendingCheckout` remains the single bill record. Its unique `billNumber`, business ID, snooker reference amount, café subtotal, original subtotal, discount snapshot, customer-credit state, and settlement status are persisted. Session-linked bills use the unique `sessionId`; standalone café bills use the unique order ID. Session billing uses the approved final session amount when one exists and retains the original session reference separately. Café line-item snapshots are summed and cancelled orders are excluded.

`Payment` is append-only and may contain multiple rows per checkout. Cash and QR rows represent collected allocations; a cash tender amount and change are stored separately, so tender/change are not counted as revenue. Split allocations and later repayments create new rows. Remaining credit is computed as bill amount minus payment rows; there is no mutable customer balance column.

## Workflow and authorization

- `GET /api/billing` lists pending bills and returns actual daily summaries.
- `GET /api/billing?view=transactions` filters payment records by business date, method and checkout status.
- `GET /api/billing?view=credit` lists customers with outstanding recorded credit; `GET /api/billing/credit/customers/[customerId]` returns their bill and repayment history.
- `POST /api/billing/[id]/payment` settles a bill, applies optional one-time discount, accepts Cash/QR allocations and may record the remainder as explicit customer credit.
- `POST /api/billing/credit/checkouts/[checkoutId]/payment` records a repayment against one selected credit bill.
- `GET/PUT /api/billing/payment-methods` and `GET/PUT /api/billing/business-settings` configure allowed tenders and receipt contact details.

All mutations re-check the authenticated actor inside the business-row transaction lock. `billing.settle` permits settlement; `billing.discount` is granted only to OWNER/ADMIN. Credit requires a customer ID or a new customer name and is not inferred from an unpaid checkout. QR receipt is manually confirmed. Refunds, voids of paid bills, card, gateways, tax calculations and interest are not implemented.

## Integrity and printing

The migration extends checkout statuses with partial, credit and paid states, adds customer and payment data, unique bill/receipt references, nonnegative and discount checks, deferred session/checkout and payment consistency checks, business ownership validation, and database immutability for payments and relevant audit actions. Settlement/repayment requests are idempotent and serialized to prevent concurrent over-collection.

Receipts print in monochrome with 80 mm max width and browser print/PDF support. They show business contact details when configured, itemized session segments and café snapshots, discount, bill total, tender rows, change, amount collected, balance, cashier, and payment or credit reference. These are ordinary payment/credit receipts, not tax invoices.

## Phase boundary and verification

The Phase 4 Prisma models and POS/order-management UI are present. Café order creation, listing and mutation API services are still pending backend integration; the frontend contracts are documented in the repository README. Until those APIs are implemented, café-only/combined billing cannot be exercised through the POS. Phase 5 reads existing `CafeOrder` snapshots and synchronizes standalone pending checkout entries.

Type checks, lint, all unit/HTTP tests, and a Webpack production build passed during this implementation. PostgreSQL integration tests require `TEST_DATABASE_URL` and `DATABASE_URL` pointing at the same disposable database ending in `_test`; without it the test guard rejects startup before database assertions. The migration has not been applied or runtime-verified against PostgreSQL in this environment.
