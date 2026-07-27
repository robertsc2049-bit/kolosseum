// DEV NOTE: FULL-UI-07 durable review queue product proof.

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

test(
  "FULL-UI-07 exposes searchable review queue controls and factual detail",
  () => {
    for (const id of [
      "reviewAthlete",
      "reviewSearch",
      "reviewStatusFilter",
      "reviewAllCount",
      "reviewAwaitingCount",
      "reviewReviewedCount",
      "reviewOpenCount",
      "reviewList",
      "reviewDetail",
      "reviewDetailContent"
    ]) {
      assert.match(
        html,
        new RegExp(
          `id="${id}"`,
          "u"
        )
      );
    }

    for (const token of [
      "renderCoachReviewWorkspace",
      "filteredCoachReviewRecords",
      "renderCoachReviewDetail",
      "reviewRecordMatches"
    ]) {
      assert.match(
        application,
        new RegExp(token, "u")
      );
    }
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
      "live_status_read_only",
      "reviewNoteList",
      "Athlete visible",
      "Coach only",
      "Non-binding product note"
    ]) {
      assert.match(
        `${routes}\n${application}`,
        new RegExp(token, "u")
      );
    }

    assert.match(
      html,
      /cannot alter engine output or session facts/u
    );
  }
);

test(
  "FULL-UI-07 drives dashboard completed-since-review from durable state",
  () => {
    assert.match(
      application,
      /state\.coachReviewRecords/u
    );

    assert.match(
      application,
      /review_status[\s\S]*"unreviewed"/u
    );

    assert.match(
      application,
      /refreshCoachReviewQueue/u
    );

    assert.match(
      application,
      /completedSessions/u
    );
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
