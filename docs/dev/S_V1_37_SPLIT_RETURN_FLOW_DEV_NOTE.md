# S-V1-37 Developer Note: Split and Return Flow

The S-V1-37 flow is a product-layer contract around the S-V1-36 reducer. It creates factual SPLIT_SESSION, RETURN_CONTINUE, and RETURN_SKIP event records only after replaying the supplied event log.

Developer constraints:
- keep split and return as factual runtime events
- keep event append order exact
- reject resolved return decisions
- do not alter prior events
- do not add storage writes to this contract
- do not import engine modules
- do not add live coach mutation
- do not add billing state or UI state as reducer input

Docs define law. Tests prove behaviour. Comments explain boundaries. CI blocks drift.
