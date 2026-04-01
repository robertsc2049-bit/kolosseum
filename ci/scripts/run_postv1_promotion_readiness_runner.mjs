import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const OUTPUT_PATH = path.join(REPO_ROOT, "docs", "releases", "V1_PROMOTION_READINESS.json");

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sortValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (isPlainObject(value)) {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortValue(value[key]);
        return acc;
      }, {});
  }

  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(sortValue(value), null, 2) + "\n";
}

function listFilesSafe(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  return fs.readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(dirPath, entry.name));
}

function toRepoRelativePosix(absolutePath) {
  const relative = path.relative(REPO_ROOT, absolutePath);
  return relative.split(path.sep).join("/");
}

function rankFreezeVerifier(filePath) {
  const name = path.basename(filePath).toLowerCase();
  let score = 0;

  if (name.includes("freeze")) score += 10;
  if (name.includes("artefact") || name.includes("artifact")) score += 8;
  if (name.includes("registry")) score += 6;
  if (name.includes("surface")) score += 2;
  if (name.includes("completeness")) score += 1;
  if (name.includes("verifier")) score += 10;

  return score;
}

function rankFreezeArtefact(filePath) {
  const name = path.basename(filePath).toLowerCase();
  let score = 0;

  if (name.includes("freeze")) score += 10;
  if (name.includes("artefact") || name.includes("artifact")) score += 8;
  if (name.includes("registry")) score += 6;
  if (name.includes("surface")) score += 2;

  return score;
}

function selectUniqueBest(candidates, rankFn, label) {
  if (candidates.length === 0) {
    throw new Error(`No ${label} candidates found.`);
  }

  const scored = candidates
    .map((filePath) => ({ filePath, score: rankFn(filePath) }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.filePath.localeCompare(b.filePath);
    });

  const top = scored[0];
  if (!top || top.score <= 0) {
    throw new Error(
      `No usable ${label} candidate found. Candidates were:\n${candidates.join("\n")}`
    );
  }

  const ties = scored.filter((item) => item.score === top.score);
  if (ties.length !== 1) {
    throw new Error(
      `Ambiguous ${label} candidate:\n${ties.map((item) => `${item.score} :: ${item.filePath}`).join("\n")}`
    );
  }

  return top.filePath;
}

export function makePrerequisites() {
  const scriptCandidates = listFilesSafe(path.join(REPO_ROOT, "ci", "scripts"))
    .filter((filePath) => filePath.toLowerCase().includes("freeze") && filePath.toLowerCase().includes("verifier"));

  const artefactCandidates = listFilesSafe(path.join(REPO_ROOT, "docs", "releases"))
    .filter((filePath) => filePath.toLowerCase().includes("freeze") && filePath.toLowerCase().endsWith(".json"));

  const runnerScriptAbs = selectUniqueBest(scriptCandidates, rankFreezeVerifier, "freeze verifier script");
  const requiredArtefactAbs = selectUniqueBest(artefactCandidates, rankFreezeArtefact, "freeze readiness artefact");

  return [
    {
      prerequisite_id: "freeze_readiness",
      description: "Freeze readiness is mandatory for promotion readiness.",
      runner_script: toRepoRelativePosix(runnerScriptAbs),
      required_artefact: toRepoRelativePosix(requiredArtefactAbs)
    }
  ];
}

