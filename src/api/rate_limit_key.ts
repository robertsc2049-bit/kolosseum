import { createHash } from "node:crypto";
import type { Request } from "express";
import { ipKeyGenerator } from "express-rate-limit";

// DEV NOTE: every product rate limit sits on a signed-in route, so it counts
// per account - a whole gym on one wifi network, or phones sharing a mobile
// carrier's public address, would otherwise all spend one IP's allowance.
// The key is a hash of the session cookie (never the token itself); a request
// without one falls back to its IP. A made-up cookie only buys a fresh bucket
// for a request the route then refuses as signed out.
const SESSION_COOKIES = ["kolosseum_session", "kolosseum_org_owner_session", "kolosseum_admin_session"];

function sessionCookie(request: Request): string | null {
  const header = request.headers.cookie;
  if (typeof header !== "string") return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (SESSION_COOKIES.includes(name) && value) return `${name}=${value}`;
  }
  return null;
}

export function accountRateLimitKey(request: Request): string {
  const cookie = sessionCookie(request);
  if (cookie) return `session:${createHash("sha256").update(cookie).digest("hex")}`;
  return `ip:${ipKeyGenerator(request.ip ?? "")}`;
}
