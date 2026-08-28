// DEV NOTE: FULL-UI-22 cross-product quality closure static surface contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const html = read("public/app/index.html");
const css = read("public/app/styles.css");
const js = read("public/app/app.js");
const routeBootstrap = read("public/app/route_bootstrap.js");
const dataRightsPanel = read("public/app-src/screens/account/AccountDataRightsPanel.tsx");
const dataRightsHook = read("public/app-src/screens/account/useAccountDataRights.ts");
const supportPanel = read("public/app-src/screens/account/AccountSupportPanel.tsx");
const supportHook = read("public/app-src/screens/account/useAccountSupport.ts");
const reviewHook = read("public/app-src/screens/coach/useCoachReview.ts");
const eventDetailHook = read("public/app-src/screens/coach/useCoachEventDetail.ts");
const invitationsPanel = read("public/app-src/screens/account/AccountCoachInvitationsPanel.tsx");
const relationshipPanel = read("public/app-src/screens/account/AccountCoachRelationshipPanel.tsx");
const inviteByEmailPanel = read("public/app-src/screens/coach/InviteAthleteByEmailPanel.tsx");
const broadcastPanel = read("public/app-src/screens/coach/CoachBroadcastPanel.tsx");
const connectAthletePanel = read("public/app-src/screens/coach/ConnectAthletePanel.tsx");
const athleteRelationshipDetailPanel = read("public/app-src/screens/coach/AthleteRelationshipDetailPanel.tsx");
const assignmentPanel = read("public/app-src/screens/coach/AthleteProfileAssignmentPanel.tsx");
const programmeLibraryPanel = read("public/app-src/screens/coach/CoachProgrammeLibraryPanel.tsx");

