import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

function shOut(cmd) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString("utf8");
}

function die(msg) {
  console.error(msg);
  process.exit(1);
}

const base = (process.env.BASE_SHA || "").trim();
const head = (process.env.HEAD_SHA || "").trim();
if (!base || !head) die("ci_select: BASE_SHA and HEAD_SHA are required.");

const files = shOut(`git diff --name-only ${base} ${head}`)
  .split(/\r?\n/)
  .map(s => s.trim())
  .filter(Boolean);

// Classification helpers
const isDoc = (f) =>
  f.startsWith("docs/") ||
  /\.(md|txt)$/i.test(f);

const isWorkflow = (f) => f.startsWith(".github/workflows/");
const isCIInfra = (f) => f.startsWith("ci/") || f.startsWith("scripts/") || f.startsWith("tools/");
const isCli = (f) => f.startsWith("cli/");
const isEngine = (f) => f.startsWith("engine/");
const isSrc = (f) => f.startsWith("src/");
const isContractish = (f) =>
  f === "ENGINE_CONTRACT.md" ||
  f === "schema.sql" ||
  f.startsWith("ci/schemas/") ||
  f.startsWith("registries/") ||
  f.includes("CONTRACT") ||
  f.includes("contract") ||
  f.includes("schema");

const isApi = (f) => f.startsWith("src/") || f.includes("server") || f.includes("apply-schema") || f.includes("schema.sql");

// Modes:
// docs  -> no install; lint:fast only
// cli   -> install; lint:fast; run cli test only
// unit  -> install; dev:fast (lint:fast + test:unit)
// full  -> install; npm run ci
let mode = "unit";

if (files.length === 0) {
  mode = "full"; // weird edge: treat as full
} else if (files.every(isDoc)) {
  mode = "docs";
} else {
  const anyContract = files.some(isContractish);
  const anyEngine = files.some(isEngine);
  const anyCli = files.some(isCli);
  const anySrc = files.some(isSrc);
  const anyWorkflow = files.some(isWorkflow);

  // If workflow/CI infra changes, be conservative.
  if (anyWorkflow) {
    mode = "full";
  } else if (anyContract || anyEngine) {
    mode = "full";
  } else if (anyCli && !anySrc && !files.some(isEngine) && !files.some(isContractish)) {
    mode = "cli";
  } else {
    mode = "unit";
  }
}

// Persist changed files for later steps / artifacts
writeFileSync("ci_changed_files.txt", files.join("\n") + (files.length ? "\n" : ""), "utf8");

// Expose outputs to GitHub Actions
const outPath = process.env.GITHUB_OUTPUT;
if (outPath) {
  const lines = [
    `mode=${mode}`,
    `changed_count=${files.length}`,
    `base_sha=${base}`,
    `head_sha=${head}`,
    `has_api=${files.some(isApi) ? "1" : "0"}`
  ].join("\n") + "\n";
  writeFileSync(outPath, lines, { encoding: "utf8", flag: "a" });
}

console.log(`ci_select: mode=${mode} changed=${files.length}`);