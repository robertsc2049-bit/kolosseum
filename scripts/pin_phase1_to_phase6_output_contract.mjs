import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

const DEFAULT_INPUT_PATH = "test/fixtures/phase1_to_phase6.valid.general_strength.individual.json";
const DEFAULT_PIN_PATH = "ci/golden/phase1_to_phase6_output_contract.json";
const WRITE_MODE = process.argv.includes("--write");

function fail(code, msg) {
  console.error(`PHASE6_PIN_FAIL::${code}::${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`PHASE6_PIN_OK::${msg}`);
}

function written(msg) {
  console.log(`PHASE6_PIN_WRITTEN::${msg}`);
}

function ensureDirFor(filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath, missingCode, invalidCode) {
  if (!fs.existsSync(filePath)) {
    fail(missingCode, filePath);
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    fail(invalidCode, filePath);
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

function assertSemanticSuccess(result) {
  if (result === null || typeof result !== "object" || Array.isArray(result)) {
    fail("invalid_success_shape", "success result must be an object");
  }

  if (result.ok !== true) {
    fail("semantic_not_ok", `expected ok=true, got ok=${String(result.ok)}`);
  }

  if (typeof result.failure_token === "string" && result.failure_token.length > 0) {
    fail("unexpected_failure_token", `success result carried failure_token=${result.failure_token}`);
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
      return {
        runPipeline: fn,
        modulePath: path.relative(repo, candidate).replace(/\\/g, "/")
      };
    }
  }

  fail(
    "missing_run_pipeline",
    "No supported run_pipeline build artefact found in dist/src/run_pipeline.js, dist/engine/src/run_pipeline.js, or dist/run_pipeline.js"
  );
}

async function buildPinnedPayload() {
  const repo = process.cwd();
  const inputPath = path.resolve(repo, process.env.PHASE1_TO_PHASE6_INPUT_PATH || DEFAULT_INPUT_PATH);
  const fixture = readJson(inputPath, "missing_input", "invalid_input");
  const fixturePath = path.relative(repo, inputPath).replace(/\\/g, "/");

  const { runPipeline, modulePath } = await resolveRunPipeline();

  let first;
  let second;

  try {
    first = await runPipeline(fixture);
    second = await runPipeline(fixture);
  } catch (error) {
    fail("unexpected_throw", error instanceof Error ? error.message : String(error));
  }

  const firstNorm = normalize(first);
  const secondNorm = normalize(second);
  const firstJson = stableStringify(firstNorm);
  const secondJson = stableStringify(secondNorm);

  if (firstJson !== secondJson) {
    fail("nondeterministic_output", "same positive fixture produced different normalized outputs");
  }

  assertSemanticSuccess(firstNorm);

  return {
    schema_version: "kolosseum.phase6.output-contract-pin.v1",
    fixture_path: fixturePath,
    module_path: modulePath,
    output: firstNorm
  };
}

async function main() {
  const repo = process.cwd();
  const pinPath = path.resolve(repo, process.env.PHASE1_TO_PHASE6_PIN_PATH || DEFAULT_PIN_PATH);
  const payload = await buildPinnedPayload();
  const serialized = stableStringify(payload);
  const digest = sha256(serialized);
  const relativePinPath = path.relative(repo, pinPath).replace(/\\/g, "/");

  if (WRITE_MODE) {
    ensureDirFor(pinPath);
    fs.writeFileSync(pinPath, serialized, "utf8");
    written(`sha256=${digest}::pin=${relativePinPath}`);
    return;
  }

  if (!fs.existsSync(pinPath)) {
    fail("missing_pin", relativePinPath);
  }

  const expected = fs.readFileSync(pinPath, "utf8");
  if (expected !== serialized) {
    fail("pin_mismatch", `pin=${relativePinPath}`);
  }

  ok(`sha256=${digest}::pin=${relativePinPath}`);
}

await main();
