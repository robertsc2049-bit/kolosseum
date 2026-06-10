
// DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts,
// deterministic checks, and developer handover standards. Do not introduce hidden defaults,
// broad discovery, or unreviewed boundary changes.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const previewPath = join(
  repoRoot,
  "previews",
  "coach-queue-review",
  "static-preview.html",
);
const generatorPath = join(
  repoRoot,
  "scripts",
  "render_coach_queue_review_static_preview.mjs",
);

function readPreview() {
  return readFileSync(previewPath, "utf8");
}

function readGenerator() {
  return readFileSync(generatorPath, "utf8");
}

function forbiddenPreviewTokens() {
  return [
    "score",
    "rank",
    "readiness certification",
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

test("static preview exists and contains the required heading", () => {
  const preview = readPreview();

  assert.equal(preview.includes("<!doctype html>"), true);
  assert.equal(
    preview.includes("Coach Queue Review — Static Preview"),
    true,
  );
});

test("static preview contains a clear non-production notice", () => {
  const preview = readPreview();

  assert.equal(preview.includes("Static non-production preview."), true);
  assert.equal(preview.includes("no live API"), true);
  assert.equal(preview.includes("database"), true);
  assert.equal(preview.includes("route registration"), true);
});

test("static preview includes primary empty and refusal examples", () => {
  const preview = readPreview();

  assert.equal(preview.includes("Primary coach queue fixture"), true);
  assert.equal(preview.includes("Empty coach queue fixture"), true);
  assert.equal(preview.includes("Missing coach identifier fixture"), true);
});

test("static preview contains rendered S53 output", () => {
  const preview = readPreview();

  assert.equal(preview.includes('data-surface="coach_queue_review"'), true);
  assert.equal(preview.includes("queue_item_review_001"), true);
  assert.equal(preview.includes("No review items"), true);
  assert.equal(preview.includes("Required coach identifier missing"), true);
});

test("static preview contains no live API script or route registration", () => {
  const preview = readPreview();

  const banned = [
    "<script",
    "fetch(",
    "XMLHttpRequest",
    "axios",
    "express",
    "app.get",
    "router.get",
    "createServer",
    "sqlite",
    "postgres",
    "prisma",
    "login",
    "auth",
    "href=\"/v0/coach/queue-review\"",
    "href='/v0/coach/queue-review'"
  ];

  for (const token of banned) {
    assert.equal(
      preview.includes(token),
      false,
      `${token} must not appear in static preview`,
    );
  }
});

test("static preview contains no forbidden language", () => {
  const preview = readPreview().toLowerCase();

  for (const token of forbiddenPreviewTokens()) {
    assert.equal(
      preview.includes(token.toLowerCase()),
      false,
      `${token} must not appear in static preview`,
    );
  }
});

test("generator uses S52 expected responses and S53 renderer output", () => {
  const generator = readGenerator();

  assert.equal(generator.includes("expected_route_responses.json"), true);
  assert.equal(generator.includes("renderCoachQueueReviewReadModel"), true);
  assert.equal(generator.includes("coachQueueReviewUiRenderer.js"), true);
});

test("generator does not import S51 route handler or live integration surfaces", () => {
  const generator = readGenerator();

  const banned = [
    "handleCoachQueueReviewRoute",
    "coachQueueReviewRouteContract",
    "fetch(",
    "XMLHttpRequest",
    "axios",
    "express",
    "app.get",
    "router.get",
    "sqlite",
    "postgres",
    "prisma"
  ];

  for (const token of banned) {
    assert.equal(
      generator.includes(token),
      false,
      `${token} must not appear in generator`,
    );
  }
});

test("generator is deterministic against committed static preview", async () => {
  const before = readPreview();

  await import(`file://${generatorPath}?cacheBust=s54-static-preview-test`);

  const after = readPreview();

  assert.equal(after, before);
});
