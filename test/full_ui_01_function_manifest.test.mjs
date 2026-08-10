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
  assert.equal(manifest.product_areas.length, 26);

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
    "exercise_reference_media"
  ]) {
    assert.ok(areaIds.has(required), required);
  }
});

test("FULL-UI-01 manifest retains every delivery slice", () => {
  assert.equal(manifest.delivery_slices.length, 30);
  assert.deepEqual(
    manifest.delivery_slices.map((slice) => slice.slice_id),
    Array.from({ length: 30 }, (_, index) =>
      "FULL-UI-" + String(index + 1).padStart(2, "0")
    )
  );
});

test("implemented functions have direct tests and no local-only completion evidence", () => {
  const functions = manifest.product_areas.flatMap((area) => area.functions);
  assert.ok(functions.length >= 150);

  for (const item of functions.filter((entry) => entry.state === "implemented")) {
    assert.equal(typeof item.direct_test, "string", item.function_id);
    assert.notEqual(item.persistence, "localStorage_only", item.function_id);
  }
});
