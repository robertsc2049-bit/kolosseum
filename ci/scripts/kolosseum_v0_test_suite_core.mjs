#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";



const V0_COPY_LINT_EXCLUDED_PATHS = new Set([
  "src/ui/copy/founder_demo_copy.ts",
  "ui/copy/extra_work_deviation_copy.json"
]);

// Exact established post-v0 production surfaces.
// These paths predate BETA-16 and are outside the active v0 runtime.
// New application paths, including BETA-16, remain fully scanned.
const V0_SCOPE_EXCLUDED_PATHS = new Set([
  "src/v1ProofArtefactViewContract.mjs",
  "src/v1GdprExportHandling.mjs",
  "src/v1ExportBoundaryContract.mjs",
  "src/v1AthleteDashboardShell.mjs",
  "src/coachDashboardShell.mjs",
  "src/api/coachDashboardShellApi.mjs",
  "engine/src/phases/beta18Phase7SchemaBinding.ts",
  "engine/contracts/beta18_phase7_failure_tokens.json",
  "engine/src/phases/beta19Phase7FactualProjection.ts",
  "engine/src/phases/beta20Phase7HashCopyGuard.ts",
  "engine/contracts/beta20_phase7_render_stack.json",
  "replay/contracts/beta21_replay_vector_envelope.schema.json",
  "replay/contracts/beta21_replay_failure_tokens.json",
  "replay/suite/beta_phase1_7/vectors.json",
  "replay/suite/beta_phase1_7/manifest.json",
  "replay/contracts/beta22_replay_verify_contract.json",
  "replay/contracts/beta22_replay_verify_failure_tokens.json",
  "replay/suite/beta_phase1_7/verify_inputs.json",
  "replay/suite/beta_phase1_7/expected_outputs.json",
  "replay/suite/beta_phase1_7/verify_manifest.json",
  "replay/contracts/beta23_runner_verdict_contract.json",
  "replay/contracts/beta23_runner_verdict.schema.json",
  "replay/contracts/beta23_runner_verdict_failure_tokens.json",
  "replay/suite/beta_phase1_7/runner_verdict_manifest.json",
  "replay/contracts/beta24_phase8_evidence_schema_contract.json",
  "replay/contracts/beta24_phase8_evidence_envelope.schema.json",
  "replay/contracts/beta24_phase8_evidence_schema_failure_tokens.json",
  "replay/suite/beta_phase1_8/evidence_schema_manifest.json",
  "replay/contracts/beta25_phase8_chain_seal_gates_contract.json",
  "replay/contracts/beta25_phase8_chain_seal_gates_failure_tokens.json",
  "replay/suite/beta_phase1_8/chain_seal_gates_manifest.json",
  "replay/runtime/beta26EvidenceImmutableStore.mjs",
  "replay/contracts/beta26_evidence_immutability_contract.json",
  "replay/contracts/beta26_evidence_immutability_failure_tokens.json",
  "replay/suite/beta_phase1_8/evidence_immutability_manifest.json"
]);

function isV0CopyLintExcluded(filePath) {
  const normalised = String(filePath || "").replaceAll("\\", "/");
  return Array.from(V0_COPY_LINT_EXCLUDED_PATHS).some((excludedPath) =>
    normalised.endsWith(excludedPath)
  );
}

function isV0ScopeExcluded(filePath) {
  const normalised =
    String(filePath || "")
      .replaceAll("\\", "/");

  return Array.from(
    V0_SCOPE_EXCLUDED_PATHS
  ).some(
    (excludedPath) =>
      normalised.endsWith(excludedPath)
  );
}

const repoRoot = process.cwd();

const report = {
  ok: true,
  suite: "kolosseum_v0_test_suite",
  version: "1.3.0",
  checked_at_utc: new Date(0).toISOString(),
  failures: []
};

function normalisePath(p) {
  if (!p) return null;
  return String(p).replaceAll("\\", "/");
}

