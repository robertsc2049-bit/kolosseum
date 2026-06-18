# S-V1-R-02 Factual Weekly Summary

## Purpose

This slice defines a deliberately activated factual weekly summary.

It is a controlled-launch support surface only. It may create a product-layer activation record and generate a weekly summary from supplied recorded session rows.

## Boundary

Included:

- factual summary generator
- summary copy
- tests and CI guard
- generated index and checksum refresh

Excluded:

- coach judgement wording
- completion scoring
- comparative ordering
- training-effect wording
- inferred next steps
- any change to deterministic engine truth

## Invariants

The summary reports recorded facts only.

The summary requires deliberate activation.

The summary cannot alter engine input, engine output, runtime events, replay, proof, substitution, factual history, or coach-athlete relationship authority.

The summary copy must remain copy-registry-backed and factual.

## Accepted copy

- Weekly summary
- No recorded sessions are present for this selected week.
- This summary reports recorded facts only.

## Count fields

The summary may report only explicit counts from supplied recorded session rows:

- recorded_session_count
- completed_session_count
- stopped_session_count
- split_event_count
- returned_event_count
- completed_work_item_count
- skipped_work_item_count
- partial_work_item_count
- substitution_count

## Proof

Required proof for this slice:

- summary fixture test
- copy lint
- no-coupling test
- S-V1-R-02 guard
- standard generated index and checksum refresh