# BETA-18 Phase 7 Schema and Binding

## Status

BETA-18 defines the closed-world Phase 7 input and output schema for the September controlled beta.

The slice creates schema and binding law only. It does not create interpretation, advice, readiness, safety, ranking, optimisation, evidence sealing, or product-tier behaviour.

## Source boundary

Phase 7 accepts one truth-bearing object:

`phase6_output`

The Phase 6 output contains exactly:

- `canonical_input_hash`;
- `selection_hash`;
- `execution_status`;
- `execution_state`.

The canonical and selection hashes are binding echoes from deterministic upstream engine work. Execution status and execution state are factual Phase 6 runtime truth.

## Forbidden input

Phase 7 rejects:

- coach notes;
- payment or billing state;
- product tier;
- organisation metadata;
- UI or presentation state;
- Copy Registry IDs;
- user-facing copy strings;
- unknown fields.

These fields cannot affect projection content or the projection hash.

## Input schema

`schema/beta18_phase7_input.schema.json` is closed-world and sets `additionalProperties` to false at the Phase 7 input, Phase 6 output, and execution-state levels.

A non-empty `phase7_projection_id` is mandatory.

Missing projection identity fails with:

`phase7_projection_id_missing`

## Output schema

`schema/beta18_phase7_output.schema.json` requires exactly:

- `phase7_projection_id`;
- `canonical_input_hash`;
- `selection_hash`;
- `execution_status`;
- `execution_state`;
- `content_format`;
- `rendered_output`;
- `projection_hash`.

The controlled beta content format is:

`application/json`

## Binding echoes

Output validation requires exact equality for:

- canonical input hash;
- selection hash;
- execution status;
- canonical execution-state bytes.

Canonical input hash echo mismatch, selection hash echo mismatch, execution status echo mismatch, or execution state echo mismatch fails closed.

Any mismatch fails with:

`phase7_binding_mismatch`

## Execution-state integrity

The execution state must:

- identify the BETA-14 Phase 6 runtime reducer;
- contain only the closed reducer-state fields;
- bind its work-item order to its work-item map;
- bind pain follow-up records to the same work items;
- contain factual counts matching work-item state;
- bind terminal classification to terminal status;
- match its deterministic `reducer_state_hash`.

## Rendering

`rendered_output` is canonical JSON generated only from the four Phase 6 truth fields.

It contains no user-facing prose and does not read Copy Registry.

## Projection hash

`projection_hash` is the lowercase SHA-256 hash of every Phase 7 output field except `projection_hash` itself.

Projection hash tampering fails with:

`phase7_projection_hash_mismatch`

## V0 compatibility

The legacy v0 scope scanner continues to reject Phase 7 generally.

Only these two exact BETA-18 paths are excluded from that old scanner:

- `engine/src/phases/beta18Phase7SchemaBinding.ts`;
- `engine/contracts/beta18_phase7_failure_tokens.json`.

No directory, wildcard, or broad Phase 7 exclusion is permitted.
