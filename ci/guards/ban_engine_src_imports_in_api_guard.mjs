// @law: Runtime Boundary
// @severity: high
// @scope: engine
// ci/guards/ban_engine_src_imports_in_api_guard.mjs
import fs from "node:fs";
import path from "node:path";

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function walk(dirAbs, out) {
  const ents = fs.readdirSync(dirAbs, { withFileTypes: true });
  for (const e of ents) {
    const p = path.join(dirAbs, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile()) out.push(p);
  }
}

function rel(p) {
  return path.relative(process.cwd(), p).replaceAll("\\", "/");
}

const root = process.cwd();
const apiDir = path.join(root, "src", "api");
if (!fs.existsSync(apiDir)) die(`ban_engine_src_imports_in_api_guard: missing dir: ${rel(apiDir)}`);

const files = [];
walk(apiDir, files);

const offenders = [];
const re = /from\s+["'](?:[^"']*?)engine\/src\/|import\s+["'](?:[^"']*?)engine\/src\//;

for (const f of files) {
  if (!f.endsWith(".ts") && !f.endsWith(".tsx") && !f.endsWith(".mts") && !f.endsWith(".cts")) continue;
  const txt = fs.readFileSync(f, "utf8");
  if (re.test(txt)) offenders.push(rel(f));
}

if (offenders.length > 0) {
  die(
    "ban_engine_src_imports_in_api_guard: forbidden imports from engine/src in src/api/**.\n" +
      "Use engine/dist (or a package entrypoint) instead.\n\nOffenders:\n" +
      offenders.map((x) => `- ${x}`).join("\n")
  );
}

console.log("OK: ban_engine_src_imports_in_api_guard");
