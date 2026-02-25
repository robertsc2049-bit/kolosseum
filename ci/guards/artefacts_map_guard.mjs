// @law: Repo Hygiene
// @severity: high
// @scope: ci/guards + ci/artefacts

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function die(msg, code = 1) {
  process.stderr.write(String(msg).trimEnd() + "\n");
  process.exit(code);
}

function isPlainObject(x) {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function readJson(absPath) {
  let raw = "";
  try {
    raw = fs.readFileSync(absPath, "utf8");
  } catch (e) {
    die(`artefacts_map_guard: failed to read: ${absPath} :: ${String(e)}`, 2);
  }

  try {
    return JSON.parse(raw);
  } catch (e) {
    die(`artefacts_map_guard: invalid JSON: ${absPath} :: ${String(e)}`, 2);
  }
}

function assert(cond, msg) {
  if (!cond) die(`artefacts_map_guard: ${msg}`, 2);
}

function assertString(x, msg) {
  assert(typeof x === "string" && x.trim().length > 0, msg);
}

function hasBadPathBits(p) {
  const s = String(p || "").replace(/\\/g, "/");
  if (!s) return true;
  if (s.startsWith("/") || s.startsWith("./") || s.startsWith("../")) return true;
  if (s.includes("..")) return true;
  if (s.includes("\0")) return true;
  if (s.includes("\r")) return true;
  if (s.includes("\n")) return true;
  if (s.includes("\t")) return true;
  if (/^[a-zA-Z]:\//.test(s)) return true; // drive absolute
  return false;
}

function globToRegex(glob) {
  const g = String(glob || "").replace(/\\/g, "/");
  let re = "^";
  for (let i = 0; i < g.length; i++) {
    const ch = g[i];
    const next = g[i + 1];

    if (ch === "*" && next === "*") {
      re += ".*";
      i++;
      continue;
    }
    if (ch === "*") {
      re += "[^/]*";
      continue;
    }
    if (ch === "?") {
      re += "[^/]";
      continue;
    }

    if (/[\.\+\^\$\{\}\(\)\|\[\]\\]/.test(ch)) re += "\\" + ch;
    else re += ch;
  }
  re += "$";
  return new RegExp(re, "i");
}

function validateGroup(g, idx) {
  assert(isPlainObject(g), `groups[${idx}] must be an object`);
  assertString(g.id, `groups[${idx}].id must be a non-empty string`);
  assertString(g.kind, `groups[${idx}].kind must be a non-empty string`);
  assert(
    Array.isArray(g.patterns) && g.patterns.length > 0,
    `groups[${idx}].patterns must be a non-empty array`
  );

  for (let i = 0; i < g.patterns.length; i++) {
    const p = g.patterns[i];
    assertString(p, `groups[${idx}].patterns[${i}] must be a non-empty string`);
    assert(
      !hasBadPathBits(p),
      `groups[${idx}].patterns[${i}] has unsafe/invalid path bits: '${p}'`
    );

    try {
      globToRegex(p);
    } catch (e) {
      die(
        `artefacts_map_guard: groups[${idx}].patterns[${i}] failed to compile: '${p}' :: ${String(
          e
        )}`,
        2
      );
    }
  }
}

function validateDecision(d) {
  assert(isPlainObject(d), "decision must be an object");

  const required = [
    "when_docs_only",
    "when_workflow_only",
    "when_engine_risk",
    "when_app_risk",
    "default",
  ];

  for (const k of required) {
    assert(isPlainObject(d[k]), `decision.${k} must be an object`);
    assertString(d[k].route, `decision.${k}.route must be a non-empty string`);
    assertString(d[k].reason, `decision.${k}.reason must be a non-empty string`);
  }
}

function validateArtefacts(json, absPath) {
  assert(isPlainObject(json), "root must be an object");
  assert(json.version === 1, `version must be 1 (got ${String(json.version)})`);
  assert(Array.isArray(json.groups) && json.groups.length > 0, "groups must be a non-empty array");
  validateDecision(json.decision);

  const ids = new Set();
  for (let i = 0; i < json.groups.length; i++) {
    validateGroup(json.groups[i], i);
    const id = String(json.groups[i].id).trim();
    assert(!ids.has(id), `duplicate group id: '${id}'`);
    ids.add(id);
  }

  const allowedKinds = new Set(["DOC", "WORKFLOW", "ENGINE_RISK", "APP_RISK"]);
  for (let i = 0; i < json.groups.length; i++) {
    const k = String(json.groups[i].kind).trim();
    assert(allowedKinds.has(k), `unknown kind '${k}' (allowed: DOC, WORKFLOW, ENGINE_RISK, APP_RISK)`);
  }

  const raw = fs.readFileSync(absPath, "utf8");
  assert(raw.endsWith("\n"), "artefacts.json must end with LF newline");
  assert(!raw.includes("\r"), "artefacts.json must be LF-only (no CRLF)");
}

function parseArgs(argv) {
  const args = { relPath: "ci/artefacts/artefacts.json" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--path" || a === "-p") {
      const v = argv[i + 1];
      if (!v) die("artefacts_map_guard: --path requires a value", 2);
      args.relPath = v;
      i++;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const abs = path.resolve(process.cwd(), args.relPath);

if (!fs.existsSync(abs)) die(`artefacts_map_guard: missing file: ${args.relPath}`, 2);

const json = readJson(abs);
validateArtefacts(json, abs);

process.stdout.write("OK: artefacts_map_guard\n");
