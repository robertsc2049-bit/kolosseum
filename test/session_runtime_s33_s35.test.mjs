
// DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts,
// deterministic checks, and developer handover standards. Do not introduce hidden defaults,
// broad discovery, or unreviewed boundary changes.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  applyRuntimeEvent,
  initialiseSessionRuntimeState,
  replayRuntimeEvents
} from "../dist/engine/src/runtime/sessionRuntime.js";

const session = {
  session_id: "session_001",
  user_id: "user_001",
  phase1_hash: "phase1_hash_001",
  materialised_session_hash: "materialised_session_hash_001",
  work_items: [
    { work_item_id: "work_001", planned_quantity: 5, unit: "reps" },
    { work_item_id: "work_002", planned_quantity: 3, unit: "sets" },
    { work_item_id: "work_003", planned_quantity: 10, unit: "minutes" }
  ]
};

let n = 0;

function event(event_type, overrides = {}) {
  n += 1;

  return {
    event_id: `event_${String(n).padStart(3, "0")}`,
    session_id: "session_001",
    user_id: "user_001",
    event_type,
    work_item_id: null,
    factual_payload: null,
    occurred_at: `2026-05-19T12:${String(n).padStart(2, "0")}:00.000Z`,
    created_at: `2026-05-19T12:${String(n).padStart(2, "0")}:01.000Z`,
    ...overrides
  };
}

describe("S33 session execution runtime shell", () => {
  it("starts, records work events, and ends a session", () => {
    let state = initialiseSessionRuntimeState(session);

    const started = applyRuntimeEvent(state, event("start_session"));
    assert.equal(started.ok, true);
    state = started.state;

    const completed = applyRuntimeEvent(
      state,
      event("complete_work_item", { work_item_id: "work_001" })
    );
    assert.equal(completed.ok, true);
    state = completed.state;

    const skipped = applyRuntimeEvent(
      state,
      event("skip_work_item", {
        work_item_id: "work_002",
        factual_payload: { reason_code: "not_declared" }
      })
    );
    assert.equal(skipped.ok, true);
    state = skipped.state;

    const partial = applyRuntimeEvent(
      state,
      event("partial_complete_work_item", {
        work_item_id: "work_003",
        factual_payload: {
          declared_completed_quantity: 4,
          declared_planned_quantity: 10,
          unit: "minutes",
          reason_code: "time_unavailable"
        }
      })
    );
    assert.equal(partial.ok, true);
    state = partial.state;

    const ended = applyRuntimeEvent(state, event("end_session"));
    assert.equal(ended.ok, true);

    assert.equal(ended.state.status, "ended");
    assert.deepEqual(ended.state.counts, {
      total: 3,
      completed: 1,
      skipped: 1,
      partial: 1,
      pending: 0
    });
    assert.equal(ended.state.phase1_hash, session.phase1_hash);
    assert.equal(ended.state.materialised_session_hash, session.materialised_session_hash);
    assert.deepEqual(Object.keys(ended.state.work_items), ["work_001", "work_002", "work_003"]);
  });

  it("fails work-item event before start_session", () => {
    const state = initialiseSessionRuntimeState(session);
    const result = applyRuntimeEvent(
      state,
      event("complete_work_item", { work_item_id: "work_001" })
    );

    assert.equal(result.ok, false);
    assert.equal(result.code, "invalid_event_order");
  });

  it("fails duplicate completion deterministically", () => {
    let state = initialiseSessionRuntimeState(session);

    const started = applyRuntimeEvent(state, event("start_session"));
    assert.equal(started.ok, true);
    state = started.state;

    const first = applyRuntimeEvent(
      state,
      event("complete_work_item", { work_item_id: "work_001" })
    );
    assert.equal(first.ok, true);
    state = first.state;

    const duplicate = applyRuntimeEvent(
      state,
      event("complete_work_item", { work_item_id: "work_001" })
    );

    assert.equal(duplicate.ok, false);
    assert.equal(duplicate.code, "duplicate_work_item_terminal_event");
  });

  it("fails work-item event after ended session", () => {
    let state = initialiseSessionRuntimeState(session);

    const started = applyRuntimeEvent(state, event("start_session"));
    assert.equal(started.ok, true);
    state = started.state;

    const ended = applyRuntimeEvent(state, event("end_session"));
    assert.equal(ended.ok, true);
    state = ended.state;

    const afterEnd = applyRuntimeEvent(
      state,
      event("skip_work_item", { work_item_id: "work_001" })
    );

    assert.equal(afterEnd.ok, false);
    assert.equal(afterEnd.code, "invalid_event_order");
  });

  it("fails unknown work item", () => {
    let state = initialiseSessionRuntimeState(session);

    const started = applyRuntimeEvent(state, event("start_session"));
    assert.equal(started.ok, true);
    state = started.state;

    const result = applyRuntimeEvent(
      state,
      event("complete_work_item", { work_item_id: "unknown_work" })
    );

    assert.equal(result.ok, false);
    assert.equal(result.code, "unknown_work_item");
  });

  it("fails duplicate event_id", () => {
    let state = initialiseSessionRuntimeState(session);

    const e = event("start_session", { event_id: "same_event" });
    const started = applyRuntimeEvent(state, e);
    assert.equal(started.ok, true);
    state = started.state;

    const result = applyRuntimeEvent(
      state,
      event("end_session", { event_id: "same_event" })
    );

    assert.equal(result.ok, false);
    assert.equal(result.code, "duplicate_event_id");
  });
});

