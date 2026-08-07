import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  S_REG_10_CONTEXT_SCOPE,
  S_REG_10_CONTEXT_TYPE,
  S_REG_10_FAILURE_TOKEN,
  S_REG_10_RUNTIME_STATUS,
  S_REG_10_SEED_STATUS,
  sReg10CandidatePaths,
  sReg10LoadSportContextCandidateSeedFiles,
  sReg10ValidateSportContextCandidateSeeds
} from "../ci/registry/s_reg_10_sport_context_candidate_seeds.mjs";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

const registryIndex = readJson("registries/registry_index.json");
const registryBundle = readJson("registries/registry_bundle.json");

const expectedCompactIds = Object.freeze([
  "activity",
  "movement",
  "exercise",
  "program"
]);

test("S-REG-10 keeps the active registry surface compact", () => {
  assert.deepEqual(registryIndex.order.slice(0, expectedCompactIds.length), expectedCompactIds);
  assert.deepEqual(Object.keys(registryBundle.registries).slice(0, expectedCompactIds.length), expectedCompactIds);
  assert.equal(fs.existsSync("registries/sport_subdivision_registry_1a"), false);
  assert.equal(fs.existsSync("registries/sport_role_registry_2"), false);
});

test("S-REG-10 candidate paths remain under the S-REG-05 candidate surface", () => {
  assert.deepEqual(sReg10CandidatePaths(), {
    sport_subdivision_registry_1a:
      "ci/registry/candidates/sport_subdivision_registry_1a/sport_subdivision_registry_1a.candidate.registry.json",
    sport_role_registry_2:
      "ci/registry/candidates/sport_role_registry_2/sport_role_registry_2.candidate.registry.json"
  });
});

test("S-REG-10 validates sport context candidate FK closure", () => {
  const result = sReg10ValidateSportContextCandidateSeeds();

  assert.equal(result.ok, true);
  assert.deepEqual(result.registry_ids, [
    "sport_subdivision_registry_1a",
    "sport_role_registry_2"
  ]);
  assert.equal(result.subdivision_count, 4);
  assert.equal(result.role_count, 3);
  assert.equal(result.activity_count, 3);
  assert.equal(result.sport_context_seed_status, S_REG_10_SEED_STATUS);
  assert.equal(result.activation_ready, false);
  assert.equal(result.runtime_status, S_REG_10_RUNTIME_STATUS);
});

test("S-REG-10 candidate records are factual context labels only", () => {
  const surface = sReg10LoadSportContextCandidateSeedFiles();

  for (const document of Object.values(surface)) {
    assert.equal(document.candidate_status, "candidate_content_draft");
    assert.equal(document.runtime_status, "non_runtime");
    assert.equal(document.activation_ready, false);
    assert.equal(document.sport_context_seed_status, "candidate_fk_ready");

    for (const record of document.records) {
      assert.equal(record.context_type, S_REG_10_CONTEXT_TYPE);
      assert.equal(record.context_scope, S_REG_10_CONTEXT_SCOPE);
      assert.equal(record.source_slice_id, "S-REG-10");
      assert.equal(record.candidate_status, "candidate_content_draft");
      assert.equal(record.runtime_status, "non_runtime");
      assert.equal(record.activation_ready, false);
    }
  }
});

test("S-REG-10 fails closed when a subdivision references an unknown activity", () => {
  const surface = JSON.parse(JSON.stringify(sReg10LoadSportContextCandidateSeedFiles()));
  surface.sport_subdivision_registry_1a.records[0].activity_id = "missing_activity";

  assert.throws(
    () => sReg10ValidateSportContextCandidateSeeds({ sportContextSurface: surface }),
    (error) => {
      assert.equal(error.code, S_REG_10_FAILURE_TOKEN);
      assert.equal(error.reason, "subdivision_record_field_invalid");
      return true;
    }
  );
});

test("S-REG-10 fails closed when a role references an unknown subdivision", () => {
  const surface = JSON.parse(JSON.stringify(sReg10LoadSportContextCandidateSeedFiles()));
  surface.sport_role_registry_2.records[0].sport_subdivision_id = "missing_subdivision";

  assert.throws(
    () => sReg10ValidateSportContextCandidateSeeds({ sportContextSurface: surface }),
    (error) => {
      assert.equal(error.code, S_REG_10_FAILURE_TOKEN);
      assert.equal(error.reason, "role_record_field_invalid");
      return true;
    }
  );
});

test("S-REG-10 refuses metric or threshold fields", () => {
  const surface = JSON.parse(JSON.stringify(sReg10LoadSportContextCandidateSeedFiles()));
  surface.sport_role_registry_2.records[0].metric_id = "forbidden_metric";

  assert.throws(
    () => sReg10ValidateSportContextCandidateSeeds({ sportContextSurface: surface }),
    (error) => {
      assert.equal(error.code, S_REG_10_FAILURE_TOKEN);
      assert.equal(error.reason, "forbidden_sport_context_semantic_key");
      return true;
    }
  );
});