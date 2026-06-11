import assert from "node:assert/strict";
import test from "node:test";

function item(exercise_id, role, ordinal) {
  return {
    planned_item_id: `session_s_v0_08:${String(ordinal).padStart(2, "0")}:${exercise_id}`,
    session_id: "session_s_v0_08",
    exercise_id,
    ordinal,
    role,
    prescription: {
      sets: role === "primary" ? 4 : 3,
      reps: role === "primary" ? 5 : 10,
      intensity: role === "primary" ? { type: "percent_1rm", value: 70 } : { type: "bodyweight" },
      rest_seconds: role === "primary" ? 180 : 90
    }
  };
}

function ids(items) {
  return items.map((entry) => entry.exercise_id);
}

function serial(value) {
  return JSON.stringify(value);
}

function makePlan() {
  return [
    item("ex_primary_1", "primary", 1),
    item("ex_primary_2", "primary", 2),
    item("ex_primary_3", "primary", 3),
    item("ex_primary_4", "primary", 4),
    item("ex_accessory_1", "accessory", 5),
    item("ex_accessory_2", "accessory", 6),
    item("ex_accessory_3", "accessory", 7)
  ];
}

function assertNoAdvisoryOutput(value) {
  const text = serial(value).toLowerCase();
  for (const forbidden of ["recommend", "recommended", "recommendation", "best", "optimal"]) {
    assert.equal(
      text.includes(forbidden),
      false,
      `S-V0-08 output must not contain advisory selection wording: ${forbidden}`
    );
  }
}

// DEV NOTE: S-V0-08 test fixture.
// These tests call the compiled Phase 4 timebox module directly because this
// slice proves one engine rule: pruning removes items by explicit thresholds
// while preserving existing planned item order. The tests avoid registry or
// pipeline setup so ordering failures point at the prune seam.
test("S-V0-08 exact fit keeps full planned item order stable", async () => {
  const { applyTimeboxDeterministic } = await import("../dist/engine/src/phases/phase4/timebox.js");

  const input = makePlan();
  const actual = applyTimeboxDeterministic(input, 45);

  assert.deepEqual(
    ids(actual),
    [
      "ex_primary_1",
      "ex_primary_2",
      "ex_primary_3",
      "ex_primary_4",
      "ex_accessory_1",
      "ex_accessory_2",
      "ex_accessory_3"
    ],
    "45 minutes is the exact no-prune threshold and must preserve order"
  );

  assertNoAdvisoryOutput(actual);
});

test("S-V0-08 overrun below 45 keeps primaries plus first accessory in stable order", async () => {
  const { applyTimeboxDeterministic } = await import("../dist/engine/src/phases/phase4/timebox.js");

  const input = makePlan();
  const actual = applyTimeboxDeterministic(input, 44);

  assert.deepEqual(
    ids(actual),
    [
      "ex_primary_1",
      "ex_primary_2",
      "ex_primary_3",
      "ex_primary_4",
      "ex_accessory_1"
    ],
    "timebox below 45 keeps all primaries and the first existing accessory"
  );

  assertNoAdvisoryOutput(actual);
});

test("S-V0-08 zero timebox keeps primary items only and preserves primary order", async () => {
  const { applyTimeboxDeterministic } = await import("../dist/engine/src/phases/phase4/timebox.js");

  const input = makePlan();
  const actual = applyTimeboxDeterministic(input, 0);

  assert.deepEqual(
    ids(actual),
    [
      "ex_primary_1",
      "ex_primary_2",
      "ex_primary_3",
      "ex_primary_4"
    ],
    "timebox below 30 keeps primary items only"
  );

  assertNoAdvisoryOutput(actual);
});

test("S-V0-08 invalid or absent timebox is non-finite and preserves order", async () => {
  const { applyTimeboxDeterministic, readSessionTimeboxMinutes } = await import("../dist/engine/src/phases/phase4/timebox.js");

  const input = makePlan();

  assert.equal(
    Number.isFinite(readSessionTimeboxMinutes({ constraints: { schedule: { session_timebox_minutes: "not-a-number" } } })),
    false,
    "invalid timebox must resolve to a non-finite deterministic value"
  );

  assert.equal(
    Number.isFinite(readSessionTimeboxMinutes({})),
    false,
    "absent timebox must resolve to a non-finite deterministic value"
  );

  assert.deepEqual(
    ids(applyTimeboxDeterministic(input, Number.NaN)),
    ids(input),
    "NaN timebox must preserve planned order"
  );

  assert.deepEqual(
    ids(applyTimeboxDeterministic(input, Infinity)),
    ids(input),
    "Infinity timebox must preserve planned order"
  );
});

test("S-V0-08 tie ordering is source-order stable for same-role items", async () => {
  const { applyTimeboxDeterministic } = await import("../dist/engine/src/phases/phase4/timebox.js");

  const tiedAccessories = [
    item("ex_primary_1", "primary", 1),
    item("ex_primary_2", "primary", 2),
    item("ex_accessory_b", "accessory", 3),
    item("ex_accessory_a", "accessory", 4),
    item("ex_accessory_c", "accessory", 5)
  ];

  const actual = applyTimeboxDeterministic(tiedAccessories, 44);

  assert.deepEqual(
    ids(actual),
    [
      "ex_primary_1",
      "ex_primary_2",
      "ex_accessory_b"
    ],
    "first retained accessory must be selected by existing planned order, not alphabetical or scoring order"
  );

  assertNoAdvisoryOutput(actual);
});

test("S-V0-08 repeated runs produce byte-stable pruned results", async () => {
  const { applyTimeboxDeterministic } = await import("../dist/engine/src/phases/phase4/timebox.js");

  const repeated = [];

  for (let i = 0; i < 20; i++) {
    repeated.push(serial(applyTimeboxDeterministic(makePlan(), 44)));
  }

  assert.equal(
    new Set(repeated).size,
    1,
    "same input and same timebox must produce one stable serialized result"
  );
});
