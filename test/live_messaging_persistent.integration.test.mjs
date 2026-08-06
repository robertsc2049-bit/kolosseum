// DEV NOTE: Part E - live delivery for messaging. Proves an authenticated
// WebSocket connection receives a real-time push of a message sent by the
// other participant via the existing HTTP send routes, for both
// coach<->athlete and org-owner<->coach threads, in both directions, and
// that an upgrade attempt with no/invalid session cookie is rejected.
// This is purely additive verification on top of the already-tested
// persistent messaging system (test/coach_athlete_messaging_persistent.
// integration.test.mjs, test/org_coach_messaging_persistent.integration.
// test.mjs) - it does not re-prove idempotency, gating, or persistence,
// only the live-push mechanism itself.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { WebSocket } from "ws";

import { app } from "../dist/src/server.js";
import { pool } from "../dist/src/db/pool.js";
import { attachRealtimeWebSocketServer } from "../dist/src/api/realtime_hub.js";
import { STORAGE_ROOT } from "../dist/src/api/message_attachment_storage.js";
import fs from "node:fs/promises";
import path from "node:path";

async function listen() {
  return await new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
    server.once("error", reject);
  });
}

async function closeServer(server) {
  if (!server) return;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function request(baseUrl, method, route, body, options = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (options.cookie) headers.cookie = options.cookie;
  if (options.csrf) headers["x-kolosseum-csrf"] = options.csrf;

  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { response, text, json };
}

async function requestMultipart(baseUrl, route, fields, filePart, options = {}) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) formData.append(key, value);
  }
  if (filePart) {
    formData.append(
      "attachment",
      new Blob([filePart.buffer], { type: filePart.mimeType ?? "application/octet-stream" }),
      filePart.filename ?? "upload.bin"
    );
  }

  const headers = {};
  if (options.cookie) headers.cookie = options.cookie;
  if (options.csrf) headers["x-kolosseum-csrf"] = options.csrf;

  const response = await fetch(`${baseUrl}${route}`, { method: "POST", headers, body: formData });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { response, text, json };
}

function tinyJpegBuffer() {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
}

function cookieNamed(result, cookieName, label) {
  const values =
    typeof result.response.headers.getSetCookie === "function"
      ? result.response.headers.getSetCookie()
      : [result.response.headers.get("set-cookie")].filter(Boolean);

  const found = values.find((value) => String(value).startsWith(`${cookieName}=`));
  assert.ok(found, `${label}: expected ${cookieName} cookie`);
  return String(found).split(";")[0];
}

function assertStatus(result, status, label) {
  assert.equal(
    result.response.status,
    status,
    `${label}: expected ${status}, received ${result.response.status}. raw=${result.text}`
  );
}

function connectSocket(baseUrl, cookie) {
  const wsUrl = `${baseUrl.replace(/^http/u, "ws")}/ws/messages`;
  return new WebSocket(wsUrl, cookie ? { headers: { cookie } } : undefined);
}

function waitForOpen(socket, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timed out waiting for socket open")), timeoutMs);
    socket.once("open", () => { clearTimeout(timer); resolve(); });
    socket.once("error", (error) => { clearTimeout(timer); reject(error); });
  });
}

function waitForRejection(socket, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timed out waiting for rejection")), timeoutMs);
    socket.once("open", () => { clearTimeout(timer); reject(new Error("expected the upgrade to be rejected, but it opened")); });
    socket.once("unexpected-response", (_request, response) => {
      clearTimeout(timer);
      resolve(response.statusCode);
    });
    socket.once("error", () => { clearTimeout(timer); resolve(null); });
    socket.once("close", () => { clearTimeout(timer); resolve(null); });
  });
}

function waitForMessage(socket, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timed out waiting for a pushed message")), timeoutMs);
    socket.once("message", (data) => {
      clearTimeout(timer);
      try { resolve(JSON.parse(data.toString("utf8"))); }
      catch (error) { reject(error); }
    });
  });
}

