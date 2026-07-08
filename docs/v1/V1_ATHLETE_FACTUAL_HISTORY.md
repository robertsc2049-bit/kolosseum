<!-- DEV NOTE: Developer documentation surface. Executable tests and guards prove behaviour; this note records the S-V1-40 boundary for future maintainers. -->

# V1 Athlete Factual History

Status: active v1 slice record
Slice: S-V1-40
Surface: `v1_athlete_factual_history`

## Purpose

S-V1-40 creates an athlete factual history read model, API adapter, and read-only UI view model.

History shows recorded facts only.

No inference.

Athlete can view own history.

Assigned coach visibility uses the existing `factual_history` relationship permission surface and requires accepted coach-athlete permission state.

## Boundary

In scope:

- athlete factual history read model
- explicit relationship-scoped permission check
- own-athlete history access
- assigned coach factual-history access
- unassigned viewer rejection
- read-only UI view model
- copy-backed labels
- stable byte comparison helper
- target athlete filtering

Out of scope:

- analytics dashboards
- rankings
- readiness labels
- effectiveness claims
- coaching advice
- programme judgement
- live coach intervention
- engine mutation
- runtime event append behaviour
- organisation, team, gym, federation, or marketplace scope

No analytics dashboards, rankings, readiness labels, or effectiveness claims.

## Permission rule

The surface uses `factual_history`.

Allowed:

- athlete actor where `actor.user_id` equals the target athlete id
- coach actor with an accepted individual coach-athlete relationship to the target athlete and explicit factual-history visibility

Rejected:

- other athlete
- unassigned coach
- missing relationship records
- invalid or incomplete input

## Proof

Executable proof:

- `test/s_v1_40_athlete_factual_history.test.mjs`
- `ci/guards/s_v1_40_athlete_factual_history_guard.mjs`
- `ci/fixtures/v1_athlete_factual_history/s_v1_40_athlete_factual_history_cases.json`

Code surfaces:

- `src/athleteFactualHistory.mjs`
- `src/api/athleteFactualHistoryApi.mjs`
- `copy/athlete_factual_history_copy.json`

This slice does not rewrite the older `server/history/historyCounts.*` files. Those remain historical count surfaces; S-V1-40 adds the v1 athlete factual-history surface.
