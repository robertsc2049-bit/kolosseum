import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { validateManifest } from "../ci/registry/reg_full_00_final_registry_surface_authority.mjs";

const base = JSON.parse(fs.readFileSync(new URL("../registries/final_registry_surface_manifest.json", import.meta.url), "utf8"));
const clone = () => structuredClone(base);
const errors = (m) => validateManifest(m).errors.map((x) => x.code);

test("authoritative REG-FULL-00 manifest validates", () => assert.deepEqual(validateManifest(base), { ok: true, errors: [] }));
test("rejects an unclassified registry", () => { const m=clone(); m.entities[0].classification="unknown"; assert.ok(errors(m).includes("ENTITY_UNCLASSIFIED")); });
test("rejects duplicate canonical authority", () => { const m=clone(); m.entities[1].canonical_registry_id=m.entities[0].canonical_registry_id; assert.ok(errors(m).includes("CANONICAL_DUPLICATE")); });
test("rejects active index registry absent from manifest", () => { const m=clone(); const e=m.entities.find((x)=>x.current_state.repo_registry_ids.includes("activity")); e.current_state.repo_registry_ids=e.current_state.repo_registry_ids.filter((x)=>x!=="activity"); assert.ok(errors(m).includes("INDEX_DOMAIN_UNMAPPED")); });
test("rejects canonical spine registry absent from manifest", () => { const m=clone(); m.entities=m.entities.filter((x)=>x.canonical_registry_id!=="physical_requirements_registry_1b"); assert.ok(errors(m).includes("CANONICAL_REQUIRED_MISSING")); });
test("rejects prohibited registry in final load order", () => { const m=clone(); m.final_load_order[0]="instruction_display_copy_registry"; assert.ok(errors(m).includes("LOAD_ORDER_NON_ACTIVE")); });
test("rejects dormant registry in final load order", () => { const m=clone(); m.final_load_order[0]="threshold_marker_registry"; assert.ok(errors(m).includes("LOAD_ORDER_NON_ACTIVE")); });
test("rejects retained legacy registry in final load order", () => { const m=clone(); m.final_load_order[0]="exercise_substitution_graph"; assert.ok(errors(m).includes("LOAD_ORDER_NON_ACTIVE")); });
test("rejects derived generated registry treated as independent authority", () => { const m=clone(); const e=m.entities.find((x)=>x.canonical_registry_id==="registry_bundle"); e.final_state.authoritative=true; assert.ok(errors(m).includes("NON_ACTIVE_AUTHORITY")); });
test("rejects unresolved architecture conflict", () => { const m=clone(); m.architecture_conflicts.push({conflict_id:"x"}); assert.ok(errors(m).includes("ARCHITECTURE_CONFLICT")); });
test("rejects duplicate final load position", () => { const m=clone(); const a=m.entities.find((x)=>x.canonical_registry_id===m.final_load_order[0]); const b=m.entities.find((x)=>x.canonical_registry_id===m.final_load_order[1]); b.final_state.final_load_position=a.final_state.final_load_position; assert.ok(errors(m).includes("LOAD_POSITION_DUPLICATE_OR_INVALID")); });
test("rejects forward dependency", () => { const m=clone(); const e=m.entities.find((x)=>x.canonical_registry_id==="activity_registry_1"); e.dependency_ids=["copy_registry"]; assert.ok(errors(m).includes("DEPENDENCY_FORWARD")); });
test("rejects dependency cycle", () => { const m=clone(); m.entities.find((x)=>x.canonical_registry_id==="activity_registry_1").dependency_ids=["movement_registry_3"]; m.entities.find((x)=>x.canonical_registry_id==="movement_registry_3").dependency_ids=["activity_registry_1"]; assert.ok(errors(m).includes("DEPENDENCY_CYCLE")); });
test("rejects prohibited classification without governing boundary", () => { const m=clone(); delete m.entities.find((x)=>x.classification==="prohibited").governing_boundary; assert.ok(errors(m).includes("PROHIBITED_BOUNDARY_MISSING")); });
test("rejects retained legacy classification without migration destination/action", () => { const m=clone(); const e=m.entities.find((x)=>x.classification==="retained_legacy"); e.successor_registry_id=null; e.migration_action="Freeze compatibility surface."; assert.ok(errors(m).includes("LEGACY_MIGRATION_MISSING")); });
test("rejects derived generated classification without authoritative input", () => { const m=clone(); m.entities.find((x)=>x.classification==="derived_generated").authoritative_input_registry_ids=[]; assert.ok(errors(m).includes("DERIVED_INPUTS_MISSING")); });