function runPrerequisite(repoRoot, prerequisite) {
  const runnerScriptAbs = path.join(repoRoot, prerequisite.runner_script);
  const requiredArtefactAbs = path.join(repoRoot, prerequisite.required_artefact);

  if (!fs.existsSync(runnerScriptAbs)) {
    return {
      prerequisite_id: prerequisite.prerequisite_id,
      ok: false,
      runner_script: prerequisite.runner_script,
      required_artefact: prerequisite.required_artefact,
      failure_reason: "runner_script_missing",
      details: prerequisite.runner_script
    };
  }

  if (!fs.existsSync(requiredArtefactAbs)) {
    return {
      prerequisite_id: prerequisite.prerequisite_id,
      ok: false,
      runner_script: prerequisite.runner_script,
      required_artefact: prerequisite.required_artefact,
      failure_reason: "required_artefact_missing",
      details: prerequisite.required_artefact
    };
  }

  const result = spawnSync(process.execPath, [runnerScriptAbs], {
    cwd: repoRoot,
    encoding: "utf8"
  });

  const stdout = (result.stdout ?? "").trim();
  const stderr = (result.stderr ?? "").trim();

  if (result.error) {
    return {
      prerequisite_id: prerequisite.prerequisite_id,
      ok: false,
      runner_script: prerequisite.runner_script,
      required_artefact: prerequisite.required_artefact,
      failure_reason: "runner_spawn_failed",
      details: String(result.error)
    };
  }

  if (result.status !== 0) {
    return {
      prerequisite_id: prerequisite.prerequisite_id,
      ok: false,
      runner_script: prerequisite.runner_script,
      required_artefact: prerequisite.required_artefact,
      failure_reason: "runner_exit_nonzero",
      details: stderr || stdout || "Runner exited non-zero."
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return {
      prerequisite_id: prerequisite.prerequisite_id,
      ok: false,
      runner_script: prerequisite.runner_script,
      required_artefact: prerequisite.required_artefact,
      failure_reason: "runner_output_not_json",
      details: stdout || "Runner produced empty stdout."
    };
  }

  if (!isPlainObject(parsed)) {
    return {
      prerequisite_id: prerequisite.prerequisite_id,
      ok: false,
      runner_script: prerequisite.runner_script,
      required_artefact: prerequisite.required_artefact,
      failure_reason: "runner_output_not_object",
      details: "Runner JSON output must be an object."
    };
  }

  if (parsed.ok !== true) {
    return {
      prerequisite_id: prerequisite.prerequisite_id,
      ok: false,
      runner_script: prerequisite.runner_script,
      required_artefact: prerequisite.required_artefact,
      failure_reason: "prerequisite_not_ready",
      details: canonicalJson(parsed).trim()
    };
  }

  return {
    prerequisite_id: prerequisite.prerequisite_id,
    ok: true,
    runner_script: prerequisite.runner_script,
    required_artefact: prerequisite.required_artefact,
    prerequisite_output: parsed
  };
}

export function buildPromotionReadiness({ repoRoot = REPO_ROOT, prerequisites = null } = {}) {
  let resolvedPrerequisites;

  try {
    resolvedPrerequisites = prerequisites ?? makePrerequisites();
  } catch (error) {
    return {
      schema_version: "kolosseum.v1.promotion_readiness.v1",
      release_id: "v1",
      readiness_id: "promotion_readiness",
      ok: false,
      promotion_ready: false,
      failure: {
        prerequisite_id: "freeze_readiness",
        reason: "freeze_prerequisite_discovery_failed",
        details: error instanceof Error ? error.message : String(error)
      },
      prerequisites: []
    };
  }

  const evaluated = resolvedPrerequisites.map((prerequisite) => runPrerequisite(repoRoot, prerequisite));
  const failed = evaluated.find((item) => item.ok !== true);

  if (failed) {
    return {
      schema_version: "kolosseum.v1.promotion_readiness.v1",
      release_id: "v1",
      readiness_id: "promotion_readiness",
      ok: false,
      promotion_ready: false,
      required_prerequisite_ids: resolvedPrerequisites.map((item) => item.prerequisite_id),
      failure: {
        prerequisite_id: failed.prerequisite_id,
        reason: failed.failure_reason,
        details: failed.details
      },
      prerequisites: evaluated
    };
  }

  return {
    schema_version: "kolosseum.v1.promotion_readiness.v1",
    release_id: "v1",
    readiness_id: "promotion_readiness",
    ok: true,
    promotion_ready: true,
    required_prerequisite_ids: resolvedPrerequisites.map((item) => item.prerequisite_id),
    prerequisites: evaluated
  };
}

export function writePromotionReadiness(outputPath, readiness) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, canonicalJson(readiness), "utf8");
}

export function main() {
  const readiness = buildPromotionReadiness();
  writePromotionReadiness(OUTPUT_PATH, readiness);
  process.stdout.write(canonicalJson(readiness));
  process.exitCode = readiness.ok ? 0 : 1;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath && pathToFileURL(invokedPath).href === import.meta.url) {
  main();
}