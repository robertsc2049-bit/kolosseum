# S50 — Coach Queue / Review API Adapter

Document class: implementation contract
Status: v0 implementation slice
Authority: subordinate to v0 scope, engine contract, CI gates, public/sales claim guard, S49 coach queue review surface contract, and product/design references
Scope: narrow API-style adapter over the S49 pure coach queue review builder
Engine impact: none
Does not define: engine behaviour, storage behaviour, Express routing, UI, training advice, medical judgement, safety status, readiness certification, ranking, scoring, organisation runtime, team runtime, gym runtime, evidence sealing, or exportable proof

## 1. Purpose

The S50 Coach Queue / Review API Adapter exposes the S49 coach queue review builder through a narrow platform adapter.

The adapter exists so later UI/API work can consume a stable response shape without directly coupling to source records.

This slice uses fake/in-memory source data only.

## 2. Current v0 boundary

This slice is allowed in v0 because it is:

- linked-coach scoped
- factual
- platform-only
- engine-inert
- storage-free
- UI-free
- deterministic

It must not create:

- public claim surface
- organisation dashboard
- team dashboard
- gym dashboard
- medical readiness status
- safety status
- athlete ranking
- score
- recommendation
- training advice
- autonomous coach authority
- evidence seal
- exportable proof

## 3. Adapter input

The adapter accepts a request object with:

- `coach_id`

No other request field has product meaning.

If `coach_id` is missing or blank, the adapter refuses the request.

## 4. Adapter source

The adapter uses a provided in-memory source with one method:

- `listCoachQueueReviewItems()`

The source returns S49 queue input items.

The source must not:

- read a database
- call a network
- use current time
- mutate records
- infer missing records
- create engine output

## 5. Adapter output

Successful response:

- `ok: true`
- `surface_id: "coach_queue_review_api_adapter"`
- `version: "1.0.0"`
- `coach_id`
- `items`

Refusal response:

- `ok: false`
- `surface_id: "coach_queue_review_api_adapter"`
- `version: "1.0.0"`
- `error`

Allowed errors:

- `coach_id_required`
- `source_unavailable`

No other errors are part of this slice.

## 6. Filtering rule

The adapter filters source items by exact `coach_id`.

A coach must not receive queue items belonging to another coach.

## 7. Sorting rule

The adapter delegates status derivation and deterministic sorting to the S49 builder.

It must not reorder output after the builder returns it.

## 8. Prohibited output fields

The adapter must not output:

- score
- rank
- readiness
- readiness_certification
- safety
- medical
- optimisation
- optimization
- advice
- best_action
- recommendation

## 9. Acceptance criteria

Tests must prove:

- missing coach ID is refused
- blank coach ID is refused
- adapter filters records by coach ID
- adapter delegates status derivation to S49 builder
- adapter returns deterministic queue order
- adapter returns blocked records from S49 builder without advice
- source failure returns `source_unavailable`
- adapter output contains no forbidden fields
- in-memory source returns copies, not shared mutable records
- adapter does not mutate source records