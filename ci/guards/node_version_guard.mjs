// @law: Build Integrity
// @severity: high
// @scope: repo
function die(msg) {
  console.error(msg);
  process.exit(1);
}

const REQUIRED = "25.9.0";
const actual = process.versions.node;

const allow = process.env.NODE_ALLOW_MISMATCH === "1" || process.env.NODE_ALLOW_MISMATCH === "true";
if (!allow && actual !== REQUIRED) {
  die(`\u274C node_version_guard: requires node ${REQUIRED}, got ${actual}. If intentional, re-run with NODE_ALLOW_MISMATCH=1`);
}

console.log(`OK: node_version_guard (${actual})`);
