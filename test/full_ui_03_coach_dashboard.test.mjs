// DEV NOTE: FULL-UI-03 factual coach-dashboard surface proof.

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(
  new URL("../public/app/index.html", import.meta.url),
  "utf8"
);

const application = fs.readFileSync(
  new URL("../public/app/app.js", import.meta.url),
  "utf8"
);

const styles = fs.readFileSync(
  new URL("../public/app/styles.css", import.meta.url),
  "utf8"
);

const manifest = JSON.parse(
  fs.readFileSync(
    new URL(
      "../product/ui/function_manifest.json",
      import.meta.url
    ),
    "utf8"
  )
);

// DEV NOTE: every dashboard panel (Connected athletes, Action queue, Open
// sessions, Completed since review, Upcoming events) AND the metric-count
// strip above them have moved to React - see public/app-src/screens/coach/
// CoachOverviewAthletesPanel.tsx/useCoachOverviewAthletes.ts,
// CoachOverviewAssignmentsPanel.tsx/useCoachOverviewAssignments.ts,
// CoachOverviewSessionReviewPanel.tsx/useCoachOverviewSessionReview.ts,
// CoachOverviewEventsPanel.tsx/useCoachOverviewEvents.ts and
// CoachOverviewMetricsPanel.tsx/useCoachOverviewMetrics.ts. Only the
// dashboard status line stays legacy - see that component's own DEV NOTE
// for why.
const coachOverviewEventsPanel = fs.readFileSync(
  new URL("../public/app-src/screens/coach/CoachOverviewEventsPanel.tsx", import.meta.url),
  "utf8"
);
const coachOverviewAssignmentsPanel = fs.readFileSync(
  new URL("../public/app-src/screens/coach/CoachOverviewAssignmentsPanel.tsx", import.meta.url),
  "utf8"
);
const coachOverviewSessionReviewPanel = fs.readFileSync(
  new URL("../public/app-src/screens/coach/CoachOverviewSessionReviewPanel.tsx", import.meta.url),
  "utf8"
);
const coachOverviewAthletesPanel = fs.readFileSync(
  new URL("../public/app-src/screens/coach/CoachOverviewAthletesPanel.tsx", import.meta.url),
  "utf8"
);
const coachOverviewMetricsPanel = fs.readFileSync(
  new URL("../public/app-src/screens/coach/CoachOverviewMetricsPanel.tsx", import.meta.url),
  "utf8"
);

test("FULL-UI-03 exposes the complete factual coach dashboard", () => {
  const ids = [
    "coachDashboardRefreshButton",
    "coachDashboardStatus"
  ];

  for (const id of ids) {
    assert.ok(
      html.includes(`id="${id}"`),
      `missing dashboard control ${id}`
    );
  }

  for (const id of [
    "coachAthleteCount",
    "coachAssignmentCount",
    "coachArtefactCount",
    "coachOpenSessionCount",
    "coachCompletedSessionCount",
    "coachUpcomingEventCount"
  ]) {
    assert.ok(!html.includes(`id="${id}"`), `legacy metric control ${id} should be fully retired`);
  }

  assert.ok(html.includes('id="coach-overview-metrics-root"'), "missing coach-overview-metrics-root");
  assert.ok(coachOverviewMetricsPanel.includes("Connected athletes"));
  assert.ok(coachOverviewMetricsPanel.includes("Assignments recorded"));
  assert.ok(coachOverviewMetricsPanel.includes("Session records"));
  assert.ok(coachOverviewMetricsPanel.includes("Open sessions"));
  assert.ok(coachOverviewMetricsPanel.includes("Awaiting review"));
  assert.ok(coachOverviewMetricsPanel.includes("Upcoming events"));

  assert.ok(html.includes('id="coach-overview-events-root"'), "missing coach-overview-events-root");
  assert.ok(!html.includes('id="coachOverviewEvents"'), "legacy coachOverviewEvents mount point should be fully retired");
  assert.ok(html.includes('id="coach-overview-assignments-root"'), "missing coach-overview-assignments-root");
  assert.ok(!html.includes('id="coachOverviewAssignments"'), "legacy coachOverviewAssignments mount point should be fully retired");
  assert.ok(html.includes('id="coach-overview-open-sessions-root"'), "missing coach-overview-open-sessions-root");
  assert.ok(!html.includes('id="coachOverviewOpenSessions"'), "legacy coachOverviewOpenSessions mount point should be fully retired");
  assert.ok(html.includes('id="coach-overview-review-queue-root"'), "missing coach-overview-review-queue-root");
  assert.ok(!html.includes('id="coachOverviewReviewQueue"'), "legacy coachOverviewReviewQueue mount point should be fully retired");
  assert.ok(html.includes('id="coach-overview-athletes-root"'), "missing coach-overview-athletes-root");
  assert.ok(!html.includes('id="coachOverviewAthletes"'), "legacy coachOverviewAthletes mount point should be fully retired");
});

