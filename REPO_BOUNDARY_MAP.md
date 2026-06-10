# REPO BOUNDARY MAP

## Purpose
This document defines the practical ownership boundaries inside the Kolosseum repo.

It exists to stop behaviour leakage across engine, server, UI, CI, docs, and commercial surfaces.

If a file or module crosses a forbidden boundary, the slice is invalid until corrected.

---

## 1. Boundary model

The repo is divided into six primary authority zones:

1. engine
2. server
3. ui / presentation
4. ci / replay / verification
5. docs / contracts
6. product / commercial / access surfaces

These boundaries are not aesthetic.
They exist to preserve determinism, legality separation, and replay-honest behaviour.

---

## 2. Engine boundary

### Engine owns
- phase orchestration
- canonical input handling
- legality and constraint application
- deterministic selection and materialisation
- runtime truth capture
- engine invariants
- replay-coupled outputs within active release scope

### Engine must not read
- payment state
- commercial tier state as execution authority
- presentation-only preferences as behaviour controls
- UI state
- marketing content
- free-text notes
- manual operator opinions
- coach notes
- org metadata unless explicitly lawful and active in current build scope

### Engine examples
Expected surfaces:
- `engine/`
- deterministic shared engine modules
- canonical runtime state machine logic
- phase-specific orchestration code

### Hard rule
If output changes because of UI, payment, notes, or presentation-only flags, the system is invalid.

---

## 3. Server boundary

### Server owns
- API routing
- auth and identity wiring
- persistence orchestration
- request/response transport
- storage and retrieval around engine artefacts
- integration plumbing

### Server must not do
- infer missing declarations
- reinterpret legality
- inject fallback exercise logic
- change engine decisions
- mutate canonical engine artefacts after acceptance
- invent convenience behaviour to make flows pass

### Server examples
Expected surfaces:
- `server/`
- adapters
- API handlers
- persistence glue
- background-safe orchestration that does not change truth

### Hard rule
Server may transport truth.
Server may not author truth.

---

## 4. UI / presentation boundary

### UI owns
- rendering
- navigation
- form presentation
- copy display
- user pacing
- density preferences
- presentation-only affordances

### UI must not do
- change engine outputs
- imply advisory meaning
- infer undeclared data
- add silent defaults for engine-relevant fields
- mask legality failures as soft guidance
- convert forbidden states into “nice” outcomes

### UI examples
Expected surfaces:
- `app/`
- `web/`
- `ui/`
- copy registry callers
- view models that remain engine-inert

### Hard rule
UI may explain what exists.
UI may not create what exists.

---

## 5. CI / replay / verification boundary

### CI owns
- schema enforcement
- registry validation
- grep bans
- deterministic replay checks
- failure token emission
- merge blocking signals

### Replay / verification owns
- proof of deterministic reproduction within declared scope
- byte-level comparison where required
- honest verification boundaries

### CI / replay must not do
- reinterpret product meaning
- silently waive failures
- ignore declared scope
- permit “close enough” behaviour
- backfill missing guarantees in prose

### Expected surfaces
- `ci/`
- `replay/`
- validation scripts
- guard scripts
- deterministic verification harnesses

### Hard rule
If CI or replay cannot prove the boundary, the slice is not complete.

---

## 6. Docs / contract boundary

### Docs own
- declared workflow rules
- authority maps
- release-scope clarification
- implementation contracts where applicable
- PR discipline
- access and offboarding expectations

### Docs must not do
- secretly redefine engine behaviour when subordinate
- expand v0 reachability by wording drift
- leave broader dormant platform material looking current
- contradict canonical naming without explicit demotion or fencing

### Expected surfaces
- root repo docs
- operational docs
- dev workflow docs
- release-scope clarification docs

### Hard rule
Docs are executable governance for humans.
Drift in docs produces real system risk.

---

## 7. Product / commercial / access boundary

### Product / commercial owns
- tier visibility
- access packaging
- seat limits
- non-engine commercial routing
- access lifecycle
- onboarding / offboarding process around humans and systems

### Product / commercial must not do
- alter legality
- alter determinism
- alter replay truth
- grant hidden engine authority
- create execution-side branching through payment state

### Expected surfaces
- billing-adjacent code
- entitlement surfaces
- role and access docs
- admin lifecycle controls

### Hard rule
Money may change visibility.
Money must not change truth.

---

## 8. Cross-boundary allowed flows

The following flows are lawful:

1. UI collects declared inputs -> server transports -> engine validates and executes
2. Engine produces artefacts -> server stores -> UI renders factual outputs
3. CI validates repo state -> PR status blocks or permits merge
4. Replay verifies declared proof scope -> result is surfaced honestly
5. Docs constrain developer and reviewer behaviour without mutating engine truth

---

## 9. Cross-boundary forbidden flows

The following flows are forbidden:

- UI deciding engine behaviour
- server correcting engine truth
- payment state changing execution outputs
- docs silently expanding release scope
- coach notes influencing engine behaviour
- presentation flags altering deterministic outputs
- CI failure ignored because local run looked fine
- replay claims stronger than actual replay coverage
- commercial role implying behavioural authority not declared by active build scope

---

## 10. Practical repo mapping

Use this as the default mental model:

### Engine zone
- `engine/`
- deterministic shared engine logic
- runtime state machine
- phase orchestration

### Server zone
- `server/`
- API transport
- persistence adapters
- auth boundary code

### UI zone
- `app/`
- `web/`
- `ui/`
- user-facing rendering
- copy consumers

### CI / replay zone
- `ci/`
- `replay/`
- checks, guardrails, scripts, fixtures

### Docs zone
- root `.md` governance docs
- release-scope docs
- PR docs
- onboarding / offboarding docs

### Product / access zone
- entitlement / access wiring
- role management surfaces
- billing-adjacent non-engine logic

---

## 11. Boundary checks for every slice

Before merge, ask:

1. Which boundary is this slice allowed to touch?
2. Which boundary must remain untouched?
3. Could this change alter engine truth indirectly?
4. Could this change make docs, UI, or payment look more authoritative than they are?
5. Are tests proving the boundary stayed intact?

If any answer is unclear, the slice is not ready.

---

## 12. Final rule

Repo boundaries are part of the product.

A change is invalid if it:
- leaks behaviour across boundaries
- weakens engine isolation
- weakens CI authority
- hides release-scope drift
- lets non-engine surfaces affect truth

When in doubt:
preserve isolation,
prove the invariant,
and reject convenience leakage.
