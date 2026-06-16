# S-V1-37 Split and Return Flow

Status: active v1 slice artefact.

Purpose: define the v1 product-layer flow for recording split and return session events.

Boundary: this slice creates factual split and return event records around the S-V1-36 reducer contract. It returns an API result and a presentation handoff. It does not replace v0 persistence.

Included:
- split event flow
- return continue flow
- return skip flow
- resolved return decision rejection
- factual event log append model
- UI handoff for the mobile session execution shell

Excluded:
- live coach mutation
- condition labels
- progress guidance
- communication surfaces
- media surfaces
- billing state
- engine imports
- direct persistence wiring

Invariant:
Split and return are factual events. Return does not mutate prior truth. Return decision rules are deterministic. Replaying a resolved return decision is rejected.

Proof:
- test/s_v1_37_split_return_flow.test.mjs
- ci/guards/s_v1_37_split_return_flow_guard.mjs
- ci/fixtures/v1_split_return_flow/s_v1_37_split_return_flow_cases.json
- copy/split_return_flow_copy.json
