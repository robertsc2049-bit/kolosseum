import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function ids(items) {
  return items.map((entry) => entry.exercise_id);
}

function serial(value) {
  return JSON.stringify(value);
}

function minimalRegistryEntries() {
  return {
    bench_press: {
      exercise_id: "bench_press",
      name: "Bench Press"
    },
    deadlift: {
      exercise_id: "deadlift",
      name: "Deadlift"
    },
    back_squat: {
      exercise_id: "back_squat",
      name: "Back Squat"
    }
  };
}

function readTokenDeep(value) {
  if (!value || typeof value !== "object") return undefined;

  const direct =
    value.failure_token ??
    value.token ??
    value.error_token ??
    value.failure?.failure_token ??
    value.failure?.token ??
    value.error?.failure_token ??
    value.error?.token ??
    value.reason?.failure_token ??
    value.reason?.token;

  if (typeof direct === "string") return direct;

  for (const nested of Object.values(value)) {
    if (nested && typeof nested === "object") {
      const token = readTokenDeep(nested);
      if (typeof token === "string") return token;
    }
  }

  return undefined;
}

function readDetailsDeep(value) {
  if (!value || typeof value !== "object") return {};

  if (value.details && typeof value.details === "object") return value.details;
  if (value.failure?.details && typeof value.failure.details === "object") return value.failure.details;
  if (value.error?.details && typeof value.error.details === "object") return value.error.details;
  if (value.reason?.details && typeof value.reason.details === "object") return value.reason.details;

  for (const nested of Object.values(value)) {
    if (nested && typeof nested === "object") {
      const details = readDetailsDeep(nested);
      if (details && Object.keys(details).length > 0) return details;
    }
  }

  return {};
}

function assertNoIdentityInferenceLanguage(value) {
  const text = serial(value).toLowerCase();

  for (const forbidden of ["recommend", "recommended", "recommendation", "best", "optimal", "guess", "inferred"]) {
    assert.equal(
      text.includes(forbidden),
      false,
      `S-V0-09 output must not contain identity inference/advisory wording: ${forbidden}`
    );
  }
}

// DEV NOTE: S-V0-09 target/planned-items proof.
// These tests target the Phase 4 identity seam directly: build explicit
// planned_items, derive planned_exercise_ids from those items, derive
// target_exercise_id from the first explicit planned id, and fail registry
// misses with the stable Phase 4 token. This keeps identity proof narrow and
// avoids turning Phase 5 substitution behaviour into the authority for plan
// identity.
test("S-V0-09 valid planned items are explicit, array-ordered, and target-bound", async () => {
  const {
    buildPlannedItems,
    derivePlannedExerciseIds,
    deriveTargetExerciseId
  } = await import("../dist/engine/src/phases/phase4/planned_items.js");

  const plannedItems = buildPlannedItems(
    ["bench_press", "deadlift", "back_squat"],
    "session_s_v0_09_valid",
    Infinity
  );

  assert.deepEqual(
    ids(plannedItems),
    ["bench_press", "deadlift", "back_squat"],
    "planned_items must preserve explicit input identity order"
  );

  assert.equal(plannedItems.length, 3, "valid planned_items must emit one item per explicit unique exercise id");

  for (const item of plannedItems) {
    assert.equal(typeof item.exercise_id, "string", "exercise_id must be explicit");
    assert.equal(item.exercise_id.length > 0, true, "exercise_id must not be empty");
  }

  const plannedExerciseIds = derivePlannedExerciseIds(plannedItems);

  assert.deepEqual(
    plannedExerciseIds,
    ["bench_press", "deadlift", "back_squat"],
    "planned_exercise_ids must be derived directly from planned_items"
  );

  assert.equal(
    deriveTargetExerciseId(plannedExerciseIds),
    "bench_press",
    "target_exercise_id must be the first explicit planned exercise id"
  );

  assertNoIdentityInferenceLanguage({ plannedItems, plannedExerciseIds });
});

