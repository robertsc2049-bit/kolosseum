# V0 Coach Notes Boundary Demo Proof

Document ID: v0_coach_notes_boundary_demo_proof
Status: Draft for enforcement
Scope: active v0 coach notes boundary only
Audience: Founder / Commercial / Demo operator / Review

## Purpose

Make the non-binding notes boundary impossible to mis-sell.

## Invariant

- notes cannot be implied as override or control logic
- demo note examples must stay inside the non-binding boundary
- banned authority language is forbidden
- notes boundary references tested surfaces only

## Pinned demo note examples

### note_example_01_context_only

Demo note text:
- Athlete reported knee irritation after prior session; coach note records context only.

Allowed demo line:
- This note records context for the coach view and does not change engine legality or execution authority.

Surface ids:
- coach.notes.boundary.read
- coach.notes.non_binding

Doc surfaces:
- docs/commercial/V0_COACH_TIER_VALUE_PROOF_PACK.md
- docs/commercial/V0_COACH_DEMO_SURFACE_CLAIM_MATRIX.md
- docs/commercial/V0_FOUNDER_DEMO_SCRIPT_LOCK.md
- docs/commercial/V0_COACH_NOTES_BOUNDARY_DEMO_PROOF.md

Proof ids:
- test/coach_tier_value_proof_pack.test.mjs
- test/coach_demo_surface_claim_matrix.test.mjs
- test/founder_demo_script_lock.test.mjs
- test/coach_notes_boundary_demo_proof.test.mjs

### note_example_02_intent_only

Demo note text:
- Coach would prefer tempo emphasis next time; note expresses intent only.

Allowed demo line:
- This note shows coach intent only and does not override assignment, execution flow, or engine decisions.

Surface ids:
- coach.notes.boundary.read
- coach.notes.non_binding

Doc surfaces:
- docs/commercial/V0_COACH_TIER_VALUE_PROOF_PACK.md
- docs/commercial/V0_COACH_DEMO_SURFACE_CLAIM_MATRIX.md
- docs/commercial/V0_FOUNDER_DEMO_SCRIPT_LOCK.md
- docs/commercial/V0_COACH_NOTES_BOUNDARY_DEMO_PROOF.md

Proof ids:
- test/coach_tier_value_proof_pack.test.mjs
- test/coach_demo_surface_claim_matrix.test.mjs
- test/founder_demo_script_lock.test.mjs
- test/coach_notes_boundary_demo_proof.test.mjs

### note_example_03_followup_only

Demo note text:
- Coach wants to revisit warm-up clarity on the next review; note flags follow-up only.

Allowed demo line:
- This note flags follow-up only and does not change athlete execution or create automatic follow-up handling.

Surface ids:
- coach.notes.boundary.read
- coach.notes.non_binding

Doc surfaces:
- docs/commercial/V0_COACH_TIER_VALUE_PROOF_PACK.md
- docs/commercial/V0_COACH_DEMO_SURFACE_CLAIM_MATRIX.md
- docs/commercial/V0_FOUNDER_DEMO_SCRIPT_LOCK.md
- docs/commercial/V0_COACH_NOTES_BOUNDARY_DEMO_PROOF.md

Proof ids:
- test/coach_tier_value_proof_pack.test.mjs
- test/coach_demo_surface_claim_matrix.test.mjs
- test/founder_demo_script_lock.test.mjs
- test/coach_notes_boundary_demo_proof.test.mjs

## Banned authority language

- override
- force
- enforce
- control
- instructs the engine
- changes legality
- changes execution authority
- auto-adjusts
- automatic correction
- compliance enforcement
- mandatory athlete action

## Final rule

If a demo note example implies override, enforcement, control, or engine authority, the coach notes boundary demo proof has failed.