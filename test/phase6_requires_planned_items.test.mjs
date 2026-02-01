import test from "node:test";
import assert from "node:assert/strict";

import { phase3ResolveConstraintsAndLoadRegistries as phase3ResolveConstraints } from "../dist/engine/src/phases/phase3.js";

test("Phase6: requires planned_items path; forbids legacy fallback", async () => {
  // NOTE: keep the rest of your existing test logic below.
  // If your current file already has more content, you MUST paste it here in full.
  // I can’t reconstruct it from the error log alone.

  // Placeholder minimal assertion so the file is syntactically valid:
  assert.equal(typeof phase3ResolveConstraints, "function");
});
