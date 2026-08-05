// DEV NOTE: Part E - live delivery for messaging. This file is a purely
// additive, best-effort notification layer on top of the already-correct,
// already-tested D.1/D.2 messaging system - it never mutates
// product_messages/product_message_threads itself, only reads a
// connecting client's session and, on request, forwards an
// already-persisted message to a live socket. If a push fails or no
// socket is connected, nothing changes: the recipient sees the message
// next time they open or refresh the thread, exactly as before this
// slice. The WS application protocol is server->client push only - the
// browser never sends application data over the socket, so connection-
// level cookie auth at the handshake is the only auth surface that
// matters here.

import type { Server as HttpServer } from "node:http";
import type { IncomingMessage } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";

import { PRODUCT_SESSION_COOKIE, resolveProductSession } from "./product_account_service.js";
import { ORG_OWNER_SESSION_COOKIE, resolveOrgOwnerSession } from "./org_owner_account_service.js";

export type RealtimeRole = "coach" | "athlete" | "org_owner";

export type RealtimeActor = Readonly<{
  role: RealtimeRole;
  userId: string;
}>;

// Duplicated from cookieValue (coach_session_auth.ts) / orgOwnerCookieValue
// (org_owner_auth.ts) rather than imported - both only ever read
// `request.headers.cookie`, a plain string, which a raw IncomingMessage
// (what the 'upgrade' event hands you, not a full Express Request) exposes
// identically. Mirrors this codebase's established per-file duplication
// convention for small auth-adjacent helpers.
function cookieFromRequest(request: IncomingMessage, name: string): string {
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

export async function authenticateRealtimeUpgrade(
  request: IncomingMessage
): Promise<RealtimeActor | null> {
  const productToken = cookieFromRequest(request, PRODUCT_SESSION_COOKIE);
  if (productToken) {
    try {
      const session = await resolveProductSession(productToken);
      if (session.account_row.actor_type === "coach" || session.account_row.actor_type === "athlete") {
        return Object.freeze({ role: session.account_row.actor_type, userId: session.account_row.user_id });
      }
    }
    catch {
      // Falls through to the org-owner attempt below - an invalid/expired
      // coach/athlete cookie must not block a valid org-owner cookie from
      // being tried on the same connection.
    }
  }

  const orgOwnerToken = cookieFromRequest(request, ORG_OWNER_SESSION_COOKIE);
  if (orgOwnerToken) {
    try {
      const session = await resolveOrgOwnerSession(orgOwnerToken);
      return Object.freeze({ role: "org_owner" as const, userId: session.user_id });
    }
    catch {
      // Neither cookie resolved - fall through to null below.
    }
  }

  return null;
}

function connectionKey(role: RealtimeRole, userId: string): string {
  return `${role}:${userId}`;
}

const connections = new Map<string, Set<WebSocket>>();

export function registerConnection(role: RealtimeRole, userId: string, socket: WebSocket): void {
  const key = connectionKey(role, userId);
  const existing = connections.get(key);
  if (existing) {
    existing.add(socket);
    return;
  }
  connections.set(key, new Set([socket]));
}

export function unregisterConnection(role: RealtimeRole, userId: string, socket: WebSocket): void {
  const key = connectionKey(role, userId);
  const sockets = connections.get(key);
  if (!sockets) return;
  sockets.delete(socket);
  if (sockets.size === 0) connections.delete(key);
}

// A no-op if the user has no live connection - the correct, safe default.
// A missed push is never a correctness problem, only a delayed one.
export function pushToUser(role: RealtimeRole, userId: string, payload: unknown): void {
  const sockets = connections.get(connectionKey(role, userId));
  if (!sockets || sockets.size === 0) return;

  const serialized = JSON.stringify(payload);
  for (const socket of sockets) {
    if (socket.readyState !== socket.OPEN) continue;
    try {
      socket.send(serialized);
    }
    catch {
      // Best-effort - a send failure on one socket must never affect the
      // HTTP response that triggered this push, nor any other connection.
    }
  }
}

// Extracted into its own function (rather than inlined at the one
// production call site in src/main.ts) so both the real process AND any
// test that spins up its own ephemeral `app.listen(...)` server can attach
// the identical upgrade-handling behaviour to whatever http.Server they
// hold - noServer mode + a manual 'upgrade' handler is the standard ws
// pattern for auth-gated upgrades.
export function attachRealtimeWebSocketServer(server: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    if (request.url !== "/ws/messages") {
      socket.destroy();
      return;
    }

    authenticateRealtimeUpgrade(request)
      .then((actor) => {
        if (!actor) {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }

        wss.handleUpgrade(request, socket, head, (ws) => {
          registerConnection(actor.role, actor.userId, ws);
          ws.on("close", () => unregisterConnection(actor.role, actor.userId, ws));
          ws.on("error", () => unregisterConnection(actor.role, actor.userId, ws));
        });
      })
      .catch(() => {
        socket.destroy();
      });
  });
}
