// @law: V0 Boundary Pack
// @severity: high
// @scope: repo

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function fail(message, details = {}) {
  const error = new Error(message);
  error.details = details;
  throw error;
}

function assertNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(`Invalid ${label}: expected non-empty string.`);
  }
}

function assertStringArray(value, label) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((entry) => typeof entry !== "string" || entry.trim().length === 0)
  ) {
    fail(`Invalid ${label}: expected non-empty string array.`);
  }
}

export function validateBoundaryData(exclusionsDoc, claimsDoc) {
  if (
    !exclusionsDoc ||
    exclusionsDoc.schema_version !== "kolosseum.v0_boundary_exclusions.v1"
  ) {
    fail("Invalid exclusions schema_version.");
  }
  if (
    !claimsDoc ||
    claimsDoc.schema_version !== "kolosseum.v0_allowed_claims.v1"
  ) {
    fail("Invalid claims schema_version.");
  }
  if (exclusionsDoc.release_scope !== "v0" || claimsDoc.release_scope !== "v0") {
    fail("Both exclusion and claim registries must be pinned to v0 release scope.");
  }
  if (!Array.isArray(exclusionsDoc.items) || exclusionsDoc.items.length === 0) {
    fail("Boundary exclusions must contain at least one item.");
  }
  if (!Array.isArray(claimsDoc.claims) || claimsDoc.claims.length === 0) {
    fail("Allowed claims registry must contain at least one claim.");
  }

  const boundaryIds = new Set();
  const forbiddenTokenToBoundary = new Map();

  for (const item of exclusionsDoc.items) {
    assertNonEmptyString(item.boundary_id, "boundary_id");
    assertNonEmptyString(item.expectation, `expectation for ${item.boundary_id}`);
    if (item.included_in_v0 !== false) {
      fail(`Boundary ${item.boundary_id} must explicitly declare included_in_v0=false.`);
    }
    assertNonEmptyString(item.status, `status for ${item.boundary_id}`);
    assertNonEmptyString(
      item.reason_not_in_v0,
      `reason_not_in_v0 for ${item.boundary_id}`
    );
    assertStringArray(item.grounded_in, `grounded_in for ${item.boundary_id}`);
    assertStringArray(
      item.forbidden_claim_tokens,
      `forbidden_claim_tokens for ${item.boundary_id}`
    );

    if (boundaryIds.has(item.boundary_id)) {
      fail(`Duplicate boundary_id detected: ${item.boundary_id}`);
    }
    boundaryIds.add(item.boundary_id);

    for (const token of item.forbidden_claim_tokens) {
      if (forbiddenTokenToBoundary.has(token)) {
        fail(`Forbidden claim token '${token}' is assigned to multiple boundaries.`, {
          existing_boundary_id: forbiddenTokenToBoundary.get(token),
          duplicate_boundary_id: item.boundary_id
        });
      }
      forbiddenTokenToBoundary.set(token, item.boundary_id);
    }
  }

  const claimIds = new Set();
  const contradictions = [];

  for (const claim of claimsDoc.claims) {
    assertNonEmptyString(claim.claim_id, "claim_id");
    assertNonEmptyString(claim.claim_text, `claim_text for ${claim.claim_id}`);
    assertStringArray(claim.claim_tokens, `claim_tokens for ${claim.claim_id}`);

    if (claimIds.has(claim.claim_id)) {
      fail(`Duplicate claim_id detected: ${claim.claim_id}`);
    }
    claimIds.add(claim.claim_id);

    for (const token of claim.claim_tokens) {
      const conflictingBoundaryId = forbiddenTokenToBoundary.get(token);
      if (conflictingBoundaryId) {
        contradictions.push({
          claim_id: claim.claim_id,
          claim_text: claim.claim_text,
          conflicting_token: token,
          boundary_id: conflictingBoundaryId
        });
      }
    }
  }

  if (contradictions.length > 0) {
    fail("V0 allowed claims contradict excluded v0 boundaries.", {
      contradictions
    });
  }

  return {
    ok: true,
    exclusion_count: exclusionsDoc.items.length,
    claim_count: claimsDoc.claims.length
  };
}

export function runGuard({
  exclusionsPath = path.join(repoRoot, "docs", "product", "v0_boundary_exclusions.json"),
  claimsPath = path.join(repoRoot, "docs", "product", "v0_allowed_claims.json")
} = {}) {
  const exclusionsDoc = readJson(exclusionsPath);
  const claimsDoc = readJson(claimsPath);
  return validateBoundaryData(exclusionsDoc, claimsDoc);
}

function main() {
  try {
    const result = runGuard();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    const payload = {
      ok: false,
      token: "CI_V0_BOUNDARY_CONTRADICTION",
      message: error.message,
      ...(error.details ? { details: error.details } : {})
    };
    process.stderr.write(`${JSON.stringify(payload, null, 2)}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] === __filename) {
  main();
}
