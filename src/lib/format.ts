export const BUSINESS_TIMEZONE = "Asia/Kathmandu";
export function formatMoney(value: number) {
  return new Intl.NumberFormat("en-NP", {
    style: "currency",
    currency: "NPR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}
export function formatBusinessDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(value);
}
