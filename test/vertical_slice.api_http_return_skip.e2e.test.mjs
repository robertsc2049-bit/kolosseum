import assert from "node:assert/strict";
import test from "node:test";

// NOTE: mirror the exact helper imports/pattern used in vertical_slice.api_http_return_gate.e2e.test.mjs

test("Vertical slice (HTTP): RETURN_SKIP clears gate and advances session state", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL missing; server boot hard-requires DB right now. Skipping HTTP vertical-slice.");
  }

  // copy the existing arrange/start flow from the return_gate E2E test
  // then swap RETURN_CONTINUE for RETURN_SKIP
  // assert 200 response and advanced deterministic state
});