async function registerCoach(baseUrl, nonce, label) {
  const email = `live_msg_${label}_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `Live Msg ${label} Coach`,
    email,
    password: `LiveMsg${label}Coach!2026`,
    accepted_terms: true,
    accepted_consent: true,
    accepted_terms_version: "terms_v1",
    accepted_consent_version: "consent_v1"
  });
  assertStatus(result, 201, `${label} coach registration`);
  const cookie = cookieNamed(result, "kolosseum_session", `${label} coach registration`);
  const csrf = result.json?.csrf_token;

  assertStatus(
    await request(baseUrl, "PATCH", "/account/coach-onboarding/profile", { display_name: `Live Msg ${label} Coach`, email }, { cookie, csrf }),
    200, `${label} coach onboarding profile`
  );
  assertStatus(
    await request(baseUrl, "POST", "/account/coach-onboarding/terms", { accepted: true, terms_version: "terms_v1" }, { cookie, csrf }),
    200, `${label} coach onboarding terms`
  );
  assertStatus(
    await request(baseUrl, "POST", "/account/coach-onboarding/complete", { completion_confirmed: true }, { cookie, csrf }),
    200, `${label} coach onboarding complete`
  );

  return { userId: result.json?.account?.user_id ?? "", email, cookie, csrf };
}

async function registerAthlete(baseUrl, nonce, label) {
  const email = `live_msg_${label}_athlete_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete",
    display_name: `Live Msg ${label} Athlete`,
    email,
    password: `LiveMsg${label}Athlete!2026`,
    activity_id: "powerlifting",
    accepted_terms: true,
    accepted_consent: true,
    accepted_terms_version: "terms_v1",
    accepted_consent_version: "consent_v1"
  });
  assertStatus(result, 201, `${label} athlete registration`);
  return {
    userId: result.json?.account?.user_id ?? "",
    email,
    cookie: cookieNamed(result, "kolosseum_session", `${label} athlete registration`),
    csrf: result.json?.csrf_token
  };
}

