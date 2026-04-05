# V1 Demo Fixture Pack Index

Document ID: v1_demo_fixture_pack_index
Status: Draft for enforcement
Scope: canonical first-sale demo fixture pack only
Audience: Founder / Commercial / Demo operator / Review

## Purpose

Provide one canonical fixture pack for the full first-sale demo path.

## Invariant

- demo must be runnable from known-good deterministic data
- every fixture used in the first-sale demo path must be indexed here
- every indexed fixture must exist in the repo
- broken fixture references are forbidden

## Canonical fixture pack

### founder_demo_path_contract

- docs/demo/FOUNDER_DEMO_PATH.md

### demo_fixture_pack_contract

- docs/demo/DEMO_FIXTURE_PACK.md

### fixture_data

- docs/demo/V1_DEMO_FIXTURE_PACK_INDEX_REGISTRY.json

### fixture_support_surfaces

- docs/commercial/V0_FIRST_SALE_DEMO_CHECKLIST.md
- docs/commercial/V0_COACH_DEMO_ARTEFACT_INDEX.md
- docs/commercial/V0_COACH_DEMO_SURFACE_CLAIM_MATRIX.md
- docs/commercial/V0_FOUNDER_DEMO_SCRIPT_LOCK.md

### fixture_proof_surfaces

- test/first_sale_demo_checklist.test.mjs
- test/coach_demo_artefact_index_lock.test.mjs
- test/coach_demo_surface_claim_matrix.test.mjs
- test/founder_demo_script_lock.test.mjs

## Operator rule

If the first-sale demo requires a fixture and it is not indexed here, the fixture pack is incomplete.

## Final rule

If any indexed fixture is missing or broken, the canonical demo fixture pack has failed.