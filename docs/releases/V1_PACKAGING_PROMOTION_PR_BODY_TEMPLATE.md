# V1 packaging promotion PR body template

Use this template for post-v1 packaging promotion pull requests only.

## Summary
- update the internal packaging boundary for this slice
- record repo-known acceptance and promotion surfaces only
- keep all statements declarative and evidence-linked

## Evidence
- acceptance signoff: `docs/releases/V1_ACCEPTANCE_SIGNOFF.md`
- release checklist: `docs/releases/V1_RELEASE_CHECKLIST.md`
- operator runbook: `docs/releases/V1_OPERATOR_RUNBOOK.md`
- rollback note: `docs/releases/V1_ROLLBACK.md`
- packaging evidence manifest: `docs/releases/V1_PACKAGING_EVIDENCE_MANIFEST.json`
- acceptance pack index: `docs/releases/V1_ACCEPTANCE_PACK_INDEX.md`
- final acceptance gate: `ci/scripts/run_postv1_final_acceptance_gate.mjs`
- promotion flow note: `docs/releases/V1_PROMOTION_FLOW.md`

## Testing
- `npm exec tsc -- -p tsconfig.json`
- `<slice proof command here>`

## Boundary
This template is declarative and evidence-linked only.
It does not claim deployment, rollout, publishing, release completion, or hosted availability.