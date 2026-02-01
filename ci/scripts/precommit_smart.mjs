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

console.log(`[pre-commit] staged files: ${files.length}`);

if (files.length === 0) {
  console.log("[pre-commit] nothing staged → OK");
  process.exit(0);
}

const isDoc = (f) =>
  f.startsWith("docs/") ||
  /\.(md|txt)$/i.test(f);

const touchesEngine = (f) =>
  f.startsWith("engine/") ||
  f.startsWith("cli/") ||
  f.startsWith("src/");

const touchesContracts = (f) =>
  f === "ENGINE_CONTRACT.md" ||
  f === "schema.sql" ||
  f.startsWith("ci/schemas/") ||
  f.startsWith("registries/") ||
  /contract|schema/i.test(f);

const touchesCIInfra = (f) =>
  f.startsWith(".github/workflows/") ||
  f.startsWith("ci/") ||
  f.startsWith("scripts/") ||
  f.startsWith("tools/");

const touchesBuildMeta = (f) =>
  f === "package.json" ||
  f === "package-lock.json" ||
  f === "tsconfig.json" ||
  f === ".npmrc" ||
  f === ".nvmrc";

const DOC_ONLY = files.every(isDoc);
const RISK =
  files.some(touchesEngine) ||
  files.some(touchesContracts) ||
  files.some(touchesCIInfra) ||
  files.some(touchesBuildMeta);

if (DOC_ONLY) {
  console.log("[pre-commit] docs-only → lint:fast");
  sh("npm run lint:fast");
  process.exit(0);
}

if (!RISK) {
  console.log("[pre-commit] low-risk change → lint:fast");
  sh("npm run lint:fast");
  process.exit(0);
}

console.log("[pre-commit] risk surface touched → full lint");
sh("npm run lint");