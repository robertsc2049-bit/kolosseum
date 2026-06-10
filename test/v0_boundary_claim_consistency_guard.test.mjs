import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateBoundaryData, runGuard } from "../ci/guards/run_v0_boundary_claim_consistency_guard.mjs";

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

test("validateBoundaryData passes when allowed claims stay inside v0 boundary", () => {
  const exclusions = {
    schema_version: "kolosseum.v0_boundary_exclusions.v1",
    release_scope: "v0",
    items: [
      {
        boundary_id: "V0-EX-001",
        expectation: "Evidence sealing",
        included_in_v0: false,
        status: "v1_or_post_v0",
        reason_not_in_v0: "Not in Phase 1-6 path.",
        grounded_in: ["BUILD_TARGET_v0"],
        forbidden_claim_tokens: ["evidence_sealing"]
      }
    ]
  };

  const claims = {
    schema_version: "kolosseum.v0_allowed_claims.v1",
    release_scope: "v0",
    claims: [
      {
        claim_id: "V0-CL-001",
        claim_text: "Deterministic execution for current v0.",
        claim_tokens: ["deterministic_execution"]
      }
    ]
  };

  const result = validateBoundaryData(exclusions, claims);
  assert.equal(result.ok, true);
  assert.equal(result.exclusion_count, 1);
  assert.equal(result.claim_count, 1);
});

test("validateBoundaryData fails when a boundary lacks grounding", () => {
  const exclusions = {
    schema_version: "kolosseum.v0_boundary_exclusions.v1",
    release_scope: "v0",
    items: [
      {
        boundary_id: "V0-EX-001",
        expectation: "Evidence sealing",
        included_in_v0: false,
        status: "v1_or_post_v0",
        reason_not_in_v0: "Not in Phase 1-6 path.",
        grounded_in: [],
        forbidden_claim_tokens: ["evidence_sealing"]
      }
    ]
  };

  const claims = {
    schema_version: "kolosseum.v0_allowed_claims.v1",
    release_scope: "v0",
    claims: [
      {
        claim_id: "V0-CL-001",
        claim_text: "Deterministic execution for current v0.",
        claim_tokens: ["deterministic_execution"]
      }
    ]
  };

  assert.throws(
    () => validateBoundaryData(exclusions, claims),
    /grounded_in/
  );
});

test("validateBoundaryData fails when an allowed claim contradicts an excluded boundary", () => {
  const exclusions = {
    schema_version: "kolosseum.v0_boundary_exclusions.v1",
    release_scope: "v0",
    items: [
      {
        boundary_id: "V0-EX-001",
        expectation: "Evidence sealing",
        included_in_v0: false,
        status: "v1_or_post_v0",
        reason_not_in_v0: "Not in Phase 1-6 path.",
        grounded_in: ["BUILD_TARGET_v0"],
        forbidden_claim_tokens: ["evidence_sealing"]
      }
    ]
  };

  const claims = {
    schema_version: "kolosseum.v0_allowed_claims.v1",
    release_scope: "v0",
    claims: [
      {
        claim_id: "V0-CL-001",
        claim_text: "v0 includes evidence sealing.",
        claim_tokens: ["evidence_sealing"]
      }
    ]
  };

  assert.throws(
    () => validateBoundaryData(exclusions, claims),
    /contradict/
  );
});

test("runGuard reads files and returns ok result", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "p179-boundary-"));
  const exclusionsPath = path.join(tempRoot, "docs", "product", "v0_boundary_exclusions.json");
  const claimsPath = path.join(tempRoot, "docs", "product", "v0_allowed_claims.json");

  writeJson(exclusionsPath, {
    schema_version: "kolosseum.v0_boundary_exclusions.v1",
    release_scope: "v0",
    items: [
      {
        boundary_id: "V0-EX-001",
        expectation: "Evidence sealing",
        included_in_v0: false,
        status: "v1_or_post_v0",
        reason_not_in_v0: "Not in Phase 1-6 path.",
        grounded_in: ["BUILD_TARGET_v0"],
        forbidden_claim_tokens: ["evidence_sealing"]
      }
    ]
  });

  writeJson(claimsPath, {
    schema_version: "kolosseum.v0_allowed_claims.v1",
    release_scope: "v0",
    claims: [
      {
        claim_id: "V0-CL-001",
        claim_text: "Deterministic execution for current v0.",
        claim_tokens: ["deterministic_execution"]
      }
    ]
  });

  const result = runGuard({ exclusionsPath, claimsPath });
  assert.equal(result.ok, true);
});