
// DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts,
// deterministic checks, and developer handover standards. Do not introduce hidden defaults,
// broad discovery, or unreviewed boundary changes.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCommercialArtefactRegistryGuard } from "../ci/scripts/run_commercial_artefact_registry_guard.mjs";

function writeFile(root, relPath, content = "x") {
  const fullPath = path.join(root, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, "utf8");
}

function makeRegistry() {
  return {
    registry_id: "commercial_artefact_registry",
    registry_version: "1.0.0",
    engine_compatibility: "EB2-1.0.0",
    scope_class: "closed_world",
    rewrite_policy: "rewrite_only",
    purpose: "Pinned CI-only registry for commercial-facing docs and packs.",
    v0_boundary_policy: {
      policy_id: "v0_commercial_artefact_registry_boundary_policy",
      v0_role: "boundary_protection_only",
      grants_product_scope: false,
      grants_engine_behaviour: false,
      permits_billing_or_subscriptions: false,
      permits_sales_dashboards: false,
      permits_market_launch_features: false,
      future_or_post_v0_artefacts_rule:
        "Artefacts outside the active v0 commercial boundary must remain explicitly future, v1, post-v0, dormant, or excluded. Registry inclusion does not make them active v0 product scope.",
      required_guard: "ci/scripts/run_commercial_artefact_registry_guard.mjs"
    },
    scan_roots: [
      "docs/commercial",
      "docs/pricing",
      "docs/company"
    ],
    allowed_extensions: [
      ".md",
      ".json",
      ".txt",
      ".pdf",
      ".docx"
    ],
    artefacts: [
      {
        artefact_id: "product_payments_organisational_capabilities_law",
        path: "docs/commercial/PRODUCT_PAYMENTS_ORGANISATIONAL_CAPABILITIES_LAW.md",
        class: "commercial_law"
      },
      {
        artefact_id: "pricing_entitlement_tiers",
        path: "docs/commercial/PRICING_ENTITLEMENT_TIERS.md",
        class: "commercial_authority_law"
      },
      {
        artefact_id: "commercial_pricing_pack_v0",
        path: "docs/pricing/COMMERCIAL_PRICING_PACK_V0.md",
        class: "commercial_pack"
      },
      {
        artefact_id: "company_structure_pack",
        path: "docs/company/COMPANY_STRUCTURE.md",
        class: "commercial_pack"
      }
    ]
  };
}

function setupPassFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "commercial-guard-"));
  writeFile(root, "docs/commercial/PRODUCT_PAYMENTS_ORGANISATIONAL_CAPABILITIES_LAW.md");
  writeFile(root, "docs/commercial/PRICING_ENTITLEMENT_TIERS.md");
  writeFile(root, "docs/pricing/COMMERCIAL_PRICING_PACK_V0.md");
  writeFile(root, "docs/company/COMPANY_STRUCTURE.md");

  const registryPath = path.join(root, "ci/registries/commercial_artefact_registry.json");
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });
  fs.writeFileSync(registryPath, JSON.stringify(makeRegistry(), null, 2), "utf8");

  return root;
}

test("commercial artefact registry guard passes when tracked surface is complete", () => {
  const root = setupPassFixture();
  const report = runCommercialArtefactRegistryGuard({ cwd: root });
  assert.equal(report.ok, true);
  assert.deepEqual(report.failures, []);
});

test("commercial artefact registry guard fails when a declared artefact is missing", () => {
  const root = setupPassFixture();
  fs.rmSync(path.join(root, "docs/pricing/COMMERCIAL_PRICING_PACK_V0.md"));

  const report = runCommercialArtefactRegistryGuard({ cwd: root });
  assert.equal(report.ok, false);
  assert.equal(report.failures[0].token, "CI_COMMERCIAL_ARTEFACT_MISSING");
  assert.match(report.failures[0].details, /Declared commercial artefact is missing/);
});

test("commercial artefact registry guard fails when an undeclared commercial artefact exists under tracked roots", () => {
  const root = setupPassFixture();
  writeFile(root, "docs/commercial/SALES_ENABLEMENT_PACK.md");

  const report = runCommercialArtefactRegistryGuard({ cwd: root });
  assert.equal(report.ok, false);
  assert.equal(report.failures[0].token, "CI_COMMERCIAL_ARTEFACT_UNDECLARED");
  assert.match(report.failures[0].details, /Undeclared commercial artefact detected/);
});
test("commercial artefact registry guard fails when boundary policy grants product scope", () => {
  const root = setupPassFixture();
  const registryPath = path.join(root, "ci/registries/commercial_artefact_registry.json");
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  registry.v0_boundary_policy.permits_billing_or_subscriptions = true;
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2), "utf8");

  const report = runCommercialArtefactRegistryGuard({ cwd: root });
  assert.equal(report.ok, false);
  assert.equal(report.failures[0].token, "CI_COMMERCIAL_ARTEFACT_REGISTRY_INVALID");
  assert.match(report.failures[0].details, /permits_billing_or_subscriptions must be false/);
});