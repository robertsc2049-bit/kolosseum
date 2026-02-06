import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function die(msg) {
  console.error(`Ã¢ÂÅ’ engine_exports_types_guard: ${msg}`);
  process.exit(1);
}

function isPlainObject(x) {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function readJson(p) {
  try {
    const raw = fs.readFileSync(p, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    die(`failed to read/parse JSON: ${p}\n${String(e)}`);
  }
}

function assertString(x, label) {
  if (typeof x !== "string" || x.trim().length === 0) die(`${label} must be a non-empty string`);
  return x;
}

function assertStartsWith(s, prefix, label) {
  if (!s.startsWith(prefix)) die(`${label} must start with "${prefix}" (got "${s}")`);
}

const repoRoot = process.cwd();
const enginePkgPath = path.resolve(repoRoot, "engine", "package.json");

if (!fs.existsSync(enginePkgPath)) die(`missing engine/package.json at: ${enginePkgPath}`);

const pkg = readJson(enginePkgPath);

if (pkg.name !== "@kolosseum/engine") die(`engine/package.json name must be "@kolosseum/engine" (got "${pkg.name}")`);
if (pkg.type !== "module") die(`engine/package.json type must be "module" (got "${pkg.type}")`);

const topTypes = assertString(pkg.types, 'engine/package.json "types"');
if (topTypes !== "./types/index.d.ts") die(`engine/package.json "types" must be "./types/index.d.ts" (got "${topTypes}")`);

const exportsField = pkg.exports;
if (!isPlainObject(exportsField)) die(`engine/package.json "exports" must be an object`);

const exportsKeys = Object.keys(exportsField);
if (exportsKeys.length === 0) die(`engine/package.json "exports" is empty`);

for (const key of exportsKeys) {
  const entry = exportsField[key];

  if (!isPlainObject(entry)) {
    die(`export "${key}" must be an object with { types, default }`);
  }

  const typesPath = assertString(entry.types, `export "${key}".types`);
  const defaultPath = assertString(entry.default, `export "${key}".default`);

  // Invariant: runtime resolves to dist, TS resolves to types
  assertStartsWith(typesPath, "./types/", `export "${key}".types`);
  assertStartsWith(defaultPath, "./dist/", `export "${key}".default`);

  // Basic hygiene: no absolute/parent traversal
  if (typesPath.includes("..")) die(`export "${key}".types must not contain ".." (got "${typesPath}")`);
  if (defaultPath.includes("..")) die(`export "${key}".default must not contain ".." (got "${defaultPath}")`);

  // Optional: ensure extension correctness for our current conventions
  if (!typesPath.endsWith(".d.ts")) die(`export "${key}".types must end with ".d.ts" (got "${typesPath}")`);
  if (!defaultPath.endsWith(".js")) die(`export "${key}".default must end with ".js" (got "${defaultPath}")`);
}

console.log("OK: engine_exports_types_guard (engine exports include types+default; dist/types mapping enforced)");
