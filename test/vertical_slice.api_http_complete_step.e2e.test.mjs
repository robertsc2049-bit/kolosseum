import test from "node:test";
import assert from "node:assert/strict";

import {
  bootHttpVerticalSlice,
  createStartedSession,
  fetchState,
  postEvent
} from "../test_support/http_e2e_harness.mjs";

test("Vertical slice (HTTP): COMPLETE_STEP is rejected during RETURN_DECISION and accepted immediately after RETURN_CONTINUE", async (t) => {
  let ctx = null;

  try {
    ctx = await bootHttpVerticalSlice(t, {
      requiredFlagEnvVar: "KOLOSSEUM_HTTP_E2E_COMPLETE_STEP"
    });

    if (!ctx) return;
    if (!ctx.enabled) return;

    const { baseUrl } = ctx;
    const sessionId = await createStartedSession(baseUrl);
    const st1 = await fetchState(baseUrl, sessionId);

    const beforeCompleted = Array.isArray(st1.completed_exercises) ? st1.completed_exercises.length : 0;

    if (st1.trace.return_decision_required === true) {
      assert.equal(st1.current_step?.type, "RETURN_DECISION");
      assert.ok(Array.isArray(st1.current_step?.options), "expected current_step.options");

      const blocked = await postEvent(baseUrl, sessionId, { type: "COMPLETE_STEP" });
      assert.equal(blocked.res.status, 400, blocked.body.text);
      assert.match(blocked.body.text, /phase6_runtime_await_return_decision/, "expected failure token in body");

      const continueEvent = await postEvent(baseUrl, sessionId, { type: "RETURN_CONTINUE" });
      assert.equal(continueEvent.res.status, 201, continueEvent.body.text);

      const st2 = await fetchState(baseUrl, sessionId);
      assert.equal(st2.trace.return_decision_required, false, "RETURN_CONTINUE should immediately ungate the state");
      assert.equal(st2.current_step?.type, "EXERCISE", "expected EXERCISE step immediately after RETURN_CONTINUE");
      assert.ok(st2.current_step?.exercise?.exercise_id, "expected exercise after RETURN_CONTINUE");

      const accepted = await postEvent(baseUrl, sessionId, { type: "COMPLETE_STEP" });
      assert.equal(accepted.res.status, 201, accepted.body.text);

      const st3 = await fetchState(baseUrl, sessionId);
      const afterCompleted = Array.isArray(st3.completed_exercises) ? st3.completed_exercises.length : 0;
      assert.ok(
        afterCompleted === beforeCompleted + 1,
        `expected completed_exercises +1 after RETURN_CONTINUE then COMPLETE_STEP (before=${beforeCompleted}, after=${afterCompleted})`
      );
      return;
    }

    assert.equal(st1.current_step?.type, "EXERCISE");
    assert.ok(st1.current_step?.exercise?.exercise_id, "expected current_step.exercise.exercise_id");

    const accepted = await postEvent(baseUrl, sessionId, { type: "COMPLETE_STEP" });
    assert.equal(accepted.res.status, 201, accepted.body.text);

    const st2 = await fetchState(baseUrl, sessionId);
    const afterCompleted = Array.isArray(st2.completed_exercises) ? st2.completed_exercises.length : 0;
    assert.ok(
      afterCompleted === beforeCompleted + 1,
      `expected completed_exercises +1 (before=${beforeCompleted}, after=${afterCompleted})`
    );
  } catch (e) {
    const logs = ctx?.getLogs ? ctx.getLogs() : "";
    throw new Error(`${e?.message ?? e}\n\n--- harness logs ---\n${logs}`);
  }
});

