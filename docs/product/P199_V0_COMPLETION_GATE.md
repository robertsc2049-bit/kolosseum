# P199 — v0 Completion Gate

- Document ID: P199
- Title: v0 Completion Gate
- Owner: Founder / Product / Ops
- Status: Draft
- Release Applicability: v0 Deterministic Execution Alpha
- Engine Compatibility: EB2-1.0.0
- Rewrite Policy: Rewrite-only
- Last Updated: 2026-04-21

## Target

Create one canonical document that defines the exact exit criteria for v0.

## Invariant

No one can call v0 "done" unless every required proof item is present and green.

## Proof

A single doc plus a machine-readable checklist if useful.

## Why now

This stops drift and prevents fake completion.

## Required green checks

### Repo / engineering baseline
- working tree clean
- local main aligned to origin/main
- npm run dev:status
- npm run lint:fast
- npm run build:fast
- npm run test:unit
- npm run ci:parity
- gh run list --limit 10 shows the latest relevant runs green

### Boundary containment
- no reachable org/team/unit/gym runtime in active v0 path
- no reachable Phase 7 / Phase 8 evidence-export path in active v0 path
- v0 boundary claim consistency guard green
- commercial artefact registry guard green
- sales claim lint green
- current "not included in v0" pack still accurate

### Coach authority containment
- coach may only assign, view factual artefacts, and write non-binding notes
- no coach legality override
- no coach selection override
- no coach direct substitution override
- no coach direct progression override
- no direct coach mutation of Phase 1 truth

### Neutral summary containment
- factual surfaces remain factual only
- no score
- no quality
- no adherence
- no compliance judgement
- no trend
- no insight
- no warning
- no risk
- no readiness
- no recommendation
- no performance evaluation leaking into neutral summary surfaces

### Manual runtime proof
The canonical manual runtime proof checklist must exist and all items must be GREEN.

Required checklist items:
1. athlete onboarding completes successfully
2. individual session compiles and executes
3. coach assigns a session successfully
4. athlete executes assigned session successfully
5. split mid-session works
6. return path offers "Continue where I left off"
7. return path offers "Skip and move on"
8. partial completion remains factual only
9. coach can only assign, view factual artefacts, and write non-binding notes
10. no org/team/unit/gym runtime is reachable in active v0 path
11. no Phase 7/8 evidence-export path is reachable in active v0 path

### Pilot operability closure
- pilot setup can be completed from docs only
- pilot start can be completed from docs only
- blocked-state handling exists
- pause / stop / recovery handling exists
- operator does not need undocumented founder memory to run v0

### Operator pack closure
All required operator docs exist, are current, and do not contradict each other.

## Required docs / proofs

### Canonical completion gate
- docs/product/P199_V0_COMPLETION_GATE.md

### Required proof artefacts
- docs/proofs/v0/v0_manual_runtime_checklist_2026-04-21.md

### Required operator docs
- first paid pilot setup checklist
- pilot start runbook
- pilot status template
- live demo / failure recovery runbook
- current coach boundary pack
- current "not included in v0" boundary pack
- current neutral summary contract

## Required pilot lifecycle states
- accepted
- commercial_pending
- platform_pending
- coach_pending
- athlete_pending
- link_pending
- scope_pending
- phase1_pending
- compile_pending
- coach_ready
- active
- paused
- stopped
- cancelled

## Required operator runbooks
- pilot accepted -> commercial_pending
- commercial_pending -> platform_pending
- platform_pending -> coach_pending
- coach_pending -> athlete_pending
- athlete_pending -> link_pending
- link_pending -> scope_pending
- scope_pending -> phase1_pending
- phase1_pending -> compile_pending
- compile_pending -> coach_ready
- coach_ready -> active
- active -> paused
- active -> stopped
- paused -> active
- paused -> stopped
- blocked state handling
- compile failure handling
- demo/runtime failure recovery
- factual pilot status update process

## Explicit excluded items still not part of v0
- org runtime
- team runtime
- unit runtime
- gym runtime
- messaging
- dashboards beyond bounded factual/operator need
- analytics
- rankings
- readiness scoring
- advisory scoring
- outcome evaluation
- proof export
- evidence export
- audit export
- replay layer
- Phase 7 truth projection
- Phase 8 evidence sealing
- federation runtime
- competition runtime
- hidden authority surfaces
- unsupported coach control
- commercial claims beyond current proof pack

## Final rule

v0 is complete only when every gate in this document is GREEN at the same time. If any required item is missing, stale, contradictory, AMBER, or RED, v0 is not complete.

## Machine-readable checklist

`json
{
  "document_id": "P199",
  "title": "v0 Completion Gate",
  "release_applicability": "v0 Deterministic Execution Alpha",
  "engine_compatibility": "EB2-1.0.0",
  "completion_rule": "all_required_gates_green_simultaneously",
  "required_green_checks": [
    "repo_and_engineering_baseline",
    "boundary_containment",
    "coach_authority_containment",
    "neutral_summary_containment",
    "manual_runtime_proof",
    "pilot_operability_closure",
    "operator_pack_closure"
  ],
  "required_docs_and_proofs": [
    "docs/product/P199_V0_COMPLETION_GATE.md",
    "docs/proofs/v0/v0_manual_runtime_checklist_2026-04-21.md"
  ],
  "required_pilot_lifecycle_states": [
    "accepted",
    "commercial_pending",
    "platform_pending",
    "coach_pending",
    "athlete_pending",
    "link_pending",
    "scope_pending",
    "phase1_pending",
    "compile_pending",
    "coach_ready",
    "active",
    "paused",
    "stopped",
    "cancelled"
  ],
  "required_manual_runtime_checks": [
    "athlete_onboarding_completes_successfully",
    "individual_session_compiles_and_executes",
    "coach_assigns_a_session_successfully",
    "athlete_executes_assigned_session_successfully",
    "split_mid_session_works",
    "return_path_continue_where_i_left_off",
    "return_path_skip_and_move_on",
    "partial_completion_remains_factual_only",
    "coach_only_assigns_views_factual_artefacts_and_writes_non_binding_notes",
    "no_org_team_unit_gym_runtime_reachable",
    "no_phase7_phase8_evidence_export_reachable"
  ],
  "explicit_exclusions_still_out_of_scope": [
    "org_runtime",
    "team_runtime",
    "unit_runtime",
    "gym_runtime",
    "messaging",
    "analytics",
    "rankings",
    "readiness_scoring",
    "proof_export",
    "evidence_export",
    "audit_export",
    "phase7_truth_projection",
    "phase8_evidence_sealing"
  ]
}
`",
  ",
  

Use this structure:

Completion status:
Repo / engineering baseline:
Boundary containment:
Coach authority containment:
Neutral summary containment:
Manual runtime proof:
Pilot operability closure:
Operator pack closure:
Explicit exclusions still out of scope:
Final call: SHIP / HOLD

v0 is complete only if every line above is explicitly GREEN and the final call is SHIP.
