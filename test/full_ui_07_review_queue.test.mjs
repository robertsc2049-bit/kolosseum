// DEV NOTE: FULL-UI-07 durable review queue product proof. The queue's
// rendering (reviewList/coachNoteForm) moved to React - CoachReviewPanel.tsx
// + useCoachReview.ts, mounted at #coach-review-root - see
// public/app-src/__tests__/CoachReviewPanel.test.tsx for its behavioral
// proof. Backend routes, schema and CSS are untouched and still asserted
// directly below.

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(relativePath) {
  return fs.readFileSync(
    relativePath,
    "utf8"
  );
}

const html =
  read("public/app/index.html");

const application =
  read("public/app/app.js");

const styles =
  read("public/app/styles.css");

const schema =
  read("schema.sql");

const server =
  read("src/server.ts");

const routes =
  read(
    "src/api/product_review.routes.ts"
  );

const panel =
  read("public/app-src/screens/coach/CoachReviewPanel.tsx");

// DEV NOTE: the dashboard's "Awaiting review"/"Session records" metric
// counts also moved to React - see CoachOverviewMetricsPanel.tsx/
// useCoachOverviewMetrics.ts, mounted at #coach-overview-metrics-root.
// app.js's state.coachReviewRecords/refreshCoachReviewQueue() are fully
// retired - their only remaining reader was renderCoachDashboard()'s own
// metric-card computation.
const overviewMetricsHook =
  read("public/app-src/screens/coach/useCoachOverviewMetrics.ts");

const hook =
  read("public/app-src/screens/coach/useCoachReview.ts");

test(
  "FULL-UI-07 exposes searchable review queue controls and factual detail",
  () => {
    assert.match(html, /id="coach-review-root"/u);
    assert.doesNotMatch(html, /id="reviewAthlete"/u);

    for (const token of [
      "reviewRecordMatches",
      "ReviewDetail",
      "reviewRecordStatus",
      "reviewRecordDate"
    ]) {
      assert.match(
        panel,
        new RegExp(token, "u")
      );
    }

    assert.match(hook, /const refresh = useCallback/u);
    assert.match(hook, /const markReview = useCallback/u);
  }
);

test(
  "FULL-UI-07 stores immutable reviewed and unreviewed product state",
  () => {
    assert.match(
      schema,
      /CREATE TABLE IF NOT EXISTS product_session_reviews/u
    );

    assert.match(
      schema,
      /review_status IN \([\s\S]*'reviewed'[\s\S]*'unreviewed'/u
    );

    assert.match(
      routes,
      /INSERT INTO product_session_reviews/u
    );

    assert.match(
      routes,
      /ON CONFLICT \([\s\S]*review_record_id/u
    );

    assert.match(
      routes,
      /reviewed_at_iso8601/u
    );

    assert.match(
      routes,
      /previous_review_status/u
    );
  }
);

test(
  "FULL-UI-07 mounts factual read and review-state routes",
  () => {
    assert.match(
      routes,
      /productReviewRouter\.get\([\s\S]*"\/reviews"/u
    );

    assert.match(
      routes,
      /productReviewRouter\.post\([\s\S]*"\/session-review\/:session_id"/u
    );

    assert.match(
      server,
      /productReviewRouter/u
    );

    assert.match(
      server,
      /app\.use\("\/coach-workspace", productReviewRouter\)/u
    );
  }
);

test(
  "FULL-UI-07 fails closed and preserves session artefacts",
  () => {
    assert.match(
      routes,
      /requireAcceptedAccess/u
    );

    assert.match(
      routes,
      /The session does not belong to this coach-athlete relationship/u
    );

    assert.match(
      routes,
      /Open sessions cannot be marked reviewed/u
    );

    assert.match(
      routes,
      /This review action is stale/u
    );

    assert.doesNotMatch(
      routes,
      /UPDATE\s+sessions|DELETE\s+FROM\s+sessions/iu
    );
  }
);

test(
  "FULL-UI-07 displays provenance live status and note visibility",
  () => {
    for (const token of [
      "assignment_provenance",
      "event_provenance",
      "live_status_read_only"
    ]) {
      assert.match(
        routes,
        new RegExp(token, "u")
      );
    }

    for (const token of [
      "Athlete visible",
      "Coach only",
      "Non-binding product note"
    ]) {
      assert.match(
        panel,
        new RegExp(token, "u")
      );
    }

    assert.match(
      panel,
      /cannot alter engine output or session facts/u
    );
  }
);

test(
  "FULL-UI-07 drives dashboard completed-since-review from durable state",
  () => {
    assert.match(
      overviewMetricsHook,
      /loadCoachReviews/u
    );

    assert.match(
      overviewMetricsHook,
      /awaiting_review === true/u
    );

    assert.ok(!application.includes("state.coachReviewRecords"), "state.coachReviewRecords should be fully retired from app.js");
    assert.ok(!application.includes("function refreshCoachReviewQueue"), "refreshCoachReviewQueue() should be fully retired from app.js");
  }
);

test(
  "FULL-UI-07 remains responsive and engine inert",
  () => {
    assert.match(
      styles,
      /FULL-UI-07 durable coach review queue/u
    );

    assert.match(
      styles,
      /@media \(max-width: 620px\)/u
    );

    assert.doesNotMatch(
      routes,
      /engine\/src|runPipelineFromDist|compileBlock|planSessionService/u
    );

    for (const token of [
      "included_in_engine_input:",
      "changes_engine_output:",
      "engine_visible:"
    ]) {
      assert.match(
        routes,
        new RegExp(token, "u")
      );
    }

    assert.match(
      routes,
      /calls_engine: false/u
    );
  }
);
