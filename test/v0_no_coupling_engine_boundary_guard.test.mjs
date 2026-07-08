// DEV NOTE: S-V0-22 executable boundary proof. These tests exercise the guard
// against temporary positive and negative repos so future developers can see
// exactly which coupling paths are illegal without mutating the real repo.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  extractImportSpecifiers,
  runNoCouplingEngineBoundaryGuard
} from "../ci/scripts/run_v0_no_coupling_engine_boundary_guard.mjs";

function writeFile(root, relPath, text) {
  const fullPath = path.join(root, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, text, "utf8");
}

function writeJson(root, relPath, value) {
  writeFile(root, relPath, `${JSON.stringify(value, null, 2)}\n`);
}

function makeTempRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "s-v0-22-no-coupling-"));

  writeFile(root, "engine/src/index.ts", [
    "import { phase1 } from './phases/phase1.js';",
    "export function runEngine(input) {",
    "  return phase1(input);",
    "}"
  ].join("\n"));

  writeFile(root, "engine/src/phases/phase1.ts", [
    "export function phase1(input) {",
    "  return { ok: true, input };",
    "}"
  ].join("\n"));

  writeFile(root, "engine/runtime/session_runtime.ts", [
    "export function makeRuntimeState() {",
    "  return { status: 'not_started' };",
    "}"
  ].join("\n"));

  writeJson(root, "engine/package.json", {
    name: "@kolosseum/engine",
    type: "module",
    types: "./types/index.d.ts",
    exports: {
      ".": {
        types: "./types/index.d.ts",
        default: "./dist/src/index.js"
      }
    }
  });

  return root;
}

test("S-V0-22 import parser sees static, dynamic, re-export, and require coupling routes", () => {
  const source = [
    "import a from '../ui/a.js';",
    "export { b } from '../copy/b.js';",
    "const c = await import('../commercial/c.js');",
    "const d = require('../notes/d.cjs');"
  ].join("\n");

  assert.deepEqual(extractImportSpecifiers(source), [
    "../commercial/c.js",
    "../copy/b.js",
    "../notes/d.cjs",
    "../ui/a.js"
  ]);
});

test("S-V0-22 guard passes when engine imports remain inside engine", () => {
  const root = makeTempRepo();
  const report = runNoCouplingEngineBoundaryGuard({ repoRoot: root });

  assert.equal(report.ok, true, JSON.stringify(report, null, 2));
  assert.deepEqual(report.failures, []);
});

test("S-V0-22 guard fails when engine imports UI", () => {
  const root = makeTempRepo();
  writeFile(root, "engine/src/bad_ui.ts", "import { render } from '../../ui/render/session.js';\nexport const x = render;\n");

  const report = runNoCouplingEngineBoundaryGuard({ repoRoot: root });

  assert.equal(report.ok, false);
  assert.ok(report.failures.some((failure) => failure.token === "CI_ENGINE_BOUNDARY_FORBIDDEN_IMPORT"));
  assert.ok(report.failures.some((failure) => failure.import_specifier === "../../ui/render/session.js"));
});

test("S-V0-22 guard fails when engine imports copy", () => {
  const root = makeTempRepo();
  writeFile(root, "engine/src/bad_copy.ts", "import { COPY } from '../../copy/session.copy.js';\nexport const x = COPY;\n");

  const report = runNoCouplingEngineBoundaryGuard({ repoRoot: root });

  assert.equal(report.ok, false);
  assert.ok(report.failures.some((failure) => failure.token === "CI_ENGINE_BOUNDARY_FORBIDDEN_IMPORT"));
  assert.ok(report.failures.some((failure) => failure.import_specifier === "../../copy/session.copy.js"));
});

test("S-V0-22 guard fails when engine imports coach notes", () => {
  const root = makeTempRepo();
  writeFile(root, "engine/runtime/bad_notes.ts", "import { note } from '../../notes/coach-notes.js';\nexport const x = note;\n");

  const report = runNoCouplingEngineBoundaryGuard({ repoRoot: root });

  assert.equal(report.ok, false);
  assert.ok(report.failures.some((failure) => failure.token === "CI_ENGINE_BOUNDARY_FORBIDDEN_IMPORT"));
  assert.ok(report.failures.some((failure) => failure.import_specifier === "../../notes/coach-notes.js"));
});

test("S-V0-22 guard fails when engine imports commercial or payment surfaces", () => {
  const root = makeTempRepo();
  writeFile(root, "engine/src/bad_payment.ts", [
    "import { tier } from '../../commercial/pricing.js';",
    "import { paymentState } from '../../payment/state.js';",
    "export const x = [tier, paymentState];"
  ].join("\n"));

  const report = runNoCouplingEngineBoundaryGuard({ repoRoot: root });

  assert.equal(report.ok, false);
  assert.ok(report.failures.some((failure) => failure.import_specifier === "../../commercial/pricing.js"));
  assert.ok(report.failures.some((failure) => failure.import_specifier === "../../payment/state.js"));
});

test("S-V0-22 guard fails when engine imports server or API transport", () => {
  const root = makeTempRepo();
  writeFile(root, "engine/src/bad_server.ts", "import { handler } from '../../server/session.handler.js';\nexport const x = handler;\n");

  const report = runNoCouplingEngineBoundaryGuard({ repoRoot: root });

  assert.equal(report.ok, false);
  assert.ok(report.failures.some((failure) => failure.token === "CI_ENGINE_BOUNDARY_FORBIDDEN_IMPORT"));
  assert.ok(report.failures.some((failure) => failure.import_specifier === "../../server/session.handler.js"));
});

test("S-V0-22 guard fails when engine package exports a forbidden surface", () => {
  const root = makeTempRepo();
  writeJson(root, "engine/package.json", {
    name: "@kolosseum/engine",
    type: "module",
    types: "./types/index.d.ts",
    exports: {
      ".": {
        types: "./types/index.d.ts",
        default: "./dist/src/index.js"
      },
      "./bad-copy.js": {
        types: "./types/copy/bad.d.ts",
        default: "./dist/copy/bad.js"
      }
    }
  });

  const report = runNoCouplingEngineBoundaryGuard({ repoRoot: root });

  assert.equal(report.ok, false);
  assert.ok(report.failures.some((failure) => failure.token === "CI_ENGINE_BOUNDARY_FORBIDDEN_EXPORT"));
});
