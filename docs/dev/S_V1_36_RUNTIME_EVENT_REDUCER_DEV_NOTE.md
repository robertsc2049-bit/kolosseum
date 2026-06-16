# S-V1-36 Developer Note: Runtime Event Reducer v1 Contract

The S-V1-36 reducer is a pure contract module. It does not replace the v0 persistence path. It exists so v1 session execution has a closed, tested reducer surface before storage and API wiring are widened.

Developer constraints:
- keep events append-only
- keep replay deterministic
- reject invalid events before state mutation
- keep reducer input limited to factual session and event records
- do not add coach notes, billing state, or UI state to reducer input
- do not import engine modules from this v1 contract surface
- do not add storage writes to the reducer
- do not add clock or random-value reads to the reducer

Docs define law. Tests prove behaviour. Comments explain boundaries. CI blocks drift.
