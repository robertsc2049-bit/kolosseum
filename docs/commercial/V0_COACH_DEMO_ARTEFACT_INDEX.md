# V0 Coach Demo Artefact Index

Document ID: v0_coach_demo_artefact_index
Status: Draft for enforcement
Scope: active v0 coach sale/demo path only
Audience: Founder / Commercial / Demo operator / Review

## Purpose

Provide one pinned index for every artefact used in the coach sale/demo path.

## Invariant

- demo operator cannot rely on memory or hunting
- every artefact used in the coach sale/demo path must be indexed once
- every indexed artefact must exist in the repo
- duplicate or missing artefact references are forbidden

## Indexed artefacts

### coach_value_pack

- docs/commercial/V0_COACH_TIER_VALUE_PROOF_PACK.md
- docs/commercial/V0_COACH_TIER_VALUE_CLAIM_REGISTRY.json

### first_sale_demo_checklist

- docs/commercial/V0_FIRST_SALE_DEMO_CHECKLIST.md
- docs/commercial/V0_FIRST_SALE_DEMO_CHECKLIST_REGISTRY.json

### founder_demo_boundary

- docs/v1/V1_FOUNDER_DEMO_UI_COPY_LOCK.md
- src/ui/copy/founder_demo_copy.ts
- test/founder_demo_ui_copy_lock.test.mjs

### declaration_error_boundary

- docs/v1/V1_DECLARATION_ERROR_UX_CONTRACT.md
- src/ui/copy/declaration_error_copy.ts
- test/declaration_error_ux_contract.test.mjs

### export_nothing_boundary

- docs/v1/V1_EXPORT_NOTHING_V0_GUARD.md
- ci/locks/v0_export_nothing_scope.json
- test/v0_export_nothing_guard.test.mjs

### coach_demo_execution_support

- test/coach_tier_value_proof_pack.test.mjs
- test/first_sale_demo_checklist.test.mjs

## Operator rule

If an artefact is needed for the coach sale/demo path and is not indexed here, the demo path is incomplete.

## Final rule

If any indexed artefact is missing, duplicated, or stale relative to the active v0 coach demo path, the coach demo artefact index has failed.