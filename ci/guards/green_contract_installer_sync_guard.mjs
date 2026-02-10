// @law: CI Integrity
// @severity: high
// @scope: repo
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function readUtf8(p) {
  return fs.readFileSync(p, "utf8");
}

function exists(p) {
  try {
    fs.accessSync(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function normalizeLf(s) {
  // Treat CRLF as invalid in repo, but normalize for comparisons anyway.
  return String(s).replace(/\r\n/g, "\n");
}

function extractB64(ps1Text, varName) {
  // Match:  = "...."
  const re = new RegExp("^\\s*\\$" + varName + "\\s*=\\s*\\\"([^\\\"]+)\\\"\\s*$", "m");
  const m = ps1Text.match(re);
  if (!m) die("green_contract_installer_sync_guard: missing $" + varName + ' = "..." in installer');
  return m[1];
}

function decodeB64Utf8(b64) {
  try {
    return Buffer.from(b64, "base64").toString("utf8");
  } catch (e) {
    die("green_contract_installer_sync_guard: base64 decode failed: " + String(e));
  }
}

const repo = process.cwd();
const installerPath = path.join(repo, "scripts", "apply_green_contract_guards.ps1");
const greenGuardPath = path.join(repo, "ci", "guards", "green_ci_parity_guard.mjs");
const readmeGuardPath = path.join(repo, "ci", "guards", "readme_validation_contract_guard.mjs");

if (!exists(installerPath)) die("green_contract_installer_sync_guard: missing scripts/apply_green_contract_guards.ps1");
if (!exists(greenGuardPath)) die("green_contract_installer_sync_guard: missing ci/guards/green_ci_parity_guard.mjs");
if (!exists(readmeGuardPath)) die("green_contract_installer_sync_guard: missing ci/guards/readme_validation_contract_guard.mjs");

const ps1 = readUtf8(installerPath);

const b64Green = extractB64(ps1, "B64_GREEN");
const b64Readme = extractB64(ps1, "B64_README");

const decodedGreen = normalizeLf(decodeB64Utf8(b64Green));
const decodedReadme = normalizeLf(decodeB64Utf8(b64Readme));

const diskGreen = normalizeLf(readUtf8(greenGuardPath));
const diskReadme = normalizeLf(readUtf8(readmeGuardPath));

if (decodedGreen !== diskGreen) {
  die(
    "green_contract_installer_sync_guard: installer B64_GREEN does not match ci/guards/green_ci_parity_guard.mjs\n" +
      "Fix: re-generate installer base64 payloads from the current guard sources."
  );
}

if (decodedReadme !== diskReadme) {
  die(
    "green_contract_installer_sync_guard: installer B64_README does not match ci/guards/readme_validation_contract_guard.mjs\n" +
      "Fix: re-generate installer base64 payloads from the current guard sources."
  );
}

console.log("OK: green_contract_installer_sync_guard (installer payloads match committed guards)");
