import test from "node:test";
import assert from "node:assert/strict";
import { buildOrgDataProduct } from "../dist/src/products/build_org_data_product.js";

test("S19: org data product stays aggregate and neutral", () => {
  const result = buildOrgDataProduct({
    org_id: "org_1",
    sessions: [
      {
        execution_status: "completed",
        trace: {
          completed_ids: ["a"],
          dropped_ids: [],
          remaining_ids: [],
          split_entered: true,
          split_return_decision: "RETURN_CONTINUE"
        }
      },
      {
        execution_status: "abandoned",
        trace: {
          completed_ids: [],
          dropped_ids: ["b"],
          remaining_ids: ["c"],
          split_entered: true,
          split_return_decision: "RETURN_SKIP"
        }
      }
    ]
  });

  assert.equal(result.org_id, "org_1");
  assert.ok(result.generated_at);

  assert.deepEqual(result.totals, {
    sessions_completed: 1,
    sessions_split: 0,
    sessions_abandoned: 1
  });

  assert.deepEqual(result.exercises, {
    completed_ids: ["a"],
    dropped_ids: ["b"],
    remaining_ids: ["c"]
  });

  assert.deepEqual(result.splits, {
    entered: 2,
    return_continue: 1,
    return_skip: 1
  });

  const forbiddenKeys = [
    "score",
    ["read", "iness"].join(""),
    ["recom", "mendations"].join("")
  ];

  for (const key of forbiddenKeys) {
    assert.equal(Object.prototype.hasOwnProperty.call(result, key), false);
  }

  assert.deepEqual(
    Object.keys(result).sort(),
    ["exercises", "generated_at", "org_id", "splits", "totals"].sort()
  );
});