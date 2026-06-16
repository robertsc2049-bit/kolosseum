# S-V1-35 Session Start Flow

Status: active v1 slice artefact.

Purpose: define the v1 product-layer flow that starts an athlete session from an assigned compiled session.

Boundary: this slice validates explicit product state and returns a factual session start event model. It also returns a presentation-only UI handoff for the mobile execution shell.

Included:
- session start contract
- start API adapter
- start UI handoff model
- factual SESSION_START event model
- idempotent already-started behaviour
- invalid or missing compiled-state rejection

Excluded:
- ad hoc extra session creation
- coach live mutation
- communication surfaces
- media surfaces
- advisory decision
- compile output mutation
- engine imports
- direct persistence wiring

Invariant:
A session may start only from assigned compiled state. The start event is factual. Repeated start requests return the existing start event when one is supplied.

Proof:
- test/s_v1_35_session_start_flow.test.mjs
- ci/guards/s_v1_35_session_start_flow_guard.mjs
- ci/fixtures/v1_session_start_flow/s_v1_35_session_start_flow_cases.json
- copy/session_start_flow_copy.json
