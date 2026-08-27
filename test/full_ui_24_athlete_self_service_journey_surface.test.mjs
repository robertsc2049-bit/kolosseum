// DEV NOTE: FULL-UI-24 athlete self-service journey static surface contract.
// Covers the one genuinely new capability this slice built: lawful,
// non-opaque-ID coach-athlete invitation (invite by email, athlete accepts).
// The rest of the journey (onboarding, terms, profile, password, support,
// data rights, history) reuses routes already covered by earlier slices'
// own surface tests.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const html = read("public/app/index.html");
const js = read("public/app/app.js");
const routes = read("src/api/coach_workspace.routes.ts");
const handlers = read("src/api/coach_workspace.handlers.ts");
const invitationService = read("src/api/relationship_invitation_service.ts");
// DEV NOTE: the pending-invitations panel moved to React - see
// AccountCoachInvitationsPanel.tsx/useAccountCoachInvitations.ts/
// accountRelationshipsClient.ts. refreshPendingRelationshipInvitations()
// stays in app.js, trimmed to fetch+cache only (no render), since
// notificationCoachName() still reads state.pendingRelationshipInvitations.
const invitationsPanel = read("public/app-src/screens/account/AccountCoachInvitationsPanel.tsx");
const invitationsHook = read("public/app-src/screens/account/useAccountCoachInvitations.ts");
const invitationsClient = read("public/app-src/api/accountRelationshipsClient.ts");

test("the coach invites an athlete by email only - never the athlete's internal user_id", () => {
  assert.match(routes, /coachWorkspaceRouter\.post\(\s*"\/relationship-invitations",/u);
  assert.match(handlers, /export async function createCoachRelationshipInvitationHandler/u);
  assert.match(handlers, /await authenticatedCoach\(req, true\)/u);
  assert.match(handlers, /createRelationshipInvitationByEmail\(\s*coachUserId,\s*isRecord\(req\.body\) \? req\.body\.athlete_email : undefined/u);

  assert.match(invitationService, /export async function createRelationshipInvitationByEmail/u);
  assert.match(invitationService, /function canonicalEmail/u);
  assert.match(invitationService, /function findActiveAthleteByEmail/u);
  assert.doesNotMatch(invitationService, /athlete_user_id:\s*athleteEmailInput/u);

  assert.match(html, /<input id="inviteAthleteEmail" type="email" required autocomplete="off" \/>/u);
  assert.doesNotMatch(html, /id="inviteAthlete(?:Id|UserId|Code)"/u);
});

test("the athlete reads their own pending invitations from their own session, never a client-supplied athlete id", () => {
  assert.match(routes, /coachWorkspaceRouter\.get\(\s*"\/relationship-invitations",/u);
  assert.match(handlers, /export async function listAthleteRelationshipInvitationsHandler/u);
  assert.match(handlers, /const athleteUserId = await authenticatedAthlete\(req, false\);/u);
  assert.match(handlers, /listPendingRelationshipInvitationsForAthlete\(athleteUserId\)/u);

  assert.match(invitationService, /export async function listPendingRelationshipInvitationsForAthlete/u);
  assert.match(invitationService, /relationship\.relationship_state === "invited"/u);
});

test("the athlete accepts using only a relationship_id their own list already supplied - the server independently re-verifies ownership and pending state before writing", () => {
  assert.match(routes, /coachWorkspaceRouter\.post\(\s*"\/relationship-invitations\/:relationship_id\/accept",/u);
  assert.match(handlers, /export async function acceptAthleteRelationshipInvitationHandler/u);
  assert.match(handlers, /const athleteUserId = await authenticatedAthlete\(req, true\);/u);
  assert.match(handlers, /acceptRelationshipInvitation\(\s*athleteUserId,\s*req\.params\.relationship_id\s*\)/u);

  assert.match(invitationService, /export async function acceptRelationshipInvitation/u);
  assert.match(invitationService, /cleanString\(current\.athlete_user_id\) !== athleteUserId \|\|\s*\n\s*current\.relationship_state !== "invited"/u);
});

test("authenticatedAthlete derives identity only from the resolved session cookie, and mutations require CSRF", () => {
  assert.match(handlers, /function athleteSessionToken\(req: Request\): string \{/u);
  assert.match(handlers, /cookieValue\(req, PRODUCT_SESSION_COOKIE\)/u);
  assert.match(handlers, /async function authenticatedAthlete\(/u);
  assert.match(handlers, /if \(mutation\) \{\s*\n\s*assertProductCsrf\(token, req\.get\("x-kolosseum-csrf"\)\);/u);
  assert.match(handlers, /session\.account_row\.actor_type !== "athlete"/u);
});

test("the coach's email lookup only ever resolves an active athlete account, never any other actor type or account state", () => {
  const lookupQuery = invitationService.match(/async function findActiveAthleteByEmail[\s\S]*?\n\}/u);
  assert.ok(lookupQuery, "expected findActiveAthleteByEmail");
  assert.match(lookupQuery[0], /actor_type = 'athlete'\s*\n\s*AND account_state = 'active'/u);
  // The function returns only user_id and display_name - never password
  // fields, email history, or any other account beyond the single matched row.
  assert.match(lookupQuery[0], /SELECT user_id, display_name/u);
});

test("the pending-invitations panel is real, focusable markup rendered from the athlete's own server response - not a typed field", () => {
  assert.match(invitationsPanel, /export function AccountCoachInvitationsPanel/u);
  assert.match(js, /async function refreshPendingRelationshipInvitations\(\)/u);
  assert.match(invitationsClient, /export async function acceptRelationshipInvitation/u);
  assert.match(invitationsPanel, />Accept<\/button>/u);
  // A busy in-flight action disables the button (React's own equivalent of
  // guardedAction's double-submit guard).
  assert.match(invitationsPanel, /disabled=\{busy\}/u);

  // The panel is populated only from the server-returned relationship_id -
  // never an editable input the athlete could mistype or forge.
  assert.doesNotMatch(invitationsPanel, /<input/u);
});

test("visiting the account view refreshes the athlete's own pending invitations, and the coach invite form is duplicate-submit guarded", () => {
  assert.match(js, /refreshPendingRelationshipInvitations\(\)\.catch\(handleError\);/u);
  assert.match(js, /elements\.inviteAthleteByEmailForm\.addEventListener\("submit", \(event\) => \{\s*\n\s*guardedAction\(submitButtonOf, inviteAthleteByEmail\)\(event\)\.catch\(handleError\);/u);
});
