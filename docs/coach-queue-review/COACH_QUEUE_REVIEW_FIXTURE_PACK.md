# S52 — Coach Queue / Review Read Model Fixture Pack

Document class: fixture contract
Status: v0 implementation slice
Authority: subordinate to v0 scope, engine contract, CI gates, public/sales claim guard, S49 coach queue review surface contract, S50 coach queue review API adapter contract, S51 coach queue review route contract, and product/design references
Scope: stable fake fixture records and expected route responses for the coach queue review surface
Engine impact: none
Does not define: engine behaviour, production routing, storage behaviour, UI, training advice, medical judgement, safety status, readiness certification, ranking, scoring, organisation runtime, team runtime, gym runtime, evidence sealing, or exportable proof

## 1. Purpose

The S52 fixture pack creates stable fake source records and expected outputs for the coach queue review surface.

The fixture pack exists so future UI and API work can be built against known product states before any rendering or production route wiring is added.

## 2. Current v0 boundary

This slice is allowed in v0 because it is:

- fixture-only
- linked-coach scoped
- factual
- engine-inert
- storage-free
- UI-free
- deterministic

It must not create:

- production route exposure
- database access
- network access
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

## 3. Fixture files

This slice adds:

- `test/fixtures/coach-queue-review/source_records.json`
- `test/fixtures/coach-queue-review/expected_route_responses.json`

The source records file contains fake in-memory S49 source records.

The expected route responses file contains deterministic S51 route responses for known coach requests.

## 4. Required fixture states

The fixture pack must include:

- one linked coach record with `review_required`
- one linked coach record with `available`
- one blocked record caused by revoked link
- one blocked record caused by missing source refs
- one record belonging to another coach that must be filtered out
- one empty queue response for a coach with no matching records
- one missing coach ID refusal response

## 5. Determinism

Expected responses must be deterministic.

The queue order must follow S49 order:

1. `review_required`
2. `blocked`
3. `available`

Within each status group, order by `athlete_id`, then `queue_item_id`.

## 6. Prohibited fixture output fields

Fixture outputs must not contain:

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

## 7. Acceptance criteria

Tests must prove:

- fixture source records match expected successful route output
- queue order is deterministic
- coach filtering excludes other-coach records
- empty queue fixture is stable
- missing coach ID fixture is stable
- expected fixture outputs contain no forbidden fields
- fixture source records are not mutated by route handling
- fixture JSON is valid and readable