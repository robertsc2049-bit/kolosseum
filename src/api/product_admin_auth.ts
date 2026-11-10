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

// In production an admin who hasn't set up two-step sign-in
// (admin_two_step.ts) can only reach the set-up routes, which pass
// allowTwoStepSetup.
export async function authenticatedAdmin(
  request: Request,
  mutation: boolean,
  options: Readonly<{ allowTwoStepSetup?: boolean }> = {}
): Promise<Readonly<{ user_id: string; raw_session_token: string; session_hash: string; admin: Readonly<Record<string, unknown>>; session_expires_at_iso8601: string }>> {
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
    if (session.two_step_setup_required && !options.allowTwoStepSetup) {
      throw forbidden("ADMIN_TWO_STEP_SETUP_REQUIRED", { failure_token: "admin_two_step_setup_required" });
    }
    return Object.freeze({
      user_id: session.user_id,
      raw_session_token: rawToken,
      session_hash: session.session_hash,
      admin: session.admin,
      session_expires_at_iso8601: session.session_expires_at_iso8601
    });
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
