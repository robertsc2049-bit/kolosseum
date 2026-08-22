import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "product", "ui", "function_manifest.json"), "utf8")
);

test("FULL-UI-01 manifest carries the complete product-area inventory", () => {
  assert.equal(manifest.schema_version, "FULL-UI-01.0.0");
  assert.equal(manifest.source_issue, 798);
  assert.equal(manifest.product_areas.length, 34);

  const areaIds = new Set(manifest.product_areas.map((area) => area.area_id));
  for (const required of [
    "identity_account",
    "athlete_onboarding",
    "coach_commercial",
    "relationships",
    "coach_overview",
    "athlete_directory",
    "strength_references",
    "events",
    "programme_library",
    "programme_builder",
    "event_calendar_binding",
    "assignments",
    "athlete_today",
    "session_execution",
    "athlete_history",
    "coach_review",
    "notifications",
    "data_rights",
    "status_support",
    "founder_admin",
    "organisation_billing",
    "messaging",
    "cross_product_quality",
    "progress_photos",
    "body_metrics_habits",
    "exercise_reference_media",
    "device_sync",
    "exercise_content",
    "video_feedback",
    "progress_insights",
    "athlete_goals",
    "weekly_checkins"
  ]) {
    assert.ok(areaIds.has(required), required);
  }
});

test("FULL-UI-01 manifest retains every delivery slice", () => {
  assert.equal(manifest.delivery_slices.length, 46);
  const sliceIds = manifest.delivery_slices.map((slice) => slice.slice_id);
  assert.deepEqual(
    sliceIds.slice(0, 31),
    Array.from({ length: 31 }, (_, index) =>
      "FULL-UI-" + String(index + 1).padStart(2, "0")
    )
  );
  assert.equal(sliceIds[31], "FULL-UI-32");
  assert.equal(sliceIds[32], "FULL-UI-35");
  assert.equal(sliceIds[33], "FULL-UI-36");
  assert.equal(sliceIds[34], "FULL-UI-37");
  assert.equal(sliceIds[35], "FULL-UI-64");
  assert.equal(sliceIds[36], "FULL-UI-65");
  assert.equal(sliceIds[37], "FULL-UI-66");
  assert.equal(sliceIds[38], "FULL-UI-67");
  assert.equal(sliceIds[39], "FULL-UI-68");
  assert.equal(sliceIds[40], "FULL-UI-69");
  assert.equal(sliceIds[41], "FULL-UI-70");
  assert.equal(sliceIds[42], "FULL-UI-71");
  assert.equal(sliceIds[43], "FULL-UI-72");
  assert.equal(sliceIds[44], "FULL-UI-73");
  assert.equal(sliceIds[45], "FULL-UI-74");
  assert.ok(manifest.delivery_slices.every((slice) => slice.state === "implemented"));
});

test("implemented functions have direct tests and no local-only completion evidence", () => {
  const functions = manifest.product_areas.flatMap((area) => area.functions);
  assert.ok(functions.length >= 150);

  for (const item of functions.filter((entry) => entry.state === "implemented")) {
    assert.equal(typeof item.direct_test, "string", item.function_id);
    assert.notEqual(item.persistence, "localStorage_only", item.function_id);
  }
});
