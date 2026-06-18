import assert from "node:assert/strict";
import test from "node:test";

import {
  FACTUAL_WEEKLY_SUMMARY_COPY_IDS,
  FACTUAL_WEEKLY_SUMMARY_ENGINE_BOUNDARY,
  createFactualWeeklySummaryActivationRecord,
  generateFactualWeeklySummary,
  compileIgnoringFactualWeeklySummary,
  getFactualWeeklySummaryContract,
  lintFactualWeeklySummaryCopy
} from "../src/v1FactualWeeklySummary.mjs";

const activationRequest = Object.freeze({
  summary_id: "sum_week_001",
  athlete_id: "ath_001",
  week_start_at: "2026-08-03T00:00:00Z",
  week_end_at: "2026-08-10T00:00:00Z",
  deliberately_activated: true,
  activated_by_user_id: "ath_001",
  activated_at: "2026-08-02T12:00:00Z",
  delivery_target_id: "athlete_primary_email"
});

const recordedSessions = Object.freeze([
  Object.freeze({
    session_id: "sess_b",
    athlete_id: "ath_001",
    started_at: "2026-08-05T18:00:00Z",
    status: "stopped",
    completed_work_items: 2,
    skipped_work_items: 1,
    partial_work_items: 1,
    substitution_count: 1,
    recorded_events: Object.freeze([
      Object.freeze({ event_type: "session_started", occurred_at: "2026-08-05T18:00:00Z" }),
      Object.freeze({ event_type: "session_split", occurred_at: "2026-08-05T18:20:00Z" }),
      Object.freeze({ event_type: "session_returned", occurred_at: "2026-08-05T18:35:00Z" }),
      Object.freeze({ event_type: "session_stopped", occurred_at: "2026-08-05T18:50:00Z" })
    ])
  }),
  Object.freeze({
    session_id: "sess_a",
    athlete_id: "ath_001",
    started_at: "2026-08-04T18:00:00Z",
    status: "completed",
    completed_work_items: 4,
    skipped_work_items: 0,
    partial_work_items: 0,
    substitution_count: 0,
    recorded_events: Object.freeze([
      Object.freeze({ event_type: "session_started", occurred_at: "2026-08-04T18:00:00Z" }),
      Object.freeze({ event_type: "session_completed", occurred_at: "2026-08-04T19:00:00Z" })
    ])
  }),
  Object.freeze({
    session_id: "sess_outside_week",
    athlete_id: "ath_001",
    started_at: "2026-08-11T18:00:00Z",
    status: "completed",
    completed_work_items: 4,
    skipped_work_items: 0,
    partial_work_items: 0,
    substitution_count: 0,
    recorded_events: Object.freeze([])
  })
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stable(value) {
  return JSON.stringify(value, Object.keys(value).sort());
}

function joined(...parts) {
  return parts.join("");
}

test("S-V1-R-02 requires deliberate activation before generating a weekly summary", () => {
  const activation = createFactualWeeklySummaryActivationRecord({
    ...activationRequest,
    deliberately_activated: false
  });

  assert.equal(activation.activated, false);
  assert.equal(activation.blocked_reason, "not_deliberately_activated");

  const summary = generateFactualWeeklySummary(activation, recordedSessions);
  assert.equal(summary.generated, false);
  assert.equal(summary.blocked_reason, "not_deliberately_activated");
  assert.equal(summary.engine_boundary.mutates_engine_output, false);
});

test("S-V1-R-02 summary fixture reports recorded facts only", () => {
  const activation = createFactualWeeklySummaryActivationRecord(activationRequest);
  const summary = generateFactualWeeklySummary(activation, recordedSessions);

  assert.equal(summary.generated, true);
  assert.equal(summary.summary_id, "sum_week_001");
  assert.equal(summary.athlete_id, "ath_001");
  assert.deepEqual(summary.source_session_ids, ["sess_a", "sess_b"]);
  assert.deepEqual(summary.counts, {
    recorded_session_count: 2,
    completed_session_count: 1,
    stopped_session_count: 1,
    split_event_count: 1,
    returned_event_count: 1,
    completed_work_item_count: 6,
    skipped_work_item_count: 1,
    partial_work_item_count: 1,
    substitution_count: 1
  });
  assert.deepEqual(summary.copy_ids, FACTUAL_WEEKLY_SUMMARY_COPY_IDS);
  assert.deepEqual(summary.engine_boundary, FACTUAL_WEEKLY_SUMMARY_ENGINE_BOUNDARY);
});

test("S-V1-R-02 summary output is byte-stable for equivalent explicit input", () => {
  const activation = createFactualWeeklySummaryActivationRecord(activationRequest);
  const first = generateFactualWeeklySummary(activation, recordedSessions);
  const second = generateFactualWeeklySummary(activation, clone(recordedSessions).reverse());

  assert.equal(first.stable_summary_json, second.stable_summary_json);
  assert.equal(stable(first.counts), stable(second.counts));
});

test("S-V1-R-02 copy lint blocks forbidden judgement and claim terms", () => {
  const clean = lintFactualWeeklySummaryCopy();
  assert.equal(clean.ok, true);

  const blocked = lintFactualWeeklySummaryCopy({
    BAD_COPY: `This week was ${joined("good")}.`
  });

  assert.equal(blocked.ok, false);
  assert.equal(blocked.failures[0].term, joined("good"));
});

test("S-V1-R-02 weekly summary does not alter engine input or output probes", () => {
  const phaseLikeInput = Object.freeze({
    activity_id: "powerlifting",
    execution_scope: "coach_managed",
    source_phase1_hash: "phase1_hash_001",
    planned_item_ids: ["wi_001", "wi_002"]
  });

  const beforeInput = clone(phaseLikeInput);
  const activation = createFactualWeeklySummaryActivationRecord(activationRequest);
  const summary = generateFactualWeeklySummary(activation, recordedSessions);
  const baseProbe = compileIgnoringFactualWeeklySummary(phaseLikeInput, []);
  const summaryProbe = compileIgnoringFactualWeeklySummary(phaseLikeInput, [summary]);

  assert.deepEqual(phaseLikeInput, beforeInput);
  assert.equal(baseProbe.stable_probe_json, summaryProbe.stable_probe_json);
  assert.equal(summaryProbe.ignored_summary_record_count, 1);
  assert.equal(summaryProbe.engine_boundary.reads_engine_input, false);
  assert.equal(summaryProbe.engine_boundary.changes_compile_output, false);
});

test("S-V1-R-02 contract excludes scoring comparison inference and training judgement authority", () => {
  const contract = getFactualWeeklySummaryContract();

  assert.equal(contract.deliberately_activated_required, true);
  assert.equal(contract.engine_boundary.mutates_engine_output, false);
  assert.equal(contract.engine_boundary.writes_engine_input, false);
  assert.equal(contract.engine_boundary.emits_score, false);
  assert.equal(contract.engine_boundary.emits_comparison_order, false);

  const serialised = stable(contract);
  for (const blocked of [
    joined("reco", "mmend"),
    joined("opti", "mal"),
    joined("ad", "vice"),
    joined("effect", "ive"),
    joined("rank"),
    joined("infer"),
    joined("adher", "ence"),
    joined("good"),
    joined("bad"),
    joined("poor")
  ]) {
    assert.equal(serialised.includes(blocked), false);
  }
});