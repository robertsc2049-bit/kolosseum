// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * DEV NOTE: S-V1-04 app-engine boundary contract guard.
 * Purpose: binds app, UI, API, billing, auth, notes, copy, legal, marketing,
 * and commercial state outside deterministic engine truth.
 * Boundary: checks documentation markers, a negative fixture, and engine import
 * paths only. It does not execute or alter engine behaviour.
 * Determinism: reads fixed repository files and performs stable string/path
 * checks with no network, clock, database, or runtime state.
 * Failure: emits CI_V1_APP_ENGINE_BOUNDARY_CONTRACT when app/product state can
 * appear engine-visible or when the boundary documentation drifts.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const GUARD = "S-V1-04";
const TOKEN = "CI_V1_APP_ENGINE_BOUNDARY_CONTRACT";
const BOUNDARY_DOC = "docs/roadmap/V1_ENGINE_UI_AUTH_BOUNDARY.md";
const ACCEPTANCE_DOC = "docs/v1/V1_ACCEPTANCE_GATE.md";
const REPO_BOUNDARY_MAP = "REPO_BOUNDARY_MAP.md";
const FIXTURE_PATH = "ci/fixtures/v1_app_engine_boundary_negative/s_v1_04_forbidden_engine_state_paths.json";

const REQUIRED_BOUNDARY_MARKERS = [
  "## S-V1-04 App-Engine Boundary Contract",
  "This section binds app, UI, API, billing, auth, notes, copy, legal, marketing, and commercial state outside the deterministic engine.",
  "Engine must not read auth state.",
  "Engine must not read billing state.",
  "Engine must not read payment state.",
  "Engine must not read coach notes.",
  "Engine must not read UI density state.",
  "Engine must not read ND presentation state.",
  "Engine must not read presentation copy.",
  "Engine must not read legal state.",
  "Engine must not read marketing state.",
  "Engine must not read commercial state.",
  "Engine output must depend only on declared engine inputs and registries.",
  "Those surfaces must not become canonical engine input, registry authority, substitution truth, runtime event truth, replay truth, proof truth, evidence truth, legality authority, or deterministic compile authority.",
  "ci/fixtures/v1_app_engine_boundary_negative/s_v1_04_forbidden_engine_state_paths.json"
];

const REQUIRED_ACCEPTANCE_MARKERS = [
  "engine remains a deterministic library boundary",
  "app layer owns auth, persistence, UI, payments, and notes",
  "engine does not read payment state",
  "engine does not read coach notes",
  "engine does not read presentation copy",
  "engine does not branch on UI density or ND presentation fields"
];

const REQUIRED_REPO_BOUNDARY_MARKERS = [
  "Engine must not read",
  "- payment state",
  "- commercial tier state as execution authority",
  "- presentation-only preferences as behaviour controls",
  "- UI state",
  "- marketing content",
  "- free-text notes",
  "- manual operator opinions",
  "- coach notes",
  "If output changes because of UI, payment, notes, or presentation-only flags, the system is invalid."
];

const FORBIDDEN_ENGINE_KEYS = new Set([
  "auth_state",
  "auth_session",
  "auth_provider_id",
  "authproviderid",
  "authsession",
  "authstate",
  "billing_state",
  "billingstate",
  "payment_state",
  "paymentstate",
  "subscription_state",
  "subscriptionstate",
  "coach_notes",
  "coach_notes_text",
  "coach_note_text",
  "coachnotes",
  "coachnotetext",
  "ui_density",
  "uidensity",
  "nd_presentation",
  "ndpresentation",
  "presentation_copy",
  "presentationcopy",
  "legal_state",
  "legalstate",
  "marketing_state",
  "marketingstate",
  "commercial_state",
  "commercialstate"
]);

const CODE_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx"]);
const ENGINE_ROOT = path.join(ROOT, "engine");

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    guard: GUARD,
    token: TOKEN,
    message,
    ...details
  }, null, 2));

  process.exitCode = 1;
}

function repoPath(relPath) {
  return path.join(ROOT, relPath);
}

function readRequiredText(relPath) {
  const absPath = repoPath(relPath);

  if (!fs.existsSync(absPath)) {
    fail("Required file is missing.", { path: relPath });
    return "";
  }

  return fs.readFileSync(absPath, "utf8");
}

function assertMarkers(relPath, markers, markerType) {
  const text = readRequiredText(relPath);

  for (const marker of markers) {
    if (!text.includes(marker)) {
      fail("Required app-engine boundary marker is missing.", {
        path: relPath,
        marker_type: markerType,
        marker
      });
    }
  }
}

function normaliseKey(key) {
  return key.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
}

function collectForbiddenEngineInputPaths(value, pathParts = [], out = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectForbiddenEngineInputPaths(item, [...pathParts, String(index)], out);
    });
    return out;
  }

  if (!value || typeof value !== "object") {
    return out;
  }

  for (const [key, child] of Object.entries(value)) {
    const normalisedKey = normaliseKey(key);

    if (FORBIDDEN_ENGINE_KEYS.has(normalisedKey)) {
      out.push({
        path: pathParts.concat(key).join("."),
        key
      });
    }

    collectForbiddenEngineInputPaths(child, [...pathParts, key], out);
  }

  return out;
}

