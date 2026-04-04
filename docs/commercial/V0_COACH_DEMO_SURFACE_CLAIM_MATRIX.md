# V0 Coach Demo Surface-to-Claim Matrix

Document ID: v0_coach_demo_surface_claim_matrix
Status: Draft for enforcement
Scope: active v0 coach-facing commercial and demo path only
Audience: Founder / Commercial / Product / Review

## Purpose

Map each coach-facing claim to exact UI, API, doc, and test surfaces.

## Invariant

- no coach-facing claim may exist without a traceable implementation chain
- every claim must map to exact surface ids and proof ids
- orphan claims are forbidden
- demo and sales language must stay inside active v0 truth only

## Matrix

### assignment

Claim text:
- Coach can assign work within the active v0 coach path.

Surface ids:
- coach.assignment.read
- coach.assignment.write

Doc surfaces:
- docs/commercial/V0_COACH_TIER_VALUE_PROOF_PACK.md
- docs/commercial/V0_FIRST_SALE_DEMO_CHECKLIST.md
- docs/commercial/V0_COACH_DEMO_ARTEFACT_INDEX.md

UI/API surfaces:
- coach.assignment.read
- coach.assignment.write

Proof ids:
- test/coach_tier_value_proof_pack.test.mjs
- test/first_sale_demo_checklist.test.mjs
- test/coach_demo_artefact_index_lock.test.mjs

### execution_view

Claim text:
- Coach can view factual execution artefacts and summaries only.

Surface ids:
- coach.execution.state.read
- coach.execution.summary.read

Doc surfaces:
- docs/commercial/V0_COACH_TIER_VALUE_PROOF_PACK.md
- docs/commercial/V0_FIRST_SALE_DEMO_CHECKLIST.md
- docs/commercial/V0_COACH_DEMO_ARTEFACT_INDEX.md

UI/API surfaces:
- coach.execution.state.read
- coach.execution.summary.read

Proof ids:
- test/coach_tier_value_proof_pack.test.mjs
- test/first_sale_demo_checklist.test.mjs
- test/coach_demo_artefact_index_lock.test.mjs

### notes_boundary

Claim text:
- Coach notes are non-binding and do not alter engine legality or execution authority.

Surface ids:
- coach.notes.boundary.read
- coach.notes.non_binding

Doc surfaces:
- docs/commercial/V0_COACH_TIER_VALUE_PROOF_PACK.md
- docs/commercial/V0_FIRST_SALE_DEMO_CHECKLIST.md
- docs/commercial/V0_COACH_DEMO_ARTEFACT_INDEX.md

UI/API surfaces:
- coach.notes.boundary.read
- coach.notes.non_binding

Proof ids:
- test/coach_tier_value_proof_pack.test.mjs
- test/first_sale_demo_checklist.test.mjs
- test/coach_demo_artefact_index_lock.test.mjs

### history_counts

Claim text:
- Coach can view factual history counts only where the v0 surface exposes counts.

Surface ids:
- coach.history.counts.read

Doc surfaces:
- docs/commercial/V0_COACH_TIER_VALUE_PROOF_PACK.md
- docs/commercial/V0_FIRST_SALE_DEMO_CHECKLIST.md
- docs/commercial/V0_COACH_DEMO_ARTEFACT_INDEX.md

UI/API surfaces:
- coach.history.counts.read

Proof ids:
- test/coach_tier_value_proof_pack.test.mjs
- test/first_sale_demo_checklist.test.mjs
- test/coach_demo_artefact_index_lock.test.mjs

## Final rule

If a coach-facing claim cannot be traced from claim text to surface ids to proof ids, that claim is not lawful for sales or demo use in active v0.