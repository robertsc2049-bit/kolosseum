import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

const DEFAULT_INPUT_PATH = "test/fixtures/phase1_to_phase6.valid.general_strength.individual.json";
const EXPECTATION = process.env.PHASE1_TO_PHASE6_EXPECT || "success";

function fail(code, msg) {
  console.error(`SPINE_FAIL::${code}::${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`SPINE_OK::${msg}`);
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    fail("missing_input", filePath);
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    fail("invalid_json", filePath);
  }
}

async function resolveRunPipeline() {
  const repo = process.cwd();
  const candidates = [
    path.join(repo, "dist", "src", "run_pipeline.js"),
    path.join(repo, "dist", "engine", "src", "run_pipeline.js"),
    path.join(repo, "dist", "run_pipeline.js")
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) {
      continue;
    }

    const mod = await import(pathToFileURL(candidate).href);
    const fn = mod.runPipeline ?? mod.default?.runPipeline ?? mod.default;

    if (typeof fn === "function") {
      return { runPipeline: fn, modulePath: candidate };
    }
  }

  fail(
    "missing_run_pipeline",
    "No supported run_pipeline build artefact found in dist/src/run_pipeline.js, dist/engine/src/run_pipeline.js, or dist/run_pipeline.js"
  );
}

function stableStringify(value) {
  return JSON.stringify(value);
}

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function hasFailureMarker(value) {
  if (value == null) {
    return false;
  }

  if (typeof value === "string") {
    return /(invalid_|missing_|unknown_|forbidden_|not_permitted|not permitted|bad_request|error|failed|failure|empty_solution_space)/i.test(value);
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasFailureMarker(item));
  }

  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (/(failure|error|token|reason|status|code)/i.test(key) && hasFailureMarker(child)) {
        return true;
      }
      if (hasFailureMarker(child)) {
        return true;
      }
    }
  }

  return false;
}

async function main() {
  const inputPath = path.resolve(process.cwd(), process.env.PHASE1_TO_PHASE6_INPUT_PATH || DEFAULT_INPUT_PATH);
  const input = readJson(inputPath);
  const { runPipeline, modulePath } = await resolveRunPipeline();

  if (!["success", "failure"].includes(EXPECTATION)) {
    fail("invalid_expectation", `PHASE1_TO_PHASE6_EXPECT=${EXPECTATION}`);
  }

  if (EXPECTATION === "success") {
    let first;
    let second;

    try {
      first = await runPipeline(input);
      second = await runPipeline(input);
    } catch (error) {
      fail("unexpected_throw", error instanceof Error ? error.message : String(error));
    }

    if (first == null || typeof first !== "object") {
      fail("invalid_success_shape", "runPipeline success result must be an object");
    }

    const firstJson = stableStringify(first);
    const secondJson = stableStringify(second);

    if (firstJson !== secondJson) {
      fail("nondeterministic_output", "same Phase1 input produced different serialized outputs");
    }

    ok(`phase1_to_phase6_success::module=${modulePath}::sha256=${sha256(firstJson)}`);
    return;
  }

  try {
    const result = await runPipeline(input);

    if (hasFailureMarker(result)) {
      ok(`phase1_to_phase6_failure::module=${modulePath}::mode=returned_failure_marker`);
      return;
    }

    fail(
      "expected_failure_not_observed",
      "invalid fixture did not throw and did not return any recognizable failure marker"
    );
  } catch (error) {
    ok(`phase1_to_phase6_failure::module=${modulePath}::mode=threw`);
  }
}

await main();
