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

// DEV NOTE: the "Upcoming events" panel moved to React - see
// public/app-src/screens/coach/CoachOverviewEventsPanel.tsx and
// useCoachOverviewEvents.ts. The metric counts, "Connected athletes"/
// "Action queue"/"Open sessions"/"Completed since review" panels and the
// dashboard status line all stay legacy - see that component's own DEV
// NOTE for why.
const coachOverviewEventsPanel = fs.readFileSync(
  new URL("../public/app-src/screens/coach/CoachOverviewEventsPanel.tsx", import.meta.url),
  "utf8"
);

test("FULL-UI-03 exposes the complete factual coach dashboard", () => {
  const ids = [
    "coachDashboardRefreshButton",
    "coachDashboardStatus",
    "coachAthleteCount",
    "coachAssignmentCount",
    "coachArtefactCount",
    "coachOpenSessionCount",
    "coachCompletedSessionCount",
    "coachUpcomingEventCount",
    "coachOverviewAthletes",
    "coachOverviewAssignments",
    "coachOverviewOpenSessions",
    "coachOverviewReviewQueue"
  ];

  for (const id of ids) {
    assert.ok(
      html.includes(`id="${id}"`),
      `missing dashboard control ${id}`
    );
  }

  assert.ok(html.includes('id="coach-overview-events-root"'), "missing coach-overview-events-root");
  assert.ok(!html.includes('id="coachOverviewEvents"'), "legacy coachOverviewEvents mount point should be fully retired");
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
    "state.coachDashboardArtefacts",
    "state.coachDashboardFailures"
  ];

  for (const token of tokens) {
    assert.ok(
      application.includes(token),
      `missing dashboard implementation token ${token}`
    );
  }
});

test("FULL-UI-03 provides direct coach actions", () => {
  const actions = [
    "open-athlete",
    "open-assignment",
    "open-review",
    "open-programmes",
    "openAthleteProfile"
  ];

  for (const action of actions) {
    assert.ok(
      application.includes(action),
      `missing dashboard action ${action}`
    );
  }

  // "open-event" moved to React (CoachOverviewEventsPanel.tsx) - it
  // navigates the same way legacy's bindCoachDashboardActions() used to
  // (click the legacy nav button for the Events view, then set
  // location.hash to the specific event), just without the
  // data-dashboard-action delegation legacy used.
  assert.ok(!application.includes('"open-event"'), "the open-event action branch should be fully retired from app.js");
  assert.ok(coachOverviewEventsPanel.includes("#/coach/events/"));
  assert.ok(coachOverviewEventsPanel.includes('data-view="events"'));

  // "open-review" also moved most of its work to React (CoachReviewPanel.tsx/
  // useCoachReview.ts) - loadCoachReview() is retired, and the dashboard
  // action now dispatches the same kolosseum:open-session-review bridge
  // event the other two entry points into the review view already use.
  assert.ok(!application.includes("loadCoachReview"), "loadCoachReview() should be fully retired from app.js");
  const openReviewAction = application.match(/if \(action === "open-review"\) \{[\s\S]*?\n {8}\}/u);
  assert.ok(openReviewAction, "expected the open-review action branch");
  assert.match(openReviewAction[0], /kolosseum:open-session-review/u);
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
    dashboardSource.includes("recorded events")
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
