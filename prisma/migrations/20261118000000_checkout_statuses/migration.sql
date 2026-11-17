-- Keep enum additions in their own migration so PostgreSQL commits them before later CHECK constraints use them.
ALTER TYPE "CheckoutStatus" ADD VALUE 'PAID';
ALTER TYPE "CheckoutStatus" ADD VALUE 'PARTIALLY_PAID';
ALTER TYPE "CheckoutStatus" ADD VALUE 'CREDIT';