test("S-V0-09 duplicate planned item identities are deduped deterministically by first occurrence", async () => {
  const {
    buildPlannedItems,
    derivePlannedExerciseIds,
    deriveTargetExerciseId
  } = await import("../dist/engine/src/phases/phase4/planned_items.js");

  const repeatedOutputs = [];

  for (let i = 0; i < 20; i++) {
    const plannedItems = buildPlannedItems(
      ["bench_press", "deadlift", "bench_press", "back_squat", "deadlift"],
      "session_s_v0_09_duplicate",
      Infinity
    );

    repeatedOutputs.push(serial(plannedItems));

    assert.deepEqual(
      ids(plannedItems),
      ["bench_press", "deadlift", "back_squat"],
      "dedupe must keep first occurrence order and remove later duplicate exercise ids"
    );

    assert.equal(
      plannedItems.length,
      3,
      "dedupe must remove later duplicate exercise ids without creating ambiguity"
    );

    const plannedExerciseIds = derivePlannedExerciseIds(plannedItems);

    assert.equal(
      deriveTargetExerciseId(plannedExerciseIds),
      "bench_press",
      "target_exercise_id must remain tied to first explicit deduped planned id"
    );
  }

  assert.equal(
    new Set(repeatedOutputs).size,
    1,
    "dedupe output must be byte-stable for repeated runs"
  );
});

test("S-V0-09 missing explicit planned items produce no inferred target identity", async () => {
  const {
    buildPlannedItems,
    derivePlannedExerciseIds,
    deriveTargetExerciseId
  } = await import("../dist/engine/src/phases/phase4/planned_items.js");

  const plannedItems = buildPlannedItems([], "session_s_v0_09_missing", Infinity);
  const plannedExerciseIds = derivePlannedExerciseIds(plannedItems);

  assert.deepEqual(plannedItems, [], "missing intent must not invent planned_items");
  assert.deepEqual(plannedExerciseIds, [], "missing planned_items must not invent planned_exercise_ids");

  assert.equal(
    deriveTargetExerciseId(plannedExerciseIds),
    "",
    "missing planned ids must not infer a target exercise id"
  );
});

test("S-V0-09 invalid registry references fail with stable Phase 4 token", async () => {
  const {
    guardPlannedIdsExist
  } = await import("../dist/engine/src/phases/phase4/exercise_pool.js");

  const guard = guardPlannedIdsExist(
    minimalRegistryEntries(),
    ["bench_press", "missing_exercise", "back_squat"],
    "S_V0_09_TEST_REGISTRY"
  );

  assert.equal(guard.ok, false, "invalid planned exercise id must fail registry resolution");

  assert.equal(
    serial(guard).includes("PHASE4_MISSING_PLANNED_EXERCISE"),
    true,
    "invalid planned exercise id must expose the stable Phase 4 token somewhere in the failure payload"
  );

  assert.equal(
    readTokenDeep(guard),
    "PHASE4_MISSING_PLANNED_EXERCISE",
    "invalid planned exercise id must fail with stable token"
  );

  assert.equal(
    serial(guard).includes("missing_exercise"),
    true,
    "missing registry references must be explicit in the failure payload"
  );

  const details = readDetailsDeep(guard);

  if (Object.keys(details).length > 0) {
    assert.equal(
      serial(details).includes("missing_exercise"),
      true,
      "failure details must include missing exercise id when details are exposed"
    );
  }

  assertNoIdentityInferenceLanguage(guard);
});

test("S-V0-09 valid registry references resolve without mutation or fallback", async () => {
  const {
    guardPlannedIdsExist
  } = await import("../dist/engine/src/phases/phase4/exercise_pool.js");

  const plannedExerciseIds = ["bench_press", "deadlift", "back_squat"];
  const before = serial(plannedExerciseIds);

  const guard = guardPlannedIdsExist(
    minimalRegistryEntries(),
    plannedExerciseIds,
    "S_V0_09_TEST_REGISTRY"
  );

  assert.deepEqual(guard, { ok: true }, "valid planned exercise ids must resolve cleanly");
  assert.equal(serial(plannedExerciseIds), before, "registry guard must not mutate planned id order");
});

test("S-V0-09 source contracts document Phase 6 planned_items-only closure and stable token", () => {
  const phase6Source = fs.readFileSync("engine/src/phases/phase6.ts", "utf8");
  const phase5Source = fs.readFileSync("engine/src/phases/phase5.ts", "utf8");

  assert.match(
    phase6Source,
    /planned_items is the ONLY accepted non-empty plan source/,
    "Phase 6 must document planned_items-only session emission"
  );

  assert.match(
    phase6Source,
    /phase6_requires_planned_items/,
    "Phase 6 missing planned_items token must remain stable"
  );

  assert.match(
    phase5Source,
    /Ticket-032: planned_items is canonical when present/,
    "Phase 5 must preserve planned_items as canonical target source when present"
  );
});
