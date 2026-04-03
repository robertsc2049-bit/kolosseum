# V1 Operator Freeze Runbook

Status: Authoritative
Scope: Operator freeze execution and handoff
Applies to: V1 sealed freeze surfaces

## Purpose

This runbook defines the operator-controlled freeze execution surface and the minimum handoff surfaces required to operate, verify, and preserve a sealed freeze state.

## Required operator law surfaces

The operator freeze bundle is lawful only when it contains all of the following required surfaces:

- docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md
- docs/releases/V1_OPERATOR_FREEZE_COMMAND_ORDER.json
- docs/releases/V1_OPERATOR_EXECUTION_ORDER.md
- docs/releases/V1_HANDOFF_INDEX.md
- docs/releases/V1_RELEASE_CHECKLIST.md
- docs/releases/V1_ROLLBACK_RUNBOOK.md
- ci/scripts/run_operator_freeze_command_order_verifier.mjs
- ci/scripts/run_operator_freeze_handoff_index_completeness_verifier.mjs
- ci/scripts/run_operator_freeze_release_checklist_binding_verifier.mjs
- ci/scripts/run_operator_freeze_runbook_execution_order_binding_verifier.mjs
- ci/scripts/run_operator_freeze_runbook_surface_completeness_verifier.mjs
- ci/scripts/run_freeze_rollback_compatibility_verifier.mjs

## Surface roles

- docs/releases/V1_OPERATOR_FREEZE_COMMAND_ORDER.json is the machine-readable freeze command sequence.
- docs/releases/V1_OPERATOR_EXECUTION_ORDER.md is the operator-readable execution order companion.
- docs/releases/V1_HANDOFF_INDEX.md is the freeze handoff entrypoint.
- docs/releases/V1_RELEASE_CHECKLIST.md is the release checklist bound to operator freeze.
- docs/releases/V1_ROLLBACK_RUNBOOK.md is the lawful rollback surface for freeze-controlled release operation.
- ci/scripts/run_operator_freeze_command_order_verifier.mjs proves command-order integrity.
- ci/scripts/run_operator_freeze_handoff_index_completeness_verifier.mjs proves handoff index completeness.
- ci/scripts/run_operator_freeze_release_checklist_binding_verifier.mjs proves release checklist binding.
- ci/scripts/run_operator_freeze_runbook_execution_order_binding_verifier.mjs proves runbook â†” execution-order binding.
- ci/scripts/run_operator_freeze_runbook_surface_completeness_verifier.mjs proves runbook surface completeness.
- ci/scripts/run_freeze_rollback_compatibility_verifier.mjs proves rollback compatibility with freeze semantics.

## Final rule

If a surface is required for operator freeze execution, verification, rollback compatibility, or handoff,
it must be explicitly named in operator law and must be present in the operator freeze bundle.
## Freeze governance closure artefacts

The freeze-complete operator path depends on the following closure artefacts and they MUST remain present, current, and green:

- docs/releases/V1_FREEZE_PROOF_INDEX.json
- docs/releases/V1_FREEZE_PROOF_CHAIN.json
- docs/releases/V1_FREEZE_DRIFT_STATUS.json
- docs/releases/V1_OPERATOR_FREEZE_BUNDLE_PRESERVATION.json
- docs/releases/V1_FREEZE_PACK_REBUILD_CLEANLINESS.json
- docs/releases/V1_FREEZE_EXIT_CRITERIA.json
- docs/releases/V1_PROMOTION_READINESS.json

A freeze-complete state is invalid if any of the above artefacts are missing, stale, or failing.
