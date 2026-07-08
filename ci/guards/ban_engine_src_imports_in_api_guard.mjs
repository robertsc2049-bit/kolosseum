// @law: Runtime Boundary
// @severity: high
// @scope: engine
// ci/guards/ban_engine_src_imports_in_api_guard.mjs

// DEV NOTE: API-to-engine source import guard. This script protects the runtime
// boundary by blocking src/api/** from importing private engine/src files directly.
// API code must depend on engine/dist or a package entrypoint so compiled contracts,
// export boundaries, and engine isolation stay reviewable.

import fs from "node:fs";
import path from "node:path";

/**
 * DEV NOTE: Terminate with a stable guard-owned message and non-zero exit code.
 * This keeps expected boundary failures readable in CI instead of exposing an
 * unhandled JavaScript stack trace.
 */
function die(msg) {
  console.error(msg);
  process.exit(1);
}

/**
 * DEV NOTE: Recursively collect files under src/api. The guard intentionally walks
 * the API tree only because the boundary being protected is API code reaching into
 * private engine source.
 */
function walk(dirAbs, out) {
  const ents = fs.readdirSync(dirAbs, { withFileTypes: true });
  for (const e of ents) {
    const p = path.join(dirAbs, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile()) out.push(p);
  }
}

/**
 * DEV NOTE: Convert absolute paths to repo-relative POSIX paths for stable CI output.
 * This keeps offender lists readable and independent of Windows path separators.
 */
function rel(p) {
  return path.relative(process.cwd(), p).replaceAll("\\", "/");
}

const root = process.cwd();
const apiDir = path.join(root, "src", "api");

// DEV NOTE: Missing src/api is a guard failure because this check only makes sense
// when the API surface exists. If the API boundary moves, update this guard and its
// owning tests deliberately rather than silently passing.
if (!fs.existsSync(apiDir)) die(`ban_engine_src_imports_in_api_guard: missing dir: ${rel(apiDir)}`);

const files = [];
walk(apiDir, files);

const offenders = [];

// DEV NOTE: This regex catches static import forms that reach into engine/src from
// API TypeScript files. The rule protects the private source boundary; API code
// should import compiled engine output or a public package entrypoint instead.
const re = /from\s+["'](?:[^"']*?)engine\/src\/|import\s+["'](?:[^"']*?)engine\/src\//;

// DEV NOTE: Only TypeScript source variants are checked because src/api is expected
// to compile through the TypeScript pipeline. Non-TypeScript files are outside this
// specific runtime-boundary rule.
for (const f of files) {
  if (!f.endsWith(".ts") && !f.endsWith(".tsx") && !f.endsWith(".mts") && !f.endsWith(".cts")) continue;
  const txt = fs.readFileSync(f, "utf8");
  if (re.test(txt)) offenders.push(rel(f));
}

// DEV NOTE: Offender output explains the allowed dependency direction. Do not fix
// this by weakening the regex; fix API imports so they use engine/dist or a public
// engine package entrypoint.
if (offenders.length > 0) {
  die(
    "ban_engine_src_imports_in_api_guard: forbidden imports from engine/src in src/api/**.\n" +
      "Use engine/dist (or a package entrypoint) instead.\n\nOffenders:\n" +
      offenders.map((x) => `- ${x}`).join("\n")
  );
}

console.log("OK: ban_engine_src_imports_in_api_guard");
