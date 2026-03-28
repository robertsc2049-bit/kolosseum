# V1 Operator Execution Order

## Purpose
Define the **only valid execution sequence** for post-v1 packaging and promotion.

This is a **linear, non-branching contract**.

No step may be skipped, reordered, or conditionally executed.

---

## Execution Order

1. Build packaging evidence  
   → ci/scripts/build_postv1_packaging_evidence.mjs

2. Verify packaging evidence manifest  
   → ci/scripts/run_postv1_packaging_evidence_manifest_verifier.mjs

3. Run final acceptance gate  
   → ci/scripts/run_postv1_final_acceptance_gate.mjs

4. Perform release claim validation  
   → ci/scripts/run_release_claim_validator.mjs

5. Confirm merge readiness  
   → ci/scripts/run_postv1_merge_readiness_verifier.mjs

6. Execute mainline post-merge verification  
   → ci/scripts/run_postv1_mainline_post_merge_verification.mjs

---

## Invariants

- Order is strictly linear
- No branching or optional paths
- All steps must exist in repo
- All steps must succeed before proceeding

---

## Violation Conditions

The sequence is invalid if:
- any step is missing
- any step is reordered
- any step is duplicated
- any additional step is inserted

---

## Authority

This document is enforced by:
- packaging surface registry
- packaging registry guard
- execution order test (P39)

This file is the **single source of truth** for operator sequencing.