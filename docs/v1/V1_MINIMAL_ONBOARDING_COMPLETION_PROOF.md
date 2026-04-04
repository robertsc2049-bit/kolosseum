# V1 Minimal Onboarding Completion Proof

Document ID: v1_minimal_onboarding_completion_proof
Status: Draft for enforcement
Scope: active v0 onboarding only
Audience: Product / UI / API / CI / review

## Purpose

Prove one lawful onboarding flow completes with the minimum required user burden for each active v0 onboarding entry mode.

## Invariant

- v0 onboarding stays narrow and executable
- onboarding captures only fields required for legality or execution feasibility
- no unused prompts, no pre-emptive downstream prompts, no extra fields

## Accepted entry modes pinned

- individual
- coach_managed

## Proof

- one accepted declaration fixture for individual
- one accepted declaration fixture for coach_managed
- required-field count pinned per fixture
- conditional authority field pinned for coach_managed only
- extra prompts and extra fields fail

## Minimal accepted declaration fields

Pinned minimal individual fixture fields:
- consent_granted
- engine_version
- enum_bundle_version
- phase1_schema_version
- actor_type
- execution_scope
- activity_id
- location_type
- nd_mode
- instruction_density
- exposure_prompt_density
- bias_mode

Pinned additional coach_managed fixture field:
- governing_authority_id

## Final rule

If onboarding requires more than the pinned minimal accepted declaration fields for the relevant v0 entry mode without a lawful schema or contract change, the onboarding surface has drifted.