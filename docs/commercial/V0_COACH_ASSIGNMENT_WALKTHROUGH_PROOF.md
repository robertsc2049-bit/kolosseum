# V0 Coach Assignment Walkthrough Proof

Document ID: v0_coach_assignment_walkthrough_proof
Status: Draft for enforcement
Scope: active v0 coach path only
Audience: Founder / Commercial / Demo operator / Review

## Purpose

Provide one step-by-step operator walkthrough for assign -> view -> confirm.

## Invariant

- coach path must be demonstrable as a closed loop
- every walkthrough step must map to pinned tested surfaces
- skipped steps are forbidden
- unproven jumps are forbidden

## Closed-loop walkthrough

### step_01_open_boundary

Operator action:
- Open the active v0 coach demo boundary before touching assignment.

Surface ids:
- coach.assignment.read
- coach.assignment.write

Doc surfaces:
- docs/commercial/V0_COACH_TIER_VALUE_PROOF_PACK.md
- docs/commercial/V0_FIRST_SALE_DEMO_CHECKLIST.md
- docs/commercial/V0_COACH_DEMO_SURFACE_CLAIM_MATRIX.md
- docs/commercial/V0_FOUNDER_DEMO_SCRIPT_LOCK.md

Proof ids:
- test/coach_tier_value_proof_pack.test.mjs
- test/first_sale_demo_checklist.test.mjs
- test/coach_demo_surface_claim_matrix.test.mjs
- test/founder_demo_script_lock.test.mjs

### step_02_assign_work

Operator action:
- Demonstrate the coach assignment step using the active v0 assignment claim only.

Surface ids:
- coach.assignment.write

Doc surfaces:
- docs/commercial/V0_COACH_TIER_VALUE_PROOF_PACK.md
- docs/commercial/V0_COACH_DEMO_SURFACE_CLAIM_MATRIX.md
- docs/commercial/V0_COACH_ASSIGNMENT_WALKTHROUGH_PROOF.md

Proof ids:
- test/coach_tier_value_proof_pack.test.mjs
- test/coach_demo_surface_claim_matrix.test.mjs
- test/coach_assignment_walkthrough_proof.test.mjs

### step_03_view_execution

Operator action:
- Show the factual execution view that follows the assignment step.

Surface ids:
- coach.execution.state.read
- coach.execution.summary.read

Doc surfaces:
- docs/commercial/V0_COACH_TIER_VALUE_PROOF_PACK.md
- docs/commercial/V0_COACH_DEMO_SURFACE_CLAIM_MATRIX.md
- docs/commercial/V0_COACH_ASSIGNMENT_WALKTHROUGH_PROOF.md

Proof ids:
- test/coach_tier_value_proof_pack.test.mjs
- test/coach_demo_surface_claim_matrix.test.mjs
- test/coach_assignment_walkthrough_proof.test.mjs

### step_04_confirm_boundary

Operator action:
- Confirm the loop closes with factual confirmation only, not scoring, override, or automation.

Surface ids:
- coach.execution.summary.read
- coach.notes.non_binding

Doc surfaces:
- docs/commercial/V0_COACH_TIER_VALUE_PROOF_PACK.md
- docs/commercial/V0_COACH_DEMO_SURFACE_CLAIM_MATRIX.md
- docs/commercial/V0_FOUNDER_DEMO_SCRIPT_LOCK.md
- docs/commercial/V0_COACH_ASSIGNMENT_WALKTHROUGH_PROOF.md

Proof ids:
- test/coach_tier_value_proof_pack.test.mjs
- test/coach_demo_surface_claim_matrix.test.mjs
- test/founder_demo_script_lock.test.mjs
- test/coach_assignment_walkthrough_proof.test.mjs

## Final rule

If any walkthrough step is skipped, reordered, or cannot be traced to pinned tested surfaces, the coach assignment walkthrough proof has failed.