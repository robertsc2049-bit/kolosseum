import fs from "node:fs";

const TOKEN = "REG_FULL_05_SCAFFOLD_REPAIR";
const SELF = "scripts/reg_full_05_repair_scaffold.mjs";
const lines = (items) => items.join("\n");

function fail(reason, details = {}) {
  const error = new Error(`${TOKEN}: ${reason} ${JSON.stringify(details)}`);
  error.code = TOKEN;
  throw error;
}

function replaceOnce(source, needle, replacement, path) {
  const count = source.split(needle).length - 1;
  if (count !== 1) fail("replace_anchor_invalid", { path, count, needle });
  return source.replace(needle, replacement);
}

function edit(path, mutate) {
  const before = fs.readFileSync(path, "utf8");
  const after = mutate(before);
  if (after === before) fail("file_not_changed", { path });
  fs.writeFileSync(path, after, "utf8");
  console.log(`REG-FULL-05 repair updated ${path}`);
}

edit("scripts/reg_full_05_materialize_sport_context.mjs", (source) => {
  source = replaceOnce(
    source,
    'const COMP_LIFTS = new Set(["back_squat", "bench_press", "deadlift"]);',
    lines([
      'const COMP_LIFTS = new Set(["back_squat", "bench_press", "deadlift"]);',
      'const LINKLESS_METRIC_REASONS = Object.freeze({',
      '  "powerlifting__body_mass_kg": "athlete_context_measure_not_exercise_measure",',
      '  "general_strength__body_mass_kg": "athlete_context_measure_not_exercise_measure",',
      '  "rugby_union__body_mass_kg": "athlete_context_measure_not_exercise_measure",',
      '  "rugby_union__contact_repetition_count": "sport_context_measure_not_exercise_measure",',
      '  "rugby_union__set_piece_repetition_count": "sport_context_measure_not_exercise_measure"',
      '});',
      'const LINKLESS_METRICS = new Set(Object.keys(LINKLESS_METRIC_REASONS));'
    ]),
    "scripts/reg_full_05_materialize_sport_context.mjs"
  );
  source = replaceOnce(
    source,
    lines([
      'const RESISTANCE = new Set(["squat", "hinge", "horizontal_push", "vertical_push", "horizontal_pull", "vertical_pull", "split_squat", "lunge", "step", "calf_ankle", "carry", "core_anti_extension", "core_anti_rotation", "core_anti_lateral", "rotation"]);',
      'const DURATION = new Set(["core_anti_extension", "core_anti_rotation", "core_anti_lateral", "carry", "conditioning_sled", "conditioning_cyclical", "locomotion_walk_run", "locomotion_crawl", "rugby_contact", "rugby_set_piece"]);',
      'const DISTANCE = new Set(["carry", "conditioning_sled", "sprint_acceleration", "sprint_max_velocity", "change_of_direction", "locomotion_walk_run", "locomotion_crawl"]);'
    ]),
    lines([
      'const RESISTANCE = new Set(["squat", "hinge", "single_leg_squat", "single_leg_hinge", "horizontal_push", "incline_push", "decline_push", "vertical_push", "angled_push", "horizontal_pull", "vertical_pull", "carry_bilateral", "carry_unilateral", "core_anti_extension", "core_anti_rotation", "core_anti_lateral_flexion", "rotation", "throw_slam", "conditioning_sled"]);',
      'const DURATION = new Set(["core_anti_extension", "core_anti_rotation", "core_anti_lateral_flexion", "carry_bilateral", "carry_unilateral", "conditioning_sled", "conditioning_cyclical", "conditioning_row", "locomotion_walk", "locomotion_run", "locomotion_crawl"]);',
      'const DISTANCE = new Set(["carry_bilateral", "carry_unilateral", "conditioning_sled", "sprint_acceleration", "sprint_max_velocity", "change_of_direction", "locomotion_walk", "locomotion_run", "locomotion_crawl"]);'
    ]),
    "scripts/reg_full_05_materialize_sport_context.mjs"
  );
  source = replaceOnce(
    source,
    '  if (metricId.endsWith("__body_mass_kg")) return { linkable: false, match: () => false };',
    '  if (LINKLESS_METRICS.has(metricId)) return { linkable: false, match: () => false };',
    "scripts/reg_full_05_materialize_sport_context.mjs"
  );
  source = replaceOnce(
    source,
    lines([
      '  if (metricId.endsWith("__contact_repetition_count")) return { linkable: true, match: (ex) => ex.movement_pattern_id === "rugby_contact" };',
      '  if (metricId.endsWith("__set_piece_repetition_count")) return { linkable: true, match: (ex) => ex.movement_pattern_id === "rugby_set_piece" };',
      ''
    ]),
    '',
    "scripts/reg_full_05_materialize_sport_context.mjs"
  );
  source = replaceOnce(
    source,
    lines([
      'function writeEvidence() {',
      '  const subdivisionRegistry = read(P.subdivision), roleRegistry = read(P.role), metricRegistry = read(P.metric), links = read(P.link), thresholds = read(P.threshold);'
    ]),
    lines([
      'function assertMaterializedForEvidence() {',
      '  const docs = { subdivision: read(P.subdivision), role: read(P.role), metric: read(P.metric), link: read(P.link), threshold: read(P.threshold) };',
      '  const expected = { subdivision: "sport_subdivision", role: "sport_role", metric: "sport_metric", link: "metric_exercise_link", threshold: "threshold_marker" };',
      '  for (const [key, registryId] of Object.entries(expected)) {',
      '    const doc = docs[key];',
      '    if (doc.registry_id !== registryId || doc.version !== "2.0.0") fail("evidence_requires_materialized_registry", { key, registry_id: doc.registry_id, version: doc.version });',
      '  }',
      '  const counts = {',
      '    subdivision: Object.keys(docs.subdivision.entries ?? {}).length,',
      '    role: Object.keys(docs.role.entries ?? {}).length,',
      '    metric: Object.keys(docs.metric.entries ?? {}).length,',
      '    link: Object.keys(docs.link.entries ?? {}).length,',
      '    threshold: Object.keys(docs.threshold.entries ?? {}).length',
      '  };',
      '  if (counts.subdivision < 24 || counts.role < 18 || counts.metric < 32 || counts.link <= 12 || counts.threshold < counts.metric) fail("evidence_requires_completed_reg_full_05_surface", { counts });',
      '  return docs;',
      '}',
      '',
      'function writeEvidence() {',
      '  const { subdivision: subdivisionRegistry, role: roleRegistry, metric: metricRegistry, link: links, threshold: thresholds } = assertMaterializedForEvidence();'
    ]),
    "scripts/reg_full_05_materialize_sport_context.mjs"
  );
  source = replaceOnce(
    source,
    lines([
      '      generic_fallback_allowed: false,',
      '      threshold_marker_supersession:'
    ]),
    lines([
      '      generic_fallback_allowed: false,',
      '      metric_exercise_link_exemptions: Object.entries(LINKLESS_METRIC_REASONS).map(([metric_id, reason]) => ({ metric_id, reason })),',
      '      threshold_marker_supersession:'
    ]),
    "scripts/reg_full_05_materialize_sport_context.mjs"
  );
  return source;
});

