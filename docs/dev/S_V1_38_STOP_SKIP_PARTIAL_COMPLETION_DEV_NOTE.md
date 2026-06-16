# S-V1-38 Developer Note: Stop, Skip, and Partial Completion

The S-V1-38 flow is a product-layer contract around the S-V1-36 reducer. It records STOP_SESSION, SKIP_WORK_ITEM, and PARTIAL_COMPLETE_WORK_ITEM events after replaying the supplied event log.

Developer constraints:
- keep stop, skip, and partial completion as factual runtime events
- keep event append order exact
- reject invalid partial quantity payloads
- reject events after terminal session state
- do not alter prior events
- do not add storage writes to this contract
- do not import engine modules
- do not add judgement language, scoring, or coaching instruction

Docs define law. Tests prove behaviour. Comments explain boundaries. CI blocks drift.
