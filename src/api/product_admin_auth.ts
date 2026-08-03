// DEV NOTE: Shared founder/admin session-authentication boundary. Every
// admin-scoped HTTP handler must derive admin identity from here (a
// verified admin session cookie), never from a client-supplied user id.
// This never reads the athlete/coach session cookie, so an athlete or
// coach session can never satisfy this guard, and vice versa.

import type { Request } from "express";

import {
  ADMIN_SESSION_COOKIE,
  AdminAuthError,
  assertAdminCsrf,
  resolveAdminSession
} from "./product_admin_account_service.js";
import { forbidden, unauthorized } from "./http_errors.js";

export function adminCookieValue(request: Request, name: string): string {
  const header = String(request.headers.cookie ?? "");
  for (const item of header.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0 || item.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(item.slice(separator + 1).trim());
    }
    catch {
      return "";
    }
  }
  return "";
}

export async function authenticatedAdmin(
  request: Request,
  mutation: boolean
): Promise<Readonly<{ user_id: string; raw_session_token: string }>> {
  const rawToken = adminCookieValue(request, ADMIN_SESSION_COOKIE);

  if (!rawToken) {
    throw unauthorized("ADMIN_SESSION_REQUIRED", {
      failure_token: "admin_session_missing"
    });
  }

  try {
    if (mutation) {
      assertAdminCsrf(rawToken, request.get("x-kolosseum-csrf"));
    }
    const session = await resolveAdminSession(rawToken);
    return Object.freeze({ user_id: session.user_id, raw_session_token: rawToken });
  }
  catch (error) {
    if (error instanceof AdminAuthError) {
      if (error.status === 401) {
        throw unauthorized("ADMIN_SESSION_REQUIRED", { failure_token: error.message });
      }
      throw forbidden("ADMIN_ACTION_DENIED", { failure_token: error.message });
    }
    throw error;
  }
}