edit("ci/registry/reg_full_05_sport_context_completion.mjs", (source) => {
  source = replaceOnce(
    source,
    'const LINKLESS = new Set(["powerlifting__body_mass_kg", "general_strength__body_mass_kg", "rugby_union__body_mass_kg"]);',
    lines([
      'export const REG_FULL_05_LINKLESS_METRIC_REASONS = Object.freeze({',
      '  "powerlifting__body_mass_kg": "athlete_context_measure_not_exercise_measure",',
      '  "general_strength__body_mass_kg": "athlete_context_measure_not_exercise_measure",',
      '  "rugby_union__body_mass_kg": "athlete_context_measure_not_exercise_measure",',
      '  "rugby_union__contact_repetition_count": "sport_context_measure_not_exercise_measure",',
      '  "rugby_union__set_piece_repetition_count": "sport_context_measure_not_exercise_measure"',
      '});',
      'const LINKLESS = new Set(Object.keys(REG_FULL_05_LINKLESS_METRIC_REASONS));'
    ]),
    "ci/registry/reg_full_05_sport_context_completion.mjs"
  );
  source = replaceOnce(
    source,
    '    if (LINKLESS.has(metricId)) { if (count !== 0) fail("reg_full_05_body_mass_metric_must_be_linkless", { metric_id: metricId, count }); }',
    '    if (LINKLESS.has(metricId)) { if (count !== 0) fail("reg_full_05_linkless_metric_must_not_have_exercise_edge", { metric_id: metricId, count }); }',
    "ci/registry/reg_full_05_sport_context_completion.mjs"
  );
  source = replaceOnce(
    source,
    lines([
      '  if (evidence.authority?.metric_exercise_link_runtime_inference_allowed !== false || evidence.authority?.generic_fallback_allowed !== false) fail("reg_full_05_evidence_fallback_boundary_invalid");',
      '  const s = evidence.authority?.threshold_marker_supersession;'
    ]),
    lines([
      '  if (evidence.authority?.metric_exercise_link_runtime_inference_allowed !== false || evidence.authority?.generic_fallback_allowed !== false) fail("reg_full_05_evidence_fallback_boundary_invalid");',
      '  const expectedLinkless = Object.entries(REG_FULL_05_LINKLESS_METRIC_REASONS).map(([metric_id, reason]) => ({ metric_id, reason }));',
      '  if (JSON.stringify(evidence.authority?.metric_exercise_link_exemptions) !== JSON.stringify(expectedLinkless)) fail("reg_full_05_metric_exercise_link_exemption_evidence_invalid", { actual: evidence.authority?.metric_exercise_link_exemptions, expected: expectedLinkless });',
      '  const s = evidence.authority?.threshold_marker_supersession;'
    ]),
    "ci/registry/reg_full_05_sport_context_completion.mjs"
  );
  return source;
});

