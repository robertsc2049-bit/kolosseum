# V1 Slice Register

This folder exists to keep V1 work narrow, explicit, and testable.

## Rules

- One slice = one narrow objective
- Every slice must define invariants
- Every slice must define explicit inputs/outputs
- Every slice must define test requirements
- Every slice must define done criteria
- Do not mix plumbing cleanups with product behavior unless unavoidable
- Prefer slices that produce stable contracts before broad UI work

## Current ordered slices

1. `V1_SLICE_001_DECISION_SUMMARY_READBACK.md`
   - Goal: lock single-run coach session decision summary readback by `run_id`

2. `V1_SLICE_002_DECISION_SUMMARY_HTTP_CONTRACT.md`
   - Goal: expose the decision summary readback through one stable read-only API handler/endpoint contract by `run_id`

## Operating intent

V1 should progress through small slices that:
- reduce ambiguity
- increase auditability
- preserve deterministic behavior
- keep repo/main green
- avoid hidden scope growth
