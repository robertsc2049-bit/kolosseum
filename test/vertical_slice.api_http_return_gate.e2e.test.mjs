import test from "node:test";
import assert from "node:assert/strict";

import {
  bootHttpVerticalSlice,
  createStartedSession,
  fetchState,
  postEvent
} from "../test_support/http_e2e_harness.mjs";

test("Vertical slice (HTTP): compile->create session->start->return gate events->state contract", async (t) => {
  let ctx = null;

  try {
    ctx = await bootHttpVerticalSlice(t, {
      requiredFlagEnvVar: "KOLOSSEUM_HTTP_E2E_RETURN_GATE"
    });

    if (!ctx) return;
    if (!ctx.enabled) return;

    const { baseUrl } = ctx;
    const sessionId = await createStartedSession(baseUrl);

    const evSplit = await postEvent(baseUrl, sessionId, { type: "SPLIT_SESSION" });
    assert.equal(evSplit.res.status, 201, evSplit.body.text);

    const s1 = await fetchState(baseUrl, sessionId);

    assert.ok(s1?.trace && typeof s1.trace === "object", "expected trace object");
    assert.equal(typeof s1.trace.return_decision_required, "boolean");
    assert.equal(
      s1.trace.return_decision_required,
      true,
      `expected return_decision_required=true; trace=` + JSON.stringify(s1.trace)
    );
    assert.ok(Array.isArray(s1.trace.return_decision_options), "expected return_decision_options array");
    assert.ok(
      s1.trace.return_decision_options.includes("RETURN_CONTINUE") &&
        s1.trace.return_decision_options.includes("RETURN_SKIP"),
      "expected RETURN_CONTINUE and RETURN_SKIP options"
    );

    const evContinue = await postEvent(baseUrl, sessionId, { type: "RETURN_CONTINUE" });
    assert.equal(evContinue.res.status, 201, evContinue.body.text);

    const s2 = await fetchState(baseUrl, sessionId);

    assert.ok(s2?.trace && typeof s2.trace === "object", "expected trace object");
    assert.equal(typeof s2.trace.return_decision_required, "boolean");
    assert.equal(
      s2.trace.return_decision_required,
      false,
      `expected return_decision_required=false; trace=` + JSON.stringify(s2.trace)
    );
  } catch (e) {
    const logs = ctx?.getLogs ? ctx.getLogs() : "";
    throw new Error(`${e?.message ?? e}\n\n--- harness logs ---\n${logs}`);
  }
});

test("Vertical slice (HTTP): RETURN_SKIP clears gate and advances session state", async (t) => {
  let ctx = null;

  try {
    ctx = await bootHttpVerticalSlice(t, {
      requiredFlagEnvVar: "KOLOSSEUM_HTTP_E2E_RETURN_GATE"
    });

    if (!ctx) return;
    if (!ctx.enabled) return;

    const { baseUrl } = ctx;
    const sessionId = await createStartedSession(baseUrl);

    const evSplit = await postEvent(baseUrl, sessionId, { type: "SPLIT_SESSION" });
    assert.equal(evSplit.res.status, 201, evSplit.body.text);

    const state1 = await fetchState(baseUrl, sessionId);
    assert.equal(state1.trace.return_decision_required, true);
    assert.ok(Array.isArray(state1.trace.return_decision_options));
    assert.ok(state1.trace.return_decision_options.includes("RETURN_SKIP"));

    const evSkip = await postEvent(baseUrl, sessionId, { type: "RETURN_SKIP" });
    assert.equal(evSkip.res.status, 201, evSkip.body.text);

    const s2 = await fetchState(baseUrl, sessionId);

    assert.ok(s2?.trace && typeof s2.trace === "object", "expected trace object");
    assert.equal(s2.trace.return_decision_required, false);
    assert.ok(Array.isArray(s2.trace.return_decision_options));
    assert.equal(s2.trace.return_decision_options.length, 0);
    assert.ok(Array.isArray(s2.trace.dropped_ids), "expected dropped_ids after RETURN_SKIP");
    assert.ok(
      s2.trace.dropped_ids.length >= 1,
      `expected at least one dropped_id after RETURN_SKIP; trace=` + JSON.stringify(s2.trace)
    );
  } catch (e) {
    const logs = ctx?.getLogs ? ctx.getLogs() : "";
    throw new Error(`${e?.message ?? e}\n\n--- harness logs ---\n${logs}`);
  }
});