import { execSync } from "node:child_process";

function sh(cmd, inherit = true) {
  execSync(cmd, { stdio: inherit ? "inherit" : ["ignore", "pipe", "ignore"] });
}

function out(cmd) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString("utf8");
}

const files = out("git diff --name-only --cached")
  .split(/\r?\n/)
  .map(s => s.trim())
  .filter(Boolean);

const DOC_ONLY = files.length > 0 && files.every(f => /\.(md|txt)$/i.test(f));
const ENGINE_TOUCH = files.some(f =>
  f.startsWith("engine/") ||
  f.startsWith("cli/") ||
  f.includes("ENGINE_CONTRACT") ||
  f.includes("schema")
);

console.log(`[pre-push] staged files: ${files.length}`);

if (!files.length) {
  console.log("[pre-push] nothing staged → full path");
  sh("npm run lint");
  process.exit(0);
}

if (DOC_ONLY) {
  console.log("[pre-push] docs-only → lint:fast");
  sh("npm run lint:fast");
  process.exit(0);
}

if (!ENGINE_TOUCH) {
  console.log("[pre-push] non-engine change → dev:fast");
  sh("npm run dev:fast");
  process.exit(0);
}

console.log("[pre-push] engine-affecting change → full lint");
sh("npm run lint");