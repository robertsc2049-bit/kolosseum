import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Ticket 017 — No legacy constraint keys, cross-platform.
 *
 * We must NOT embed forbidden tokens verbatim in this file,
 * otherwise the guard self-triggers.
 *
 * So we build tokens dynamically.
 */

function k(parts) {
  return parts.join("");
}

const FORBIDDEN = [
  k(["banned", "_equipment", "_ids"]),
  k(["available", "_equipment", "_ids"])
];

const ROOTS = ["engine", "ci", "test"];

const SELF = join("ci", "guards", "no_legacy_constraints.mjs");

let violations = [];

function scanFile(path) {
  const content = readFileSync(path, "utf8");
  for (const key of FORBIDDEN) {
    if (content.includes(key)) violations.push({ path, key });
  }
}

function shouldScan(path) {
  if (path === SELF) return false; // never scan the guard itself
  return path.endsWith(".ts") || path.endsWith(".mjs") || path.endsWith(".json");
}

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full);
    else if (shouldScan(full)) scanFile(full);
  }
}

for (const root of ROOTS) walk(root);

if (violations.length > 0) {
  console.error("\n❌ Legacy constraint keys detected:\n");
  for (const v of violations) console.error(`- ${v.key} → ${v.path}`);
  console.error("\nCanonical constraint contract violated. Build blocked.\n");
  process.exit(1);
}

console.log("✅ Constraint guard passed (no legacy keys detected).");
