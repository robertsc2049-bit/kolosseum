import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { verifyRegistrySurfaceClassification } from "../ci/scripts/run_registry_surface_classification_verifier.mjs";

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function makeRegistry(documentId) {
  return {
    registry_header: {
      document_id: documentId,
      document_type: "registry",
      document_version: "1.0.0",
      engine_compatibility: "EB2-1.0.0",
      scope_class: "closed_world",
      rewrite_policy: "rewrite_only"
    },
    entries: []
  };
}

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "p93-registry-surface-"));
}

function writeSeal(root, overrides = {}) {
  writeJson(path.join(root, "ci", "evidence", "evidence_seal.v1.json"), {
    contract: "kolosseum:evidence_seal@1",
    envelope_sha256: "A".repeat(64),
    seal_sha256: "B".repeat(64),
    ...overrides
  });
}

test("passes when launch-critical registries are present in bundle and dormant/excluded stay out", () => {
  const root = makeRoot();

  writeJson(path.join(root, "registries", "activity", "activity.registry.json"), makeRegistry("activity.registry"));
  writeJson(path.join(root, "registries", "exercise", "exercise_substitution_graph.json"), { document_id: "exercise_substitution_graph", entries: [] });
  writeJson(path.join(root, "registries", "exercise", "exercise_warmup_mapping.registry.json"), { document_id: "exercise_warmup_mapping_registry", entries: [] });

  writeJson(path.join(root, "registries", "registry_surface_classification.json"), {
    registry_surface_classification: {
      version: "1.0.0",
      engine_compatibility: "EB2-1.0.0",
      classification: [
        { document_id: "activity.registry", class: "launch_critical" },
        { document_id: "exercise_substitution_graph", class: "dormant" },
        { document_id: "exercise_warmup_mapping_registry", class: "excluded" }
      ]
    }
  });

  writeJson(path.join(root, "registries", "registry_bundle.json"), {
    version: "1.0.0",
    note: "generated bundle (do not hand edit)",
    registries: {
      activity: {
        registry_id: "activity",
        version: "1.0.0",
        entries: {}
      }
    }
  });

  writeSeal(root);

  const report = verifyRegistrySurfaceClassification(root);
  assert.equal(report.ok, true);
  assert.deepEqual(report.failures, []);
});

test("fails when a live registry surface is missing from classification", () => {
  const root = makeRoot();

  writeJson(path.join(root, "registries", "activity", "activity.registry.json"), makeRegistry("activity.registry"));
  writeJson(path.join(root, "registries", "registry_surface_classification.json"), {
    registry_surface_classification: {
      version: "1.0.0",
      engine_compatibility: "EB2-1.0.0",
      classification: []
    }
  });

  writeJson(path.join(root, "registries", "registry_bundle.json"), {
    version: "1.0.0",
    note: "generated bundle (do not hand edit)",
    registries: {}
  });

  writeSeal(root);

  const report = verifyRegistrySurfaceClassification(root);
  assert.equal(report.ok, false);
  assert.match(JSON.stringify(report.failures), /not classified/);
});

test("fails when launch-critical registry is missing from bundle", () => {
  const root = makeRoot();

  writeJson(path.join(root, "registries", "activity", "activity.registry.json"), makeRegistry("activity.registry"));
  writeJson(path.join(root, "registries", "registry_surface_classification.json"), {
    registry_surface_classification: {
      version: "1.0.0",
      engine_compatibility: "EB2-1.0.0",
      classification: [
        { document_id: "activity.registry", class: "launch_critical" }
      ]
    }
  });

  writeJson(path.join(root, "registries", "registry_bundle.json"), {
    version: "1.0.0",
    note: "generated bundle (do not hand edit)",
    registries: {}
  });

  writeSeal(root);

  const report = verifyRegistrySurfaceClassification(root);
  assert.equal(report.ok, false);
  assert.match(JSON.stringify(report.failures), /not present in registry bundle key 'activity'/);
});

test("fails when dormant registry is present in active bundle", () => {
  const root = makeRoot();

  writeJson(path.join(root, "registries", "exercise", "exercise_substitution_graph.json"), {
    document_id: "exercise_substitution_graph",
    entries: []
  });

  writeJson(path.join(root, "registries", "registry_surface_classification.json"), {
    registry_surface_classification: {
      version: "1.0.0",
      engine_compatibility: "EB2-1.0.0",
      classification: [
        { document_id: "exercise_substitution_graph", class: "dormant" }
      ]
    }
  });

  writeJson(path.join(root, "registries", "registry_bundle.json"), {
    version: "1.0.0",
    note: "generated bundle (do not hand edit)",
    registries: {
      exercise: {
        registry_id: "exercise",
        version: "1.0.0",
        entries: {}
      }
    }
  });

  writeSeal(root);

  const report = verifyRegistrySurfaceClassification(root);
  assert.equal(report.ok, false);
  assert.match(JSON.stringify(report.failures), /Dormant registry/);
});

test("fails when evidence seal contract is malformed", () => {
  const root = makeRoot();

  writeJson(path.join(root, "registries", "activity", "activity.registry.json"), makeRegistry("activity.registry"));
  writeJson(path.join(root, "registries", "registry_surface_classification.json"), {
    registry_surface_classification: {
      version: "1.0.0",
      engine_compatibility: "EB2-1.0.0",
      classification: [
        { document_id: "activity.registry", class: "launch_critical" }
      ]
    }
  });

  writeJson(path.join(root, "registries", "registry_bundle.json"), {
    version: "1.0.0",
    note: "generated bundle (do not hand edit)",
    registries: {
      activity: {
        registry_id: "activity",
        version: "1.0.0",
        entries: {}
      }
    }
  });

  writeSeal(root, {
    contract: "wrong",
    envelope_sha256: "bad",
    seal_sha256: "also_bad"
  });

  const report = verifyRegistrySurfaceClassification(root);
  assert.equal(report.ok, false);
  assert.match(JSON.stringify(report.failures), /evidence seal contract must be/);
  assert.match(JSON.stringify(report.failures), /envelope_sha256/);
  assert.match(JSON.stringify(report.failures), /seal_sha256/);
});