import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  BETA_TOKEN_REPORT_TOPIC_TOKENS,
  CI_TOKEN_REPORT_CONTRACT_TOKEN,
  CI_TOKEN_REPORT_SCHEMA_VERSION,
  createCiTokenReport,
  normaliseTokenFailure
} from "../ci/scripts/ci_token_report.mjs";

function captureNode(source) {
  return spawnSync(process.execPath, ["--input-type=module", "-e", source], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
}

function parseLastJsonLine(text) {
  const lines = String(text).trim().split(/\n+/).map((line) => line.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(lines[i]);
    } catch {
      continue;
    }
  }
  throw new Error(`No JSON line found in output:\n${text}`);
}

function write(root, rel, text) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n"), "utf8");
}

function betaManifest(overrides = {}) {
  const manifest = {
    schema_version: "kolosseum.beta.spine_artefact_manifest.v1.0.0",
    manifest_id: "BETA-01",
    build_target: "september_controlled_beta_2026",
    required_version: "0.1.24",
    engine_compatibility: "0.1.24",
    resolution_policy: {
      explicit_manifest_only: true,
      no_fallback: true,
      no_discovery: true,
      no_inference: true,
      no_defaults: true,
      unknown_reference_hard_fail: true
    },
    phase_policy: {
      standard_phases: [1, 2, 3, 4, 5, 6],
      beta_only_phases: [7, 8],
      beta_target_required: "september_controlled_beta_2026",
      phase_7_8_ship_scope_allowed: false
    },
    orphan_scope_roots: ["spine/"],
    spine_references: [
      { path: "spine/BUILD_TARGET_september_beta_2026.md", required: true },
      { path: "spine/BETA_ARTEFACT_MANIFEST.json", required: true }
    ],
    dependency_order: ["beta_build_target", "beta_spine_artefact_manifest"],
    artefacts: [
      {
        id: "beta_build_target",
        path: "spine/BUILD_TARGET_september_beta_2026.md",
        scope: "beta",
        version: "0.1.24",
        engine_compatibility: "0.1.24",
        phase_range: [1, 8],
        beta_only: true,
        ship_scope: false,
        dependencies: []
      },
      {
        id: "beta_spine_artefact_manifest",
        path: "spine/BETA_ARTEFACT_MANIFEST.json",
        scope: "beta",
        version: "0.1.24",
        engine_compatibility: "0.1.24",
        phase_range: [1, 8],
        beta_only: true,
        ship_scope: false,
        dependencies: ["beta_build_target"]
      }
    ]
  };

  return Object.assign(manifest, overrides);
}

