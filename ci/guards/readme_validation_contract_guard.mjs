// @law: Contracts
// @severity: high
// @scope: repo
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function exists(p) {
  try {
    fs.accessSync(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

const repo = process.cwd();
const p = path.join(repo, "README.md");

if (!exists(p)) {
  die("readme_validation_contract_guard: README.md missing");
}

const s = fs.readFileSync(p, "utf8");

function requireIncludes(needle, label) {
  if (!s.includes(needle)) {
    die("readme_validation_contract_guard: missing required README contract: " + label);
  }
}

function forbidIncludes(needle, label) {
  if (s.includes(needle)) {
    die("readme_validation_contract_guard: forbidden README string (policy): " + label);
  }
}

requireIncludes("## How to validate changes", "heading '## How to validate changes'");
requireIncludes("npm run verify", "command 'npm run verify'");

// Policy: README must not instruct humans to run internal green entrypoints.
forbidIncludes("npm run green:ci", "command 'npm run green:ci'");
forbidIncludes("npm run green", "command 'npm run green'");

console.log("OK: readme_validation_contract_guard");