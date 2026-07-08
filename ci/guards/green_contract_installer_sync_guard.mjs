// @law: CI Integrity
// @severity: high
// @scope: repo

// DEV NOTE: Green contract installer sync guard. This script protects the installer
// payload contract by proving scripts/apply_green_contract_guards.ps1 embeds the
// same guard source bytes that are committed under ci/guards. This prevents the
// installer from silently reinstalling stale guard code.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

/**
 * DEV NOTE: Terminate with a stable guard-owned message and non-zero exit code.
 * Installer-sync failures should be readable in CI and PowerShell output rather
 * than surfacing as unhandled JavaScript stack traces.
 */
function die(msg) {
  console.error(msg);
  process.exit(1);
}

/**
 * DEV NOTE: Read UTF-8 text from repo files. This guard compares committed source
 * text with decoded installer payload text; it does not execute the installer.
 */
function readUtf8(p) {
  return fs.readFileSync(p, "utf8");
}

/**
 * DEV NOTE: Existence helper for required sync surfaces.
 * Missing installer or guard source files are hard failures because the embedded
 * payload contract cannot be proven without both sides.
 */
function exists(p) {
  try {
    fs.accessSync(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * DEV NOTE: Normalise CRLF to LF before comparing installer payloads to disk.
 * CRLF is still invalid repo hygiene elsewhere, but this guard focuses on payload
 * content equivalence rather than line-ending enforcement.
 */
function normalizeLf(s) {
  // Treat CRLF as invalid in repo, but normalize for comparisons anyway.
  return String(s).replace(/\r\n/g, "\n");
}

/**
 * DEV NOTE: Extract a named base64 PowerShell variable from the installer.
 * The installer contract requires simple `$B64_NAME = "..."` assignments so the
 * embedded payloads remain easy to audit and regenerate.
 */
function extractB64(ps1Text, varName) {
  // Match:  = "...."
  const re = new RegExp("^\\s*\\$" + varName + "\\s*=\\s*\\\"([^\\\"]+)\\\"\\s*$", "m");
  const m = ps1Text.match(re);
  if (!m) die("green_contract_installer_sync_guard: missing $" + varName + ' = "..." in installer');
  return m[1];
}

/**
 * DEV NOTE: Decode base64 installer payloads as UTF-8 text.
 * Decode failures mean the installer payload is corrupt and must be regenerated
 * from the committed guard source.
 */
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

// DEV NOTE: All three files are mandatory. The installer must be checked against
// the current committed guard sources, not against generated, inferred, or remote
// content.
if (!exists(installerPath)) die("green_contract_installer_sync_guard: missing scripts/apply_green_contract_guards.ps1");
if (!exists(greenGuardPath)) die("green_contract_installer_sync_guard: missing ci/guards/green_ci_parity_guard.mjs");
if (!exists(readmeGuardPath)) die("green_contract_installer_sync_guard: missing ci/guards/readme_validation_contract_guard.mjs");

const ps1 = readUtf8(installerPath);

// DEV NOTE: The installer currently owns two embedded guard payloads. Additions to
// this installer contract should be explicit here so stale payload drift remains
// visible in review and CI.
const b64Green = extractB64(ps1, "B64_GREEN");
const b64Readme = extractB64(ps1, "B64_README");

const decodedGreen = normalizeLf(decodeB64Utf8(b64Green));
const decodedReadme = normalizeLf(decodeB64Utf8(b64Readme));

const diskGreen = normalizeLf(readUtf8(greenGuardPath));
const diskReadme = normalizeLf(readUtf8(readmeGuardPath));

// DEV NOTE: B64_GREEN must match the committed green CI parity guard exactly after
// LF normalisation. A mismatch means the installer can restore stale parity logic.
if (decodedGreen !== diskGreen) {
  die(
    "green_contract_installer_sync_guard: installer B64_GREEN does not match ci/guards/green_ci_parity_guard.mjs\n" +
      "Fix: re-generate installer base64 payloads from the current guard sources."
  );
}

// DEV NOTE: B64_README must match the committed README validation contract guard
// exactly after LF normalisation. A mismatch means the installer can restore stale
// README validation logic.
if (decodedReadme !== diskReadme) {
  die(
    "green_contract_installer_sync_guard: installer B64_README does not match ci/guards/readme_validation_contract_guard.mjs\n" +
      "Fix: re-generate installer base64 payloads from the current guard sources."
  );
}

// DEV NOTE: Success means the installer payloads match the committed guard files.
// It does not approve the installer as a general update mechanism or define new
// CI law outside these checked payloads.
console.log("OK: green_contract_installer_sync_guard (installer payloads match committed guards)");