test("every focusable control gets a visible keyboard-only focus ring, distinct from mouse-hover styling", () => {
  assert.match(
    css,
    /a:focus-visible,\s*\n\s*button:focus-visible,\s*\n\s*\.button:focus-visible,\s*\n\s*\[role="button"\]:focus-visible,\s*\n\s*\[role="menuitem"\]:focus-visible,\s*\n\s*\[tabindex\]:focus-visible\s*\{\s*\n\s*outline: 3px solid var\(--bronze-light\);/u
  );
  assert.match(css, /input:focus, select:focus, textarea:focus \{[\s\S]*?box-shadow: 0 0 0 3px rgba\(126, 184, 0, 0\.45\);/u);
});

test("prefers-reduced-motion collapses animation and transition duration everywhere, not just on one hand-picked element", () => {
  const block = css.match(/@media \(prefers-reduced-motion: reduce\) \{\s*\*, \*::before, \*::after \{[\s\S]*?\n\s*\}\s*\n\}/u);
  assert.ok(block, "expected a general prefers-reduced-motion block targeting every element");
  assert.match(block[0], /animation-duration: 0\.001ms !important/u);
  assert.match(block[0], /transition-duration: 0\.001ms !important/u);
  assert.match(block[0], /scroll-behavior: auto !important/u);
});

test("status/error notices are announced to screen readers, with errors interrupting (assertive) and status waiting its turn (polite)", () => {
  assert.match(js, /elements\.notice\.setAttribute\("aria-live", type === "error" \? "assertive" : "polite"\)/u);
  for (const id of ["athleteRelationshipCounts", "athleteDirectoryStatus", "eventsStatus", "coachDashboardStatus"]) {
    const re = new RegExp(`id="${id}"[^>]*(?:\\n[^>]*)*?(?:role="status"|aria-live="polite")[\\s\\S]{0,120}?(?:role="status"|aria-live="polite")`, "u");
    assert.match(html, re, `${id} must carry both role="status" and aria-live="polite"`);
  }

  // The programme library's status line (FULL-UI-05A) moved to React - see
  // CoachProgrammeLibraryPanel.tsx - and carries the same role="status"/
  // aria-live="polite" pair the legacy #templateLibraryStatus element did.
  assert.match(
    programmeLibraryPanel,
    /role="status" aria-live="polite"/u,
    "the programme library status line must carry both role=\"status\" and aria-live=\"polite\""
  );
});

test("a route-level service-unavailable state reuses the view's own status line and offers a real retry control, not just a toast", () => {
  assert.match(js, /function catchWithViewRetry\(statusElement, retryFn, message\)/u);
  assert.match(js, /retryButton\.type = "button"/u);
  assert.match(js, /retryButton\.className = "button secondary status-retry-button"/u);
  assert.match(js, /retryButton\.addEventListener\("click"/u);
  // The global error notice/report-a-problem path still fires too.
  assert.match(js, /statusElement\.classList\.add\("error"\);[\s\S]{0,600}handleError\(error\)/u);

  // The review queue moved to React (CoachReviewPanel.tsx) - like the
  // earlier-migrated video-feedback queue, its error state is a plain
  // message rather than this catchWithViewRetry control (no other
  // migrated coach panel added one either), so its site is no longer
  // listed here.
  const wiredSites = [
    /catchWithViewRetry\(\s*elements\.eventsStatus,\s*\(\) => refreshCoachEvents/u,
    /catchWithViewRetry\(\s*elements\.templateLibraryStatus,\s*\(\) => refreshProgrammeLibrary/u,
    /catchWithViewRetry\(\s*elements\.coachDashboardStatus,\s*\(\) => refreshCoachDashboard/u,
    /catchWithViewRetry\(\s*elements\.athleteDirectoryStatus,/u
  ];
  for (const re of wiredSites) {
    assert.match(js, re);
  }
});

test("every route with a retry status line has that status line rendered in markup with an id app.js can address", () => {
  assert.match(html, /<p id="athleteDirectoryStatus" class="muted small" role="status" aria-live="polite">/u);
  assert.match(html, /<p id="eventsStatus" class="muted small" role="status" aria-live="polite">/u);
});

test("a form submit or button click cannot be repeated while its own async action is still in flight", () => {
  assert.match(js, /function guardedAction\(buttonSource, asyncFn\)/u);
  assert.match(js, /if \(button\?\.disabled\) return;/u);
  assert.match(js, /if \(button\) button\.disabled = true;/u);
  assert.match(js, /function submitButtonOf\(event\)/u);

  // The count of remaining app.js call sites shrinks by one each time a
  // guardedAction-wrapped function migrates to React (it gains its own
  // disabled-while-submitting state instead) - see the migrated list below.
  // acceptRelationshipInvitation/declineRelationshipInvitation/
  // endAthleteRelationship's button listeners each dropped one when those
  // panels moved to React (AccountCoachInvitationsPanel.tsx/
  // AccountCoachRelationshipPanel.tsx), and inviteAthleteByEmail/
  // confirmSendCoachBroadcast dropped two more moving to
  // InviteAthleteByEmailPanel.tsx/CoachBroadcastPanel.tsx (connectAthlete's
  // own submit binding was never guardedAction-wrapped to begin with).
  const guardedCallCount = [...js.matchAll(/guardedAction\(/gu)].length - 1; // -1 for the function definition itself
  assert.ok(guardedCallCount >= 4, `expected at least 4 guardedAction call sites, found ${guardedCallCount}`);

  // saveAccountProfile/requestAccountVerificationCode/verifyAccountEmail/
  // saveAccountPassword/submitSupportReport/requestDataExportAction/
  // confirmDataDeletionAction/closePersistentAccount migrated to React,
  // which handles its own in-flight/disabled submit state per component -
  // see public/app-src/screens/account/.
  for (const fn of [
    "handleResetRequest", "handleResetComplete"
  ]) {
    const re = new RegExp(`guardedAction\\((?:submitButtonOf|elements\\.\\w+), ${fn}\\)`, "u");
    assert.match(js, re, `expected a guardedAction wrapping ${fn}`);
  }

  // React's own equivalent of the same guarantee: the support report, the
  // export request, the deletion confirm and the account closure request
  // each disable their own button while their state's own submitting/
  // requestingExport flag is true, instead of a shared elements.*-keyed
  // helper.
  assert.match(supportPanel, /type="submit" disabled=\{submitting\}/u);
  assert.match(supportHook, /submitting: true/u);
  assert.match(dataRightsPanel, /disabled=\{requestingExport\}/u);
  assert.match(dataRightsPanel, /type="submit" disabled=\{submitting\}/u);
  assert.match(dataRightsHook, /requestingExport: true/u);
  assert.match(dataRightsHook, /submitting: true/u);

  const accountClosurePanel = read("public/app-src/screens/account/AccountClosurePanel.tsx");
  assert.match(accountClosurePanel, /type="submit" disabled=\{submitting\}/u);

  // Same guarantee for the pending-invitations accept/decline buttons and
  // the end-relationship button - each disables while its own actingId/
  // endingId busy-flag matches the specific record being acted on.
  assert.match(invitationsPanel, /disabled=\{busy\}/u);
  assert.match(relationshipPanel, /disabled=\{endingId === relationshipId\}/u);

  // Same guarantee for the coach's invite-by-email, broadcast and
  // relationship-audit revoke/cancel forms, now React too.
  assert.match(inviteByEmailPanel, /type="submit" disabled=\{submitting\}/u);
  assert.match(broadcastPanel, /type="submit" disabled=\{submitting\}/u);
  assert.match(connectAthletePanel, /type="submit" disabled=\{submitting\}/u);
  assert.match(athleteRelationshipDetailPanel, /disabled=\{transitioning\}/u);
});

test("leaving a form with unsaved changes - a coach note or a programme draft - requires explicit confirmation, including on browser refresh/close", () => {
  assert.match(js, /let coachNoteDirty = false;/u);
  assert.match(js, /function confirmCoachNoteDeparture\(\) \{/u);
  assert.match(js, /if \(!coachNoteDirty\) return true;/u);
  assert.match(js, /if \(!confirmCoachNoteDeparture\(\)\) \{\s*\n\s*return false;/u);

  // The coach note form itself moved to React (CoachReviewPanel.tsx) - it
  // dispatches kolosseum:coach-note-dirty-changed on every keystroke
  // instead of setting a shared elements.coachNoteText input listener,
  // and this legacy listener keeps coachNoteDirty in sync from it.
  assert.match(js, /document\.addEventListener\("kolosseum:coach-note-dirty-changed", \(event\) => \{\s*\n\s*coachNoteDirty = Boolean\(event\.detail\?\.dirty\);/u);
  assert.match(reviewHook, /dispatchNoteDirty\(dirty: boolean\)/u);

  const beforeunload = js.match(/globalThis\.addEventListener\("beforeunload", \(event\) => \{[\s\S]*?\n\}\);/u);
  assert.ok(beforeunload, "expected a beforeunload guard");
  assert.match(beforeunload[0], /templateDraftIsDirty\(\)/u);
  assert.match(beforeunload[0], /coachNoteDirty/u);
  assert.match(beforeunload[0], /event\.preventDefault\(\);/u);
});

test("destructive or state-changing actions require an explicit confirmation before the request is sent", () => {
  // transitionCoachRelationship's, recordAssignment's and
  // cancelAssignmentForAthlete's window.confirm()/globalThis.confirm() calls
  // moved to React with them - see AthleteRelationshipDetailPanel.tsx/
  // AthleteProfileAssignmentPanel.tsx below. The standalone #view-assign
  // twin those last two were shared with is gone outright (unreachable dead
  // code), not just migrated.
  const confirmCallCount = [...js.matchAll(/globalThis\.confirm\(|window\.confirm\(/gu)].length;
  assert.ok(confirmCallCount >= 5, `expected at least 5 confirm() gates, found ${confirmCallCount}`);

  assert.match(athleteRelationshipDetailPanel, /window\.confirm\(/u);
  assert.match(athleteRelationshipDetailPanel, /Historical records will be preserved/u);

  // Both the assign/replace submit and the cancel action confirm first.
  const assignmentPanelConfirmCount = [...assignmentPanel.matchAll(/window\.confirm\(confirmation\)/gu)].length;
  assert.equal(assignmentPanelConfirmCount, 2);

  // Account closure and data-deletion use a stronger typed-word confirmation
  // rather than a dismissable browser confirm() dialog.
  const accountClosurePanel = read("public/app-src/screens/account/AccountClosurePanel.tsx");
  assert.match(accountClosurePanel, /placeholder="Type CLOSE"/u);
  assert.match(dataRightsPanel, /placeholder="Type DELETE"/u);
});

test("an unmapped internal error token never reaches the user as raw text - it always falls back to a status-appropriate plain-English message", () => {
  assert.doesNotMatch(js, /messages\[reason\] \?\? titleCase\(reason\)/u);
  assert.match(js, /messages\[reason\] \?\? genericFriendlyMessageForStatus\(status\)/u);
  assert.match(js, /function genericFriendlyMessageForStatus\(status\) \{/u);
  for (const code of ["401", "403", "404", "409", "423", "429"]) {
    assert.match(js, new RegExp(`if \\(status === ${code}\\) return`, "u"));
  }
  assert.match(js, /status >= 500\) return "Something went wrong on our end/u);
});

test("an athlete's stale cached today/history state is never left on screen while the server confirms or supersedes it on boot", () => {
  const athleteBoot = js.match(/if \(state\.role === "athlete"\) \{[\s\S]*?\n {2}\}\n {2}else \{/u);
  assert.ok(athleteBoot, "expected the athlete branch of enterApplication");
  assert.match(athleteBoot[0], /showBusy\(/u);
  assert.match(athleteBoot[0], /await refreshHistory\(\{ quiet: true \}\);/u);
  assert.match(athleteBoot[0], /await loadAthleteToday\(\);/u);
  assert.match(athleteBoot[0], /finally \{\s*\n\s*hideBusy\(\);/u);
});

test("a coach deep link to a specific event or review athlete never reports success for a stale/invalid id - it falls through to the generic not-available notice", () => {
  // React owns the event detail/lifecycle view now
  // (CoachEventDetailPanel.tsx/useCoachEventDetail.ts) - like the review-
  // athlete deep link below, route_bootstrap.js can no longer validate a
  // deep-linked event_id synchronously (no DOM card lookup), so it
  // dispatches kolosseum:open-event-detail unconditionally and the hook's
  // own GET /coach-workspace/events/:event_id fetch validates it once
  // resolved, dispatching kolosseum:coach-event-detail-not-found for a
  // stale/invalid id - never silently reporting success for a bad one.
  const eventDetail = routeBootstrap.match(/if \(route\.route_id === "coach_event_detail"[\s\S]*?\n {2}\}\n/u);
  assert.ok(eventDetail, "expected the coach_event_detail branch");
  assert.match(eventDetail[0], /kolosseum:open-event-detail/u);

  assert.match(routeBootstrap, /kolosseum:coach-event-detail-not-found/u);

  // The review queue's athlete filter moved to React (CoachReviewPanel.tsx/
  // useCoachReview.ts) - its athlete list now loads asynchronously, so
  // route_bootstrap.js can no longer validate a deep-linked athlete_id
  // synchronously against a <select>'s options. The hook itself validates
  // once its own fetch resolves and dispatches
  // kolosseum:coach-review-athlete-not-found for a stale/invalid id,
  // which route_bootstrap.js's showRouteNotice() reports exactly as
  // before - never silently reporting success for a bad id.
  const reviewAthlete = routeBootstrap.match(/if \(route\.route_id === "coach_review_athlete"[\s\S]*?\n {2}\}\n/u);
  assert.ok(reviewAthlete, "expected the coach_review_athlete branch");
  assert.match(reviewAthlete[0], /kolosseum:open-session-review/u);

  assert.match(routeBootstrap, /kolosseum:coach-review-athlete-not-found/u);
  assert.match(routeBootstrap, /showRouteNotice\("The requested record is not available in this workspace\."\)/u);

  assert.match(reviewHook, /if \(state\.athleteNamesById\[pendingAthleteId\]\) \{/u);
  assert.match(reviewHook, /document\.dispatchEvent\(new CustomEvent\(ATHLETE_NOT_FOUND_EVENT\)\);/u);
});

test("a coach programme-detail deep link that finds no matching template also falls through to the generic not-available notice", () => {
  const programmeDetail = routeBootstrap.match(/if \(route\.route_id === "coach_programme_detail"\) \{[\s\S]*?\n {2}\}\n/u);
  assert.ok(programmeDetail, "expected the coach_programme_detail branch");
  assert.match(programmeDetail[0], /if \(target\) \{/u);
  assert.doesNotMatch(programmeDetail[0].replace(/if \(target\) \{[\s\S]*?\n {4}\}/u, ""), /return true;/u);
});

test("deep-linkable entity-detail routes are wired for real elements in the DOM, not a dead custom event with no listener", () => {
  assert.doesNotMatch(routeBootstrap, /kolosseum:event-detail-route/u);

  // The review route now dispatches kolosseum:open-session-review instead
  // of clicking a (now-removed) #loadReviewButton - confirm it has real
  // listeners rather than being a dead event with nothing subscribed:
  // route_bootstrap.js's own (navigation) and useCoachReview.ts's (athlete
  // filter + data fetch).
  const openSessionReviewDispatchCount = [...routeBootstrap.matchAll(/kolosseum:open-session-review/gu)].length;
  assert.ok(openSessionReviewDispatchCount >= 2, "expected both a dispatch and a listener for kolosseum:open-session-review");
  assert.match(js, /"kolosseum:open-session-review"/u);
  assert.match(reviewHook, /OPEN_SESSION_REVIEW_EVENT = "kolosseum:open-session-review"/u);
  assert.match(reviewHook, /document\.addEventListener\(OPEN_SESSION_REVIEW_EVENT, handleOpenReview\)/u);

  // Same proof for the event-detail route: the old [data-event-id] card
  // lookup (which only ever highlighted a row - nothing "opened") is gone,
  // replaced by kolosseum:open-event-detail with a real listener in
  // useCoachEventDetail.ts, not a dead event with nothing subscribed.
  assert.doesNotMatch(routeBootstrap, /\[data-event-id="\$\{escapeSelector\(params\.event_id\)\}"\]/u);
  const openEventDetailDispatchCount = [...routeBootstrap.matchAll(/kolosseum:open-event-detail/gu)].length;
  assert.ok(openEventDetailDispatchCount >= 2, "expected both a dispatch and a listener for kolosseum:open-event-detail");
  assert.match(eventDetailHook, /OPEN_EVENT_DETAIL_EVENT = "kolosseum:open-event-detail"/u);
  assert.match(eventDetailHook, /document\.addEventListener\(OPEN_EVENT_DETAIL_EVENT, handleOpen\)/u);
});

test("newly touched status/retry surfaces stay visible on narrow (mobile) viewports", () => {
  const mobileHidingRules = [...css.matchAll(/@media[^{]*\{[\s\S]*?\n\}/gu)]
    .map((match) => match[0])
    .filter((block) => /max-width/u.test(block));

  for (const block of mobileHidingRules) {
    for (const selector of ["athleteDirectoryStatus", "eventsStatus", "status-retry-button", "relationship-metric-cards"]) {
      assert.doesNotMatch(
        block,
        new RegExp(`[.#]${selector}[^{]*\\{[^}]*display:\\s*none`, "u"),
        `${selector} must not be hidden on narrow viewports`
      );
    }
  }
});

test("every newly added interactive control is a real focusable button/form, not a div click handler (native semantics before custom keyboard emulation)", () => {
  assert.match(js, /retryButton\.type = "button"/u);
  assert.doesNotMatch(js, /statusElement\.addEventListener\("click"/u);
});