test("FULL-UI-03 loads server-authoritative coach records", () => {
  const tokens = [
    "refreshCoachDashboard",
    "renderCoachDashboard",
    "refreshCoachAthletes",
    "refreshCoachAssignments",
    "refreshCoachEvents",
    "refreshTemplates",
    "/sessions/beta-coach-artefacts",
    "Promise.all(refreshers)",
    "state.coachDashboardFailures"
  ];

  for (const token of tokens) {
    assert.ok(
      application.includes(token),
      `missing dashboard implementation token ${token}`
    );
  }

  // state.coachDashboardArtefacts/state.coachReviewRecords and
  // refreshCoachReviewQueue() are fully retired - their only remaining
  // reader was renderCoachDashboard()'s own metric-card computation,
  // itself removed now that the metric strip is React (see
  // CoachOverviewMetricsPanel.tsx/useCoachOverviewMetrics.ts, which
  // fetches GET /coach-workspace/reviews directly for the same counts).
  // The artefact fan-out above is kept - its per-athlete failure tracking
  // still feeds the still-legacy dashboard status line
  // (state.coachDashboardFailures).
  assert.ok(!application.includes("state.coachDashboardArtefacts"), "state.coachDashboardArtefacts should be fully retired from app.js");
  assert.ok(!application.includes("state.coachReviewRecords"), "state.coachReviewRecords should be fully retired from app.js");
  assert.ok(!application.includes("function refreshCoachReviewQueue"), "refreshCoachReviewQueue() should be fully retired from app.js");
});

