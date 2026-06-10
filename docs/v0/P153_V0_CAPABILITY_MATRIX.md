# P153 — v0 Capability Matrix

Status: Proposed
Scope: v0 only
Mode: BUILD
Rewrite Policy: rewrite-only

## Target

Generate one hard capability matrix for what v0 does and does not do.

## Invariant

Sales and demo language must not outrun the build.

The matrix is descriptive only.
It does not grant new capability.
If a capability is not supported by the current build target and v0 redefinition, it must not be claimed.

## Source Authorities

- current_build_target_v0
- v0_redefinition

Any contradiction resolves to the narrower interpretation.
If the authorities do not support a claim, the claim must fail.

## Capability Matrix

| capability | status | boundary_note |
| --- | --- | --- |
| onboarding_phase1_to_phase6 | SUPPORTED | limited to active v0 engine path only |
| activity_powerlifting | SUPPORTED | supported in current v0 |
| activity_general_strength | SUPPORTED | supported in current v0 |
| activity_hyrox | SUPPORTED | supported in current v0 |
| compile_program_to_session | SUPPORTED | compile path exists in active v0 |
| session_execution | SUPPORTED | start, progress, and factual session state exist |
| split_return | SUPPORTED | continue and skip are factual runtime outcomes |
| partial_completion | SUPPORTED | partial outcome is part of active v0 session truth |
| coach_assignment | SUPPORTED | coach-operable path exists in active v0 |
| coach_notes_non_binding | SUPPORTED | notes are non-authoritative and outside engine truth |
| factual_read_model_summary | SUPPORTED | factual summary surfaces exist for demo/readback |
| org_team_unit_surfaces | NOT_SUPPORTED | excluded from active v0 |
| gym_runtime_surfaces | NOT_SUPPORTED | excluded from active v0 |
| dashboards_analytics_rankings | NOT_SUPPORTED | excluded from active v0 |
| messaging_social_collaboration | NOT_SUPPORTED | excluded from active v0 |
| readiness_scoring_or_advice | NOT_SUPPORTED | excluded from active v0 |
| exports_evidence_proof_surfaces | NOT_SUPPORTED | phase 7 or 8 proof-facing surfaces are excluded |
| phase7_phase8_runtime_claims | NOT_SUPPORTED | active v0 is phase 1 to 6 only |

## Claim Rules

Allowed claim shape:

- factual
- bounded
- capability-specific
- sourceable to current_build_target_v0 and v0_redefinition

Forbidden claim shape:

- recommends
- optimises
- best
- intelligent
- complete platform
- organisation-ready
- team-ready
- unit-ready
- proof-ready
- evidence-ready

## Completion Rule

This slice is complete only when the capability matrix is pinned to the current build target and v0 redefinition and contradictory or inflated claims fail.