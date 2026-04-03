import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relPath) {
  const full = path.join(root, relPath);
  assert.ok(fs.existsSync(full), `required file missing: ${relPath}`);
  return fs.readFileSync(full, "utf8");
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const base = entry.name.toLowerCase();
      if (base === ".git" || base === "node_modules" || base === "dist" || base === "artifacts") continue;
      walk(full, acc);
    } else {
      acc.push(full);
    }
  }
  return acc;
}

function repoTextFiles() {
  return walk(root).filter((full) => /\.(md|txt|json|mjs|js|ts)$/i.test(full));
}

function findAuthority(kind) {
  const files = repoTextFiles();

  for (const full of files) {
    const rel = path.relative(root, full).replace(/\\/g, "/");
    const text = fs.readFileSync(full, "utf8");

    if (kind === "v0_redefinition") {
      const fileHit = /v0.*redefinition|redefinition.*v0/i.test(rel);
      const textHit =
        /(v0 redefinition|deterministic execution alpha)/i.test(text) &&
        /(phase 1.?6|phase1.?6|split\/return|split return|coach_managed)/i.test(text);
      if (fileHit || textHit) return { rel, text };
    }

    if (kind === "current_build_target_v0") {
      const fileHit = /build.*target.*v0|v0.*build.*target/i.test(rel);
      const textHit =
        /(build_target_v0|build target v0|current build target)/i.test(text) &&
        /(phase 1.?6|phase1.?6|active v0|excluded|not supported)/i.test(text);
      if (fileHit || textHit) return { rel, text };
    }
  }

  return null;
}

function parseMatrixRows(src) {
  const rows = [];
  const lines = src.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\|\s*([a-z0-9_]+)\s*\|\s*(SUPPORTED|NOT_SUPPORTED)\s*\|\s*(.+?)\s*\|$/);
    if (!m) continue;
    if (m[1] === "capability" && m[2] === "status") continue;
    rows.push({
      capability: m[1],
      status: m[2],
      boundary_note: m[3]
    });
  }
  return rows;
}

test("P153 matrix exists and is explicitly source-bound", () => {
  const src = read("docs/v0/P153_V0_CAPABILITY_MATRIX.md");
  assert.match(src, /# P153/);
  assert.match(src, /v0 Capability Matrix/);
  assert.match(src, /Sales and demo language must not outrun the build/);
  assert.match(src, /current_build_target_v0/);
  assert.match(src, /v0_redefinition/);
});

test("P153 source authorities are discoverable in repo text surfaces", () => {
  const v0Redefinition = findAuthority("v0_redefinition");
  const buildTarget = findAuthority("current_build_target_v0");

  assert.ok(v0Redefinition, "could not discover repo authority for v0 redefinition");
  assert.ok(buildTarget, "could not discover repo authority for current build target v0");
});

test("P153 matrix contains required supported and unsupported capabilities", () => {
  const src = read("docs/v0/P153_V0_CAPABILITY_MATRIX.md");
  const rows = parseMatrixRows(src);

  const byCapability = new Map(rows.map((row) => [row.capability, row.status]));

  const expected = {
    onboarding_phase1_to_phase6: "SUPPORTED",
    activity_powerlifting: "SUPPORTED",
    activity_general_strength: "SUPPORTED",
    activity_hyrox: "SUPPORTED",
    compile_program_to_session: "SUPPORTED",
    session_execution: "SUPPORTED",
    split_return: "SUPPORTED",
    partial_completion: "SUPPORTED",
    coach_assignment: "SUPPORTED",
    coach_notes_non_binding: "SUPPORTED",
    factual_read_model_summary: "SUPPORTED",
    org_team_unit_surfaces: "NOT_SUPPORTED",
    gym_runtime_surfaces: "NOT_SUPPORTED",
    dashboards_analytics_rankings: "NOT_SUPPORTED",
    messaging_social_collaboration: "NOT_SUPPORTED",
    readiness_scoring_or_advice: "NOT_SUPPORTED",
    exports_evidence_proof_surfaces: "NOT_SUPPORTED",
    phase7_phase8_runtime_claims: "NOT_SUPPORTED"
  };

  for (const [capability, status] of Object.entries(expected)) {
    assert.equal(byCapability.get(capability), status, `capability row mismatch for ${capability}`);
  }
});

test("P153 matrix has no contradictory duplicated capability rows", () => {
  const src = read("docs/v0/P153_V0_CAPABILITY_MATRIX.md");
  const rows = parseMatrixRows(src);

  const seen = new Map();
  for (const row of rows) {
    const prior = seen.get(row.capability);
    if (!prior) {
      seen.set(row.capability, row.status);
      continue;
    }
    assert.equal(prior, row.status, `contradictory matrix status for ${row.capability}`);
  }
});

test("P153 matrix claim language remains non-inflated", () => {
  const src = read("docs/v0/P153_V0_CAPABILITY_MATRIX.md");

  assert.match(src, /Forbidden claim shape:/);

  const banned = [
    /\brecommends\b/i,
    /\boptimises\b/i,
    /\bbest\b/i,
    /\bintelligent\b/i,
    /\bcomplete platform\b/i,
    /\borganisation-ready\b/i,
    /\bteam-ready\b/i,
    /\bunit-ready\b/i,
    /\bproof-ready\b/i,
    /\bevidence-ready\b/i
  ];

  for (const pattern of banned) {
    const matches = src.match(pattern);
    if (!matches) continue;
    const allowedContext =
      /Forbidden claim shape:[\s\S]*recommends[\s\S]*optimises[\s\S]*best[\s\S]*intelligent[\s\S]*complete platform[\s\S]*organisation-ready[\s\S]*team-ready[\s\S]*unit-ready[\s\S]*proof-ready[\s\S]*evidence-ready/i.test(src);
    assert.ok(allowedContext, `banned claim token found outside forbidden-claims context: ${pattern}`);
  }
});

test("P153 contradictions against excluded v0 surfaces fail by matrix design", () => {
  const src = read("docs/v0/P153_V0_CAPABILITY_MATRIX.md");
  assert.match(src, /org_team_unit_surfaces\s*\|\s*NOT_SUPPORTED/);
  assert.match(src, /gym_runtime_surfaces\s*\|\s*NOT_SUPPORTED/);
  assert.match(src, /dashboards_analytics_rankings\s*\|\s*NOT_SUPPORTED/);
  assert.match(src, /exports_evidence_proof_surfaces\s*\|\s*NOT_SUPPORTED/);
  assert.match(src, /phase7_phase8_runtime_claims\s*\|\s*NOT_SUPPORTED/);
});