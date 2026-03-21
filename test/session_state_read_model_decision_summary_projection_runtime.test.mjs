import test from "node:test";
import assert from "node:assert/strict";

test("decision summary runtime: missing run_id fails explicitly", async () => {
  const mod = await import(`../dist/src/api/session_state_read_model.js?case=missing_run_id`);
  await assert.rejects(
    () => mod.buildCoachSessionDecisionSummaryFromRunId(""),
    /invalid_input: run_id required/
  );
});

test("decision summary runtime: run-backed projection is normalized into stable audit-friendly shape", async (t) => {
  t.mock.module("../dist/src/api/engine_run_persistence_service.js", {
    namedExports: {
      getEngineRunById: async (runId) => ({
        id: runId,
        created_at: "2026-03-21T12:00:00.000Z",
        output: {
          decision: {
            selected: "keep_plan"
          },
          drivers: [
            { code: "timebox_ok" },
            { code: "pain_clear" }
          ],
          issues: [
            { code: "none" }
          ],
          completed_at: "2026-03-21T12:05:00.000Z",
          is_stale: false,
          is_superseded: false,
          is_incomplete: false
        }
      })
    }
  });

  const mod = await import(`../dist/src/api/session_state_read_model.js?case=normalized_success`);
  const result = await mod.buildCoachSessionDecisionSummaryFromRunId("er_test_run_001");

  assert.deepEqual(result, {
    schema: {
      version: "v1"
    },
    identity: {
      run_id: "er_test_run_001"
    },
    currentness: {
      state: "current"
    },
    outcome: {
      decision: {
        selected: "keep_plan"
      }
    },
    drivers: [
      { code: "timebox_ok" },
      { code: "pain_clear" }
    ],
    timeline: {
      created_at: "2026-03-21T12:00:00.000Z",
      completed_at: "2026-03-21T12:05:00.000Z"
    },
    audit: {
      source: "engine_run",
      resolved_from: "run_id"
    },
    issues: [
      { code: "none" }
    ]
  });
});

test("decision summary runtime: malformed persisted output fails explicitly instead of fabricating success", async (t) => {
  t.mock.module("../dist/src/api/engine_run_persistence_service.js", {
    namedExports: {
      getEngineRunById: async (runId) => ({
        id: runId,
        created_at: "2026-03-21T12:00:00.000Z",
        output: null
      })
    }
  });

  const mod = await import(`../dist/src/api/session_state_read_model.js?case=invalid_source`);
  await assert.rejects(
    () => mod.buildCoachSessionDecisionSummaryFromRunId("er_bad_run_001"),
    /invalid_source: engine_run output required/
  );
});
