import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCoachTierPricingBoundaryLint } from "../ci/scripts/run_coach_tier_pricing_boundary_lint.mjs";

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function makeTempCase({ claims, proofs, surface }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "coach-tier-pricing-boundary-"));
  const claimsPath = path.join(dir, "claims.json");
  const proofPath = path.join(dir, "proofs.json");
  const surfacePath = path.join(dir, "surface.json");

  writeJson(claimsPath, claims);
  writeJson(proofPath, proofs);
  writeJson(surfacePath, surface);

  return { claimsPath, proofPath, surfacePath };
}

function baseClaims() {
  return {
    schema_version: "kolosseum.coach_tier_pricing_claim_registry.v1.0.0",
    scope: "active_v0_only",
    tier_id: "coach_16",
    claims: [
      {
        claim_id: "coach_16_price_month",
        tier_id: "coach_16",
        claim_text: "£59.99 per month.",
        claim_class: "price_fact",
        proof_ids: ["proof_pricing_row_coach_16"],
        v0_scope_only: true,
        status: "allowed"
      },
      {
        claim_id: "coach_assign_within_system_limits",
        tier_id: "coach_16",
        claim_text: "Assign programs within system limits.",
        claim_class: "access_fact",
        proof_ids: ["proof_assign"],
        v0_scope_only: true,
        status: "allowed"
      }
    ],
    forbidden_semantic_patterns: [
      {
        pattern_id: "forbidden_optimisation",
        regex: "\\b(optimi[sz](?:e|ed|es|ing|ation)|better outcomes?)\\b",
        token: "CI_LINT_FORBIDDEN_CLAIM_SEMANTIC"
      }
    ]
  };
}

function baseProofs() {
  return {
    schema_version: "kolosseum.coach_tier_value_proof_pack.v1.0.0",
    scope: "active_v0_only",
    proofs: [
      {
        proof_id: "proof_pricing_row_coach_16",
        source_doc: "_commercial_pricing - v0 fenced.docx",
        source_anchor: "Coach Pricing Table / Coach 16",
        summary: "Coach 16 price proof.",
        supported_claim_ids: ["coach_16_price_month"]
      },
      {
        proof_id: "proof_assign",
        source_doc: "_commercial_pricing - v0 fenced.docx",
        source_anchor: "Coach / Gets / Assign programs within system limits",
        summary: "Assign within system limits proof.",
        supported_claim_ids: ["coach_assign_within_system_limits"]
      }
    ]
  };
}

function baseSurface() {
  return {
    schema_version: "kolosseum.coach_tier_pricing_copy_surface.v1.0.0",
    tier_id: "coach_16",
    phrases: [
      "£59.99 per month.",
      "Assign programs within system limits."
    ]
  };
}

test("passes on the repo coach-tier pricing proof slice", () => {
  const report = runCoachTierPricingBoundaryLint({
    claimsPath: path.resolve("docs/commercial/COACH_TIER_PRICING_CLAIM_REGISTRY.json"),
    proofPath: path.resolve("docs/commercial/COACH_TIER_VALUE_PROOF_PACK.json"),
    surfacePath: path.resolve("docs/commercial/COACH_TIER_PRICING_COPY_SURFACE.json")
  });

  assert.equal(report.ok, true, JSON.stringify(report, null, 2));
  assert.equal(report.failures.length, 0, JSON.stringify(report, null, 2));
});

test("fails when surfaced pricing copy uses forbidden optimisation language", () => {
  const claims = baseClaims();
  const proofs = baseProofs();
  const surface = baseSurface();
  surface.phrases.push("Optimised coaching decisions.");

  const files = makeTempCase({ claims, proofs, surface });
  const report = runCoachTierPricingBoundaryLint(files);

  assert.equal(report.ok, false);
  assert.ok(report.failures.some((failure) => failure.token === "CI_LINT_FORBIDDEN_CLAIM_SEMANTIC"), JSON.stringify(report, null, 2));
});

test("fails when a surfaced pricing phrase is not registered", () => {
  const claims = baseClaims();
  const proofs = baseProofs();
  const surface = baseSurface();
  surface.phrases.push("Centralise coach workflow.");

  const files = makeTempCase({ claims, proofs, surface });
  const report = runCoachTierPricingBoundaryLint(files);

  assert.equal(report.ok, false);
  assert.ok(report.failures.some((failure) => failure.token === "CI_LINT_COPY_INLINE_STRING"), JSON.stringify(report, null, 2));
});

test("fails when an allowed claim has no proof linkage", () => {
  const claims = baseClaims();
  claims.claims[1].proof_ids = [];
  const proofs = baseProofs();
  const surface = baseSurface();

  const files = makeTempCase({ claims, proofs, surface });
  const report = runCoachTierPricingBoundaryLint(files);

  assert.equal(report.ok, false);
  assert.ok(report.failures.some((failure) => failure.token === "CI_CONSTRAINT_UNUSED"), JSON.stringify(report, null, 2));
});