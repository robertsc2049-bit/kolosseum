# S51 — Coach Queue / Review Route Contract

Document class: implementation contract
Status: v0 implementation slice
Authority: subordinate to v0 scope, engine contract, CI gates, public/sales claim guard, S49 coach queue review surface contract, S50 coach queue review API adapter contract, and product/design references
Scope: route/handler-level contract for the coach queue review surface using fake/in-memory source wiring
Engine impact: none
Does not define: engine behaviour, Express app registration, production routing, storage behaviour, UI, training advice, medical judgement, safety status, readiness certification, ranking, scoring, organisation runtime, team runtime, gym runtime, evidence sealing, or exportable proof

## 1. Purpose

The S51 Coach Queue / Review Route Contract defines a narrow handler-level route surface over the S50 adapter.

This slice creates a stable request-to-response contract that later API wiring can use without coupling UI or production routing into the current work.

This is not a live registered route.

## 2. Current v0 boundary

This slice is allowed in v0 because it is:

- linked-coach scoped
- factual
- handler-level only
- fake/in-memory source only
- engine-inert
- storage-free
- UI-free
- deterministic

It must not create:

- Express app registration
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

## 3. Route identity

Logical route:

- `GET /v0/coach/queue-review`

This route identity is contractual only in this slice.

No Express route is registered by S51.

## 4. Request contract

The handler accepts a route request object with:

- `method`
- `path`
- `query`

The only meaningful query field is:

- `coach_id`

Allowed method:

- `GET`

Allowed path:

- `/v0/coach/queue-review`

## 5. Response contract

Successful response:

- HTTP status `200`
- body is the successful S50 adapter response

Missing coach ID:

- HTTP status `400`
- body is the S50 adapter refusal response with `coach_id_required`

Wrong method:

- HTTP status `405`
- body error is `method_not_allowed`

Wrong path:

- HTTP status `404`
- body error is `route_not_found`

Source failure:

- HTTP status `503`
- body error is `source_unavailable`

## 6. Source wiring

S51 uses a provided fake/in-memory source.

The handler must not:

- create storage
- read storage
- call a network
- use current time
- use randomness
- mutate source records
- mutate engine data
- infer missing data

## 7. Prohibited output fields

The handler response must not output:

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

## 8. Acceptance criteria

Tests must prove:

- GET with valid coach ID returns HTTP 200
- handler filters by coach ID via S50 adapter
- missing coach ID returns HTTP 400
- blank coach ID returns HTTP 400
- wrong method returns HTTP 405
- wrong path returns HTTP 404
- source failure returns HTTP 503
- blocked S49/S50 record is returned without advice
- handler response contains no forbidden fields
- handler does not mutate source records