test("FULL-UI-03 provides direct coach actions", () => {
  const actions = [
    "open-athlete",
    "open-programmes",
    "openAthleteProfile"
  ];

  for (const action of actions) {
    assert.ok(
      application.includes(action),
      `missing dashboard action ${action}`
    );
  }

  // "open-assignment" moved to React (CoachOverviewAssignmentsPanel.tsx) -
  // it dispatches the same kolosseum:open-athlete-profile-request bridge
  // event AthleteDirectoryPanel.tsx already uses, with an extra
  // focus_assignment flag app.js's shared listener uses to preserve the
  // scroll-to-assignment-panel nicety the removed dashboard-action branch
  // provided.
  assert.ok(!application.includes('if (action === "open-assignment")'), "the open-assignment action branch should be fully retired from app.js");
  assert.ok(coachOverviewAssignmentsPanel.includes("kolosseum:open-athlete-profile-request"));
  assert.ok(coachOverviewAssignmentsPanel.includes("focus_assignment"));
  assert.ok(application.includes("event.detail?.focus_assignment"));

  // "open-event" moved to React (CoachOverviewEventsPanel.tsx) - it
  // navigates the same way legacy's bindCoachDashboardActions() used to
  // (click the legacy nav button for the Events view, then set
  // location.hash to the specific event), just without the
  // data-dashboard-action delegation legacy used.
  assert.ok(!application.includes('"open-event"'), "the open-event action branch should be fully retired from app.js");
  assert.ok(coachOverviewEventsPanel.includes("#/coach/events/"));
  assert.ok(coachOverviewEventsPanel.includes('data-view="events"'));

  // "open-review" (Open sessions/Review queue) moved to React too
  // (CoachOverviewSessionReviewPanel.tsx/useCoachOverviewSessionReview.ts)
  // - loadCoachReview() is retired, dashboardActionButton()/the
  // dashboard-action="open-review" branch are fully retired from app.js,
  // and both "Open live status"/"Review record" buttons dispatch the same
  // kolosseum:open-session-review bridge event the other entry points
  // into the review view (AthleteHistoryPanels.tsx, route_bootstrap.js's
  // coach_review_athlete deep link) already use - app.js's own listener
  // for that event still owns the setView("review") navigation.
  assert.ok(!application.includes("loadCoachReview"), "loadCoachReview() should be fully retired from app.js");
  assert.ok(!application.includes('if (action === "open-review")'), "the open-review dashboard-action branch should be fully retired from app.js");
  assert.ok(!application.includes("function dashboardActionButton"), "dashboardActionButton() should be fully retired from app.js");
  assert.ok(coachOverviewSessionReviewPanel.includes("kolosseum:open-session-review"));
  assert.match(application, /"kolosseum:open-session-review",\s*\n\s*\(event\) => \{\s*\n\s*const athleteUserId = event\.detail\?\.athlete_user_id;\s*\n\s*if \(!athleteUserId\) return;\s*\n\s*\n\s*setView\("review"\);/u);

  // "Connected athletes" moved to React too
  // (CoachOverviewAthletesPanel.tsx/useCoachOverviewAthletes.ts) -
  // coachAthleteCard()/bindCoachAthleteActions()/profileForAthlete()/
  // currentProfileBenchmarks()/relationshipEffectiveState()/
  // refreshCoachAthleteProfiles()/dashboardEmptyState() are all fully
  // retired from app.js, and its "Open profile" button dispatches the
  // same kolosseum:open-athlete-profile-request event
  // AthleteDirectoryPanel.tsx already uses.
  assert.ok(!application.includes("function coachAthleteCard"), "coachAthleteCard() should be fully retired from app.js");
  assert.ok(!application.includes("function bindCoachAthleteActions"), "bindCoachAthleteActions() should be fully retired from app.js");
  assert.ok(!application.includes("function dashboardEmptyState"), "dashboardEmptyState() should be fully retired from app.js");
  assert.ok(coachOverviewAthletesPanel.includes("kolosseum:open-athlete-profile-request"));
});

test("FULL-UI-03 remains factual and read-only", () => {
  const marker = application.indexOf(
    "// FULL-UI-03 factual coach dashboard."
  );

  const end = application.indexOf(
    "function renderCoachWorkspace()",
    marker
  );

  assert.ok(marker >= 0);
  assert.ok(end > marker);

  const dashboardSource = application.slice(marker, end);

  for (const forbidden of [
    "readiness score",
    "performance score",
    "rank athlete",
    "predict outcome",
    "recommended load",
    "engine override"
  ]) {
    assert.equal(
      dashboardSource.toLowerCase().includes(forbidden),
      false,
      `forbidden dashboard inference: ${forbidden}`
    );
  }

  assert.ok(
    coachOverviewSessionReviewPanel.includes("recorded events")
  );

  assert.ok(
    dashboardSource.includes("factual coach records")
  );
});

test("FULL-UI-03 has responsive product styling", () => {
  for (const token of [
    "FULL-UI-03 factual coach dashboard",
    "coach-dashboard-grid",
    "@media (max-width: 920px)",
    "@media (max-width: 620px)"
  ]) {
    assert.ok(
      styles.includes(token),
      `missing dashboard style token ${token}`
    );
  }
});

test("FULL-UI-03 retains every canonical coach-overview function", () => {
  const serialized = JSON.stringify(manifest);

  for (const functionId of [
    "overview_assignment_queue",
    "overview_completed_since_review",
    "overview_direct_links",
    "overview_factual_counts",
    "overview_open_sessions",
    "overview_relationships",
    "overview_upcoming_events"
  ]) {
    assert.ok(
      serialized.includes(functionId),
      `missing manifest function ${functionId}`
    );
  }
});