describe("S34 split / return runtime", () => {
  it("splits and resumes from previous factual state", () => {
    const events = [
      event("start_session"),
      event("complete_work_item", { work_item_id: "work_001" }),
      event("partial_complete_work_item", {
        work_item_id: "work_002",
        factual_payload: {
          declared_completed_quantity: 1,
          declared_planned_quantity: 3,
          unit: "sets"
        }
      }),
      event("split_session", { factual_payload: { reason_code: "time_unavailable" } }),
      event("return_to_session"),
      event("resume_session"),
      event("skip_work_item", { work_item_id: "work_003" })
    ];

    const result = replayRuntimeEvents(session, events);

    assert.equal(result.ok, true);
    assert.equal(result.state.status, "active");
    assert.equal(result.state.work_items.work_001.status, "completed");
    assert.equal(result.state.work_items.work_002.status, "partial");
    assert.equal(result.state.work_items.work_003.status, "skipped");
    assert.deepEqual(Object.keys(result.state.work_items), ["work_001", "work_002", "work_003"]);
  });

  it("fails work event while split", () => {
    const events = [
      event("start_session"),
      event("split_session"),
      event("complete_work_item", { work_item_id: "work_001" })
    ];

    const result = replayRuntimeEvents(session, events);

    assert.equal(result.ok, false);
    assert.equal(result.code, "invalid_event_order");
  });

  it("fails resume without split", () => {
    const events = [
      event("start_session"),
      event("resume_session")
    ];

    const result = replayRuntimeEvents(session, events);

    assert.equal(result.ok, false);
    assert.equal(result.code, "invalid_event_order");
  });

  it("same event history produces same restored state", () => {
    const events = [
      event("start_session"),
      event("complete_work_item", { work_item_id: "work_001" }),
      event("split_session"),
      event("return_to_session"),
      event("resume_session")
    ];

    const a = replayRuntimeEvents(session, events);
    const b = replayRuntimeEvents(session, events);

    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.deepEqual(a.state, b.state);
  });
});

describe("S35 partial completion truth model", () => {
  it("records factual amount and leaves planned work unchanged", () => {
    const events = [
      event("start_session"),
      event("partial_complete_work_item", {
        work_item_id: "work_001",
        factual_payload: {
          declared_completed_quantity: 2,
          declared_planned_quantity: 5,
          unit: "reps",
          reason_code: "other_closed_reason"
        }
      })
    ];

    const result = replayRuntimeEvents(session, events);

    assert.equal(result.ok, true);
    assert.equal(result.state.work_items.work_001.status, "partial");
    assert.equal(result.state.work_items.work_001.planned_quantity, 5);
    assert.equal(result.state.work_items.work_001.declared_completed_quantity, 2);
    assert.equal(result.state.counts.partial, 1);
    assert.equal(result.state.phase1_hash, session.phase1_hash);
    assert.equal(result.state.materialised_session_hash, session.materialised_session_hash);
  });

  it("fails invalid partial quantities and echoes", () => {
    const invalidCases = [
      {
        name: "completed equals planned",
        payload: {
          declared_completed_quantity: 5,
          declared_planned_quantity: 5,
          unit: "reps"
        }
      },
      {
        name: "planned quantity mismatch",
        payload: {
          declared_completed_quantity: 2,
          declared_planned_quantity: 6,
          unit: "reps"
        }
      },
      {
        name: "unit mismatch",
        payload: {
          declared_completed_quantity: 2,
          declared_planned_quantity: 5,
          unit: "sets"
        }
      }
    ];

    for (const invalidCase of invalidCases) {
      const result = replayRuntimeEvents(session, [
        event("start_session"),
        event("partial_complete_work_item", {
          work_item_id: "work_001",
          factual_payload: invalidCase.payload
        })
      ]);

      assert.equal(result.ok, false, invalidCase.name);
      assert.equal(result.code, "invalid_factual_payload", invalidCase.name);
    }
  });

  it("fails duplicate partial completion for same work item", () => {
    const events = [
      event("start_session"),
      event("partial_complete_work_item", {
        work_item_id: "work_001",
        factual_payload: {
          declared_completed_quantity: 2,
          declared_planned_quantity: 5,
          unit: "reps"
        }
      }),
      event("partial_complete_work_item", {
        work_item_id: "work_001",
        factual_payload: {
          declared_completed_quantity: 3,
          declared_planned_quantity: 5,
          unit: "reps"
        }
      })
    ];

    const result = replayRuntimeEvents(session, events);

    assert.equal(result.ok, false);
    assert.equal(result.code, "duplicate_work_item_terminal_event");
  });
});

describe("runtime copy surface", () => {
  it("uses registry-safe neutral copy only", () => {
    const copyPath = path.join(
      process.cwd(),
      "ui",
      "copy",
      "session_execution_runtime_copy_surface.json"
    );

    const copySurface = JSON.parse(fs.readFileSync(copyPath, "utf8"));

    const forbiddenPatterns = [
      /\binjury\b/i,
      /\binjuries\b/i,
      /\brehab\b/i,
      /\bmedical\b/i,
      /\bsafe\b/i,
      /\bsafer\b/i,
      /\bsafety\b/i,
      /\brisk\b/i,
      /\bsuitable\b/i,
      /\bsuitability\b/i,
      /\bready\b/i,
      /\breadiness\b/i,
      /\brecommend/i,
      /\bcorrect/i,
      /\boptimal\b/i,
      /\boptimise\b/i,
      /\boptimize\b/i,
      /\bcompliance\b/i,
      /\boutcome\b/i,
      /\bperformance\b/i,
      /\bshould\b/i,
      /\bprotect\b/i,
      /\bprevent\b/i,
      /\bbetter\b/i,
      /\bbest\b/i
    ];

    const values = Object.values(copySurface.copy);
    assert.ok(values.length > 0);

    for (const value of values) {
      assert.equal(typeof value, "string");
      for (const pattern of forbiddenPatterns) {
        assert.doesNotMatch(value, pattern);
      }
    }
  });
});
