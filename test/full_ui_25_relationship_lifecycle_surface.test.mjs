// DEV NOTE: FULL-UI-25 relationship lifecycle static surface contract.
// Covers the two genuinely new capabilities this slice built: athlete
// decline (symmetric to FULL-UI-24's accept) and athlete-initiated
// end-relationship. The coach-side revoke/cancel/expiry/audit facts already
// existed and are proven by test/full_ui_25_relationship_lifecycle_persistent.integration.test.mjs
// directly against the real, pre-existing routes.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const js = read("public/app/app.js");
const routes = read("src/api/coach_workspace.routes.ts");
const handlers = read("src/api/coach_workspace.handlers.ts");
const invitationService = read("src/api/relationship_invitation_service.ts");
// DEV NOTE: the athlete's own pending-invitations/relationships/messaging
// panels moved to React - see AccountCoachInvitationsPanel.tsx and
// AccountCoachRelationshipPanel.tsx (useAccountCoachRelationship.ts owns
// endRelationship(), which calls the client's endAthleteRelationship()).
const invitationsClient = read("public/app-src/api/accountRelationshipsClient.ts");
const invitationsHook = read("public/app-src/screens/account/useAccountCoachInvitations.ts");
const relationshipHook = read("public/app-src/screens/account/useAccountCoachRelationship.ts");
const relationshipPanel = read("public/app-src/screens/account/AccountCoachRelationshipPanel.tsx");

test("the athlete can decline a pending invitation - the symmetric counterpart to accept", () => {
  assert.match(routes, /coachWorkspaceRouter\.post\(\s*"\/relationship-invitations\/:relationship_id\/decline",/u);
  assert.match(handlers, /export async function declineAthleteRelationshipInvitationHandler/u);
  assert.match(handlers, /const athleteUserId = await authenticatedAthlete\(req, true\);\s*\n\s*const relationship = await declineRelationshipInvitation/u);

  assert.match(invitationService, /export async function declineRelationshipInvitation/u);
  assert.match(invitationService, /relationship_state: "declined"/u);
  assert.match(invitationService, /revoked_at_iso8601: timestamp/u);

  assert.match(invitationsClient, /export async function declineRelationshipInvitation/u);
  assert.match(invitationsHook, /decline: \(id: string\) => respond\(id, "decline"\)/u);
  assert.match(invitationsHook, /else await declineRelationshipInvitation\(relationshipId, csrfToken\);/u);
});

test("the athlete can end an accepted relationship from their own profile, and read their own current+past relationships", () => {
  assert.match(routes, /coachWorkspaceRouter\.get\(\s*"\/relationships\/mine",/u);
  assert.match(routes, /coachWorkspaceRouter\.post\(\s*"\/relationships\/:relationship_id\/end",/u);
  assert.match(handlers, /export async function listAthleteOwnRelationshipsHandler/u);
  assert.match(handlers, /export async function endAthleteRelationshipHandler/u);

  assert.match(invitationService, /export async function athleteEndsRelationship/u);
  // The server independently re-verifies the relationship is currently
  // accepted and names this athlete before writing the closure - never
  // trusting a client-supplied assumption about the relationship's state.
  assert.match(
    invitationService,
    /cleanString\(current\.athlete_user_id\) !== athleteUserId \|\|\s*\n\s*current\.relationship_state !== "accepted"/u
  );

  assert.match(invitationsClient, /export async function endAthleteRelationship/u);
  assert.match(relationshipPanel, /window\.confirm\("End this relationship with your coach\? Historical records will be preserved\."\)/u);
  assert.match(relationshipPanel, />\s*End relationship\s*<\/button>/u);
});

test("closed relationships are shown as preserved past history, not deleted or hidden entirely", () => {
  assert.match(invitationService, /export async function listRelationshipsForAthlete/u);
  assert.match(invitationService, /relationship\.relationship_state !== "invited"/u);

  assert.match(relationshipHook, /export function useAccountCoachRelationship/u);
  assert.match(relationshipPanel, /Past relationships/u);
  assert.match(relationshipPanel, /const current = relationships\.filter\(\(entry\) => entry\.relationship_state === "accepted"\);/u);
  assert.match(relationshipPanel, /const past = relationships\.filter\(\(entry\) => entry\.relationship_state !== "accepted"\);/u);
});

test("authenticatedAthlete gates both new mutating routes with CSRF and derives identity only from the session cookie", () => {
  const declineHandler = handlers.match(/export async function declineAthleteRelationshipInvitationHandler[\s\S]*?\n\}/u);
  const endHandler = handlers.match(/export async function endAthleteRelationshipHandler[\s\S]*?\n\}/u);
  assert.ok(declineHandler);
  assert.ok(endHandler);
  assert.match(declineHandler[0], /authenticatedAthlete\(req, true\)/u);
  assert.match(endHandler[0], /authenticatedAthlete\(req, true\)/u);
});

// withCoachDisplay previously fetched a coach's profile/brand records
// inside one outer Promise.all across every relationship the athlete has -
// loadLatestBetaProductRecord throws on an empty subject_user_id, so one
// bad or transiently-failing coach lookup could take the athlete's ENTIRE
// pending-invitations or relationship-history list down instead of
// degrading just that one entry.
test("withCoachDisplay never lets one coach's profile/brand lookup failure take down the athlete's entire invitations/relationships list", () => {
  const fn = invitationService.slice(
    invitationService.indexOf("async function withCoachDisplay"),
    invitationService.indexOf("export async function listPendingRelationshipInvitationsForAthlete")
  );

  assert.match(
    fn,
    /let coachProfile = null;\s*\n\s*let brandPreference = null;\s*\n\s*try \{/u
  );

  assert.match(
    fn,
    /catch \{/u
  );
});
