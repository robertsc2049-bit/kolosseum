# S53 — Coach Queue / Review Minimal UI Read Model Renderer

Document class: implementation contract
Status: v0 implementation slice
Authority: subordinate to v0 scope, engine contract, CI gates, public/sales claim guard, S49 coach queue review surface contract, S50 API adapter contract, S51 route contract, S52 fixture pack, and product/design references
Scope: fixture-backed minimal renderer for coach queue review read-model states
Engine impact: none
Does not define: engine behaviour, production routing, storage behaviour, live API behaviour, UI framework adoption, training advice, medical judgement, safety status, readiness certification, ranking, scoring, organisation runtime, team runtime, gym runtime, evidence sealing, or exportable proof

## 1. Purpose

The S53 Coach Queue / Review Minimal UI Read Model Renderer turns known S52 fixture-backed route responses into deterministic, safe HTML strings.

This creates a visual read-model bridge without introducing a live API, route registration, database, network, or production UI framework.

## 2. Current v0 boundary

This slice is allowed in v0 because it is:

- renderer-only
- fixture-backed
- linked-coach scoped
- factual
- engine-inert
- storage-free
- route-registration-free
- deterministic

It must not create:

- production route exposure
- database access
- network access
- live API fetching
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

## 3. Renderer input

The renderer accepts an S51 route response object.

The renderer does not call S51 itself.

The renderer does not read fixture files directly.

Tests may read fixtures and pass route responses into the renderer.

## 4. Renderer output

The renderer returns:

- `surface_id`
- `version`
- `html`

The HTML is a deterministic string.

It may contain:

- title
- coach ID
- queue item count
- item cards
- item status
- athlete ID
- source record refs
- blocked reason IDs
- empty state
- refusal state

It must not contain advice, scoring, ranking, medical, safety, optimisation, or readiness-certification language.

## 5. Copy rules

Allowed user-facing strings:

- Coach queue
- Review required
- Record available
- Blocked
- No review items
- Source records
- Blocked reasons
- Coach ID
- Athlete ID
- Queue item
- Request unavailable
- Required coach identifier missing
- Source unavailable
- Route unavailable
- Method unavailable

## 6. HTML safety

All dynamic text must be escaped.

The renderer must not trust:

- coach ID
- athlete ID
- queue item ID
- source refs
- blocked reason IDs
- error IDs

## 7. Acceptance criteria

Tests must prove:

- primary fixture renders deterministic HTML
- empty fixture renders empty state
- missing coach ID fixture renders refusal state
- rendered HTML contains no forbidden terms
- rendered HTML includes factual status labels
- dynamic values are escaped
- renderer does not mutate input response
- renderer does not import or call S51 route handler
- renderer does not import filesystem, network, database, Express, or browser APIs