// DEV NOTE: Documentation reconciliation proof. This test prevents the current
// implementation inventory from being described as nonexistent or wholly future.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const index = fs.readFileSync(
  path.join(root, "docs", "product", "V0_SURFACE_INDEX.md"),
  "utf8"
);
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "product", "ui", "function_manifest.json"), "utf8")
);

const startMarker = "<!-- ADMIN-04:MANIFEST-SURFACE-TABLE:START -->";
const endMarker = "<!-- ADMIN-04:MANIFEST-SURFACE-TABLE:END -->";
const table = index.slice(
  index.indexOf(startMarker) + startMarker.length,
  index.indexOf(endMarker)
);

function cleanCell(value) {
  return value.trim().replace(/^`|`$/g, "");
}

function parseRows(markdown) {
  return markdown
    .split("\n")
    .filter((line) => line.startsWith("| `"))
    .map((line) => {
      const cells = line.split("|").slice(1, -1).map(cleanCell);
      assert.equal(cells.length, 9, `surface row must have 9 cells: ${line}`);
      return {
        areaId: cells[0],
        title: cells[1],
        classification: cells[2],
        owner: cells[3],
        actor: cells[4],
        persistence: cells[5],
        engineImpact: cells[6],
        ui: cells[7],
        lifecycle: cells[8]
      };
    });
}

test("ADMIN-04 surface index reconciles every implemented manifest area", () => {
  assert.ok(index.includes(startMarker), "surface-table start marker is required");
  assert.ok(index.includes(endMarker), "surface-table end marker is required");

  const rows = parseRows(table);
  const byArea = new Map(rows.map((row) => [row.areaId, row]));
  const implementedAreas = manifest.product_areas.filter((area) => area.state === "implemented");

  assert.equal(rows.length, implementedAreas.length, "surface table must match manifest area count");
  assert.equal(byArea.size, rows.length, "surface table area IDs must be unique");

  for (const area of implementedAreas) {
    const row = byArea.get(area.area_id);
    assert.ok(row, `implemented area missing from surface index: ${area.area_id}`);
    assert.equal(row.title, area.title, `title drift for ${area.area_id}`);
    assert.ok(row.owner.includes(area.slice_id), `slice missing for ${area.area_id}`);
    assert.notEqual(row.classification, "future-platform", `${area.area_id} is implemented`);
    assert.equal(row.lifecycle, "current", `${area.area_id} must be listed as current`);
    assert.ok(row.actor.length > 0, `actor missing for ${area.area_id}`);
    assert.ok(row.persistence.length > 0, `persistence missing for ${area.area_id}`);
    assert.ok(row.engineImpact.length > 0, `engine impact missing for ${area.area_id}`);
    assert.ok(row.ui.length > 0, `UI reachability missing for ${area.area_id}`);
  }
});

test("ADMIN-04 classification preserves release boundaries", () => {
  const byArea = new Map(parseRows(table).map((row) => [row.areaId, row]));
  const expected = {
    identity_account: "v1",
    session_execution: "v1",
    coach_commercial: "controlled-launch",
    status_support: "controlled-launch",
    device_sync: "controlled-launch",
    founder_admin: "operator-only",
    organisation_billing: "post-v1",
    messaging: "post-v1",
    programme_marketplace: "post-v1",
    attendance_events: "post-v1"
  };

  for (const [areaId, classification] of Object.entries(expected)) {
    assert.equal(byArea.get(areaId)?.classification, classification, areaId);
  }

  assert.match(index, /Existence does not change a release boundary\./);
  assert.match(index, /current implemented post-v1 surface/);
  assert.match(index, /does not mean every listed surface belongs to v0/);
});
