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

function normalize(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalize(item));
  }

  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = normalize(value[key]);
    }
    return out;
  }

  return value;
}

function stableStringify(value) {
  return JSON.stringify(normalize(value), null, 2) + "\n";
}

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function assertExactSuccessShape(result) {
  if (result === null || typeof result !== "object" || Array.isArray(result)) {
    fail("invalid_success_shape", "success result must be an object");
  }

  if (result.ok !== true) {
    fail("semantic_not_ok", `expected ok=true, got ok=${String(result.ok)}`);
  }

  const keys = Object.keys(result).sort();
  if (JSON.stringify(keys) !== JSON.stringify(["ok", "result"])) {
    fail("unexpected_success_keys", `success result must have exact top-level keys ok,result; got ${keys.join(",")}`);
  }

  if (result.result === null || typeof result.result !== "object" || Array.isArray(result.result)) {
    fail("missing_result_object", "success result must include result object");
  }

  if (typeof result.failure_token === "string" && result.failure_token.length > 0) {
    fail("unexpected_failure_token", `success result carried failure_token=${result.failure_token}`);
  }
}

function assertExactFailureShape(result) {
  if (result === null || typeof result !== "object" || Array.isArray(result)) {
    fail("invalid_failure_shape", "failure result must be an object");
  }

  if (result.ok !== false) {
    fail("semantic_not_failed", `expected ok=false, got ok=${String(result.ok)}`);
  }

  const keys = Object.keys(result).sort();
  if (JSON.stringify(keys) !== JSON.stringify(["failure_token", "ok"])) {
    fail("unexpected_failure_keys", `failure result must have exact top-level keys failure_token,ok; got ${keys.join(",")}`);
  }

  if (typeof result.failure_token !== "string" || result.failure_token.length === 0) {
    fail("missing_failure_token", "failure result must include non-empty failure_token");
  }

  if (Object.prototype.hasOwnProperty.call(result, "result")) {
    fail("unexpected_result", "failure result must not include result");
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
      return { runPipeline: fn, modulePath: path.relative(repo, candidate).replace(/\\/g, "/") };
    }
  }

  fail(
    "missing_run_pipeline",
    "No supported run_pipeline build artefact found in dist/src/run_pipeline.js, dist/engine/src/run_pipeline.js, or dist/run_pipeline.js"
  );
}

async function main() {
  const inputPath = path.resolve(process.cwd(), process.env.PHASE1_TO_PHASE6_INPUT_PATH || DEFAULT_INPUT_PATH);
  const input = readJson(inputPath);
  const { runPipeline, modulePath } = await resolveRunPipeline();

  if (!["success", "failure"].includes(EXPECTATION)) {
    fail("invalid_expectation", `PHASE1_TO_PHASE6_EXPECT=${EXPECTATION}`);
  }

  let first;
  let second;

  try {
    first = await runPipeline(input);
    second = await runPipeline(input);
  } catch (error) {
    fail("unexpected_throw", error instanceof Error ? error.message : String(error));
  }

  const firstNorm = normalize(first);
  const secondNorm = normalize(second);
  const firstJson = stableStringify(firstNorm);
  const secondJson = stableStringify(secondNorm);

  if (firstJson !== secondJson) {
    fail("nondeterministic_output", "same Phase1 input produced different normalized outputs");
  }

  if (EXPECTATION === "success") {
    assertExactSuccessShape(firstNorm);
    ok(`phase1_to_phase6_success::module=${modulePath}::sha256=${sha256(firstJson)}`);
    return;
  }

  assertExactFailureShape(firstNorm);
  ok(`phase1_to_phase6_failure::module=${modulePath}::failure_token=${firstNorm.failure_token}::sha256=${sha256(firstJson)}`);
}

await main();
