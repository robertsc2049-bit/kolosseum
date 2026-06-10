import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  renderCoachQueueReviewReadModel,
} from "../dist/src/coachQueueReviewUiRenderer.js";

const repoRoot = process.cwd();
const fixtureDir = join(repoRoot, "test", "fixtures", "coach-queue-review");

function readExpectedResponses() {
  return JSON.parse(
    readFileSync(join(fixtureDir, "expected_route_responses.json"), "utf8"),
  ).responses;
}

function forbiddenTokens() {
  return [
    "score",
    "rank",
    "readiness_certification",
    "safety",
    "medical",
    "optimisation",
    "optimization",
    "best_action",
    "recommendation",
    "advice",
    "ready to train"
  ];
}

test("primary fixture renders deterministic HTML", () => {
  const responses = readExpectedResponses();
  const first = renderCoachQueueReviewReadModel(responses.primary_coach_queue);
  const second = renderCoachQueueReviewReadModel(responses.primary_coach_queue);

  assert.deepEqual(first, second);
  assert.equal(first.surface_id, "coach_queue_review_ui_renderer");
  assert.equal(first.version, "1.0.0");
  assert.equal(first.html.includes("Coach queue"), true);
  assert.equal(first.html.includes("coach_fixture_primary"), true);
  assert.equal(first.html.includes("queue_item_review_001"), true);
});

test("empty fixture renders empty state", () => {
  const responses = readExpectedResponses();
  const rendered = renderCoachQueueReviewReadModel(responses.empty_coach_queue);

  assert.equal(rendered.html.includes("No review items"), true);
  assert.equal(rendered.html.includes("Queue item count:</strong> 0"), true);
});

test("missing coach ID fixture renders refusal state", () => {
  const responses = readExpectedResponses();
  const rendered = renderCoachQueueReviewReadModel(responses.missing_coach_id);

  assert.equal(rendered.html.includes("Required coach identifier missing"), true);
  assert.equal(rendered.html.includes("coach_id_required"), true);
});

test("rendered HTML contains no forbidden terms", () => {
  const responses = readExpectedResponses();

  for (const response of Object.values(responses)) {
    const rendered = renderCoachQueueReviewReadModel(response);
    const lowerHtml = rendered.html.toLowerCase();

    for (const token of forbiddenTokens()) {
      assert.equal(
        lowerHtml.includes(token.toLowerCase()),
        false,
        `${token} must not appear in rendered HTML`,
      );
    }
  }
});

test("rendered HTML includes factual status labels", () => {
  const responses = readExpectedResponses();
  const rendered = renderCoachQueueReviewReadModel(responses.primary_coach_queue);

  assert.equal(rendered.html.includes("Review required"), true);
  assert.equal(rendered.html.includes("Record available"), true);
  assert.equal(rendered.html.includes("Blocked"), true);
  assert.equal(rendered.html.includes("Source records"), true);
  assert.equal(rendered.html.includes("Blocked reasons"), true);
});

test("dynamic values are escaped", () => {
  const response = {
    status: 200,
    body: {
      ok: true,
      surface_id: "coach_queue_review_api_adapter",
      version: "1.0.0",
      coach_id: 'coach_<script>"x"',
      items: [
        {
          queue_item_id: "queue_<item>",
          coach_id: 'coach_<script>"x"',
          athlete_id: "athlete_&_'_>",
          queue_status: "available",
          review_required: false,
          blocked_reasons: [],
          source_record_refs: ["source_<ref>&"]
        }
      ]
    }
  };

  const rendered = renderCoachQueueReviewReadModel(response);

  assert.equal(rendered.html.includes("<script>"), false);
  assert.equal(rendered.html.includes("&lt;script&gt;"), true);
  assert.equal(rendered.html.includes("&quot;x&quot;"), true);
  assert.equal(rendered.html.includes("athlete_&amp;_&#39;_&gt;"), true);
  assert.equal(rendered.html.includes("source_&lt;ref&gt;&amp;"), true);
});

test("renderer does not mutate input response", () => {
  const responses = readExpectedResponses();
  const response = structuredClone(responses.primary_coach_queue);
  const before = JSON.stringify(response);

  renderCoachQueueReviewReadModel(response);

  assert.equal(JSON.stringify(response), before);
});

test("renderer source does not import or call route handler", () => {
  const rendererSource = readFileSync(
    join(repoRoot, "src", "coachQueueReviewUiRenderer.ts"),
    "utf8",
  );

  assert.equal(rendererSource.includes("handleCoachQueueReviewRoute"), false);
  assert.equal(rendererSource.includes("from \"./coachQueueReviewRouteContract.js\""), false);
});

test("renderer source does not import filesystem network database Express or browser APIs", () => {
  const rendererSource = readFileSync(
    join(repoRoot, "src", "coachQueueReviewUiRenderer.ts"),
    "utf8",
  );

  const banned = [
    "node:fs",
    "node:http",
    "node:https",
    "fetch(",
    "express",
    "sqlite",
    "postgres",
    "prisma",
    "document.",
    "window."
  ];

  for (const token of banned) {
    assert.equal(
      rendererSource.includes(token),
      false,
      `${token} must not appear in renderer source`,
    );
  }
});