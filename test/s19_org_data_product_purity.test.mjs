import test from "node:test";
import assert from "node:assert/strict";
import { buildOrgDataProduct } from "../dist/src/products/build_org_data_product.js";

test("S19a: org data product builder does not mutate input", () => {
  const input = {
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
  };

  const before = JSON.stringify(input);
  const result = buildOrgDataProduct(input);
  const after = JSON.stringify(input);

  assert.equal(after, before);

  assert.deepEqual(input, {
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

  assert.deepEqual(result.totals, {
    sessions_completed: 1,
    sessions_split: 0,
    sessions_abandoned: 1
  });
});