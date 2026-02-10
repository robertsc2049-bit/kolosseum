import fs from "node:fs";
import path from "node:path";
import { writeRepoTextSync } from "./repo_io.mjs";

function die(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

function isPlainObject(x) {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function readJson(absPath) {
  try {
    return JSON.parse(fs.readFileSync(absPath, "utf8"));
  } catch (e) {
    die(`pkg_script: failed to read/parse JSON: ${absPath}\n${String(e)}`);
  }
}

function writeJsonStable(absPath, obj) {
  // Stable formatting: 2-space indent, LF, trailing newline.
  const text = JSON.stringify(obj, null, 2).replace(/\r\n/g, "\n") + "\n";
  writeRepoTextSync(absPath, text);
}

function sortObjectKeys(o) {
  const out = {};
  for (const k of Object.keys(o).sort((a, b) => a.localeCompare(b))) out[k] = o[k];
  return out;
}

const repoRoot = process.cwd();
const pkgPath = path.join(repoRoot, "package.json");
if (!fs.existsSync(pkgPath)) die(`pkg_script: missing package.json at ${pkgPath}`);

const args = process.argv.slice(2);
const cmd = args[0];
if (!cmd) {
  die(
    "pkg_script: missing command.\n" +
      "Usage:\n" +
      "  node scripts/pkg_script.mjs set <scriptName> <scriptValue>\n" +
      "  node scripts/pkg_script.mjs del <scriptName>\n" +
      "  node scripts/pkg_script.mjs list\n"
  );
}

const pkg = readJson(pkgPath);
if (!isPlainObject(pkg)) die("pkg_script: package.json root must be an object");

pkg.scripts = isPlainObject(pkg.scripts) ? pkg.scripts : {};

if (cmd === "set") {
  const name = args[1];
  const value = args.slice(2).join(" ");
  if (!name) die("pkg_script: set requires <scriptName>");
  if (!value) die("pkg_script: set requires <scriptValue>");

  pkg.scripts[name] = value;

  // Keep scripts sorted for diff hygiene.
  pkg.scripts = sortObjectKeys(pkg.scripts);

  writeJsonStable(pkgPath, pkg);
  console.log(`pkg_script: set scripts.${name}`);
  process.exit(0);
}

if (cmd === "del") {
  const name = args[1];
  if (!name) die("pkg_script: del requires <scriptName>");
  if (Object.prototype.hasOwnProperty.call(pkg.scripts, name)) {
    delete pkg.scripts[name];
    pkg.scripts = sortObjectKeys(pkg.scripts);
    writeJsonStable(pkgPath, pkg);
    console.log(`pkg_script: deleted scripts.${name}`);
  } else {
    console.log(`pkg_script: scripts.${name} not present (no-op)`);
  }
  process.exit(0);
}

if (cmd === "list") {
  const names = Object.keys(pkg.scripts);
  for (const n of names.sort((a, b) => a.localeCompare(b))) {
    console.log(`${n} = ${pkg.scripts[n]}`);
  }
  process.exit(0);
}

die(`pkg_script: unknown command: ${cmd}`);
