import fs from "node:fs";
import path from "node:path";

const repo = process.cwd();

const targets = [
  "scripts/engine_shim_sync.mjs",
  "scripts/lockfile_note.mjs",
  "scripts/pkg_script.mjs",
  "test_support/registry_law_guard_harness.mjs",
  "tools/add_golden_update_script.mjs",
  "tools/fix_engine_contract_encoding.mjs",
  "tools/run_golden_update.mjs",
  "tools/write_text_utf8_nobom.mjs",
];

function read(p) {
  return fs.readFileSync(p, "utf8");
}

function write(p, s) {
  fs.writeFileSync(p, s.replace(/\r\n/g, "\n").replace(/\r/g, "\n"), { encoding: "utf8" });
}

function ensureImport(text, importLine) {
  if (text.includes(importLine)) return text;

  // If there's at least one import, insert after the last contiguous import block at top.
  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length && lines[i].startsWith("import ")) i++;

  // Insert a blank line if needed for readability.
  const out = [...lines.slice(0, i), importLine, ...lines.slice(i)];
  return out.join("\n");
}

function transformWriteCalls(text) {
  let t = text;

  // Replace encoding-arg variants first (3rd arg).
  // fs.writeFileSync(a, b, "utf8")  -> writeRepoTextSync(a, b)
  t = t.replace(
    /\bfs\.writeFileSync\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*["']utf8["']\s*\)/g,
    "writeRepoTextSync($1, $2)"
  );
  t = t.replace(
    /\bwriteFileSync\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*["']utf8["']\s*\)/g,
    "writeRepoTextSync($1, $2)"
  );

  // fs.writeFileSync(a, b, { encoding: "utf8", ... }) -> writeRepoTextSync(a, b)
  t = t.replace(
    /\bfs\.writeFileSync\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*\{[^}]*\bencoding\s*:\s*["']utf8["'][^}]*\}\s*\)/g,
    "writeRepoTextSync($1, $2)"
  );
  t = t.replace(
    /\bwriteFileSync\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*\{[^}]*\bencoding\s*:\s*["']utf8["'][^}]*\}\s*\)/g,
    "writeRepoTextSync($1, $2)"
  );

  // 2-arg variants: fs.writeFileSync(a, b) -> writeRepoTextSync(a, b)
  t = t.replace(/\bfs\.writeFileSync\s*\(/g, "writeRepoTextSync(");
  t = t.replace(/\bwriteFileSync\s*\(/g, "writeRepoTextSync(");

  return t;
}

let changed = 0;

for (const rel of targets) {
  const abs = path.join(repo, rel);
  if (!fs.existsSync(abs)) throw new Error(`codemod_use_repo_io: missing target: ${rel}`);

  let t = read(abs);

  const importLine =
    rel.startsWith("scripts/")
      ? 'import { writeRepoTextSync } from "./repo_io.mjs";'
      : 'import { writeRepoTextSync } from "../scripts/repo_io.mjs";';

  const before = t;
  t = ensureImport(t, importLine);
  t = transformWriteCalls(t);

  if (t !== before) {
    write(abs, t);
    console.log(`UPDATED: ${rel}`);
    changed++;
  } else {
    console.log(`OK: ${rel} (no change)`);
  }
}

console.log(`DONE: changed=${changed}/${targets.length}`);