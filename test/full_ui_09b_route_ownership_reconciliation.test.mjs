import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

const manifest = JSON.parse(
  fs.readFileSync(
    path.join(
      root,
      "product",
      "ui",
      "function_manifest.json"
    ),
    "utf8"
  )
);

const expectedOwnership = [
  {
    "route": "/coach-workspace/relationships",
    "area": "coach_overview",
    "function_id": "overview_relationships"
  },
  {
    "route": "/coach-workspace/relationships",
    "area": "relationships",
    "function_id": "relationship_lists"
  },
  {
    "route": "/coach-workspace/relationships",
    "area": "athlete_directory",
    "function_id": "athlete_search_filter"
  },
  {
    "route": "/coach-workspace/relationships",
    "area": "athlete_directory",
    "function_id": "athlete_relationship_state"
  },
  {
    "route": "/coach-workspace/athlete-detail",
    "area": "athlete_directory",
    "function_id": "athlete_current_programme"
  },
  {
    "route": "/coach-workspace/athlete-detail",
    "area": "athlete_directory",
    "function_id": "athlete_current_event"
  },
  {
    "route": "/coach-workspace/athlete-detail",
    "area": "athlete_directory",
    "function_id": "athlete_assignment_history"
  },
  {
    "route": "/coach-workspace/athlete-detail",
    "area": "athlete_directory",
    "function_id": "athlete_event_history"
  },
  {
    "route": "/coach-workspace/athlete-detail",
    "area": "athlete_directory",
    "function_id": "athlete_strength_history"
  },
  {
    "route": "/coach-workspace/athlete-detail",
    "area": "athlete_directory",
    "function_id": "athlete_bodyweight_history"
  },
  {
    "route": "/coach-workspace/athlete-detail",
    "area": "athlete_directory",
    "function_id": "athlete_notes_list"
  },
  {
    "route": "/coach-workspace/athlete-detail",
    "area": "athlete_directory",
    "function_id": "athlete_session_history"
  }
];

function findFunction(areaId, functionId) {
  const area = manifest.product_areas.find(
    (entry) => entry.area_id === areaId
  );

  assert.ok(
    area,
    "missing_area:" + areaId
  );

  const item = area.functions.find(
    (entry) => entry.function_id === functionId
  );

  assert.ok(
    item,
    "missing_function:" +
      areaId +
      ":" +
      functionId
  );

  return item;
}

test(
  "FULL-UI-09B assigns the relationships route to its product functions",
  () => {
    const entries = expectedOwnership.filter(
      (entry) =>
        entry.route ===
        "/coach-workspace/relationships"
    );

    assert.equal(entries.length, 4);

    for (const entry of entries) {
      const item = findFunction(
        entry.area,
        entry.function_id
      );

      assert.equal(
        item.api_routes.includes(entry.route),
        true,
        entry.area + ":" + entry.function_id
      );
    }
  }
);

test(
  "FULL-UI-09B assigns athlete detail to every persisted detail projection",
  () => {
    const entries = expectedOwnership.filter(
      (entry) =>
        entry.route ===
        "/coach-workspace/athlete-detail"
    );

    assert.equal(entries.length, 8);

    for (const entry of entries) {
      const item = findFunction(
        entry.area,
        entry.function_id
      );

      assert.equal(
        item.api_routes.includes(entry.route),
        true,
        entry.area + ":" + entry.function_id
      );
    }
  }
);

test(
  "FULL-UI-09B retains route source and area ownership metadata",
  () => {
    const routeMap = new Map(
      manifest.api_route_catalog.map((entry) => [
        entry.method.toUpperCase() +
          " " +
          entry.path,
        entry
      ])
    );

    for (const routePath of [
      "/coach-workspace/relationships",
      "/coach-workspace/athlete-detail"
    ]) {
      const entry = routeMap.get(
        "GET " + routePath
      );

      assert.ok(entry, routePath);

      assert.equal(
        entry.source,
        "src/api/coach_workspace.routes.ts",
        routePath
      );

      assert.equal(
        entry.tracked_by_area,
        "coach_workspace",
        routePath
      );
    }
  }
);

test(
  "FULL-UI-09B keeps function API route arrays duplicate-free",
  () => {
    for (const area of manifest.product_areas) {
      for (const item of area.functions) {
        assert.equal(
          item.api_routes.length,
          new Set(item.api_routes).size,
          area.area_id +
            ":" +
            item.function_id
        );
      }
    }
  }
);
