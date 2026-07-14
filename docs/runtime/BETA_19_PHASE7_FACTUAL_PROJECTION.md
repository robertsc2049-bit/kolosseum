# BETA-19 Phase 7 Factual Projection

## Status

BETA-19 creates the factual rendered projection built on the BETA-18 Phase 7 schema and binding contract.

It does not widen Phase 7 input. The only truth-bearing source remains the validated Phase 6 output envelope.

## Rendered sections

`rendered_output` contains exactly these required sections:

- `projection_metadata`;
- `program_summary`;
- `session_list`;
- `event_digest`.

`block_summary` is included only when Phase 6 work items contain block facts.

No other rendered section is permitted.

## Projection metadata

Projection metadata echoes:

- canonical input hash;
- selection hash;
- execution status;
- reducer contract ID;
- reducer version;
- reducer-state hash.

The Phase 7 projection ID remains a top-level Phase 7 binding field and is not inserted into the factual rendered content because it is not Phase 6 truth.

## Program summary

Program summary mechanically counts the single Phase 6 session and its recorded:

- blocks;
- work items;
- pending work items;
- active work items;
- completed work items;
- skipped work items;
- pain flags;
- pain follow-ups;
- accepted events.

No programme name, description, objective, judgement, or inferred meaning is created.

## Block summary

Block summary is grouped only from the `block_id` values carried by Phase 6 work-item truth.

Each block contains:

- block ID;
- work-item count;
- work-item status counts;
- ordered work-item IDs;
- ordered exercise IDs.

The projection cannot create a block that is not present in Phase 6.

## Session list

The current Phase 6 truth envelope contains one reducer state for one session.

The session list therefore contains exactly one mechanically projected session row.

The row contains session identity, activity identity, execution status, terminal facts, work-item counts, pain-event counts, and current split facts.

The projection cannot create an additional session.

## Event digest

Event digest echoes accepted event IDs and event-type counts.

It mechanically counts:

- accepted events;
- pain flags;
- pain follow-ups;
- split entries;
- split-return decisions;
- split-continue decisions;
- split-skip decisions;
- work items skipped by split return.

Split-skip decisions are counted from unique Phase 6 terminal event IDs whose terminal source is `split_return_skip`.

Split-continue count is the recorded split-return decision count minus the mechanically identified split-skip decision count.

## Narrative and copy boundary

The projection contains identifiers, hashes, status values, booleans, nulls, arrays, and integer counts only.

It does not read Copy Registry.

It does not include natural-language narrative, advice, interpretation, coaching, recommendations, safety claims, suitability claims, readiness claims, or performance judgement.

Coach notes, payment state, product tier, organisation metadata, UI state, and copy strings remain rejected by the BETA-18 input boundary.

## Validation

Output validation rebuilds the factual projection from the admitted Phase 6 input.

Any invented block, session, section, count, ID, or other value causes:

`phase7_output_invalid`

The existing BETA-18 binding and projection-hash failures remain unchanged.

## V0 compatibility

The legacy v0 scope scanner continues to reject Phase 7 generally.

Only this exact BETA-19 implementation path is excluded:

`engine/src/phases/beta19Phase7FactualProjection.ts`

No directory, wildcard, or broad Phase 7 exclusion is permitted.
