# S-V1-38 Stop, Skip, and Partial Completion

Status: active v1 slice artefact.

Purpose: define the v1 product-layer flow for recording stop, skip, and partial completion session events.

Boundary: this slice creates factual runtime event records around the S-V1-36 reducer contract. It returns an API result, a presentation handoff, and a recorded-event history projection. It does not replace v0 persistence.

Included:
- stop event flow
- skip work-item event flow
- partial completion work-item event flow
- factual quantity payload for partial completion
- recorded-event history projection
- copy lint for factual wording

Excluded:
- judgement language
- scoring
- coaching instruction
- communication surfaces
- media surfaces
- billing state
- engine imports
- direct persistence wiring

Invariant:
Events are factual. Copy remains factual and non-judgemental. History reflects recorded events only.

Proof:
- test/s_v1_38_stop_skip_partial_completion.test.mjs
- ci/guards/s_v1_38_stop_skip_partial_completion_guard.mjs
- ci/fixtures/v1_stop_skip_partial_completion/s_v1_38_stop_skip_partial_completion_cases.json
- copy/stop_skip_partial_completion_copy.json