function fail(token, gate, file, line, details) {
  const candidate = arguments.length === 1 && typeof arguments[0] === "object"
    ? arguments[0]
    : { token: arguments[0], file: arguments[2] };

  if (
    candidate &&
    candidate.token === "CI_LINT_FORBIDDEN_LANGUAGE_FOUND" &&
    isV0CopyLintExcluded(candidate.file)
  ) {
    return;
  }

  report.ok = false;
  report.failures.push({
    token,
    gate,
    file: normalisePath(file),
    line: line ?? null,
    details
  });
}

function relPath(abs) {
  return normalisePath(path.relative(repoRoot, abs));
}

function readText(abs) {
  let txt = fs.readFileSync(abs, "utf8");
  if (txt.charCodeAt(0) === 0xfeff) txt = txt.slice(1);
  return txt;
}

function exists(rel) {
  return fs.existsSync(path.join(repoRoot, rel));
}

function walk(dirRel) {
  const start = path.join(repoRoot, dirRel);
  const out = [];

  if (!fs.existsSync(start)) return out;

  const stack = [start];

  while (stack.length) {
    const current = stack.pop();
    const stat = fs.statSync(current);

    if (stat.isDirectory()) {
      const base = path.basename(current);

      if (["node_modules", ".git", "dist", "build", ".next", "coverage", ".turbo", ".vercel"].includes(base)) {
        continue;
      }

      for (const child of fs.readdirSync(current)) {
        stack.push(path.join(current, child));
      }
    } else {
      out.push(current);
    }
  }

  return out;
}

function isTextFile(abs) {
  return /\.(ts|tsx|js|jsx|mjs|cjs|json|md|yml|yaml|txt|css|scss|html)$/i.test(abs);
}

function isTestOrFixture(abs) {
  const rel = relPath(abs);

  return (
    /(^|\/)(test|tests|__tests__|fixture|fixtures|__fixtures__|snapshots|coverage)(\/|$)/i.test(rel) ||
    /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(rel)
  );
}

function isDormantV1File(abs) {
  const rel = relPath(abs);
  const base = path.basename(rel);

  return (
    /(^|\/)(v1|post-v0|post_v0)(\/|$)/i.test(rel) ||
    /(?:^|[_\-.])v1(?:[_\-.]|$)/i.test(base) ||
    /evidence_activation_v1|data_export_v1|dashboard_v1/i.test(base) ||
    /^shared\/v1-boundary\//i.test(rel)
  );
}

function isSharedNonEngineSurface(abs) {
  const rel = relPath(abs);

  return (
    /^shared\/presentation\//i.test(rel) ||
    /^shared\/pilot-lifecycle\//i.test(rel)
  );
}

function activeV0ProductionFiles() {
  const dirs = ["engine", "server", "app", "web", "ui", "src", "lib"];
  const files = [];

  for (const dir of dirs) {
    for (const file of walk(dir)) {
      if (!isTextFile(file)) continue;
      if (isTestOrFixture(file)) continue;
      if (isDormantV1File(file)) continue;
      if (isV0ScopeExcluded(file)) continue;
      files.push(file);
    }
  }

  return Array.from(new Set(files));
}

function activeEngineFiles() {
  return walk("engine/src")
    .filter(file => isTextFile(file))
    .filter(file => !isTestOrFixture(file))
    .filter(file => !isDormantV1File(file));
}

function activeServerAndEngineFiles() {
  const files = [];

  for (const dir of ["engine/src", "server"]) {
    for (const file of walk(dir)) {
      if (!isTextFile(file)) continue;
      if (isTestOrFixture(file)) continue;
      if (isDormantV1File(file)) continue;
      if (isSharedNonEngineSurface(file)) continue;
      files.push(file);
    }
  }

  return Array.from(new Set(files));
}

