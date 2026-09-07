// DEV NOTE: Repository automation script. Rewrites the static JSON layer
// (JSON Schema enum/const arrays and two derived manifest files) that cannot
// literally `import` shared/v1-boundary/v1ActivityRegistry.mjs, from that
// same single source of truth, so adding a v1 activity means editing one
// config record instead of hand-editing ~10 JSON files.
//
// Usage:
//   node scripts/sync_v1_activity_surfaces.mjs --check   (dry-run, fails on drift)
//   node scripts/sync_v1_activity_surfaces.mjs --write   (rewrites files in place)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { V1_ACTIVITY_IDS } from "../shared/v1-boundary/v1ActivityRegistry.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv.includes("--write") ? "write" : process.argv.includes("--check") ? "check" : null;

if (!mode) {
  console.error("sync_v1_activity_surfaces: pass --check or --write");
  process.exit(1);
}

// DEV NOTE: This regex matches the literal, currently-committed activity id
// sequence regardless of surrounding whitespace/newlines, so the same
// updater works for both compact single-line schema files and pretty-
// printed multi-line ones. It intentionally matches on CONTENT (the known
// ids in their current order), not on a field name, since the same array
// shape appears under different key names (`enum`, `const`,
// `supported_activity_scope`) across these files.
const ACTIVITY_ARRAY_PATTERN = /\[\s*"powerlifting"\s*,\s*"general_strength"\s*,\s*"rugby_union"\s*,\s*"strongman"\s*,\s*"hyrox"\s*\]/g;

/**
 * Rebuild an activity-id JSON array, preserving the matched text's own
 * compact-vs-pretty-printed style (indentation of items and closing
 * bracket), so a no-op sync produces byte-identical output.
 */
function rebuildActivityArray(matchText, ids) {
  const isMultiline = matchText.includes("\n");

  if (!isMultiline) {
    return `[${ids.map((id) => `"${id}"`).join(",")}]`;
  }

  const itemMatch = matchText.match(/\[\r?\n([ \t]*)"/);
  const itemIndent = itemMatch ? itemMatch[1] : "  ";
  const closeMatch = matchText.match(/\r?\n([ \t]*)\]$/);
  const closeIndent = closeMatch ? closeMatch[1] : "";
  const lines = ids.map((id, index) => `${itemIndent}"${id}"${index < ids.length - 1 ? "," : ""}`);

  return `[\n${lines.join("\n")}\n${closeIndent}]`;
}

function syncActivityArrays(text) {
  return text.replace(ACTIVITY_ARRAY_PATTERN, (matchText) => rebuildActivityArray(matchText, V1_ACTIVITY_IDS));
}

function syncMinMaxItemsPair(text) {
  return text
    .replace(/("minItems":\s*)5\b/g, `$1${V1_ACTIVITY_IDS.length}`)
    .replace(/("maxItems":\s*)5\b/g, `$1${V1_ACTIVITY_IDS.length}`);
}

function syncSupportedActivityCount(text) {
  return text.replace(
    /"supported_activity_count":\s*\d+/,
    `"supported_activity_count": ${V1_ACTIVITY_IDS.length}`
  );
}

const targets = [
  { file: "ci/schemas/activity.registry.schema.json", sync: syncActivityArrays },
  { file: "ci/schemas/movement.registry.schema.json", sync: (text) => syncMinMaxItemsPair(syncActivityArrays(text)) },
  { file: "ci/schemas/program.registry.schema.json", sync: syncActivityArrays },
  { file: "ci/schemas/exercise.registry.schema.json", sync: syncActivityArrays },
  { file: "ci/schemas/exercise_token.registry.schema.json", sync: syncActivityArrays },
  { file: "ci/schemas/equipment.registry.schema.json", sync: syncActivityArrays },
  { file: "ci/schemas/copy_registry.registry.schema.json", sync: syncActivityArrays },
  { file: "ci/schemas/substitution_registry.registry.schema.json", sync: syncActivityArrays },
  { file: "ci/schemas/sport_program_template_registry_5f.registry.schema.json", sync: syncActivityArrays },
  { file: "ci/schemas/final_registry_surface_manifest.schema.json", sync: syncActivityArrays },
  { file: "registries/registry_expected_counts.json", sync: syncSupportedActivityCount },
  { file: "registries/final_registry_surface_manifest.json", sync: syncActivityArrays }
];

let drift = false;

for (const target of targets) {
  const filePath = path.join(root, target.file);
  const original = fs.readFileSync(filePath, "utf8");
  const synced = target.sync(original);

  if (synced === original) continue;

  drift = true;

  if (mode === "check") {
    console.error(`sync_v1_activity_surfaces: DRIFT ${target.file}`);
  } else {
    fs.writeFileSync(filePath, synced, "utf8");
    console.log(`sync_v1_activity_surfaces: wrote ${target.file}`);
  }
}

if (mode === "check") {
  if (drift) {
    console.error("V1_ACTIVITY_SURFACES_SYNC_DRIFT");
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, mode: "check", activity_count: V1_ACTIVITY_IDS.length }));
} else {
  console.log(JSON.stringify({ ok: true, mode: "write", activity_count: V1_ACTIVITY_IDS.length }));
}
