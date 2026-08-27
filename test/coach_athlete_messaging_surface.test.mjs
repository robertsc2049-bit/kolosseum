// DEV NOTE: Part D.1 coach<->athlete messaging static surface contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const service = read("src/api/coach_athlete_messaging_service.ts");
const routes = read("src/api/messaging.routes.ts");
const serverTs = read("src/server.ts");
const schema = read("schema.sql");
const appJs = read("public/app/app.js");
const indexHtml = read("public/app/index.html");
// DEV NOTE: the athlete's own coach-messaging widget (embedded in "My
// coach") moved to React - see AccountCoachRelationshipPanel.tsx/
// useAccountCoachRelationship.ts/accountRelationshipsClient.ts. The
// coach-side messaging UI (athleteDetailMessage*) stays legacy.
const relationshipHook = read("public/app-src/screens/account/useAccountCoachRelationship.ts");
const relationshipPanel = read("public/app-src/screens/account/AccountCoachRelationshipPanel.tsx");
const relationshipsClient = read("public/app-src/api/accountRelationshipsClient.ts");

const forbiddenEngineImports = /session_state_write_service\.js|session_state_query_service\.js|block_compile_write_service\.js|engine_runner_service\.js|@kolosseum\/engine|engine\/src\//u;

test("messaging is mounted at its own /messages prefix with the expected coach and athlete routes", () => {
  assert.match(serverTs, /app\.use\("\/messages", messagingRouter\)/u);

  for (const path_ of [
    '"/coach/threads"', '"/coach/threads/:thread_id"', '"/coach/athletes/:athlete_user_id/send"',
    '"/athlete/threads"', '"/athlete/threads/:thread_id"', '"/athlete/coaches/:coach_user_id/send"'
  ]) {
    assert.ok(routes.includes(path_), `expected messaging route ${path_}`);
  }
});

test("identity is resolved from the session cookie only, never a client-supplied user_id, on either side", () => {
  assert.doesNotMatch(routes, /request\.body\.(?:coach_|athlete_)?user_id|request\.query\.(?:coach_|athlete_)?user_id/u);
  assert.match(routes, /authenticatedCoach\(request, false\)/u);
  assert.match(routes, /authenticatedCoach\(request, true\)/u);
  assert.match(routes, /authenticatedAthlete\(request, false\)/u);
  assert.match(routes, /authenticatedAthlete\(request, true\)/u);

  // The athlete auth helper is a local duplicate (mirroring the identical
  // pattern in coach_workspace.handlers.ts), not an import of a shared
  // athlete-scoped business file.
  assert.match(routes, /async function authenticatedAthlete/u);
});

test("messaging uses the STRICT accepted-relationship gate, not the weaker requireCoachAthleteAccess-style check", () => {
  // The weak variant (beta19_coach_workspace_service.ts's
  // requireCoachAthleteAccess) never checks these fields - a service that
  // only ever compares relationship_state would silently accept a
  // relationship whose scope, revocation or expiry fields are inconsistent.
  for (const field of [
    "relationship_scope", "revoked_at_iso8601", "expires_at_iso8601",
    "product_permission_state_only", "engine_visible"
  ]) {
    assert.match(service, new RegExp(field), `expected the strict gate to check ${field}`);
  }
  assert.match(service, /relationship_state !== "accepted"/u);
  assert.match(service, /coach_user_id !== coachUserId/u);
  assert.match(service, /athlete_user_id !== athleteUserId/u);
  assert.match(service, /loadBeta17StoredCoachContext/u);
});

test("a thread is created lazily on first send via ON CONFLICT, never a separate create-thread step", () => {
  assert.doesNotMatch(routes, /threads\/create|start-thread/iu);
  assert.match(service, /ON CONFLICT \(coach_user_id, athlete_user_id\)/u);
});

test("client_request_id makes a resend idempotent - a repeated send does not duplicate the message row", () => {
  assert.match(schema, /UNIQUE \(thread_id, sender_user_id, client_request_id\)/u);
  assert.match(service, /ON CONFLICT \(thread_id, sender_user_id, client_request_id\) DO NOTHING/u);
});