function loadFixture() {
  const text = readRequiredText(FIXTURE_PATH);

  try {
    return JSON.parse(text);
  } catch (error) {
    fail("Negative app-engine boundary fixture is not valid JSON.", {
      path: FIXTURE_PATH,
      error: String(error.message || error)
    });
    return null;
  }
}

function validateFixture() {
  const fixture = loadFixture();
  if (!fixture) {
    return;
  }

  if (fixture.fixture_id !== "s_v1_04_forbidden_engine_state_paths") {
    fail("Unexpected fixture id.", {
      path: FIXTURE_PATH,
      fixture_id: fixture.fixture_id
    });
  }

  const positiveCases = Array.isArray(fixture.positive_cases) ? fixture.positive_cases : [];
  const negativeCases = Array.isArray(fixture.negative_cases) ? fixture.negative_cases : [];

  if (positiveCases.length < 1) {
    fail("Fixture must include at least one positive engine-input case.", {
      path: FIXTURE_PATH
    });
  }

  if (negativeCases.length < 10) {
    fail("Fixture must include forbidden state-path negative cases.", {
      path: FIXTURE_PATH,
      count: negativeCases.length
    });
  }

  for (const testCase of positiveCases) {
    const forbiddenPaths = collectForbiddenEngineInputPaths(testCase.engine_input);

    if (forbiddenPaths.length > 0) {
      fail("Positive fixture contains forbidden engine-visible app/product state.", {
        case_id: testCase.case_id,
        forbidden_paths: forbiddenPaths
      });
    }
  }

  for (const testCase of negativeCases) {
    if (testCase.expected_token !== TOKEN) {
      fail("Negative fixture case uses unexpected token.", {
        case_id: testCase.case_id,
        expected_token: testCase.expected_token
      });
    }

    const forbiddenPaths = collectForbiddenEngineInputPaths(testCase.engine_input);

    if (forbiddenPaths.length === 0) {
      fail("Negative fixture case did not include a forbidden engine-visible state path.", {
        case_id: testCase.case_id
      });
    }
  }

  const forbiddenRoots = Array.isArray(fixture.forbidden_import_roots) ? fixture.forbidden_import_roots : [];

  for (const requiredRoot of ["app", "ui", "server", "src/api", "copy", "db", "marketing", "public"]) {
    if (!forbiddenRoots.includes(requiredRoot)) {
      fail("Fixture missing required forbidden import root.", {
        path: FIXTURE_PATH,
        required_root: requiredRoot
      });
    }
  }
}

function walkFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const out = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      out.push(...walkFiles(absPath));
      continue;
    }

    if (entry.isFile() && CODE_EXTENSIONS.has(path.extname(entry.name))) {
      out.push(absPath);
    }
  }

  return out;
}

function normaliseRel(absPath) {
  return path.relative(ROOT, absPath).split(path.sep).join("/");
}

function collectImportSpecifiers(text) {
  const specs = [];
  const patterns = [
    /\bimport\s+(?:[^'"]+\s+from\s+)?["']([^"']+)["']/g,
    /\bexport\s+[^'"]+\s+from\s+["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      specs.push(match[1]);
    }
  }

  return specs;
}

function topLevelFromResolvedImport(filePath, specifier) {
  if (!specifier.startsWith(".")) {
    return specifier.split("/").slice(0, 2).join("/");
  }

  const resolved = path.resolve(path.dirname(filePath), specifier);
  const rel = path.relative(ROOT, resolved).split(path.sep).join("/");

  if (rel.startsWith("..")) {
    return rel;
  }

  const parts = rel.split("/");
  if (parts[0] === "src" && parts[1] === "api") {
    return "src/api";
  }

  if (parts[0] === "docs" && parts[1] === "commercial") {
    return "docs/commercial";
  }

  return parts[0];
}

function scanEngineImports() {
  const files = walkFiles(ENGINE_ROOT);
  const forbiddenRoots = new Set([
    "app",
    "ui",
    "web",
    "admin",
    "server",
    "src/api",
    "copy",
    "docs/commercial",
    "claims",
    "db",
    "marketing",
    "emails",
    "public"
  ]);

  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const specs = collectImportSpecifiers(text);

    for (const specifier of specs) {
      const resolvedRoot = topLevelFromResolvedImport(file, specifier);

      if (forbiddenRoots.has(resolvedRoot)) {
        fail("Engine imports a forbidden app/product boundary surface.", {
          path: normaliseRel(file),
          import_specifier: specifier,
          resolved_root: resolvedRoot
        });
      }
    }
  }

  return files.length;
}

assertMarkers(BOUNDARY_DOC, REQUIRED_BOUNDARY_MARKERS, "boundary_doc");
assertMarkers(ACCEPTANCE_DOC, REQUIRED_ACCEPTANCE_MARKERS, "acceptance_doc");
assertMarkers(REPO_BOUNDARY_MAP, REQUIRED_REPO_BOUNDARY_MARKERS, "repo_boundary_map");

validateFixture();
const engineFileCount = scanEngineImports();

if (process.exitCode && process.exitCode !== 0) {
  throw new Error("S-V1-04 app-engine boundary contract guard failed.");
}

console.log(JSON.stringify({
  ok: true,
  guard: GUARD,
  token: TOKEN,
  boundary_doc: BOUNDARY_DOC,
  fixture_path: FIXTURE_PATH,
  engine_files_scanned: engineFileCount,
  message: "App-engine boundary contract passed."
}, null, 2));
