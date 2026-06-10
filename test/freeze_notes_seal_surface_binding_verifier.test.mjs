import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { verifyReleaseNotesBoundary } from "../ci/scripts/run_freeze_notes_seal_surface_binding_verifier.mjs";

function writeJson(dir, name, value) {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
  return filePath;
}

function writeText(dir, name, value) {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, value.replace(/\r\n/g, "\n") + "\n", "utf8");
  return filePath;
}

function runCase(t, { sealState, manifest, notes }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p106-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const sealStatePath = writeJson(dir, "seal-state.json", sealState);
  const manifestPath = writeJson(dir, "sealed-surface-manifest.json", manifest);
  const notesPath = writeText(dir, "release-notes.txt", notes);

  return verifyReleaseNotesBoundary({
    sealStatePath,
    sealedSurfaceManifestPath: manifestPath,
    releaseNotesPath: notesPath,
  });
}

test("passes when notes stay inside sealed surfaces and narrow replay scope", (t) => {
  const result = runCase(t, {
    sealState: {
      active_seal_state: "pre_seal",
    },
    manifest: {
      sealed_surfaces: [
        "phase2_canonicalisation",
        "phase6_runtime_execution",
        "release_notes_surface",
      ],
      replay_scope: "phase2_and_phase6_only",
      allowed_note_claims: [],
    },
    notes: [
      "Kolosseum v0 freeze state remains within the active pre-seal boundary.",
      "Replay verification is limited to the currently declared lawful scope.",
      "surface: phase2_canonicalisation",
      "surface: phase6_runtime_execution",
    ].join("\n"),
  });

  assert.equal(result.ok, true);
});

test("fails when pre-seal notes claim evidence sealed", (t) => {
  const result = runCase(t, {
    sealState: {
      active_seal_state: "pre_seal",
    },
    manifest: {
      sealed_surfaces: [
        "phase2_canonicalisation",
        "phase6_runtime_execution",
      ],
      replay_scope: "phase2_and_phase6_only",
      allowed_note_claims: [],
    },
    notes: "Evidence sealed and ready for export.",
  });

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "CI_RELEASE_NOTES_SEAL_SCOPE_VIOLATION");
  assert.match(result.failures[0].details, /pre_seal/i);
});

test("fails when notes reference an unsealed surface line", (t) => {
  const result = runCase(t, {
    sealState: {
      active_seal_state: "sealed",
    },
    manifest: {
      sealed_surfaces: [
        "phase2_canonicalisation",
        "phase6_runtime_execution",
      ],
      replay_scope: "phase2_and_phase6_only",
      allowed_note_claims: [],
    },
    notes: [
      "Freeze state aligned to sealed surfaces only.",
      "surface: phase2_canonicalisation",
      "surface: phase8_evidence_sealing",
    ].join("\n"),
  });

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "CI_RELEASE_NOTES_SEAL_SCOPE_VIOLATION");
  assert.match(result.failures[0].details, /unsealed surface/i);
});

test("fails when notes overstate replay scope", (t) => {
  const result = runCase(t, {
    sealState: {
      active_seal_state: "sealed",
    },
    manifest: {
      sealed_surfaces: [
        "phase2_canonicalisation",
        "phase6_runtime_execution",
      ],
      replay_scope: "phase2_and_phase6_only",
      allowed_note_claims: [],
    },
    notes: "Replay proves all phases and full replay proof is complete.",
  });

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "CI_RELEASE_NOTES_SEAL_SCOPE_VIOLATION");
  assert.match(result.failures[0].details, /replay proof/i);
});

test("passes when sealed state includes phase7 and phase8 and claims are explicitly allowlisted", (t) => {
  const result = runCase(t, {
    sealState: {
      active_seal_state: "sealed",
    },
    manifest: {
      sealed_surfaces: [
        "phase2_canonicalisation",
        "phase6_runtime_execution",
        "phase7_truth_projection",
        "phase8_evidence_sealing",
      ],
      replay_scope: "full",
      allowed_note_claims: [
        "claims_replay_full_scope",
      ],
    },
    notes: [
      "Proof-complete release boundary is active.",
      "Evidence sealed.",
      "Phase 7 truth projection and Phase 8 evidence sealing are active.",
      "Replay proves all phases.",
      "surface: phase7_truth_projection",
      "surface: phase8_evidence_sealing",
    ].join("\n"),
  });

  assert.equal(result.ok, true);
});