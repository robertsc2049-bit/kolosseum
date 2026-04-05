import fs from "node:fs";
import path from "node:path";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function makeFailure(token, file, pathValue, details) {
  return {
    token,
    file,
    path: pathValue,
    details
  };
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function runCoachTierPricingBoundaryLint({
  claimsPath,
  proofPath,
  surfacePath
}) {
  const failures = [];

  const claimsDoc = readJson(claimsPath);
  const proofDoc = readJson(proofPath);
  const surfaceDoc = readJson(surfacePath);

  const claims = Array.isArray(claimsDoc.claims) ? claimsDoc.claims : [];
  const proofs = Array.isArray(proofDoc.proofs) ? proofDoc.proofs : [];
  const phrases = Array.isArray(surfaceDoc.phrases) ? surfaceDoc.phrases : [];

  const claimIds = new Set();
  const proofIds = new Set();

  for (let i = 0; i < claims.length; i += 1) {
    const claim = claims[i];
    const claimPath = `claims[${i}]`;

    if (!isNonEmptyString(claim.claim_id)) {
      failures.push(makeFailure("CI_REGISTRY_STRUCTURE_INVALID", claimsPath, `${claimPath}.claim_id`, "claim_id must be a non-empty string."));
      continue;
    }

    if (claimIds.has(claim.claim_id)) {
      failures.push(makeFailure("CI_REGISTRY_STRUCTURE_INVALID", claimsPath, `${claimPath}.claim_id`, `Duplicate claim_id '${claim.claim_id}'.`));
    }
    claimIds.add(claim.claim_id);

    if (claim.status !== "allowed") {
      failures.push(makeFailure("CI_REGISTRY_STRUCTURE_INVALID", claimsPath, `${claimPath}.status`, `Only 'allowed' claims are supported by this slice. Found '${claim.status}'.`));
    }

    if (claim.tier_id !== "coach_16") {
      failures.push(makeFailure("CI_TIER_VIOLATION", claimsPath, `${claimPath}.tier_id`, `Coach pricing boundary is locked to coach_16. Found '${claim.tier_id}'.`));
    }

    if (claim.v0_scope_only !== true) {
      failures.push(makeFailure("CI_SCOPE_VIOLATION", claimsPath, `${claimPath}.v0_scope_only`, "All coach pricing claims must be v0-scope-only."));
    }

    if (!Array.isArray(claim.proof_ids) || claim.proof_ids.length === 0) {
      failures.push(makeFailure("CI_CONSTRAINT_UNUSED", claimsPath, `${claimPath}.proof_ids`, `Claim '${claim.claim_id}' has no proof linkage.`));
    }

    if (!isNonEmptyString(claim.claim_text)) {
      failures.push(makeFailure("CI_REGISTRY_STRUCTURE_INVALID", claimsPath, `${claimPath}.claim_text`, "claim_text must be a non-empty string."));
    }
  }

  const forbiddenPatterns = Array.isArray(claimsDoc.forbidden_semantic_patterns)
    ? claimsDoc.forbidden_semantic_patterns.map((rule) => ({
        ...rule,
        compiled: new RegExp(rule.regex, "i")
      }))
    : [];

  const proofById = new Map();
  for (let i = 0; i < proofs.length; i += 1) {
    const proof = proofs[i];
    const proofPathValue = `proofs[${i}]`;

    if (!isNonEmptyString(proof.proof_id)) {
      failures.push(makeFailure("CI_REGISTRY_STRUCTURE_INVALID", proofPath, `${proofPathValue}.proof_id`, "proof_id must be a non-empty string."));
      continue;
    }

    if (proofIds.has(proof.proof_id)) {
      failures.push(makeFailure("CI_REGISTRY_STRUCTURE_INVALID", proofPath, `${proofPathValue}.proof_id`, `Duplicate proof_id '${proof.proof_id}'.`));
    }
    proofIds.add(proof.proof_id);
    proofById.set(proof.proof_id, proof);

    if (!Array.isArray(proof.supported_claim_ids) || proof.supported_claim_ids.length === 0) {
      failures.push(makeFailure("CI_CONSTRAINT_UNUSED", proofPath, `${proofPathValue}.supported_claim_ids`, `Proof '${proof.proof_id}' does not support any claims.`));
    }

    for (let j = 0; j < (proof.supported_claim_ids || []).length; j += 1) {
      const claimId = proof.supported_claim_ids[j];
      if (!claimIds.has(claimId)) {
        failures.push(makeFailure("CI_FOREIGN_KEY_FAILURE", proofPath, `${proofPathValue}.supported_claim_ids[${j}]`, `Proof '${proof.proof_id}' references missing claim '${claimId}'.`));
      }
    }
  }

  const claimTextToId = new Map();

  for (let i = 0; i < claims.length; i += 1) {
    const claim = claims[i];
    if (!isNonEmptyString(claim.claim_text)) {
      continue;
    }

    if (claimTextToId.has(claim.claim_text)) {
      failures.push(makeFailure("CI_REGISTRY_STRUCTURE_INVALID", claimsPath, `claims[${i}].claim_text`, `Duplicate claim_text '${claim.claim_text}'.`));
    }
    claimTextToId.set(claim.claim_text, claim.claim_id);

    for (const rule of forbiddenPatterns) {
      if (rule.compiled.test(claim.claim_text)) {
        failures.push(makeFailure(rule.token || "CI_LINT_FORBIDDEN_CLAIM_SEMANTIC", claimsPath, `claims[${i}].claim_text`, `Claim text '${claim.claim_text}' matches forbidden pricing pattern '${rule.pattern_id}'.`));
      }
    }

    for (const proofId of claim.proof_ids || []) {
      if (!proofById.has(proofId)) {
        failures.push(makeFailure("CI_CONSTRAINT_UNUSED", claimsPath, `claims[${i}].proof_ids`, `Claim '${claim.claim_id}' references missing proof '${proofId}'.`));
        continue;
      }

      const proof = proofById.get(proofId);
      if (!Array.isArray(proof.supported_claim_ids) || !proof.supported_claim_ids.includes(claim.claim_id)) {
        failures.push(makeFailure("CI_CONSTRAINT_UNUSED", claimsPath, `claims[${i}].proof_ids`, `Proof '${proofId}' does not reciprocally support claim '${claim.claim_id}'.`));
      }
    }
  }

  const phraseSeen = new Set();
  for (let i = 0; i < phrases.length; i += 1) {
    const phrase = phrases[i];
    const phrasePath = `phrases[${i}]`;

    if (!isNonEmptyString(phrase)) {
      failures.push(makeFailure("CI_REGISTRY_STRUCTURE_INVALID", surfacePath, phrasePath, "Pricing phrase must be a non-empty string."));
      continue;
    }

    if (phraseSeen.has(phrase)) {
      failures.push(makeFailure("CI_REGISTRY_STRUCTURE_INVALID", surfacePath, phrasePath, `Duplicate surfaced phrase '${phrase}'.`));
    }
    phraseSeen.add(phrase);

    for (const rule of forbiddenPatterns) {
      if (rule.compiled.test(phrase)) {
        failures.push(makeFailure(rule.token || "CI_LINT_FORBIDDEN_CLAIM_SEMANTIC", surfacePath, phrasePath, `Surfaced phrase '${phrase}' matches forbidden pricing pattern '${rule.pattern_id}'.`));
      }
    }

    if (!claimTextToId.has(phrase)) {
      failures.push(makeFailure("CI_LINT_COPY_INLINE_STRING", surfacePath, phrasePath, `Surfaced phrase '${phrase}' is not backed by the coach-tier claim registry.`));
    }
  }

  return {
    ok: failures.length === 0,
    failures
  };
}

function main() {
  const repoRoot = process.cwd();

  const claimsPath = process.argv[2] || path.join(repoRoot, "docs/commercial/COACH_TIER_PRICING_CLAIM_REGISTRY.json");
  const proofPath = process.argv[3] || path.join(repoRoot, "docs/commercial/COACH_TIER_VALUE_PROOF_PACK.json");
  const surfacePath = process.argv[4] || path.join(repoRoot, "docs/commercial/COACH_TIER_PRICING_COPY_SURFACE.json");

  const report = runCoachTierPricingBoundaryLint({
    claimsPath,
    proofPath,
    surfacePath
  });

  const output = JSON.stringify(report, null, 2);
  if (!report.ok) {
    process.stderr.write(output + "\n");
    process.exit(1);
  }

  process.stdout.write(output + "\n");
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main();
}