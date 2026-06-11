# V0 Copy and Claims Lint Closure

Status: v0 copy and claims lint closure record.

Slice coverage: S-V0-21 Copy and Claims Lint Closure.

## Purpose

This record closes the v0 copy and claims lint inspection.

The slice verifies that active v0 copy remains factual, deterministic, and claim-bounded. It does not weaken copy lint, sales-claim lint, active-scope checks, or boundary-claim consistency checks.

## Active lint surfaces

The active v0 copy and claim checks are:

- `ci/lint/copy_blacklist.regex`
- `ci/lint/sales_claim_blacklist.regex`
- `ci/lint/sales_claim_contextual_rules.json`
- `ci/scripts/lint_sales_claims.mjs`
- `ci/scripts/run_no_inference_copy_guard.mjs`
- `ci/guards/run_v0_boundary_claim_consistency_guard.mjs`
- `ci/scripts/run_v0_active_scope_guard.mjs`
- `ci/scripts/run_v0_active_scope_negative_tests.mjs`

These checks are the executable boundary for active v0 copy. This closure record documents the boundary; it does not create new product law.

## Language boundary

Active v0 copy must stay factual and deterministic.

Active v0 copy must not use language that implies:

- product advice
- selection advice
- outcome improvement
- personal status scoring
- medical value
- clinical value
- rehabilitation value
- unsupported protection value
- unsupported athlete-condition judgement
- unsupported training-effect judgement

The blacklist files carry the machine-readable terms that enforce this.

## Active and inactive surface rule

Active v0 surfaces are controlled by:

- `docs/v0/V0_ACTIVE_SCOPE_MANIFEST.json`
- `docs/product/v0_boundary_exclusions.json`

Inactive, future, v1, roadmap, demo, and documentation surfaces may describe excluded concepts only when they remain outside active v0 checks or are explicitly bounded as exclusions. They must not be treated as active v0 product copy unless they are added to the active v0 surface manifest and pass the claim checks.

## Regeneration and maintenance rule

When active copy changes:

1. Update the copy source.
2. Run `node ci/scripts/lint_sales_claims.mjs`.
3. Run `node ci/scripts/run_no_inference_copy_guard.mjs`.
4. Run `node ci/guards/run_v0_boundary_claim_consistency_guard.mjs`.
5. Run `node ci/scripts/run_v0_active_scope_guard.mjs`.
6. Run `node ci/scripts/run_v0_active_scope_negative_tests.mjs`.
7. Run the full CI gate set before promotion.

If a forbidden term is intentionally used to describe an excluded capability, keep it in an explicitly excluded document or inactive surface. Do not weaken lint to make active copy pass.

## S-V0-21 completion proof

S-V0-21 is complete only when:

1. Copy and sales-claim blacklist files are present.
2. Missing forbidden terms are added where needed.
3. Active v0 copy gates pass.
4. Inactive, future, v1, roadmap, and demo surfaces remain explicitly scoped.
5. `lint:fast`, `test:ci`, and `test:full` pass.
6. The final PR passes GitHub checks before promotion.