test("Vertical slice (HTTP): RETURN_SKIP rejects COMPLETE_STEP before ungate and preserves dropped_ids after reload", async (t) => {
  let ctx = null;

  try {
    ctx = await bootHttpVerticalSlice(t, {
      requiredFlagEnvVar: "KOLOSSEUM_HTTP_E2E_COMPLETE_STEP"
    });

    if (!ctx) return;
    if (!ctx.enabled) return;

    const { baseUrl } = ctx;
    const sessionId = await createStartedSession(baseUrl);
    const st1 = await fetchState(baseUrl, sessionId);

    if (st1.trace.return_decision_required !== true) {
      t.skip("RETURN_SKIP proof requires an active RETURN_DECISION gate for this fixture/runtime path.");
      return;
    }

    assert.equal(st1.current_step?.type, "RETURN_DECISION");
    assert.ok(Array.isArray(st1.current_step?.options), "expected current_step.options during RETURN_DECISION");

    const blocked = await postEvent(baseUrl, sessionId, { type: "COMPLETE_STEP" });
    assert.equal(blocked.res.status, 400, blocked.body.text);
    assert.match(blocked.body.text, /phase6_runtime_await_return_decision/, "expected failure token in body");

    const skipEvent = await postEvent(baseUrl, sessionId, { type: "RETURN_SKIP" });
    assert.equal(skipEvent.res.status, 201, skipEvent.body.text);

    const st2 = await fetchState(baseUrl, sessionId);
    assert.equal(st2.trace.return_decision_required, false, "RETURN_SKIP should ungate the session");
    assert.ok(Array.isArray(st2.dropped_ids), "expected dropped_ids array after RETURN_SKIP");
    assert.ok(st2.dropped_ids.length > 0, "expected RETURN_SKIP to persist at least one dropped id");

    const droppedIdsAfterSkip = [...st2.dropped_ids];

    const st3 = await fetchState(baseUrl, sessionId);
    assert.deepEqual(
      st3.dropped_ids,
      droppedIdsAfterSkip,
      "dropped_ids should survive immediate reload without drift"
    );
    assert.equal(st3.trace.return_decision_required, false, "reloaded state should remain ungated after RETURN_SKIP");

    const blockedAgain = await postEvent(baseUrl, sessionId, { type: "COMPLETE_STEP" });

    if (st3.current_step?.type === "EXERCISE") {
      assert.equal(blockedAgain.res.status, 201, blockedAgain.body.text);

      const st4 = await fetchState(baseUrl, sessionId);
      assert.deepEqual(
        st4.dropped_ids,
        droppedIdsAfterSkip,
        "accepted COMPLETE_STEP after ungate must not rewrite dropped_ids chosen by RETURN_SKIP"
      );
      return;
    }

    assert.equal(blockedAgain.res.status, 400, blockedAgain.body.text);
    assert.doesNotMatch(
      blockedAgain.body.text,
      /phase6_runtime_await_return_decision/,
      "post-RETURN_SKIP rejection must not still be the return-decision gate"
    );

    const st4 = await fetchState(baseUrl, sessionId);
    assert.deepEqual(
      st4.dropped_ids,
      droppedIdsAfterSkip,
      "rejected post-ungate COMPLETE_STEP must not rewrite dropped_ids after reload"
    );
    assert.equal(
      st4.trace.return_decision_required,
      false,
      "post-ungate state must remain ungated even if COMPLETE_STEP is rejected for another reason"
    );
  } catch (e) {
    const logs = ctx?.getLogs ? ctx.getLogs() : "";
    throw new Error(`${e?.message ?? e}\n\n--- harness logs ---\n${logs}`);
  }
});

test("Vertical slice (HTTP): RETURN_SKIP is idempotent-rejected after ungate and preserves dropped_ids across repeated reloads", async (t) => {
  let ctx = null;

  try {
    ctx = await bootHttpVerticalSlice(t, {
      requiredFlagEnvVar: "KOLOSSEUM_HTTP_E2E_COMPLETE_STEP"
    });

    if (!ctx) return;
    if (!ctx.enabled) return;

    const { baseUrl } = ctx;
    const sessionId = await createStartedSession(baseUrl);
    const st1 = await fetchState(baseUrl, sessionId);

    if (st1.trace.return_decision_required !== true) {
      t.skip("RETURN_SKIP idempotent rejection proof requires an active RETURN_DECISION gate for this fixture/runtime path.");
      return;
    }

    assert.equal(st1.current_step?.type, "RETURN_DECISION");
    assert.ok(Array.isArray(st1.current_step?.options), "expected current_step.options during RETURN_DECISION");

    const firstSkip = await postEvent(baseUrl, sessionId, { type: "RETURN_SKIP" });
    assert.equal(firstSkip.res.status, 201, firstSkip.body.text);

    const st2 = await fetchState(baseUrl, sessionId);
    assert.equal(st2.trace.return_decision_required, false, "first RETURN_SKIP should ungate the session");
    assert.ok(Array.isArray(st2.dropped_ids), "expected dropped_ids after first RETURN_SKIP");
    assert.ok(st2.dropped_ids.length > 0, "expected first RETURN_SKIP to persist at least one dropped id");

    const droppedIdsAfterFirstSkip = [...st2.dropped_ids];

    const st3 = await fetchState(baseUrl, sessionId);
    assert.deepEqual(
      st3.dropped_ids,
      droppedIdsAfterFirstSkip,
      "dropped_ids should survive first reload after RETURN_SKIP"
    );
    assert.equal(st3.trace.return_decision_required, false, "state should remain ungated after first reload");

    const secondSkip = await postEvent(baseUrl, sessionId, { type: "RETURN_SKIP" });
    assert.equal(secondSkip.res.status, 400, secondSkip.body.text);
    assert.doesNotMatch(
      secondSkip.body.text,
      /phase6_runtime_await_return_decision/,
      "idempotent rejection after ungate must not still be the return-decision gate"
    );

    const st4 = await fetchState(baseUrl, sessionId);
    assert.deepEqual(
      st4.dropped_ids,
      droppedIdsAfterFirstSkip,
      "second RETURN_SKIP rejection must not rewrite dropped_ids"
    );
    assert.equal(
      st4.trace.return_decision_required,
      false,
      "second RETURN_SKIP rejection must keep the session ungated"
    );

    const st5 = await fetchState(baseUrl, sessionId);
    assert.deepEqual(
      st5.dropped_ids,
      droppedIdsAfterFirstSkip,
      "dropped_ids should survive repeated reloads after idempotent rejection"
    );
    assert.equal(
      st5.trace.return_decision_required,
      false,
      "repeated reloads should keep the session ungated after idempotent rejection"
    );
  } catch (e) {
    const logs = ctx?.getLogs ? ctx.getLogs() : "";
    throw new Error(`${e?.message ?? e}\n\n--- harness logs ---\n${logs}`);
  }
});