test("body_text is bounded and non-empty, and a thread_type discriminator keeps coach_athlete, org_owner_coach and org_owner_athlete threads structurally separate", () => {
  assert.match(schema, /char_length\(btrim\(body_text\)\) BETWEEN 1 AND 4000/u);
  assert.match(service, /bodyTextRaw\.length > 4000/u);
  assert.match(schema, /thread_type IN \('coach_athlete', 'org_owner_coach', 'org_owner_athlete'\)/u);
});

test("no messaging file imports any engine-truth service", () => {
  for (const source of [service, routes]) {
    assert.doesNotMatch(source, forbiddenEngineImports);
  }
});

test("an attachment's byte_size, which message_attachment_storage.ts and every messaging service already compute and return, is actually shown to the user as a human-readable file size", () => {
  // message_attachment_storage.ts stat()s the uploaded file and every
  // messaging service (coach_athlete_messaging_service.ts,
  // org_coach_messaging_service.ts, org_athlete_messaging_service.ts) already
  // returns attachment.byte_size on send/list - but renderMessageAttachment
  // never read it, so a user could never see how large a photo/video was.
  // Same phantom-field bug class as PRs #877-#883.
  assert.match(appJs, /function formatAttachmentSize/u);
  assert.match(appJs, /formatAttachmentSize\(attachment\.byte_size\)/u);
});

test("each side has its own last-read marker, added as an explicit migration since CREATE TABLE IF NOT EXISTS never re-runs against an existing table", () => {
  assert.match(schema, /ADD COLUMN IF NOT EXISTS coach_last_read_at TIMESTAMPTZ/u);
  assert.match(schema, /ADD COLUMN IF NOT EXISTS athlete_last_read_at TIMESTAMPTZ/u);
});

test("unread count is a live derived COUNT of the peer's messages since the viewer's own last-read marker, never a stored/cached number", () => {
  assert.match(service, /SELECT COUNT\(\*\) FROM product_messages m/u);
  assert.match(service, /m\.sender_role = \$2/u);
  assert.match(service, /COALESCE\(t\.\$\{lastReadColumn\}, '-infinity'::timestamptz\)/u);
});

test("opening a thread's messages marks it read for that viewer only, updating only their own last-read column", () => {
  assert.match(service, /UPDATE product_message_threads SET \$\{lastReadColumn\} = now\(\) WHERE thread_id = \$1/u);
  assert.match(service, /const lastReadColumn = role === "coach" \? "coach_last_read_at" : "athlete_last_read_at";/u);
});

test("the coach directory shows a live unread-messages badge per athlete, fetched separately from the mark-read thread-detail call", () => {
  assert.match(appJs, /function coachMessageUnreadCountFor/u);
  assert.match(appJs, /async function refreshCoachMessageUnreadCounts/u);
  assert.match(appJs, /coachMessageUnreadCountFor\(athleteUserId\) > 0/u);
  assert.match(appJs, /refreshCoachMessageUnreadCounts\(\{ quiet: true \}\)/u);
});

test("both the coach and athlete UIs exist as real focusable controls, and message bodies are escaped before rendering (never innerHTML'd raw)", () => {
  assert.match(indexHtml, /id="athleteDetailMessageButton"/u);
  assert.match(indexHtml, /id="athleteDetailMessageForm"/u);
  assert.match(indexHtml, /id="athleteDetailMessageText"/u);
  assert.match(indexHtml, /<button[^>]*id="athleteDetailMessageButton"[^>]*type="button"/u);

  assert.match(appJs, /escapeHtml\(message\.body_text/u);
  assert.match(appJs, /async function refreshCoachAthleteMessages/u);
  assert.match(appJs, /async function confirmSendAthleteMessage/u);
  assert.match(relationshipHook, /export function useAccountCoachRelationship/u);
  assert.match(relationshipsClient, /export async function sendAthleteOwnMessage/u);
  // React escapes all rendered text by default - never dangerouslySetInnerHTML.
  assert.doesNotMatch(relationshipPanel, /dangerouslySetInnerHTML/u);
});