function makeSpineRepo(mutator = () => {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kolosseum-beta03-spine-"));
  write(root, "package.json", `${JSON.stringify({ version: "0.1.24", type: "module" }, null, 2)}\n`);
  write(root, "docs/SPINE.md", "# Spine\n\n**CORE.md**\n");
  write(root, "docs/CORE.md", "# Core\n");
  write(root, "spine/BUILD_TARGET_september_beta_2026.md", "# Beta target\n");
  const manifest = betaManifest();
  mutator(root, manifest);
  write(root, "spine/BETA_ARTEFACT_MANIFEST.json", `${JSON.stringify(manifest, null, 2)}\n`);
  return root;
}

test("BETA-03 one failure emits machine-readable token report", () => {
  const report = createCiTokenReport({
    guard: "BETA-03",
    token: CI_TOKEN_REPORT_CONTRACT_TOKEN,
    failures: [
      {
        token: "CI_BETA_PHASE_7_SCOPE",
        message: "phase 7 token probe",
        source: "test/ci_token_report_contract.test.mjs",
        location: {
          path: "spine/BUILD_TARGET_september_beta_2026.md",
          line: 4
        },
        details: {
          topic: "phase7"
        }
      }
    ]
  });

  assert.equal(report.ok, false);
  assert.equal(report.schema_version, CI_TOKEN_REPORT_SCHEMA_VERSION);
  assert.equal(report.guard, "BETA-03");
  assert.equal(report.failure_count, 1);
  assert.equal(report.failures[0].token, "CI_BETA_PHASE_7_SCOPE");
  assert.equal(report.failures[0].location.path, "spine/BUILD_TARGET_september_beta_2026.md");
  assert.equal(report.failures[0].location.line, 4);
  assert.deepEqual(report.failures[0].details, { topic: "phase7" });
});

test("BETA-03 multiple failures keep consistent failure shape", () => {
  const report = createCiTokenReport({
    guard: "BETA-03",
    token: CI_TOKEN_REPORT_CONTRACT_TOKEN,
    failures: [
      { token: BETA_TOKEN_REPORT_TOPIC_TOKENS.schema, message: "schema token probe", source: "schema" },
      { token: BETA_TOKEN_REPORT_TOPIC_TOKENS.registry, message: "registry token probe", source: "registry", details: { registry: "exercise" } },
      { token: BETA_TOKEN_REPORT_TOPIC_TOKENS.copy, message: "copy token probe", source: "copy" },
      { token: BETA_TOKEN_REPORT_TOPIC_TOKENS.replay, message: "replay token probe", source: "replay" },
      { token: BETA_TOKEN_REPORT_TOPIC_TOKENS.phase8, message: "phase 8 token probe", source: "phase8" }
    ]
  });

  assert.equal(report.ok, false);
  assert.equal(report.failure_count, 5);

  for (const failure of report.failures) {
    assert.equal(typeof failure.token, "string");
    assert.equal(typeof failure.message, "string");
    assert.ok(failure.token.startsWith("CI_"));
    assert.ok(!Object.prototype.hasOwnProperty.call(failure, "ok"));
  }
});

test("BETA-03 no failures emits success report", () => {
  const report = createCiTokenReport({
    guard: "BETA-03",
    token: CI_TOKEN_REPORT_CONTRACT_TOKEN,
    message: "contract ok",
    failures: []
  });

  assert.deepEqual(report, {
    ok: true,
    schema_version: CI_TOKEN_REPORT_SCHEMA_VERSION,
    guard: "BETA-03",
    failure_count: 0,
    token: CI_TOKEN_REPORT_CONTRACT_TOKEN,
    message: "contract ok"
  });
});

test("BETA-03 missing required token metadata fails", () => {
  assert.throws(
    () => normaliseTokenFailure({ message: "missing token" }),
    /CI_BETA_TOKEN_REPORT_CONTRACT: failure\.token is required/
  );

  assert.throws(
    () => normaliseTokenFailure({ token: "CI_BETA_TOKEN_REPORT_CONTRACT" }),
    /CI_BETA_TOKEN_REPORT_CONTRACT: failure\.message is required/
  );
});

test("BETA-03 emit helper prints one JSON report", () => {
  const result = captureNode(`
    import { createCiTokenReport, emitCiTokenReport } from "./ci/scripts/ci_token_report.mjs";
    const report = createCiTokenReport({
      guard: "BETA-03",
      token: "CI_BETA_TOKEN_REPORT_CONTRACT",
      failures: [{ token: "CI_BETA_TOKEN_REPORT_CONTRACT", message: "probe" }]
    });
    emitCiTokenReport(report, { stream: "stderr" });
  `);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "");

  const parsed = parseLastJsonLine(result.stderr);
  assert.equal(parsed.schema_version, CI_TOKEN_REPORT_SCHEMA_VERSION);
  assert.equal(parsed.failure_count, 1);
  assert.equal(parsed.failures[0].token, "CI_BETA_TOKEN_REPORT_CONTRACT");
});

test("BETA-03 spine guard failure emits one contract JSON report", () => {
  const guardPath = path.resolve("ci/scripts/spine_guard.mjs");
  const root = makeSpineRepo((_root, manifest) => {
    manifest.artefacts[0].scope = "ship";
    manifest.artefacts[0].beta_only = false;
    manifest.artefacts[0].ship_scope = true;
  });

  const result = spawnSync(process.execPath, [
    guardPath,
    "--root",
    root,
    "--spine",
    "docs/SPINE.md",
    "--manifest",
    "spine/BETA_ARTEFACT_MANIFEST.json"
  ], {
    cwd: process.cwd(),
    encoding: "utf8"
  });

  assert.notEqual(result.status, 0);

  const parsed = parseLastJsonLine(result.stderr);
  assert.equal(parsed.schema_version, CI_TOKEN_REPORT_SCHEMA_VERSION);
  assert.equal(parsed.guard, "BETA-01");
  assert.equal(parsed.ok, false);
  assert.equal(parsed.failure_count, 1);
  assert.equal(parsed.failures[0].token, "CI_BETA_SPINE_PHASE_SCOPE_VIOLATION");
  assert.equal(parsed.failures[0].source, "ci/scripts/spine_guard.mjs");
});

test("BETA-03 topic token catalogue covers required guard domains", () => {
  assert.deepEqual(Object.keys(BETA_TOKEN_REPORT_TOPIC_TOKENS).sort(), [
    "copy",
    "phase7",
    "phase8",
    "registry",
    "replay",
    "schema",
    "spine"
  ]);

  for (const token of Object.values(BETA_TOKEN_REPORT_TOPIC_TOKENS)) {
    assert.match(token, /^CI_[A-Z0-9_]+$/);
  }
});