async function registerOrgOwner(baseUrl, nonce, label) {
  const email = `live_msg_${label}_owner_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/org/register", {
    email,
    display_name: `Live Msg ${label} Owner`,
    password: `LiveMsg${label}Owner!2026`
  });
  assertStatus(result, 201, `${label} org owner registration`);
  return {
    userId: result.json?.org_owner?.user_id ?? "",
    cookie: cookieNamed(result, "kolosseum_org_owner_session", `${label} org owner registration`),
    csrf: result.json?.csrf_token
  };
}

async function seedRelationship(baseUrl, { relationshipId, coachUserId, athleteUserId }) {
  const now = new Date().toISOString();
  const result = await request(baseUrl, "POST", "/sessions/beta-coach-relationship", {
    relationship_id: relationshipId,
    coach_user_id: coachUserId,
    athlete_user_id: athleteUserId,
    relationship_state: "accepted",
    relationship_scope: "individual_coach_athlete",
    accepted_at_iso8601: now,
    created_at_iso8601: now,
    updated_at_iso8601: now,
    revoked_at_iso8601: null,
    expires_at_iso8601: null
  });
  assertStatus(result, 201, `seed accepted relationship ${relationshipId}`);
}

test(
  "Live messaging: authenticated WebSocket receives a real-time push for coach<->athlete and org-owner<->coach sends, in both directions; unauthenticated upgrades are rejected",
  async (testContext) => {
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);

    let server = null;
    const sockets = [];
    const coachUserIds = [];
    const athleteUserIds = [];
    const orgOwnerUserIds = [];
    const attachmentMessageIds = [];

    const cleanup = async () => {
      const allUserIds = [...coachUserIds, ...athleteUserIds, ...orgOwnerUserIds].filter(Boolean);
      if (allUserIds.length > 0) {
        await pool.query(`DELETE FROM product_messages WHERE sender_user_id = ANY($1::text[])`, [allUserIds]).catch(() => {});
        await pool.query(
          `DELETE FROM product_message_threads WHERE coach_user_id = ANY($1::text[]) OR athlete_user_id = ANY($1::text[]) OR org_id IN (SELECT org_id FROM product_organisations WHERE owner_user_id = ANY($1::text[]))`,
          [allUserIds]
        ).catch(() => {});
        await pool.query(`DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])`, [allUserIds]).catch(() => {});
      }
      for (const userId of orgOwnerUserIds) {
        if (!userId) continue;
        await pool.query(
          "DELETE FROM product_org_audit_records WHERE org_id IN (SELECT org_id FROM product_organisations WHERE owner_user_id = $1)",
          [userId]
        ).catch(() => {});
        await pool.query(
          "DELETE FROM product_org_coach_memberships WHERE org_id IN (SELECT org_id FROM product_organisations WHERE owner_user_id = $1)",
          [userId]
        ).catch(() => {});
        await pool.query("DELETE FROM product_organisations WHERE owner_user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_org_owner_sessions WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_org_owner_accounts WHERE user_id = $1", [userId]).catch(() => {});
      }
      for (const userId of [...coachUserIds, ...athleteUserIds]) {
        if (!userId) continue;
        await pool.query("DELETE FROM product_account_events WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_sessions WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_challenges WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_accounts WHERE user_id = $1", [userId]).catch(() => {});
      }
      for (const messageId of attachmentMessageIds) {
        if (!messageId) continue;
        await fs.rm(path.join(STORAGE_ROOT, messageId), { recursive: true, force: true }).catch(() => {});
      }
    };

    testContext.after(async () => {
      // Sockets must close BEFORE the server: http.Server#close's callback
      // only fires once every connection has ended, and an upgraded
      // WebSocket connection never ends on its own - closing the server
      // first hangs indefinitely with live sockets still attached.
      for (const socket of sockets) {
        try { socket.close(); } catch {}
      }
      await closeServer(server);
      await cleanup();
      await pool.end();
    });

    server = await listen();
    attachRealtimeWebSocketServer(server);
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    // ============================================================
    // An upgrade attempt with no cookie at all is rejected.
    // ============================================================
    const noCookieSocket = connectSocket(baseUrl, undefined);
    sockets.push(noCookieSocket);
    await waitForRejection(noCookieSocket);

    // An upgrade attempt with a garbage cookie is rejected the same way.
    const garbageCookieSocket = connectSocket(baseUrl, "kolosseum_session=not-a-real-token");
    sockets.push(garbageCookieSocket);
    await waitForRejection(garbageCookieSocket);

    // ============================================================
    // Coach<->athlete: both directions.
    // ============================================================
    const coachA = await registerCoach(baseUrl, nonce, "a");
    coachUserIds.push(coachA.userId);
    const athlete1 = await registerAthlete(baseUrl, nonce, "1");
    athleteUserIds.push(athlete1.userId);
    await seedRelationship(baseUrl, { relationshipId: `live_msg_rel_${nonce}`, coachUserId: coachA.userId, athleteUserId: athlete1.userId });

    const athleteSocket = connectSocket(baseUrl, athlete1.cookie);
    sockets.push(athleteSocket);
    await waitForOpen(athleteSocket);

    const coachSocket = connectSocket(baseUrl, coachA.cookie);
    sockets.push(coachSocket);
    await waitForOpen(coachSocket);

    const athletePush = waitForMessage(athleteSocket);
    const firstSend = await request(
      baseUrl, "POST", `/messages/coach/athletes/${encodeURIComponent(athlete1.userId)}/send`,
      { body_text: "Live push test from coach", client_request_id: `live_${nonce}_1` },
      { cookie: coachA.cookie, csrf: coachA.csrf }
    );
    assertStatus(firstSend, 201, "coach sends first message");

    const athletePushed = await athletePush;
    assert.equal(athletePushed.type, "coach_athlete_message");
    assert.equal(athletePushed.thread.thread_id, firstSend.json?.thread?.thread_id);
    assert.equal(athletePushed.message.message_id, firstSend.json?.message?.message_id);
    assert.equal(athletePushed.message.body_text, "Live push test from coach");

    const coachPush = waitForMessage(coachSocket);
    const reply = await request(
      baseUrl, "POST", `/messages/athlete/coaches/${encodeURIComponent(coachA.userId)}/send`,
      { body_text: "Live push test from athlete", client_request_id: `live_${nonce}_2` },
      { cookie: athlete1.cookie, csrf: athlete1.csrf }
    );
    assertStatus(reply, 201, "athlete replies");

    const coachPushed = await coachPush;
    assert.equal(coachPushed.type, "coach_athlete_message");
    assert.equal(coachPushed.message.message_id, reply.json?.message?.message_id);
    assert.equal(coachPushed.message.sender_role, "athlete");

    // ============================================================
    // A push after an attachment send carries the same attachment shape
    // as the HTTP response (Part D.3) - pushToUser forwards the message
    // object verbatim, so this only needs a single assertion, not the
    // full validation/authorization coverage already proven against real
    // Postgres in coach_athlete_messaging_persistent.integration.test.mjs.
    // ============================================================
    const athleteAttachmentPush = waitForMessage(athleteSocket);
    const attachmentSend = await requestMultipart(
      baseUrl, `/messages/coach/athletes/${encodeURIComponent(athlete1.userId)}/send`,
      { body_text: "Here's a photo", client_request_id: `live_${nonce}_attach` },
      { buffer: tinyJpegBuffer(), mimeType: "image/jpeg", filename: "photo.jpg" },
      { cookie: coachA.cookie, csrf: coachA.csrf }
    );
    assertStatus(attachmentSend, 201, "coach sends a message with an attachment");
    attachmentMessageIds.push(attachmentSend.json?.message?.message_id);

    const athleteAttachmentPushed = await athleteAttachmentPush;
    assert.equal(athleteAttachmentPushed.message.message_id, attachmentSend.json?.message?.message_id);
    assert.equal(athleteAttachmentPushed.message.attachment?.media_type, "image");
    assert.equal(athleteAttachmentPushed.message.attachment?.mime_type, "image/jpeg");
    // The pushed envelope is projected for the ATHLETE recipient, while
    // attachmentSend's own response is projected for the sending coach -
    // same underlying row, deliberately different URL prefixes (each
    // viewer's own attachment route), per coach_athlete_messaging_service.ts's
    // per-viewer mapMessageRow projection.
    assert.ok(athleteAttachmentPushed.message.attachment?.url?.startsWith("/messages/athlete/attachments/"));
    assert.ok(attachmentSend.json?.message?.attachment?.url?.startsWith("/messages/coach/attachments/"));

    // ============================================================
    // Org-owner<->coach: both directions (API-only, no client UI, but the
    // same generic push infra applies).
    // ============================================================
    const owner = await registerOrgOwner(baseUrl, nonce, "primary");
    orgOwnerUserIds.push(owner.userId);
    const coachB = await registerCoach(baseUrl, nonce, "b");
    coachUserIds.push(coachB.userId);

    const org = await request(baseUrl, "POST", "/org/organisations", { org_name: "Live Msg Test Gym" }, { cookie: owner.cookie, csrf: owner.csrf });
    assertStatus(org, 201, "create organisation");
    const orgId = org.json?.organisation?.org_id;

    const inviteB = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/roster/invite`,
      { coach_email: coachB.email, request_id: `live_invite_${nonce}` }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(inviteB, 201, "invite coachB");
    assertStatus(
      await request(
        baseUrl, "POST", `/coach-workspace/org-memberships/${encodeURIComponent(inviteB.json?.membership?.membership_id)}/accept`,
        { request_id: `live_accept_${nonce}` }, { cookie: coachB.cookie, csrf: coachB.csrf }
      ),
      200, "coachB accepts org membership"
    );

    const ownerSocket = connectSocket(baseUrl, owner.cookie);
    sockets.push(ownerSocket);
    await waitForOpen(ownerSocket);

    const coachBSocket = connectSocket(baseUrl, coachB.cookie);
    sockets.push(coachBSocket);
    await waitForOpen(coachBSocket);

    const coachBPush = waitForMessage(coachBSocket);
    const ownerSend = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/messages/coaches/${encodeURIComponent(coachB.userId)}/send`,
      { body_text: "Live org push test from owner", client_request_id: `live_org_${nonce}_1` },
      { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(ownerSend, 201, "owner sends to coachB");

    const coachBPushed = await coachBPush;
    assert.equal(coachBPushed.type, "org_coach_message");
    assert.equal(coachBPushed.message.message_id, ownerSend.json?.message?.message_id);
    assert.equal(coachBPushed.message.sender_role, "org_owner");

    const ownerPush = waitForMessage(ownerSocket);
    const coachBReply = await request(
      baseUrl, "POST", `/coach-workspace/org-messages/organisations/${encodeURIComponent(orgId)}/send`,
      { body_text: "Live org push reply from coach", client_request_id: `live_org_${nonce}_2` },
      { cookie: coachB.cookie, csrf: coachB.csrf }
    );
    assertStatus(coachBReply, 201, "coachB replies to owner");

    const ownerPushed = await ownerPush;
    assert.equal(ownerPushed.type, "org_coach_message");
    assert.equal(ownerPushed.message.message_id, coachBReply.json?.message?.message_id);
    assert.equal(ownerPushed.message.sender_role, "coach");

    // ============================================================
    // Org-owner<->athlete (part D.4): both directions. The athlete side
    // has real UI, unlike the coach/owner org-messaging above, but the
    // push mechanism is the same generic infra either way.
    // ============================================================
    const teamOrg = await request(
      baseUrl, "POST", "/org/organisations", { org_name: "Live Msg Team Org", visibility_mode: "shared" },
      { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(teamOrg, 201, "create shared-mode organisation");
    const teamOrgId = teamOrg.json?.organisation?.org_id;

    const inviteC = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(teamOrgId)}/roster/invite`,
      { coach_email: coachA.email, request_id: `live_team_invite_${nonce}` }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(inviteC, 201, "invite coachA to the team org");
    assertStatus(
      await request(
        baseUrl, "POST", `/coach-workspace/org-memberships/${encodeURIComponent(inviteC.json?.membership?.membership_id)}/accept`,
        { request_id: `live_team_accept_${nonce}` }, { cookie: coachA.cookie, csrf: coachA.csrf }
      ),
      200, "coachA accepts the team org membership"
    );

    const athleteOrgPush = waitForMessage(athleteSocket);
    const ownerToAthleteSend = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(teamOrgId)}/athlete-messages/athletes/${encodeURIComponent(athlete1.userId)}/send`,
      { body_text: "Live org->athlete push test from owner", client_request_id: `live_org_ath_${nonce}_1` },
      { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(ownerToAthleteSend, 201, "owner sends to athlete1 via the team org");

    const athleteOrgPushed = await athleteOrgPush;
    assert.equal(athleteOrgPushed.type, "org_athlete_message");
    assert.equal(athleteOrgPushed.thread.org_name, "Live Msg Team Org");
    assert.equal(athleteOrgPushed.message.message_id, ownerToAthleteSend.json?.message?.message_id);
    assert.equal(athleteOrgPushed.message.sender_role, "org_owner");

    const ownerOrgAthletePush = waitForMessage(ownerSocket);
    const athleteToOwnerReply = await request(
      baseUrl, "POST", `/messages/athlete/org-messages/organisations/${encodeURIComponent(teamOrgId)}/send`,
      { body_text: "Live org->athlete push reply from athlete", client_request_id: `live_org_ath_${nonce}_2` },
      { cookie: athlete1.cookie, csrf: athlete1.csrf }
    );
    assertStatus(athleteToOwnerReply, 201, "athlete1 replies to the owner via the team org");

    const ownerOrgAthletePushed = await ownerOrgAthletePush;
    assert.equal(ownerOrgAthletePushed.type, "org_athlete_message");
    assert.equal(ownerOrgAthletePushed.message.message_id, athleteToOwnerReply.json?.message?.message_id);
    assert.equal(ownerOrgAthletePushed.message.sender_role, "athlete");
  }
);
