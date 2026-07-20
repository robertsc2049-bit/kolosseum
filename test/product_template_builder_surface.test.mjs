// DEV NOTE: Product coach template builder static contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const server = read("src/server.ts");
const routes = read("src/api/templates.routes.ts");
const handlers = read("src/api/templates.handlers.ts");
const service = read("src/api/beta18_programme_template_service.ts");
const store = read("src/api/beta_product_record_store.ts");
const schema = read("schema.sql");
const html = read("public/app/index.html");
const css = read("public/app/styles.css");
const js = read("public/app/app.js");
const blocks = read("src/api/blocks.handlers.ts");
const journey = read("src/api/beta_product_journey_service.ts");

test("coach template product route is served", () => {
  assert.match(server, /import \{ templatesRouter \} from "\.\/api\/templates\.routes\.js";/u);
  assert.match(server, /app\.use\("\/templates", templatesRouter\);/u);
  assert.match(routes, /\/:template_id\/activate/u);
  assert.match(routes, /\/:template_id\/duplicate/u);
  assert.match(routes, /\/:template_id\/archive/u);
  assert.match(handlers, /saveCoachProgrammeTemplate/u);
});

test("template records are immutable persisted product state", () => {
  assert.match(store, /beta18_programme_template/u);
  assert.match(schema, /'beta18_programme_template'/u);
  assert.match(service, /persistBetaProductRecord/u);
  assert.match(service, /active_or_archived_template_is_immutable/u);
  assert.match(service, /only_draft_can_activate/u);
});

test("builder is registry-bound and percentage-only", () => {
  assert.match(service, /registries",\s*"exercise",\s*"exercise\.registry\.json"/u);
  assert.match(service, /session_requires_exactly_four_work_items/u);
  assert.match(service, /duplicate_exercise_in_session/u);
  assert.match(service, /percent_1rm/u);
  assert.doesNotMatch(service, /planned_rpe|resistance_rpe/u);
});

test("assignment requires an active owned template", () => {
  assert.match(journey, /loadActiveCoachTemplateById/u);
  assert.match(journey, /stored_template_not_active/u);
  assert.match(journey, /stored_template_activity_mismatch/u);
});

test("assigned template materialises the next deterministic session", () => {
  assert.match(blocks, /materialiseNextCoachTemplateProgram/u);
  assert.match(blocks, /programForSession/u);
  assert.match(service, /assigned_template_sessions_exhausted/u);
  assert.match(service, /template_record_sha256/u);
  assert.match(service, /explicit_order_index_only/u);
  assert.match(service, /planned_items/u);
  assert.match(blocks, /template_compile_binding_missing/u);
  assert.match(blocks, /phase2_canonical_hash/u);
});

test("coach UI exposes library, builder, versioning and assignment selection", () => {
  assert.match(html, /data-view="templates"/u);
  assert.match(html, /id="view-templates"/u);
  assert.match(html, /id="templateWeeks"/u);
  assert.match(html, /id="assignmentTemplate"/u);
  assert.match(js, /refreshTemplates/u);
  assert.match(js, /duplicateTemplate/u);
  assert.match(js, /activateOpenTemplate/u);
  assert.match(js, /renderAssignmentTemplateOptions/u);
  assert.match(css, /\.template-builder-layout/u);
});
