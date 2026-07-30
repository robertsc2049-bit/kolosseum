// DEV NOTE: Shared coach session-authentication boundary. Every coach-scoped HTTP handler
// must derive coach identity from here (a verified product session cookie), never from a
// client-supplied coach_user_id field in a query string or request body.

import type { Request } from "express";

import {
  PRODUCT_SESSION_COOKIE,
  ProductAccountError,
  assertProductCsrf,
  resolveProductSession
} from "./product_account_service.js";
import {
  forbidden,
  unauthorized
} from "./http_errors.js";

export function cookieValue(request: Request, name: string): string {
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

export async function authenticatedCoach(
  request: Request,
  mutation: boolean
): Promise<string> {
  const rawToken = cookieValue(request, PRODUCT_SESSION_COOKIE);
  if (!rawToken) {
    throw unauthorized("ACCOUNT_SESSION_REQUIRED", {
      failure_token: "account_session_missing"
    });
  }

  try {
    if (mutation) {
      assertProductCsrf(rawToken, request.get("x-kolosseum-csrf"));
    }
    const session = await resolveProductSession(rawToken);
    if (session.account_row.actor_type !== "coach") {
      throw forbidden("COACH_ACCOUNT_REQUIRED", {
        failure_token: "coach_account_required"
      });
    }
    return session.account_row.user_id;
  }
  catch (error) {
    if (error instanceof ProductAccountError) {
      if (error.status === 401) {
        throw unauthorized("ACCOUNT_SESSION_REQUIRED", {
          failure_token: error.code
        });
      }
      throw forbidden("ACCOUNT_ACTION_DENIED", {
        failure_token: error.code
      });
    }
    throw error;
  }
}