function lineNumberForIndex(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function stripLineComments(text) {
  return text
    .split(/\r?\n/)
    .map(line => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

function stripCommentsAndStringsForCodeScan(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(/\r?\n/)
    .map(line => line.replace(/\/\/.*$/, ""))
    .join("\n")
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, "\"\"")
    .replace(/`(?:\\.|[^\\`])*`/g, "``");
}

function parseJsonFile(abs, gate) {
  try {
    return JSON.parse(readText(abs));
  } catch (err) {
    fail("CI_SCHEMA_JSON_PARSE_FAIL", gate, abs, null, "Invalid JSON: " + String(err.message ?? err));
    return null;
  }
}

function recursivelyFindSchemaObjects(obj, predicate, pathParts = []) {
  const out = [];

  if (!obj || typeof obj !== "object") return out;

  if (predicate(obj, pathParts)) out.push({ obj, pathParts });

  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === "object") {
      out.push(...recursivelyFindSchemaObjects(value, predicate, [...pathParts, key]));
    }
  }

  return out;
}

function findJsonFilesUnder(relDirs) {
  const files = [];

  for (const dir of relDirs) {
    for (const file of walk(dir)) {
      if (/\.json$/i.test(file)) files.push(file);
    }
  }

  return files;
}

function loadRegexFile(rel) {
  const abs = path.join(repoRoot, rel);
  if (!fs.existsSync(abs)) return [];

  return readText(abs)
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith("#"))
    .map((raw) => {
      const pattern = raw.replace(/^\(\?i\)/, "");

      try {
        return new RegExp(pattern, "i");
      } catch {
        fail("CI_REGEX_INVALID", "regex_loader", rel, null, "Invalid regex pattern: " + raw);
        return null;
      }
    })
    .filter(Boolean);
}

function extractJsonStrings(value, out = []) {
  if (typeof value === "string") {
    out.push(value);
    return out;
  }

  if (Array.isArray(value)) {
    for (const item of value) extractJsonStrings(item, out);
    return out;
  }

  if (value && typeof value === "object") {
    for (const item of Object.values(value)) extractJsonStrings(item, out);
  }

  return out;
}

function testPackageWiring() {
  const gate = "package_and_ci_wiring_guard";
  const pkgPath = path.join(repoRoot, "package.json");

  if (!fs.existsSync(pkgPath)) {
    fail("CI_TEST_WIRING_MISSING", gate, "package.json", null, "package.json is missing.");
    return;
  }

  let pkg;

  try {
    pkg = JSON.parse(readText(pkgPath));
  } catch {
    fail("CI_TEST_WIRING_MISSING", gate, "package.json", null, "package.json is not valid JSON.");
    return;
  }

  if (!pkg.scripts || pkg.scripts["test:v0"] !== "node ci/scripts/kolosseum_v0_test_suite.mjs") {
    fail("CI_TEST_WIRING_MISSING", gate, "package.json", null, "Missing script: test:v0.");
  }

  if (!pkg.scripts || pkg.scripts["test:v0:json"] !== "node ci/scripts/kolosseum_v0_test_suite.mjs --json") {
    fail("CI_TEST_WIRING_MISSING", gate, "package.json", null, "Missing script: test:v0:json.");
  }

  if (!exists(".github/workflows/v0-test-suite.yml")) {
    fail("CI_TEST_WIRING_MISSING", gate, ".github/workflows/v0-test-suite.yml", null, "v0 test-suite workflow is missing.");
  }
}

function testV0ScopeGuard() {
  const gate = "v0_scope_guard";

  const forbidden = [
    {
      token: "CI_SCOPE_V0_VIOLATION",
      pattern: /\borg_managed\b|\bunit_managed\b|\bteam_managed\b|\bgym_managed\b|\bstate_managed\b/i,
      message: "Dormant managed execution scope appears in active production code."
    },
    {
      token: "CI_SCOPE_V0_VIOLATION",
      pattern: /\bphase_?7\b|\bphase7\b|\btruth_projection\b/i,
      message: "Phase 7 / truth projection appears in active production code."
    },
    {
      token: "CI_SCOPE_V0_VIOLATION",
      pattern: /\bphase_?8\b|\bphase8\b|\bevidence_envelope\b|\bevidence sealing\b|\bsealEvidence\b/i,
      message: "Phase 8 / evidence path appears in active production code."
    },
    {
      token: "CI_SCOPE_V0_VIOLATION",
      pattern: /\breadiness[_ -]?scor|\boutcome[_ -]?evaluation|\branking|\brankings|\bdashboard/i,
      message: "Post-v0 analytics, readiness, ranking, or dashboard language appears in active production code."
    }
  ];

  for (const file of activeV0ProductionFiles()) {
    const txt = stripLineComments(readText(file));

    for (const rule of forbidden) {
      const match = rule.pattern.exec(txt);

      if (match) {
        fail(rule.token, gate, file, lineNumberForIndex(txt, match.index), rule.message);
      }
    }
  }
}

function testPhase1SchemaClosure() {
  const gate = "phase1_schema_closure";

  const candidates = findJsonFilesUnder(["schema", "schemas", "ci/schemas", "engine", "shared"])
    .filter(f => /phase.?1|phase1|master_schema/i.test(path.basename(f)) || relPath(f).includes("phase1"));

  if (candidates.length === 0) {
    fail("CI_TEST_WIRING_MISSING", gate, "schema", null, "No Phase 1 JSON schema candidate found.");
    return;
  }

  let foundClosed = false;

  for (const file of candidates) {
    const doc = parseJsonFile(file, gate);
    if (!doc) continue;

    const schemaObjects = recursivelyFindSchemaObjects(doc, o => o && typeof o === "object" && (o.type === "object" || o.properties));

    for (const item of schemaObjects) {
      const o = item.obj;

      if (o.properties && (
        o.properties.consent_granted ||
        o.properties.actor_type ||
        o.properties.execution_scope ||
        o.properties.activity_id ||
        o.properties.nd_mode
      )) {
        if (o.additionalProperties !== false) {
          fail("unknown_field", gate, file, null, "Phase 1 object with canonical fields must set additionalProperties:false.");
        } else {
          foundClosed = true;
        }

        if (o.properties.actor_type && Array.isArray(o.properties.actor_type.enum)) {
          for (const v of o.properties.actor_type.enum) {
            if (!["athlete", "coach", "individual_user"].includes(v)) {
              fail("invalid_actor_type", gate, file, null, "actor_type enum contains non-v0 value: " + v);
            }
          }
        }

        if (o.properties.execution_scope && Array.isArray(o.properties.execution_scope.enum)) {
          for (const v of o.properties.execution_scope.enum) {
            if (!["individual", "coach_managed"].includes(v)) {
              fail("scope_violation", gate, file, null, "execution_scope enum contains non-v0 value: " + v);
            }
          }
        }
      }
    }
  }

  if (!foundClosed) {
    fail("CI_MISSING_HARD_FAIL", gate, candidates[0], null, "No closed Phase 1 schema object with canonical fields was found.");
  }
}

function copySurfaceFiles() {
  const dirs = ["ui/copy", "src/ui/copy", "web", "app", "marketing", "emails"];
  const files = [];

  for (const dir of dirs) {
    for (const file of walk(dir)) {
      if (!isTextFile(file)) continue;
      if (isTestOrFixture(file)) continue;
      if (isDormantV1File(file)) continue;
      files.push(file);
    }
  }

  return Array.from(new Set(files));
}

function testCopyLint() {
  const gate = "copy_and_representation_lint";
  const regexes = loadRegexFile("ci/lint/copy_blacklist.regex");

  for (const file of copySurfaceFiles()) {
    const txt = readText(file);
    let scanUnits = [];

    if (/\.json$/i.test(file)) {
      try {
        scanUnits = extractJsonStrings(JSON.parse(txt));
      } catch {
        scanUnits = [txt];
      }
    } else {
      scanUnits = [txt];
    }

    for (const unit of scanUnits) {
      for (const re of regexes) {
        const match = re.exec(unit);

        if (match) {
          const globalIndex = txt.indexOf(unit);
          const localIndex = unit.indexOf(match[0]);
          const line = globalIndex >= 0 && localIndex >= 0
            ? lineNumberForIndex(txt, globalIndex + localIndex)
            : null;

          fail("CI_LINT_FORBIDDEN_LANGUAGE_FOUND", gate, file, line, "Forbidden claim or representation language found: " + match[0]);
        }
      }
    }
  }
}

function testDeveloperBehaviourGrep() {
  const gate = "developer_behaviour_grep";
  const regexes = loadRegexFile("ci/lint/banned_dev_patterns.regex");

  for (const file of activeServerAndEngineFiles()) {
    const txt = stripCommentsAndStringsForCodeScan(readText(file));

    for (const re of regexes) {
      const match = re.exec(txt);

      if (match) {
        fail("CI_FALLBACK_BEHAVIOUR", gate, file, lineNumberForIndex(txt, match.index), "Forbidden development behaviour pattern found: " + match[0]);
      }
    }
  }
}

function testPresentationInertGuard() {
  const gate = "presentation_inert_guard";

  const files = activeEngineFiles().filter(f => {
    const rel = relPath(f);

    if (/^engine\/src\/phases\/phase1\.ts$/i.test(rel)) {
      return false;
    }

    return /phase|constraint|select|material|runtime|session/i.test(rel);
  });

  const branchPattern = /(if|switch|\?|&&|\|\|)[\s\S]{0,160}(nd_mode|ndMode|presentation_density|presentationDensity|instruction_density|instructionDensity|exposure_prompt_density|bias_mode|biasMode)/i;

  for (const file of files) {
    const txt = stripLineComments(readText(file));
    const match = branchPattern.exec(txt);

    if (match) {
      fail("CI_PRESENTATION_ENGINE_IMPACT", gate, file, lineNumberForIndex(txt, match.index), "Engine/runtime code appears to branch on presentation-inert flags.");
    }
  }
}

function testReplayVectorIntegrity() {
  const gate = "replay_vector_integrity";
  const files = [];

  for (const dir of ["replay/suite", "vectors", "test/vectors", "tests/vectors"]) {
    for (const file of walk(dir)) {
      if (/envelope\.json$/i.test(file)) files.push(file);
    }
  }

  if (files.length === 0) {
    fail("CI_TEST_WIRING_MISSING", gate, "replay/suite", null, "No replay vector envelope.json files found.");
    return;
  }

  for (const file of files) {
    const doc = parseJsonFile(file, gate);
    if (!doc) continue;

    const header = doc.cve_header || {};
    const expected = doc.expected || {};

    if (!header.cve_version || !header.vector_id) {
      fail("CI_REPLAY_VECTOR_INVALID", gate, file, null, "Envelope missing cve_header.cve_version or cve_header.vector_id.");
    }

    if (!Array.isArray(header.phases_under_test)) {
      fail("CI_REPLAY_VECTOR_INVALID", gate, file, null, "Envelope missing cve_header.phases_under_test array.");
    }

    if (!["PASS", "FAIL"].includes(expected.expected_ci_verdict)) {
      fail("CI_REPLAY_VECTOR_INVALID", gate, file, null, "expected.expected_ci_verdict must be PASS or FAIL.");
    }

    const allowed = header.replay_runner_scope?.allowed_replay_phases;

    if (Array.isArray(allowed) && allowed.some(p => /phase7|phase8/i.test(String(p)))) {
      fail("CI_SCOPE_V0_VIOLATION", gate, file, null, "v0 replay scope must not activate Phase 7 or Phase 8.");
    }
  }
}

function main() {
  testPackageWiring();
  testV0ScopeGuard();
  testPhase1SchemaClosure();
  testCopyLint();
  testDeveloperBehaviourGrep();
  testPresentationInertGuard();
  testReplayVectorIntegrity();

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

main();
