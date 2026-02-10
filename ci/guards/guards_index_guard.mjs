// @law: Repo Governance
// @severity: medium
// @scope: repo
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function lf(s) {
  return String(s).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

const repo = process.cwd();
const gen = path.join(repo, "scripts", "guard_index_gen.mjs");
const outPath = path.join(repo, "docs", "GUARDS_INDEX.md");

if (!exists(gen)) die(`guards_index_guard: missing generator: ${path.relative(repo, gen).replace(/\\/g, "/")}`);

const node = process.execPath;
const r = spawnSync(node, [gen], { cwd: repo, encoding: "utf8" });

if (r.error) die(`guards_index_guard: failed to run generator: ${r.error.message}`);
if (r.status !== 0) {
  die(
    [
      "❌ guards_index_guard: generator failed.",
      "",
      (r.stdout || "").trimEnd(),
      (r.stderr || "").trimEnd()
    ].filter(Boolean).join("\n")
  );
}

const expected = lf(r.stdout || "");
if (!exists(outPath)) {
  die(
    [
      "❌ guards_index_guard: docs/GUARDS_INDEX.md missing.",
      "",
      "Fix: npm run guard:index",
      ""
    ].join("\n")
  );
}

const actual = lf(fs.readFileSync(outPath, "utf8"));
if (actual !== expected) {
  die(
    [
      "❌ guards_index_guard: docs/GUARDS_INDEX.md is out of date.",
      "",
      "Fix: npm run guard:index",
      ""
    ].join("\n")
  );
}

console.log("OK: guards_index_guard");