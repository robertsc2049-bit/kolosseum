// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * DEV NOTE: S-V1-46 proof artefact view guard.
 * @law v1 proof artefact view
 * @severity medium
 * @scope repo
 *
 * Purpose: proves that the proof artefact view contract, API adapter, renderer,
 * copy surface, documentation, and package wiring remain present.
 * Boundary: this guard protects a read-model surface only; it must not create
 * engine, replay, envelope, export, or coach-note authority.
 * Determinism: file checks are static and fail closed when the expected contract
 * markers drift.
 * Failure: emits CI_V1_PROOF_ARTEFACT_VIEW_CONTRACT by throwing on the first
 * detected contract gap.
 */

import fs from "node:fs";

const TOKEN = "CI_V1_PROOF_ARTEFACT_VIEW_CONTRACT";

const FILES = Object.freeze({
  source: "src/v1ProofArtefactViewContract.mjs",
  test: "test/s_v1_46_proof_artefact_view.test.mjs",
  guard: "ci/guards/s_v1_46_proof_artefact_view_guard.mjs",
  doc: "docs/v1/V1_PROOF_ARTEFACT_VIEW.md",
  copy: "copy/proof_artefact_view_copy.json",
  packageJson: "package.json",
});

function read(path) {
  if (!fs.existsSync(path)) {
    throw new Error(`${TOKEN}: missing ${path}`);
  }

  return fs.readFileSync(path, "utf8");
}

function requireText(text, needle, message) {
  if (!text.includes(needle)) {
    throw new Error(`${TOKEN}: ${message}`);
  }
}

function requireRegex(text, pattern, message) {
  if (!pattern.test(text)) {
    throw new Error(`${TOKEN}: ${message}`);
  }
}

function rejectRegex(text, pattern, message) {
  if (pattern.test(text)) {
    throw new Error(`${TOKEN}: ${message}`);
  }
}

function parseJson(path) {
  try {
    return JSON.parse(read(path));
  } catch (error) {
    throw new Error(`${TOKEN}: invalid json in ${path}: ${error.message}`);
  }
}

function validateCopyRegistry() {
  const copy = parseJson(FILES.copy);

  if (copy.surface_id !== "v1.proof_artefact_view") {
    throw new Error(`${TOKEN}: copy surface_id mismatch`);
  }

  if (!Array.isArray(copy.entries)) {
    throw new Error(`${TOKEN}: copy entries must be an array`);
  }

  const ids = new Set(copy.entries.map((entry) => entry.copy_id));
  const required = [
    "v1.proof_artefact_view.title",
    "v1.proof_artefact_view.not_available",
    "v1.proof_artefact_view.permission_required",
    "v1.proof_artefact_view.source_record",
    "v1.proof_artefact_view.replay_verdict",
    "v1.proof_artefact_view.envelope_state",
    "v1.proof_artefact_view.artefact_hash",
    "v1.proof_artefact_view.recorded_at",
  ];

  for (const id of required) {
    if (!ids.has(id)) {
      throw new Error(`${TOKEN}: missing copy id ${id}`);
    }
  }

  for (const entry of copy.entries) {
    if (typeof entry.copy_text !== "string" || entry.copy_text.length === 0) {
      throw new Error(`${TOKEN}: copy entry text missing for ${entry.copy_id}`);
    }
  }
}

function validateNoDisallowedSurfaceWords() {
  const paths = [FILES.source, FILES.doc, FILES.copy];
  const patterns = [
    new RegExp("\\bcertif\\w*\\b", "i"),
    new RegExp("\\brank\\w*\\b", "i"),
    new RegExp("\\brea" + "dy\\w*\\b", "i"),
    new RegExp("\\bsa" + "fe\\w*\\b", "i"),
    new RegExp("\\beffect\\w*\\b", "i"),
    new RegExp("\\boptimal\\b|\\boptimise\\b|\\boptimize\\b", "i"),
  ];

  for (const path of paths) {
    const text = read(path);
    for (const pattern of patterns) {
      rejectRegex(text, pattern, `${path} contains non-scope wording`);
    }
  }
}

function main() {
  const source = read(FILES.source);
  const test = read(FILES.test);
  const doc = read(FILES.doc);
  const packageJson = read(FILES.packageJson);

  requireText(source, "S_V1_46_PROOF_ARTEFACT_VIEW_CONTRACT_ID", "source must expose S-V1-46 contract id");
  requireText(source, "buildProofArtefactView", "source must expose read-model builder");
  requireText(source, "handleProofArtefactViewApiRequest", "source must expose API adapter");
  requireText(source, "renderProofArtefactView", "source must expose renderer");
  requireText(source, "source_bound", "source must keep source-bound field");
  requireText(source, "permission_scope", "source must expose permission scope");
  requireText(source, "proof_state", "source must expose proof state");
  requireText(source, "not_available", "source must expose missing-proof state");
  requireText(source, "deepFreeze", "source must freeze returned records");
  requireText(source, "createHash", "source must use deterministic view id materialisation");

  requireText(test, "builds a source-bound proof artefact view", "test must cover factual view creation");
  requireText(test, "active assigned coach", "test must cover assigned coach permission");
  requireText(test, "blocks unrelated coach access", "test must cover unrelated coach denial");
  requireText(test, "pending and revoked", "test must cover inactive relationship denial");
  requireText(test, "not_available", "test must cover missing-proof state");
  requireText(test, "renderer emits copy ids", "test must cover UI renderer copy-id boundary");
  requireText(test, "API adapter returns permission status", "test must cover API adapter");
  requireText(test, "deterministic", "test must cover deterministic output");

  requireText(doc, "S-V1-46 Proof Artefact View", "doc must identify slice");
  requireText(doc, "permission-scoped proof artefact view", "doc must state purpose");
  requireText(doc, "Missing proof remains not_available.", "doc must state missing-proof invariant");
  requireText(doc, "The renderer emits copy ids and factual values only.", "doc must state renderer boundary");

  requireText(packageJson, "node --test test/s_v1_46_proof_artefact_view.test.mjs", "package lint:fast must run S-V1-46 test");
  requireText(packageJson, "node ci/guards/s_v1_46_proof_artefact_view_guard.mjs", "package lint:fast must run S-V1-46 guard");

  requireRegex(source, /import\s+\{\s*createHash\s*\}\s+from\s+"node:crypto";/, "source must import only deterministic crypto helper");
  rejectRegex(source, /\.\.\/engine|from\s+["'].*engine|require\(["'].*engine/, "source must not import engine internals");
  rejectRegex(source, /\bDate\.now\b|\bnew Date\s*\(/, "source must not use wall-clock time");

  validateCopyRegistry();
  validateNoDisallowedSurfaceWords();

  console.log("s_v1_46_proof_artefact_view_guard: PASS");
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    guard: "S-V1-46",
    token: TOKEN,
    message: error.message,
    path: FILES.guard,
  }));
  process.exitCode = 1;
}
