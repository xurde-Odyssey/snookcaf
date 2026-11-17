import { endpoint, json, requestToken } from "@/lib/auth/http";
import { billing } from "@/features/billing/server/service";
import { AuthError } from "@/lib/auth/errors";

function businessDate(value: string | null, end = false) {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new AuthError(400, "Choose a valid business date.");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new AuthError(400, "Choose a valid business date.");
  const start = new Date(date.getTime() - 345 * 60_000);
  return end ? new Date(start.getTime() + 24 * 60 * 60_000) : start;
}

export async function GET(request: Request) {
  return endpoint(async () => {
    const url = new URL(request.url);
    if (url.searchParams.get("view") === "credit") return json({ customers: await billing.listCredits(await requestToken(), url.searchParams.get("q") ?? "") });
    if (url.searchParams.get("view") === "customers") return json({ customers: await billing.listCustomers(await requestToken(), url.searchParams.get("q") ?? "") });
    if (url.searchParams.get("view") === "transactions") {
      const from = businessDate(url.searchParams.get("from"));
      const to = businessDate(url.searchParams.get("to"), true);
      const method = url.searchParams.get("method") as "CASH" | "QR" | null;
      if (method && !["CASH", "QR"].includes(method)) throw new AuthError(400, "Choose a valid payment method.");
      const status = url.searchParams.get("status") as import("@prisma/client").CheckoutStatus | null;
      if (status && !["PENDING", "PARTIALLY_PAID", "CREDIT", "PAID", "CANCELLED", "AWAITING_APPROVAL"].includes(status)) throw new AuthError(400, "Choose a valid payment status.");
      return json({ transactions: await billing.listTransactions(await requestToken(), from, to, method ?? undefined, status ?? undefined) });
    }
    const token = await requestToken();
    const [bills, paymentMethods, summary, businessDetails] = await Promise.all([billing.listPending(token, url.searchParams.get("q") ?? ""), billing.getPaymentMethods(token), billing.summary(token), billing.getBusinessDetails(token)]);
    return json({ bills, paymentMethods, summary, businessDetails });
  });
}
