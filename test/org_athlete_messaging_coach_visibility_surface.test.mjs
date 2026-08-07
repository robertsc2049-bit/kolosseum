// DEV NOTE: Part O.8 - coach read-only visibility into org-owner<->athlete
// message threads (D.4) static surface contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const service = read("src/api/org_athlete_messaging_service.ts");
const routes = read("src/api/messaging.routes.ts");
const appJs = read("public/app/app.js");
const indexHtml = read("public/app/index.html");

test("the four coach-facing org-message routes exist on the messaging router", () => {
  for (const path_ of [
    '"/coach/athletes/:athlete_user_id/org-messages/threads"',
    '"/coach/org-messages/threads/:thread_id"',
    '"/coach/org-messages/attachments/:message_id"',
    '"/coach/org-messages/attachments/:message_id/thumbnail"'
  ]) {
    assert.ok(routes.includes(path_), `expected coach org-message route ${path_}`);
  }
});

test("all four coach org-message routes are read-only - authenticatedCoach(request, false) only, never a mutation call", () => {
  const coachOrgMessagesBlock = routes.slice(routes.indexOf('"/coach/athletes/:athlete_user_id/org-messages/threads"'));
  const blockEnd = coachOrgMessagesBlock.indexOf("messagingRouter.use(");
  const scopedBlock = blockEnd === -1 ? coachOrgMessagesBlock : coachOrgMessagesBlock.slice(0, blockEnd);

  assert.doesNotMatch(scopedBlock, /authenticatedCoach\(request, true\)/u);
  const readCalls = [...scopedBlock.matchAll(/authenticatedCoach\(request, false\)/gu)].length;
  assert.equal(readCalls, 4, "each of the four coach org-message routes must resolve identity from authenticatedCoach(request, false)");
  assert.doesNotMatch(scopedBlock, /messagingRouter\.post/u, "no coach org-message route may accept a send - the coach never writes into this thread");
});

test("no route ever accepts a client-supplied coach_user_id", () => {
  assert.doesNotMatch(routes, /request\.body\.coach_user_id|request\.query\.coach_user_id/u);
});

test("the coach's gate is the STRICT accepted-relationship check, duplicated from coach_athlete_messaging_service.ts's own gate - not the lighter org-membership relationship check", () => {
  assert.match(service, /requireCoachHasAcceptedRelationshipWithAthlete/u);
  const functionBody = service.slice(service.indexOf("async function requireCoachHasAcceptedRelationshipWithAthlete"));
  const functionEnd = functionBody.indexOf("\nexport async function", 1);
  const scopedBody = functionEnd === -1 ? functionBody : functionBody.slice(0, functionEnd);

  for (const field of [
    "relationship_scope", "revoked_at_iso8601", "expires_at_iso8601",
    "product_permission_state_only", "engine_visible"
  ]) {
    assert.match(scopedBody, new RegExp(field), `expected the strict gate to check ${field}`);
  }
  assert.match(scopedBody, /relationship_state !== "accepted"/u);
  assert.match(scopedBody, /coach_user_id !== coachUserId/u);
  assert.match(scopedBody, /athlete_user_id !== athleteUserId/u);
  assert.match(scopedBody, /loadBeta17StoredCoachContext/u);
});

test("listOrgAthleteThreadsVisibleToCoach is structurally quiet (no active/shared match -> empty list), while listOrgAthleteThreadMessagesForCoach denies access to a named thread the coach has no claim to", () => {
  assert.match(service, /export async function listOrgAthleteThreadsVisibleToCoach/u);
  assert.match(service, /export async function listOrgAthleteThreadMessagesForCoach/u);

  const listBody = service.slice(
    service.indexOf("export async function listOrgAthleteThreadsVisibleToCoach"),
    service.indexOf("export async function listOrgAthleteThreadMessagesForCoach")
  );
  assert.match(listBody, /membership_status = 'active'/u);
  assert.match(listBody, /visibility_mode = 'shared'/u);
  assert.doesNotMatch(listBody, /org_athlete_messaging_thread_access_denied/u, "the list function must never throw for a structural non-match - it returns an empty array");

  const messagesBody = service.slice(service.indexOf("export async function listOrgAthleteThreadMessagesForCoach"));
  assert.match(messagesBody, /org_athlete_messaging_thread_access_denied/u);
});

test("the coach viewer's attachment route base is /messages/coach/org-messages/attachments, distinct from the athlete and org-owner bases", () => {
  assert.match(service, /role: "coach"/u);
  assert.match(service, /\/messages\/coach\/org-messages\/attachments/u);
  assert.match(service, /resolveOrgAthleteMessageAttachmentForCoach/u);
  assert.match(service, /resolveOrgAthleteMessageAttachmentThumbnailForCoach/u);
});

test("the coach org-messages panel exists as a real, read-only DOM section - no send form, message bodies escaped before rendering", () => {
  assert.match(indexHtml, /id="athleteDetailOrgMessageHistory"/u);
  assert.doesNotMatch(indexHtml, /athleteDetailOrgMessage(?:Form|Text|SendButton)/u, "no send control should exist for this read-only panel");

  assert.match(appJs, /async function refreshCoachAthleteOrgMessages/u);
  assert.match(appJs, /function renderCoachAthleteOrgMessages/u);
  assert.match(appJs, /api\(\s*"GET",\s*`\/messages\/coach\/athletes\/\$\{encodeURIComponent\(athleteUserId\)\}\/org-messages\/threads`/u);
  assert.match(appJs, /api\(\s*"GET",\s*`\/messages\/coach\/org-messages\/threads\/\$\{encodeURIComponent\(thread\.thread_id\)\}`/u);
  assert.match(appJs, /escapeHtml\(entry\.thread\.org_name\)/u);
  assert.match(appJs, /escapeHtml\(message\.body_text\)/u);
  assert.doesNotMatch(appJs, /confirmSendCoachAthleteOrgMessage|sendCoachAthleteOrgMessage/u, "no send handler should exist for this read-only panel");
});

test("the coach org-messages refresh is wired into openAthleteProfile and reset in closeAthleteProfile", () => {
  assert.match(appJs, /refreshCoachAthleteOrgMessages\(\s*athleteUserId/u);
  assert.match(appJs, /state\.coachAthleteOrgMessageThreads = \[\];/u);
});
