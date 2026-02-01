import { execSync } from "node:child_process";

function sh(cmd) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "inherit"] }).toString("utf8");
}

function shOut(cmd) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString("utf8");
}

const files = shOut("git diff --name-only --cached")
  .split(/\r?\n/)
  .map((s) => s.trim())
  .filter(Boolean);

const isDocOnly =
  files.length > 0 &&
  files.every((f) => /\.(md|txt)$/i.test(f));

console.log(`prepush: staged files = ${files.length}`);
if (!files.length) {
  console.log("prepush: nothing staged; running full prepush (lint).");
  sh("npm run lint");
  process.exit(0);
}

if (isDocOnly) {
  console.log("prepush: docs-only change detected -> running lint:fast only");
  sh("npm run lint:fast");
  process.exit(0);
}

console.log("prepush: code change detected -> running full lint");
sh("npm run lint");