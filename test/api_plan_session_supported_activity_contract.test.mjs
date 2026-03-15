import test from "node:test";
import assert from "node:assert/strict";

const { planSession } = await import("../dist/src/api/sessions.handlers.js");

function makeReq(body) {
  return { body };
}

function makeRes() {
  return {
    statusCode: 200,
    jsonBody: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.jsonBody = payload;
      return this;
    }
  };
}

function assertSupportedActivityContract(payload, activity) {
  assert.equal(payload?.ok, true, `expected ok=true for activity ${activity}`);
  assert.ok(payload?.session, `expected session object for activity ${activity}`);
  assert.ok(Array.isArray(payload.session.exercises), `expected session.exercises array for activity ${activity}`);
  assert.ok(payload.session.exercises.length > 0, `expected non-empty session.exercises for activity ${activity}`);

  for (const exercise of payload.session.exercises) {
    assert.equal(typeof exercise.exercise_id, "string", `expected exercise_id string for activity ${activity}`);
    assert.ok(exercise.exercise_id.length > 0, `expected non-empty exercise_id for activity ${activity}`);
  }
}

test("plan-session-api preserves supported activity contract end-to-end across powerlifting rugby_union and general_strength", async () => {
  const supportedActivities = [
    "powerlifting",
    "rugby_union",
    "general_strength"
  ];

  for (const activity of supportedActivities) {
    const req = makeReq({
      input: {
        user: { activity },
        constraints: {
          available_equipment: ["barbell", "bench", "dumbbell"],
          session_minutes: 45
        }
      }
    });
    const res = makeRes();

    await planSession(req, res);

    assert.equal(res.statusCode, 200, `expected HTTP 200 for activity ${activity}`);
    assertSupportedActivityContract(res.jsonBody, activity);
  }
});

test("plan-session-api supported activities do not fall through to stub-like empty exercise output", async () => {
  const supportedActivities = [
    "powerlifting",
    "rugby_union",
    "general_strength"
  ];

  for (const activity of supportedActivities) {
    const req = makeReq({
      input: {
        user: { activity },
        constraints: {
          available_equipment: ["barbell", "bench"],
          session_minutes: 30
        }
      }
    });
    const res = makeRes();

    await planSession(req, res);

    assert.equal(res.statusCode, 200, `expected HTTP 200 for activity ${activity}`);
    assert.equal(res.jsonBody?.ok, true, `expected ok=true for activity ${activity}`);
    assert.ok(Array.isArray(res.jsonBody?.session?.exercises), `expected exercises array for activity ${activity}`);
    assert.ok(res.jsonBody.session.exercises.length > 0, `supported activity ${activity} should not produce empty exercises`);
  }
});