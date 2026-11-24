// DEV NOTE: Opening the app in one request. Today and the coach's Overview are
// built from many small reads; on a phone's connection each is a round trip.
// GET /account/opening answers them together: it asks this server's own
// routes, as the signed-in person (their cookie, nothing else), so every
// answer, access check and shape is exactly the route's own. The browser hands
// each answer to whichever panel asks for it (public/app/opening.js); anything
// missing here, or asked for later, is an ordinary request.
//
// Only the fixed paths below are ever asked for, only of this server, and a
// slow or failed one is left out rather than holding up the rest.

import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";

import { asyncHandler } from "./async_handler.js";
import { accountRateLimitKey } from "./rate_limit_key.js";

type Json = Record<string, unknown>;
type Read = Readonly<{ status: number; payload: unknown }>;
type Ask = (method: "GET" | "POST", path: string, body?: Json) => Promise<Read | null>;

const READ_TIMEOUT_MS = 6000;
const STRENGTH_PROFILES_SHOWN = 6;
const isRecord = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === "string" ? value : "");

export const openingRouter = Router();

const openingRateLimit = rateLimit({
  keyGenerator: accountRateLimitKey,
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false
});

// This server, as the connection reached it.
function ownOrigin(request: Request): string | null {
  const { localAddress, localPort } = request.socket;
  if (!localAddress || !localPort) return null;
  const host = localAddress.startsWith("::ffff:") ? localAddress.slice(7) : localAddress.includes(":") ? `[${localAddress}]` : localAddress;
  return `http://${host}:${localPort}`;
}

export function openingPaths(role: string, userId: string): ReadonlyArray<readonly ["GET" | "POST", string, Json?]> {
  const id = encodeURIComponent(userId);
  const both = [["GET", "/account/detail"], ["GET", "/account/notifications/unread-count"]] as const;
  if (role === "athlete") {
    return [
      ...both,
      ["GET", "/account/onboarding/"],
      ["GET", "/account/onboarding/pain-flags"],
      ["GET", "/account/onboarding/readiness"],
      ["GET", "/account/onboarding/other-training"],
      ["GET", "/weekly-checkins"],
      ["GET", "/check-ins/mine"],
      ["GET", "/check-ins/slots"],
      ["GET", "/coach-workspace/relationships/mine"],
      ["POST", "/sessions/beta-athlete-today", { athlete_user_id: userId }],
      ["POST", "/sessions/beta-athlete-history", { athlete_user_id: userId }]
    ];
  }
  if (role === "coach") {
    return [
      ...both,
      ["GET", "/account/coach-onboarding"],
      ["GET", `/templates?coach_user_id=${id}`],
      ["GET", `/coach-workspace/events?coach_user_id=${id}`],
      ["GET", `/coach-workspace/athletes?coach_user_id=${id}`],
      ["GET", `/coach-workspace/relationships?coach_user_id=${id}`],
      ["GET", `/coach-workspace/assignments?coach_user_id=${id}`],
      ["GET", `/coach-workspace/reviews?coach_user_id=${id}`],
      ["GET", "/coach-workspace/coaching-requests"],
      ["GET", "/coach-workspace/org-handovers"],
      ["GET", "/coach-workspace/video-feedback/queue"],
      ["GET", "/check-ins/package-members"],
      ["GET", "/messages/coach/threads"]
    ];
  }
  return [];
}

const keyOf = (method: string, path: string, body?: Json) => (method === "POST" ? `POST ${path} ${JSON.stringify(body ?? null)}` : `GET ${path}`);

export async function collectOpening(ask: Ask): Promise<Record<string, Read>> {
  const reads: Record<string, Read> = {};
  const read = async (method: "GET" | "POST", path: string, body?: Json): Promise<Read | null> => {
    const answer = await ask(method, path, body).catch(() => null);
    // A server fault is left for an ordinary request to meet.
    if (answer && answer.status < 500) reads[keyOf(method, path, body)] = answer;
    return answer;
  };
  const session = await read("GET", "/account/session");
  const account = isRecord(session?.payload) && isRecord(session!.payload.account) ? session!.payload.account : null;
  if (session?.status !== 200 || !account) return reads;
  const userId = text(account.user_id);
  const role = text(account.actor_type);
  if (!userId) return reads;
  await Promise.all(openingPaths(role, userId).map(async ([method, path, body]) => {
    const answer = await read(method, path, body);
    if (answer?.status !== 200 || !isRecord(answer.payload)) return;
    // What the screen asks for next, from what it has just been given.
    if (path === "/sessions/beta-athlete-today") {
      const open = isRecord(answer.payload.session) ? text(answer.payload.session.session_id) : "";
      if (open) await read("GET", `/sessions/${encodeURIComponent(open)}/state`);
    }
    if (path.startsWith("/coach-workspace/relationships?")) {
      const accepted = (Array.isArray(answer.payload.relationships) ? answer.payload.relationships : [])
        .filter(isRecord)
        .filter((entry) => entry.relationship_state === "accepted" && entry.relationship_expired !== true)
        .slice(0, STRENGTH_PROFILES_SHOWN);
      await Promise.all(accepted.map((entry) => read("GET", `/coach-workspace/athlete-strength-profile?athlete_user_id=${encodeURIComponent(text(entry.athlete_user_id))}`)));
    }
  }));
  return reads;
}

openingRouter.get("/", openingRateLimit, asyncHandler(async (request: Request, response: Response) => {
  response.setHeader("cache-control", "no-store");
  const origin = ownOrigin(request);
  const cookie = request.get("cookie") ?? "";
  if (!origin || !cookie) return response.status(200).json({ reads: {} });
  const ask: Ask = async (method, path, body) => {
    const answer = await fetch(origin + path, {
      method,
      headers: { cookie, accept: "application/json", ...(body === undefined ? {} : { "content-type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      redirect: "error",
      signal: AbortSignal.timeout(READ_TIMEOUT_MS)
    });
    const payload: unknown = await answer.json().catch(() => undefined);
    return payload === undefined ? null : { status: answer.status, payload };
  };
  return response.status(200).json({ reads: await collectOpening(ask) });
}));
