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
    "coachOverviewReviewQueue",
    "coachOverviewEvents"
  ];

  for (const id of ids) {
    assert.ok(
      html.includes(`id="${id}"`),
      `missing dashboard control ${id}`
    );
  }
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
    "open-event",
    "open-programmes",
    "openAthleteProfile",
    "loadCoachReview",
    "#/coach/events/"
  ];

  for (const action of actions) {
    assert.ok(
      application.includes(action),
      `missing dashboard action ${action}`
    );
  }
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
