<!-- DEV NOTE: V1 onboarding gate control document. This binds the executable-session entry path to factual account, relationship, and declaration state. It extends the existing onboarding trigger contract and does not add advice, team onboarding, UI, persistence, or engine mutation. -->

# V1 Onboarding Start Gate

Status: active v1 onboarding start-gate boundary document.
Slice: S-V1-19.
Release boundary: v1 First Lawful Run.

## Purpose

This document binds the v1 onboarding start gate.

S-V1-19 prevents an athlete from entering executable session flow unless required factual product states are present.

Required factual states:

- onboarding start was explicitly triggered
- athlete account is active
- individual coach-athlete relationship is accepted
- declaration compile gate admits a current valid accepted declaration

## Existing authority

S-V1-19 extends the existing onboarding trigger contract:

- `shared/pilot-lifecycle/onboardingStartGateContract.mjs`

S-V1-19 reuses existing v1 product-state surfaces:

- athlete account state from S-V1-13
- individual coach-athlete relationship state from S-V1-14 and S-V1-15
- declaration compile-gate state from S-V1-18

S-V1-19 does not replace those surfaces.

## Gate rule

The onboarding start gate must emit factual blocked reason ids only.

Allowed blocked reason ids are:

- `onboarding_start_trigger_missing`
- `onboarding_start_trigger_invalid`
- `athlete_account_missing`
- `athlete_account_inactive`
- `coach_athlete_relationship_missing`
- `coach_athlete_relationship_not_accepted`
- `phase1_declaration_missing`
- `phase1_declaration_not_current_valid`

No blocked reason may imply advice, judgement, safety, suitability, medical meaning, outcome quality, or action recommendation.

## Valid path

The valid path is allowed only when all are true:

1. Onboarding has an explicit lawful trigger event.
2. Athlete account exists and is active.
3. The account is for the same athlete user id.
4. At least one individual coach-athlete relationship exists for the athlete.
5. That relationship is accepted.
6. The current declaration passes the declaration compile gate.
7. Engine-facing probe output is unchanged by onboarding product state.

## Engine boundary

The onboarding gate is product/app state only.

It must not mutate:

- engine input
- engine output
- deterministic compile output
- declaration truth
- relationship truth
- account truth
- runtime events
- planned work items
- registry truth
- replay truth
- proof truth
- evidence truth

## Non-scope

S-V1-19 does not implement:

- recommendations
- coaching advice
- medical clearance
- medical assessment
- diagnosis
- safety judgement
- suitability judgement
- team onboarding
- organisation onboarding
- organization onboarding
- unit onboarding
- federation onboarding
- enterprise onboarding
- UI
- persistence
- assignment
- substitution
- proof implementation
- real compile route mutation
- engine phase mutation

## Failure token

The stable CI failure token for this boundary is:

- `CI_V1_ONBOARDING_START_GATE`

## Proof required

S-V1-19 acceptance requires proof that:

- missing onboarding trigger blocks with factual reason
- missing athlete account blocks with factual reason
- inactive athlete account blocks with factual reason
- missing relationship blocks with factual reason
- non-accepted relationship blocks with factual reason
- missing declaration blocks with factual reason
- invalid declaration compile gate blocks with factual reason
- valid account, relationship, and declaration path is allowed
- blocked reasons are exact and factual
- onboarding state does not mutate engine-facing probe output
- S-V1-13 through S-V1-18 proofs remain green
- v0 active scope remains green

## Final rule

If athlete account state, relationship state, or declaration compile-gate state is missing or invalid, executable session flow must remain blocked using factual blocked reason ids only.

The onboarding gate must not advise, recommend, assess, infer, or mutate engine truth.
