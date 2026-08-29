// DEV NOTE: Product template prescription mode static contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const service = read("src/api/beta18_programme_template_service.ts");
const html = read("public/app/index.html");
const css = read("public/app/styles.css");
const js = read("public/app/app.js");
const phase4 = read("engine/src/phases/phase4/types.ts");
const phase6 = read("engine/src/phases/phase6.ts");
// DEV NOTE: the builder's rep/load/duration/distance/prescription-mode
// controls moved to React with the rest of the builder tree (FULL-UI-05B)
// - see CoachProgrammeBuilderTree.tsx's RepControls()/LoadControls()/
// DurationControls()/DistanceControls()/PrescriptionControls().
const builderTree = read("public/app-src/screens/coach/CoachProgrammeBuilderTree.tsx");

test("template input supports fixed reps and rep ranges", () => {
  assert.match(service, /const repModes/u);
  assert.match(service, /"fixed",\s*"range"/u);
  assert.match(service, /repPrescriptionFromInput/u);
  assert.match(service, /rep_range_order_invalid/u);
  assert.match(service, /rep_prescription/u);
});

test("template input supports percentage, weight, bodyweight and RPE loading", () => {
  assert.match(service, /const loadModes/u);
  assert.match(service, /"percent_1rm",\s*"fixed_weight",\s*"bodyweight",\s*"rpe"/u);
  assert.match(service, /loadingReferenceFromInput/u);
  assert.match(service, /weightUnits/u);
  assert.match(service, /weight_value_invalid/u);
  assert.match(service, /type: "bodyweight"/u);
  assert.match(service, /type: "rpe"/u);
  assert.match(service, /rpe_value_invalid/u);
  assert.match(service, /stored_rpe_value_invalid/u);
});

test("engine carries the complete explicit prescription to the session", () => {
  assert.match(phase4, /rep_range\?: PlannedItemRepRange/u);
  assert.match(phase4, /unit\?: "kg" \| "lb"/u);
  assert.match(phase4, /type: "bodyweight"/u);
  assert.match(phase6, /repRangeFromItem/u);
  assert.match(phase6, /rep_range: repRange/u);
  assert.match(phase6, /intensity: it\.intensity/u);
});

test("coach builder exposes conditional rep and loading controls", () => {
  assert.match(html, /Repetitions may be fixed or a range/u);
  assert.match(html, /fixed weight, bodyweight, or RPE/u);
  assert.match(builderTree, /function RepControls/u);
  assert.match(builderTree, /function LoadControls/u);
  assert.match(builderTree, />Fixed reps</u);
  assert.match(builderTree, />Rep range</u);
  assert.match(builderTree, />Weight</u);
  assert.match(builderTree, />Bodyweight</u);
  assert.match(builderTree, />RPE</u);
  assert.match(builderTree, /weight_unit/u);
  assert.match(js, /normalisePersistedTemplateDraft/u);
  assert.match(css, /\.template-prescription-grid/u);
  assert.match(css, /\.template-prescription-card/u);
});

test("athlete session formatting distinguishes range and loading type", () => {
  assert.ok(js.includes("${repRange.minimum}–${repRange.maximum} reps"));
  assert.match(js, /% 1RM/u);
  assert.ok(js.includes("details.push(`${Number(intensity.value)} ${unit}`)"));
  assert.match(js, /details\.push\("Bodyweight"\)/u);
  assert.match(js, /RPE \$\{Number\(intensity\.value\)\}/u);
});

test("template input supports duration and distance prescriptions alongside reps", () => {
  assert.match(service, /const prescriptionModes/u);
  assert.match(service, /"reps",\s*"duration",\s*"distance"/u);
  assert.match(service, /const distanceUnits/u);
  assert.match(service, /"meters",\s*"feet"/u);
  assert.match(service, /function durationPrescriptionFromInput/u);
  assert.match(service, /function distancePrescriptionFromInput/u);
  assert.match(service, /duration_range_order_invalid/u);
  assert.match(service, /distance_range_order_invalid/u);
  assert.match(service, /prescription_mode_invalid/u);
});

test("template input supports an optional coaching tempo", () => {
  assert.match(service, /work_item_tempo_invalid/u);
  assert.match(service, /\[0-9Xx\]-\[0-9Xx\]-\[0-9Xx\]-\[0-9Xx\]/u);
});

test("coach builder exposes a prescription mode selector with duration and distance controls", () => {
  assert.match(html, /timed hold or a distance/u);
  assert.match(builderTree, /function PrescriptionControls/u);
  assert.match(builderTree, /function DurationControls/u);
  assert.match(builderTree, /function DistanceControls/u);
  assert.match(builderTree, />Prescribe by</u);
  assert.match(builderTree, />Duration</u);
  assert.match(builderTree, />Distance</u);
  assert.match(builderTree, /Tempo \(optional\)/u);
  assert.match(css, /\.template-tempo-field/u);
});

test("athlete session formatting distinguishes duration, distance and tempo", () => {
  assert.match(js, /Hold \$\{durationRange\.minimum\}–\$\{durationRange\.maximum\}s/u);
  assert.match(js, /Hold \$\{exercise\.duration_seconds\}s/u);
  assert.match(js, /Tempo \$\{tempo\}/u);
});
