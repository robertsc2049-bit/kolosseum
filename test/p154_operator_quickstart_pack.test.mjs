import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relPath) {
  const full = path.join(root, relPath);
  assert.ok(fs.existsSync(full), `required file missing: ${relPath}`);
  return fs.readFileSync(full, "utf8");
}

function mustExist(relPath) {
  const full = path.join(root, relPath);
  assert.ok(fs.existsSync(full), `required referenced artefact missing: ${relPath}`);
}

test("P154 quickstart doc exists and stays one-page in intent", () => {
  const src = read("docs/v0/P154_OPERATOR_QUICKSTART_PACK.md");
  assert.match(src, /# P154/);
  assert.match(src, /Operator Quickstart Pack/);
  assert.match(src, /Core founder\/operator workflow must fit on one page/);

  const lineCount = src.split(/\r?\n/).length;
  assert.ok(lineCount <= 120, `quickstart doc too long for one-page intent: ${lineCount} lines`);
});

test("P154 quickstart references only live core commands", () => {
  const src = read("docs/v0/P154_OPERATOR_QUICKSTART_PACK.md");

  const allowedCommands = [
    "Set-Location C:\\Users\\rober\\kolosseum",
    "node --test <targeted test file>",
    "npm run lint:fast",
    "npm run dev:status",
    "gh run list --limit 10"
  ];

  for (const cmd of allowedCommands) {
    assert.match(src, new RegExp(cmd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("P154 referenced v0 artefacts exist", () => {
  mustExist("docs/v0/P153_V0_CAPABILITY_MATRIX.md");
  mustExist("docs/v0/P151_SPLIT_RETURN_DEMO_READ_MODEL_SURFACE.md");
  mustExist("docs/v0/P152_COACH_NOTES_BOUNDARY_PROOF.md");
});

test("P154 bans legacy engine-status drift", () => {
  const src = read("docs/v0/P154_OPERATOR_QUICKSTART_PACK.md");

  assert.match(src, /npm run engine-status/);
  assert.match(src, /scripts\/engine-status\.ps1/);
  assert.match(src, /Forbidden Legacy Drift/);

  const packageJson = read("package.json");
  assert.doesNotMatch(packageJson, /"engine-status"\s*:/, "legacy engine-status script must not exist in package.json");
});

test("P154 quickstart points at current preferred repo checks", () => {
  const src = read("docs/v0/P154_OPERATOR_QUICKSTART_PACK.md");

  assert.match(src, /npm run lint:fast/);
  assert.match(src, /npm run dev:status/);
  assert.match(src, /gh run list --limit 10/);
});

test("P154 quickstart does not widen into undocumented broad workflows", () => {
  const src = read("docs/v0/P154_OPERATOR_QUICKSTART_PACK.md");

  assert.doesNotMatch(src, /\bnpm run test\b/i, "quickstart must not widen to broad test command");
  assert.doesNotMatch(src, /\bnpm run build\b/i, "quickstart must not widen to broad build command");
  assert.doesNotMatch(src, /\bci:parity\b/i, "quickstart must stay brutally short");
  assert.doesNotMatch(src, /\bdev:fast\b/i, "quickstart must stay brutally short");
  assert.doesNotMatch(src, /\bdev:status:full\b/i, "quickstart must stay brutally short");
});

test("P154 quickstart keeps capability claims pinned to the matrix", () => {
  const src = read("docs/v0/P154_OPERATOR_QUICKSTART_PACK.md");
  assert.match(src, /Do not claim capability outside the current v0 capability matrix/);
});