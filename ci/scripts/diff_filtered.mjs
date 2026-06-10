
// DEV NOTE: Repository automation script. This file exists to make a repeatable repo operation
// deterministic and reviewable. Keep side effects explicit, paths repo-root relative, and
// failure output readable for PowerShell and CI users.

import { execSync } from "node:child_process";

function sh(cmd) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString("utf8");
}

const pattern = process.argv[2];
if (!pattern) {
  console.error("usage: node ci/scripts/diff_filtered.mjs <regex>");
  process.exit(1);
}

const re = new RegExp(pattern, "i");

const files = sh("git diff --name-only").split(/\r?\n/).filter(Boolean);
const hits = files.filter((f) => re.test(f));

console.log(`== diff filtered ==`);
console.log(`pattern: ${pattern}`);
console.log(hits.length ? hits.map((f) => `- ${f}`).join("\n") : "(no matches)");
console.log("");

if (!hits.length) process.exit(0);

// show stat + full diff for matching files only
const args = hits.map((f) => `"${f}"`).join(" ");
console.log("== diff --stat ==");
console.log(sh(`git diff --stat -- ${args}`).trim());
console.log("");
console.log("== diff ==");
process.stdout.write(sh(`git diff -- ${args}`));
