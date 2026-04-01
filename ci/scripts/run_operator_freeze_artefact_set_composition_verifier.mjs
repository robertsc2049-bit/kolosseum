import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const REGISTRY_RELATIVE_PATH = "docs/releases/V1_FREEZE_ARTEFACT_SET.json";
const REGISTRY_PATH = path.join(REPO_ROOT, ...REGISTRY_RELATIVE_PATH.split("/"));

const EXPECTED_FREEZE_ARTEFACTS = [
  "docs/releases/V1_FREEZE_ARTEFACT_SET.json",
  "docs/releases/V1_HANDOFF_INDEX.md",
  "docs/releases/V1_OPERATOR_EXECUTION_ORDER.md",
  "docs/releases/V1_OPERATOR_FREEZE_COMMAND_ORDER.json",
  "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md",
  "docs/releases/V1_RELEASE_CHECKLIST.md",
  "ci/scripts/run_operator_freeze_command_order_verifier.mjs",
  "ci/scripts/run_operator_freeze_handoff_index_completeness_verifier.mjs",
  "ci/scripts/run_operator_freeze_release_checklist_binding_verifier.mjs",
  "ci/scripts/run_operator_freeze_runbook_execution_order_binding_verifier.mjs",
  "ci/scripts/run_operator_freeze_runbook_surface_completeness_verifier.mjs"
];

function fail(token, details, extra = {}) {
  process.stdout.write(
    JSON.stringify(
      {
        ok: false,
        token,
        details,
        ...extra
      },
      null,
      2
    ) + "\n"
  );
  process.exit(1);
}

function ok(payload = {}) {
  process.stdout.write(JSON.stringify({ ok: true, ...payload }, null, 2) + "\n");
  process.exit(0);
}

function normalizeRelativePath(value) {
  return String(value ?? "").trim().replace(/[\\/]+/g, "/");
}

function fileExists(relativePath) {
  const fullPath = path.join(REPO_ROOT, ...relativePath.split("/"));
  return fs.existsSync(fullPath) && fs.statSync(fullPath).isFile();
}

function main() {
  if (!fs.existsSync(REGISTRY_PATH)) {
    fail(
      "CI_OPERATOR_FREEZE_ARTEFACT_SET_MISSING",
      "Freeze artefact registry is missing.",
      { registry_path: REGISTRY_RELATIVE_PATH }
    );
  }

  const registryRaw = fs.readFileSync(REGISTRY_PATH, "utf8");
  const registry = JSON.parse(registryRaw);

  if (!Array.isArray(registry.artefacts) || registry.artefacts.length === 0) {
    fail(
      "CI_OPERATOR_FREEZE_ARTEFACT_SET_EMPTY",
      "Freeze artefact registry does not declare any artefacts.",
      { registry_path: REGISTRY_RELATIVE_PATH }
    );
  }

  const declaredArtefacts = registry.artefacts.map(normalizeRelativePath);
  const duplicateArtefacts = declaredArtefacts.filter((value, index) => declaredArtefacts.indexOf(value) !== index);
  if (duplicateArtefacts.length > 0) {
    fail(
      "CI_OPERATOR_FREEZE_ARTEFACT_SET_DUPLICATE",
      "Freeze artefact registry contains duplicate artefact declarations.",
      {
        registry_path: REGISTRY_RELATIVE_PATH,
        duplicate_artefacts: [...new Set(duplicateArtefacts)].sort()
      }
    );
  }

  const expectedArtefacts = EXPECTED_FREEZE_ARTEFACTS.map(normalizeRelativePath).sort();
  const sortedDeclaredArtefacts = [...declaredArtefacts].sort();

  const undeclaredArtefacts = expectedArtefacts.filter((value) => !sortedDeclaredArtefacts.includes(value));
  if (undeclaredArtefacts.length > 0) {
    fail(
      "CI_OPERATOR_FREEZE_ARTEFACT_SET_UNDECLARED",
      "Freeze artefact registry is missing declared freeze-phase artefacts.",
      {
        registry_path: REGISTRY_RELATIVE_PATH,
        undeclared_artefacts: undeclaredArtefacts
      }
    );
  }

  const extraArtefacts = sortedDeclaredArtefacts.filter((value) => !expectedArtefacts.includes(value));
  if (extraArtefacts.length > 0) {
    fail(
      "CI_OPERATOR_FREEZE_ARTEFACT_SET_EXTRA",
      "Freeze artefact registry declares extra artefacts outside the canonical freeze set.",
      {
        registry_path: REGISTRY_RELATIVE_PATH,
        extra_artefacts: extraArtefacts
      }
    );
  }

  const missingFiles = sortedDeclaredArtefacts.filter((value) => !fileExists(value));
  if (missingFiles.length > 0) {
    fail(
      "CI_OPERATOR_FREEZE_ARTEFACT_SET_FILE_MISSING",
      "Freeze artefact registry references missing files.",
      {
        registry_path: REGISTRY_RELATIVE_PATH,
        missing_files: missingFiles
      }
    );
  }

  ok({
    registry_path: REGISTRY_RELATIVE_PATH,
    artefact_count: sortedDeclaredArtefacts.length,
    artefacts: sortedDeclaredArtefacts
  });
}

main();