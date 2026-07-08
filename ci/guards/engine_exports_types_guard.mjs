// @law: Runtime Boundary
// @severity: high
// @scope: engine

// DEV NOTE: Engine exports/types guard. This script protects the public engine
// package boundary by validating engine/package.json exports. Runtime consumers
// must resolve to compiled dist files while TypeScript consumers resolve to
// generated declaration files; no caller should reach into private source paths.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

/**
 * DEV NOTE: Terminate with a stable guard-owned message and non-zero exit code.
 * Export contract failures should be readable in CI and PowerShell output rather
 * than surfacing as unhandled JavaScript stack traces.
 */
function die(msg) {
  console.error(`[ERR] engine_exports_types_guard: ${msg}`);
  process.exit(1);
}

/**
 * DEV NOTE: package.json contract nodes must be plain objects where expected.
 * Arrays, null, and primitives are rejected so malformed exports cannot pass
 * through JavaScript truthiness.
 */
function isPlainObject(x) {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

/**
 * DEV NOTE: Read strict JSON from disk. engine/package.json is the source of
 * truth for this guard, so parse errors are treated as runtime-boundary failures.
 */
function readJson(p) {
  try {
    const raw = fs.readFileSync(p, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    die(`failed to read/parse JSON: ${p}\n${String(e)}`);
  }
}

/**
 * DEV NOTE: Required package fields must be non-empty strings.
 * Empty strings would create ambiguous or broken export mappings while still
 * being syntactically valid JSON.
 */
function assertString(x, label) {
  if (typeof x !== "string" || x.trim().length === 0) die(`${label} must be a non-empty string`);
  return x;
}

/**
 * DEV NOTE: Prefix checks enforce the split between declaration output and
 * runtime output. This keeps TypeScript and Node resolution on their approved
 * sides of the engine package boundary.
 */
function assertStartsWith(s, prefix, label) {
  if (!s.startsWith(prefix)) die(`${label} must start with "${prefix}" (got "${s}")`);
}

const repoRoot = process.cwd();
const enginePkgPath = path.resolve(repoRoot, "engine", "package.json");

// DEV NOTE: Missing engine/package.json is a hard boundary failure because the
// package export contract cannot be reviewed or enforced without it.
if (!fs.existsSync(enginePkgPath)) die(`missing engine/package.json at: ${enginePkgPath}`);

const pkg = readJson(enginePkgPath);

// DEV NOTE: The package identity and module mode are part of the public engine
// contract. Changing either affects import semantics and must be deliberate.
if (pkg.name !== "@kolosseum/engine") die(`engine/package.json name must be "@kolosseum/engine" (got "${pkg.name}")`);
if (pkg.type !== "module") die(`engine/package.json type must be "module" (got "${pkg.type}")`);

// DEV NOTE: The top-level types entry must point to the generated declaration
// index. Do not point this at src or dist because TypeScript should consume the
// declaration surface, not private implementation files.
const topTypes = assertString(pkg.types, 'engine/package.json "types"');
if (topTypes !== "./types/index.d.ts") die(`engine/package.json "types" must be "./types/index.d.ts" (got "${topTypes}")`);

const exportsField = pkg.exports;
if (!isPlainObject(exportsField)) die(`engine/package.json "exports" must be an object`);

const exportsKeys = Object.keys(exportsField);
if (exportsKeys.length === 0) die(`engine/package.json "exports" is empty`);

// DEV NOTE: Every export must explicitly provide both a types target and a default
// runtime target. This prevents ambiguous package resolution and keeps public
// imports on compiled/dist plus generated/types outputs.
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

// DEV NOTE: Success means engine/package.json keeps the approved package identity,
// ESM mode, top-level declaration entry, and per-export dist/types mapping. It
// does not approve runtime behaviour inside the exported implementation files.
console.log("OK: engine_exports_types_guard (engine exports include types+default; dist/types mapping enforced)");
