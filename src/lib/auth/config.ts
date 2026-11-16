export const SESSION_SECONDS = 8 * 60 * 60;
export const cookieName = () => process.env.NODE_ENV === "production" ? "__Host-cue-session" : "cue-session";
export const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: SESSION_SECONDS });
export function appOrigin() {
  const configured = process.env.APP_ORIGIN;
  if (!configured) throw new Error("APP_ORIGIN must be configured.");
  const url = new URL(configured);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("Production APP_ORIGIN requires HTTPS.");
  return url.origin;
}
export const businessSlug = () => process.env.BUSINESS_SLUG || "development-club";
