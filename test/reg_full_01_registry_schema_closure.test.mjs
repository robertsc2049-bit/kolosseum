import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { validateSchemaManifest } from "../ci/registry/reg_full_01_registry_schema_closure.mjs";

const schemaManifest = JSON.parse(fs.readFileSync(new URL("../registries/final_registry_schema_manifest.json", import.meta.url), "utf8"));
const surfaceManifest = JSON.parse(fs.readFileSync(new URL("../registries/final_registry_surface_manifest.json", import.meta.url), "utf8"));
const clone = () => structuredClone(schemaManifest);
const codes = (m) => validateSchemaManifest(m, surfaceManifest).errors.map((x)=>x.code);

test("authoritative REG-FULL-01 schema manifest validates",()=>assert.deepEqual(validateSchemaManifest(schemaManifest,surfaceManifest),{ok:true,errors:[]}));
test("rejects duplicate authoritative schema for one registry",()=>{const m=clone();m.registries[1].canonical_registry_id=m.registries[0].canonical_registry_id;assert.ok(codes(m).includes("DUPLICATE_REGISTRY_SCHEMA_AUTHORITY"));});
test("rejects duplicate authoritative schema path",()=>{const m=clone();m.registries[1].schema_path=m.registries[0].schema_path;assert.ok(codes(m).includes("DUPLICATE_SCHEMA_PATH"));});
test("rejects required-active registry without schema",()=>{const m=clone();m.registries=m.registries.filter((r)=>r.canonical_registry_id!=="movement_registry_3");assert.ok(codes(m).includes("SCHEMA_COUNT")||codes(m).includes("REQUIRED_ACTIVE_SCHEMA_MISSING"));});
test("rejects generic or absent canonical primary key",()=>{const m=clone();const r=m.registries.find((x)=>x.canonical_registry_id==="exercise_registry_3a");r.primary_key_field=null;assert.ok(codes(m).includes("PRIMARY_KEY_MISSING"));});
test("rejects undeclared canonical optional field",()=>{const m=clone();m.registries[0].optional_fields=["mystery"];assert.ok(codes(m).includes("CANONICAL_OPTIONAL_FIELD"));});
test("rejects FK target key drift",()=>{const m=clone();const r=m.registries.find((x)=>x.canonical_registry_id==="exercise_registry_3a");r.fk_fields[0].target_primary_key_field="movement_id";assert.ok(codes(m).includes("FK_TARGET_KEY_MISMATCH"));});
test("rejects FK target outside final active authority",()=>{const m=clone();const r=m.registries.find((x)=>x.canonical_registry_id==="exercise_registry_3a");r.fk_fields[0].target_registry_id="threshold_marker_registry";assert.ok(codes(m).includes("FK_TARGET_UNKNOWN"));});
test("rejects legacy dual-read permission",()=>{const m=clone();m.summary.legacy_dual_read_allowed=true;assert.ok(codes(m).includes("SUMMARY_MISMATCH"));});
test("rejects unresolved schema conflict",()=>{const m=clone();m.schema_conflicts.push({conflict_id:"x"});assert.ok(codes(m).includes("SCHEMA_CONFLICT"));});
test("rejects wrong load position",()=>{const m=clone();m.registries.find((x)=>x.canonical_registry_id==="movement_registry_3").load_position=99;assert.ok(codes(m).includes("LOAD_POSITION_MISMATCH"));});
test("rejects deferred-no-rows registry with invented primary key",()=>{const m=clone();const r=m.registries.find((x)=>x.row_contract_status==="deferred_no_rows");r.primary_key_field="invented_id";assert.ok(codes(m).includes("DEFERRED_PRIMARY_KEY_FORBIDDEN"));});
