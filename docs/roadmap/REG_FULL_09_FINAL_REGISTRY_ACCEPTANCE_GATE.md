# REG-FULL-09 — Final Registry Acceptance Gate

## Status
Implementation slice. The registry programme is not finished until this gate reports `PASS` on the exact merge candidate head.

## Goal
Close the registry programme with one deterministic final acceptance gate that rebuilds the compact compatibility bundle, aggregates all prior REG-FULL closure laws, audits remaining cross-surface invariants, and emits one machine-readable completion report with exact counts and an unambiguous `PASS` or `FAIL` result.

## Governing rule
REG-FULL-09 does not invent a new registry architecture. It accepts the final surface declared by `registries/final_registry_surface_manifest.json` and the schema authority declared by `registries/final_registry_schema_manifest.json`, then proves that the implemented row-bearing authorities and compatibility bundle conform to those laws.

Dormant and retained-legacy surfaces remain governed by their existing classification. Candidate-only records are prohibited from active authority. Lawfully dormant candidate records are not promoted, rewritten, or deleted merely to make this gate green.

## Canonical bundle rebuild
The only lawful writer for `registries/registry_bundle.json` remains:

```text
node scripts/bundle_writer.cjs
```

REG-FULL-09 must prove:

- the writer can rebuild the committed bundle without byte drift;
- a second rebuild is byte-identical to the first;
- bundle version matches `registry_index.json`;
- `registry_bundle.registries` key order exactly matches `registry_index.order`;
- no file discovery or fallback loading is introduced.

## Required acceptance criteria
Every criterion below is fail-closed.

1. **Schema closure**
   - every `required_active` registry has one authoritative schema;
   - no schema conflicts;
   - no permanent dual-read escape;
   - all declared FK targets and target primary-key vocabularies are closed.

2. **Complete FK and relationship closure**
   - all declared FK fields on materialized active authorities resolve to existing target IDs;
   - REG-FULL-04 equipment/applicability relationships remain complete;
   - REG-FULL-06 substitution relationships remain complete;
   - REG-FULL-07 template bindings remain complete;
   - REG-FULL-08 provenance source relationships remain complete;
   - orphan relationship count is exactly zero.

3. **Deterministic ordering**
   - bundle rematerialization is byte-identical;
   - compact bundle registry order equals `registry_index.order` exactly;
   - REG-FULL-06 substitution ordering remains deterministic;
   - REG-FULL-07 template family/order contracts remain deterministic;
   - REG-FULL-08 provenance materialization remains deterministic.

4. **Activity closure**
   - supported activity set remains exactly `powerlifting`, `general_strength`, `rugby_union`;
   - unsupported active activity references: `0`.

5. **Candidate-only active closure**
   - candidate-only records in active record sources: `0`;
   - dormant candidate records may remain only where the final surface manifest classifies that registry as dormant.

6. **Fallback closure**
   - operative fallback/default/closest-exercise fields in active registry records: `0`;
   - generic substitution fallback and closest-exercise inference remain forbidden by REG-FULL-06/07.

7. **ID closure**
   - duplicate or mismatched primary IDs within every explicitly active source file: `0`.

8. **Programme-template coverage**
   - 11 canonical templates total;
   - powerlifting: 4;
   - general strength: 3;
   - rugby union: 4;
   - supported activities without canonical template coverage: `0`.

9. **Substitution reachability**
   - canonical substitution registry equals the complete deterministic lawful candidate set from REG-FULL-06;
   - no lawful candidate edge is missing or unexpected;
   - reachability gap count: `0`;
   - source count is derived from exercises that actually have at least one lawful outgoing edge. REG-FULL-09 must not fabricate edges merely to make all exercises substitution sources.

10. **Copy/provenance closure**
    - REG-FULL-08 remains green over its explicit active source set;
    - no licensed-content inference or source mutation is introduced.

## Dependency gates
REG-FULL-09 must aggregate and keep green:

- REG-FULL-00 final registry surface authority;
- REG-FULL-01 registry schema closure;
- REG-FULL-02 activity/movement completion;
- REG-FULL-03 exercise registry production;
- registry bundle guard;
- S-V1-24 registry load-order/FK closure;
- REG-FULL-04 equipment/applicability closure;
- REG-FULL-06 substitution graph closure;
- REG-FULL-07 programme template production;
- REG-FULL-08 copy/instructions/provenance closure.

There is no synthetic REG-FULL-05 dependency to invent.

## Generated completion report
Canonical report:

`ci/evidence/reg_full_09_final_registry_acceptance.v1.json`

The report is deterministic and contains:

- overall `PASS` / `FAIL`;
- one PASS/FAIL field for every final acceptance criterion;
- exact schema, bundle, activity, relationship, template, substitution and provenance counts;
- exact zero counts for unsupported activities, candidate-only active records, fallbacks, duplicate IDs, orphan relationships and substitution reachability gaps;
- dependency-gate results;
- an explicit completion statement.

The report may say `REGISTRIES_FINISHED` only when every criterion and dependency is green. Otherwise it must say `REGISTRIES_NOT_FINISHED` and the materializer must fail.

## Commands
Materialize the bundle and completion report only after all source registries are in their intended final state:

```text
node scripts/reg_full_09_materialize_final_registry_acceptance.mjs --write
```

Verify without authoring changes:

```text
node scripts/reg_full_09_materialize_final_registry_acceptance.mjs --check
node --test test/reg_full_09_final_registry_acceptance.test.mjs
node ci/registry/reg_full_09_final_registry_acceptance.mjs
```

## Failure token

`CI_REG_FULL_09_FINAL_REGISTRY_ACCEPTANCE`

## Done when
REG-FULL-09 is complete only when:

- canonical bundle rebuild is byte-identical;
- the committed completion report is exact and reports `PASS`;
- all direct tests and dependency gates pass locally;
- registry/evidence/failure-token/docs guards remain current;
- authoritative GitHub CI is green on the exact merge candidate head;
- the PR is merge-ready.

Only after those conditions are proven may the registries be described as finished.
