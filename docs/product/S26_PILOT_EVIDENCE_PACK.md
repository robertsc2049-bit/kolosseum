# S26 - Pilot Evidence Pack

Status: v0 aligned
Scope: Deterministic Execution Alpha
Release boundary: Phase 1-6 only
Rewrite policy: rewrite-only
Pack type: factual pilot artefact bundle

## Target

Package all required proof artefacts for one real pilot into one canonical place.

## Invariant

A pilot's v0 legality can be shown from factual artefacts only.

No narrative judgement is permitted.
No advisory wording is permitted.
No outcome claim is permitted.
No interpretation layer is permitted.

## Why now

This turns "we tested it" into "the artefacts are present, ordered, and checkable."

## v0 boundary

This pack belongs to v0 only.

It may contain factual artefacts showing that a pilot was configured, gated, compiled, and executed within the active v0 boundary.

It must not contain or imply:

- Phase 7 truth projection
- Phase 8 evidence sealing
- sealed evidence envelopes
- audit exports
- analytics dashboards
- readiness scoring
- outcome evaluation
- medical claims
- safety claims
- suitability claims
- optimisation claims
- organisation runtime
- team runtime
- unit runtime
- gym runtime

## Canonical pack location

Each real pilot pack must use this folder shape:

- docs/product/pilot_evidence_packs/{pilot_id}/00_manifest/
- docs/product/pilot_evidence_packs/{pilot_id}/01_checklist/
- docs/product/pilot_evidence_packs/{pilot_id}/02_runbook_refs/
- docs/product/pilot_evidence_packs/{pilot_id}/03_green_gate_results/
- docs/product/pilot_evidence_packs/{pilot_id}/04_manual_runtime_proof/
- docs/product/pilot_evidence_packs/{pilot_id}/05_intake_copy_used/
- docs/product/pilot_evidence_packs/{pilot_id}/06_setup_completion_record/
- docs/product/pilot_evidence_packs/{pilot_id}/07_factual_session_artefact_samples/

One pilot means one folder.
No shared pilot folders are permitted.

## Required artefacts

### 00_manifest

Purpose: define the pack contents.

Required files:

- manifest.json
- artefact_index.md

Required manifest fields:

- pilot_id
- pilot_name
- pilot_status
- created_at_utc
- pack_version
- v0_scope
- repo_commit_sha
- source_branch
- ci_run_ids
- coach_ids
- athlete_ids
- phase1_declaration_hashes
- compiled_session_ids
- runtime_session_ids
- blocked_reason

Rules:

- blocked_reason must be null unless the pilot is blocked.
- Every referenced artefact must exist inside the pack or be directly resolvable by repo commit and CI run ID.
- Manifest values are factual only.

### 01_checklist

Purpose: confirm required pilot gate artefacts exist.

Required file:

- checklist.json

Required checklist items:

- payment_confirmed
- workspace_created
- coach_invited
- coach_active
- athlete_invited
- athlete_active
- link_accepted
- scope_locked
- phase1_accepted
- compilation_passed
- coach_can_view_factual_artefact
- coach_note_boundary_confirmed
- no_illegal_surface_exposed

Allowed statuses:

- pass
- fail
- not_applicable
- blocked

Rules:

- Checklist status must be derived from artefacts.
- Manual ticks without supporting artefacts are not accepted.

### 02_runbook_refs

Purpose: identify the lawful operating references used for the pilot.

Required file:

- runbook_refs.json

Required references:

- pilot_start_runbook
- first_compile_eligibility_gate
- coach_managed_athlete_link_truth_model
- live_operator_dashboard_pack
- support_boundary_pack
- v0_scope_definition

Rules:

- References are IDs and file paths only.
- No explanatory layer is permitted.

### 03_green_gate_results

Purpose: show build-level gates passed for the commit used by the pilot.

Required files:

- green_gate_summary.json
- lint_fast_output.txt
- targeted_test_output.txt
- dev_status_output.txt
- github_actions_recent_runs.txt

Required facts:

- repo_commit_sha
- branch
- lint_fast_passed
- targeted_tests_passed
- dev_status_passed
- github_actions_checked

Rules:

- If lint or targeted checks fail, pack status must not be complete.
- Captured command output should be stored raw where practical.

### 04_manual_runtime_proof

Purpose: show runtime execution occurred inside the v0 boundary.

Required files:

- manual_runtime_proof.json
- first_compile_raw_output.json
- runtime_event_log.json

Required facts:

- pilot_id
- athlete_id
- compiled_session_id
- runtime_session_id
- started_at_utc
- completed_at_utc
- runtime_events
- compile_verdict
- execution_verdict

Allowed runtime event classes:

- session_started
- work_item_presented
- set_recorded
- work_skipped
- extra_work_recorded
- substitution_recorded
- split_started
- return_recorded
- partial_completion_recorded
- session_completed
- session_stopped

Rules:

- Runtime proof is factual only.
- Runtime proof must not describe quality, success, readiness, safety, suitability, or improvement.

### 05_intake_copy_used

Purpose: preserve exactly what the user saw before pilot execution.

Required files:

- intake_copy_used.md
- intake_copy_version.json

Required facts:

- copy_surface_id
- copy_version
- captured_at_utc
- source_path
- exact_copy_text

Rules:

- Copy must not include advisory, safety, readiness, optimisation, or outcome claims.
- Copy must be preserved verbatim.

### 06_setup_completion_record

Purpose: show the pilot reached lawful setup completion.

Required file:

- setup_completion_record.json

Required states:

- paid
- workspace_created
- coach_invited
- coach_active
- athlete_invited
- athlete_active
- link_accepted
- scope_locked
- phase1_pending
- phase1_accepted
- compilation_passed
- coach_ready

Required fields per state:

- state
- status
- occurred_at_utc
- source_artefact
- recorded_by

Allowed statuses:

- reached
- not_reached
- blocked
- not_applicable

Rules:

- coach_ready requires all upstream required states to be reached.
- No inferred state transitions are permitted.

### 07_factual_session_artefact_samples

Purpose: provide factual sample artefacts from real pilot session execution.

Required files:

- compiled_session_sample.json
- executed_session_sample.json
- deviation_session_sample.json

Minimum samples:

- one compiled session sample
- one executed session sample
- one deviation or partial-completion sample, if such an event occurred

Rules:

- If no deviation occurred, deviation_session_sample.json must state factual absence only.
- No performance analysis is permitted.

## Completion definition

The S26 pilot evidence pack is complete only when:

- manifest exists
- checklist exists
- runbook refs exist
- green gate results exist
- manual runtime proof exists
- intake copy used exists
- setup completion record exists
- factual session artefact samples exist
- no forbidden v0 leakage exists
- all files use factual language only

## Explicit non-proof

This pack does not prove:

- sealed evidence
- audit export validity
- Phase 7 truth projection
- Phase 8 evidence envelope validity
- outcome improvement
- readiness
- safety
- suitability

Those are not v0 claims.

## Final rule

If a pilot's legality cannot be shown from the artefacts in this pack, the pack is incomplete.