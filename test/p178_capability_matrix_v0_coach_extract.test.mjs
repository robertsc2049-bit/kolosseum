import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const docPath = path.join(repoRoot, "docs", "founder", "P178_CAPABILITY_MATRIX_V0_COACH_EXTRACT.md");
const mapPath = path.join(repoRoot, "docs", "founder", "P178_CAPABILITY_MATRIX_V0_COACH_EXTRACT.map.json");

function readUtf8(p) {
  return fs.readFileSync(p, "utf8");
}

function extractLineIds(markdown) {
  const ids = [];
  const regex = /^- \[(C\d{2})\] /gm;
  for (const match of markdown.matchAll(regex)) {
    ids.push(match[1]);
  }
  return ids;
}

test("P178 extract exists and stays one-page readable", () => {
  assert.equal(fs.existsSync(docPath), true, "extract markdown must exist");
  const markdown = readUtf8(docPath);

  const ids = extractLineIds(markdown);
  assert.ok(ids.length > 0, "extract must contain capability lines");
  assert.ok(ids.length <= 12, `extract should remain one-page readable; found ${ids.length} capability lines`);

  const uniqueIds = new Set(ids);
  assert.equal(uniqueIds.size, ids.length, "extract capability IDs must be unique");
});

test("P178 map covers every extract line and forbids orphan lines", () => {
  assert.equal(fs.existsSync(mapPath), true, "mapping json must exist");

  const markdown = readUtf8(docPath);
  const docIds = extractLineIds(markdown);

  const mapDoc = JSON.parse(readUtf8(mapPath));
  assert.equal(mapDoc.document_id, "p178_capability_matrix_v0_coach_extract_map");
  assert.equal(mapDoc.status, "pinned");
  assert.equal(mapDoc.scope, "current_v0_only");
  assert.deepEqual(mapDoc.allowed_statuses, ["tested_surface", "explicit_exclusion"]);

  assert.ok(Array.isArray(mapDoc.entries), "entries must be an array");
  assert.ok(mapDoc.entries.length > 0, "entries must not be empty");

  const allowedStatuses = new Set(mapDoc.allowed_statuses);
  const mapIds = [];
  for (const entry of mapDoc.entries) {
    assert.match(entry.id, /^C\d{2}$/, `invalid entry id: ${entry.id}`);
    assert.equal(typeof entry.line, "string");
    assert.ok(entry.line.length > 0, `line must be non-empty for ${entry.id}`);
    assert.ok(allowedStatuses.has(entry.status), `invalid status for ${entry.id}: ${entry.status}`);
    assert.ok(Array.isArray(entry.sources), `sources must be array for ${entry.id}`);
    assert.ok(entry.sources.length > 0, `sources must not be empty for ${entry.id}`);
    assert.equal(typeof entry.rationale, "string");
    assert.ok(entry.rationale.length > 0, `rationale must be non-empty for ${entry.id}`);
    mapIds.push(entry.id);
  }

  const uniqueMapIds = new Set(mapIds);
  assert.equal(uniqueMapIds.size, mapIds.length, "map IDs must be unique");

  assert.deepEqual(
    [...docIds].sort(),
    [...mapIds].sort(),
    "every extract line must have a mapping entry and orphan lines must fail"
  );
});

test("P178 extract keeps tested surfaces and exclusions explicit", () => {
  const mapDoc = JSON.parse(readUtf8(mapPath));
  const statuses = new Set(mapDoc.entries.map((entry) => entry.status));

  assert.ok(statuses.has("tested_surface"), "extract must include at least one tested surface");
  assert.ok(statuses.has("explicit_exclusion"), "extract must include at least one explicit exclusion");
});