edit("test/reg_full_05_sport_context_completion.test.mjs", (source) => {
  source = replaceOnce(
    source,
    '  for (const [id, row] of Object.entries(mutated.link.entries)) if (row.sport_metric_id === "rugby_union__contact_repetition_count") delete mutated.link.entries[id];',
    '  for (const [id, row] of Object.entries(mutated.link.entries)) if (row.sport_metric_id === "rugby_union__load_kg") delete mutated.link.entries[id];',
    "test/reg_full_05_sport_context_completion.test.mjs"
  );
  source = replaceOnce(
    source,
    '  expectClosureFailure(() => auditRegFull05Documents(mutated), "reg_full_05_body_mass_metric_must_be_linkless");',
    '  expectClosureFailure(() => auditRegFull05Documents(mutated), "reg_full_05_linkless_metric_must_not_have_exercise_edge");',
    "test/reg_full_05_sport_context_completion.test.mjs"
  );
  source = replaceOnce(
    source,
    'test("REG-FULL-05 requires a threshold marker for every sport metric", () => {',
    lines([
      'test("REG-FULL-05 keeps rugby contact and set-piece context metrics linkless instead of inventing exercise authority", () => {',
      '  const documents = loadRegFull05Documents();',
      '  for (const metricId of ["rugby_union__contact_repetition_count", "rugby_union__set_piece_repetition_count"]) {',
      '    assert.equal(Object.values(documents.link.entries).filter((row) => row.sport_metric_id === metricId).length, 0);',
      '  }',
      '',
      '  const mutated = clone(documents);',
      '  const source = firstLink(mutated, (item) => item.activity_id === "rugby_union");',
      '  const id = `rugby_union__contact_repetition_count__${source.exercise_id}`;',
      '  mutated.link.entries[id] = { ...source, metric_exercise_link_id: id, sport_metric_id: "rugby_union__contact_repetition_count" };',
      '  expectClosureFailure(() => auditRegFull05Documents(mutated), "reg_full_05_linkless_metric_must_not_have_exercise_edge");',
      '});',
      '',
      'test("REG-FULL-05 requires a threshold marker for every sport metric", () => {'
    ]),
    "test/reg_full_05_sport_context_completion.test.mjs"
  );
  return source;
});

edit("docs/roadmap/REG_FULL_05_SPORT_CONTEXT_COMPLETION.md", (source) => {
  source = replaceOnce(
    source,
    'Body-mass metrics are deliberately non-exercise metrics and must have zero metric→exercise links.',
    'Body-mass metrics are deliberately non-exercise metrics and must have zero metric→exercise links. Rugby contact-repetition and set-piece-repetition metrics are also sport-context-only in REG-FULL-05: the canonical movement/exercise universe contains no contact or set-piece exercise authority, so this slice records them without inventing metric→exercise edges. Every other metric remains exercise-linked and must resolve through explicit rows.',
    "docs/roadmap/REG_FULL_05_SPORT_CONTEXT_COMPLETION.md"
  );
  source = replaceOnce(
    source,
    '- body-mass metrics remain linkless;',
    '- the exact declared linkless context metrics (body mass, rugby contact repetitions and rugby set-piece repetitions) remain linkless while every other metric has explicit exercise relations;',
    "docs/roadmap/REG_FULL_05_SPORT_CONTEXT_COMPLETION.md"
  );
  return source;
});

if (fs.existsSync("ci/evidence/reg_full_05_sport_context_completion.v1.json")) {
  fs.unlinkSync("ci/evidence/reg_full_05_sport_context_completion.v1.json");
  console.log("REG-FULL-05 repair removed stale pre-materialisation evidence");
}

fs.unlinkSync(SELF);
console.log("REG-FULL-05 scaffold repair complete");
