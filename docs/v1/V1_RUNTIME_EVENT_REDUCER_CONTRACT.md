# S-V1-36 Runtime Event Reducer v1 Contract

Status: active v1 slice artefact.

Purpose: define the v1 runtime event reducer contract for factual session execution events.

Boundary: the reducer accepts a closed session shape and a closed event schema. It applies events in supplied order only and returns a replayable factual state.

Included:
- v1 runtime event schema
- pure reducer state initialisation
- append-only event log helper
- replay from recorded event list
- invalid event fail-closed behaviour
- duplicate event and duplicate terminal work-item rejection
- split return continue and return skip handling

Excluded:
- coach notes as reducer input
- billing state as reducer input
- UI state as reducer input
- storage writes
- clock reads
- random values
- engine imports
- live coach mutation

Invariant:
Events are append-only. The reducer is deterministic. Invalid events fail closed. Replaying the same event list returns the same state.

Proof:
- test/s_v1_36_runtime_event_reducer.test.mjs
- ci/guards/s_v1_36_runtime_event_reducer_guard.mjs
- ci/fixtures/v1_runtime_event_reducer/s_v1_36_runtime_event_reducer_cases.json
