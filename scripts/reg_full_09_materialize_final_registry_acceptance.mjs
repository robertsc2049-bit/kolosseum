// DEV NOTE: REG-FULL-09 controlled materializer. It rebuilds the compact
// compatibility bundle using the canonical writer, then writes the final
// completion report only when every acceptance criterion is green.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  REG_FULL_09_FAILURE_TOKEN,
  REG_FULL_09_REPORT,
  computeRegFull09Acceptance,
  validateRegFull09Closure
} from "../ci/registry/reg_full_09_final_registry_acceptance.mjs";

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const write = args.has("--write");
const check = args.has("--check");

if (!write && !check) {
  console.error("REG-FULL-09 materializer: specify --write or --check");
  process.exit(1);
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

if (write) {
  execFileSync(process.execPath, ["scripts/bundle_writer.cjs"], { cwd: root, stdio: "inherit" });
  const result = computeRegFull09Acceptance(root);
  if (!result.ok || result.report.status !== "PASS") {
    console.error(`${REG_FULL_09_FAILURE_TOKEN}: FAIL; completion report not written`);
    for (const error of result.errors) console.error(`${error.code}: ${typeof error.detail === "string" ? error.detail : JSON.stringify(error.detail)}`);
    process.exit(1);
  }
  const reportPath = path.join(root, ...REG_FULL_09_REPORT.split("/"));
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, stableJson(result.report), "utf8");
  console.log(`${REG_FULL_09_FAILURE_TOKEN}: wrote ${REG_FULL_09_REPORT}`);
}

const checked = validateRegFull09Closure({ repoRoot: root });
if (!checked.ok) {
  console.error(`${REG_FULL_09_FAILURE_TOKEN}: FAIL`);
  for (const error of checked.errors) console.error(`${error.code}: ${typeof error.detail === "string" ? error.detail : JSON.stringify(error.detail)}`);
  process.exit(1);
}
console.log(`${REG_FULL_09_FAILURE_TOKEN}: PASS report=${checked.report.status}`);
