import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();

const expectedActivities = Object.freeze([
  "powerlifting",
  "general_strength",
  "rugby_union",
  "strongman"
]);

const fixturePath = path.join(
  repoRoot,
  "ci",
  "fixtures",
  "v1_supported_activity_set_lock_negative",
  "s_v1_20_unsupported_activity_negative.json"
);

const boundaryModuleUrl = pathToFileURL(
  path.join(repoRoot, "shared", "v1-boundary", "v1BoundaryGuards.mjs")
).href;

const boundary = await import(`${boundaryModuleUrl}?s_v1_20=${Date.now()}`);

function readFixture() {
  return JSON.parse(fs.readFileSync(fixturePath, "utf8"));
}

test("S-V1-20 locks the supported activity set exactly", () => {
  assert.deepEqual(
    boundary.V1_SUPPORTED_ACTIVITIES,
    expectedActivities,
    "V1_SUPPORTED_ACTIVITIES must stay exactly powerlifting, general_strength, rugby_union, strongman"
  );

  for (const activityId of expectedActivities) {
    assert.equal(
      boundary.assertActivityIsV1Supported(activityId),
      true,
      `expected supported activity to pass: ${activityId}`
    );
  }
});

test("S-V1-20 negative fixture rejects unsupported activities", () => {
  const fixture = readFixture();

  assert.equal(fixture.slice_id, "S-V1-20");
  assert.deepEqual(fixture.locked_supported_activity_ids, expectedActivities);
  assert.equal(fixture.expected_rejection_code, "v1_boundary_guard_unsupported_activity");
  assert.ok(Array.isArray(fixture.unsupported_activity_ids));
  assert.ok(fixture.unsupported_activity_ids.length > 0);

  for (const activityId of fixture.unsupported_activity_ids) {
    assert.equal(
      expectedActivities.includes(activityId),
      false,
      `negative fixture must not include supported activity as unsupported: ${activityId}`
    );

    assert.throws(
      () => boundary.assertActivityIsV1Supported(activityId),
      (error) => error?.code === fixture.expected_rejection_code,
      `expected unsupported activity to be rejected: ${activityId}`
    );
  }
});

test("S-V1-20 documentation points to fixture and proof surfaces", () => {
  const docPath = path.join(repoRoot, "docs", "v1", "V1_SUPPORTED_ACTIVITY_SET_LOCK.md");
  const doc = fs.readFileSync(docPath, "utf8");

  assert.match(doc, /S-V1-20/);
  assert.match(doc, /powerlifting/);
  assert.match(doc, /general_strength/);
  assert.match(doc, /rugby_union/);
  assert.match(doc, /s_v1_20_unsupported_activity_negative\.json/);
  assert.match(doc, /v1_boundary_guard_unsupported_activity/);
});
