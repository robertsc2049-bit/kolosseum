<!-- DEV NOTE: V1 exclusion-control surface. This document prevents accidental feature creep. It does not create product authority or change engine, registry, commercial, or CI law. -->

# V1 Not In Scope

Status: active v1 exclusion-control document.
Release name: First Lawful Run.
Slice: S-V1-00.

## Purpose

This document lists features, behaviours, claims, and surfaces that must not be implemented as v1 unless a deliberate boundary-change slice rewrites the v1 release boundary, acceptance gate, authority map, and relevant guards.

Silence is not permission.

## Excluded roles and execution scopes

The following are not active v1 runtime scope unless a later boundary rewrite explicitly activates them:

- organisation runtime
- team runtime
- unit runtime
- gym runtime
- federation runtime
- state runtime
- PTI runtime
- team-admin runtime
- unit-admin runtime
- organisation-admin runtime

Documentation may mention dormant future roles only as dormant, not active.

## Excluded product capabilities

V1 must not include:

- marketplace
- coach marketplace
- athlete marketplace
- programme marketplace
- programme royalties engine
- messaging or chat
- in-app social feed
- friends or train-together flows
- broad analytics dashboards
- team dashboards
- organisation dashboards
- unit dashboards
- federation dashboards
- gym dashboards
- gym access control
- door access
- code scanner access
- EPOS
- stock or retail flows
- education platform
- media platform
- event ticketing
- workshop ticketing
- supplement sales
- apparel sales
- enterprise account management
- enterprise billing
- HR integrations
- medical integrations

## Excluded engine behaviours

V1 must not include:

- optimisation
- recommendations
- coaching advice
- automatic coaching decisions
- behavioural judgement
- user ranking
- athlete comparison ranking
- programme quality scoring
- adherence scoring
- fatigue scoring
- readiness scoring
- risk scoring
- safety scoring
- suitability scoring
- capability inference
- predictive modelling
- causal inference
- automatic progression based on inferred success
- automatic return-to-play decision
- automatic return-to-run decision
- automatic fitness-for-duty decision
- automatic operational-readiness decision

## Excluded language

V1 user-facing copy, docs, UI, marketing, support, and release notes must not claim or imply:

- safe
- safer
- safety
- suitable
- suitability
- ready
- readiness
- cleared
- can run
- return to play
- return to run
- fit for duty
- deployment ready
- operationally ready
- recommended
- optimal
- best
- proven
- prevents injury
- reduces risk
- protects
- fixes
- corrects
- resolves pain
- rehabilitation
- treatment
- diagnosis
- medical assessment

These terms may appear only inside tests, guards, claim-ban fixtures, or boundary documents where they are explicitly listed as forbidden language.

## Metric Threshold Marker exclusion

The Metric Threshold Marker Engine is not v1 core scope.

Metric foundation may be built in v1 only if deliberately sliced and kept factual.

Forbidden metric outputs include:

- ability conclusions
- readiness conclusions
- suitability conclusions
- safety conclusions
- return-to-play conclusions
- return-to-run conclusions
- fitness-for-duty conclusions
- operational-readiness conclusions
- deployment-readiness conclusions
- recommended interventions

Permitted future marker statuses are factual statuses only:

- recorded_met
- recorded_not_met
- not_recorded
- invalid_source
- insufficient_recorded_data

## Commercial exclusions

V1 must not include:

- multi-entity billing
- enterprise procurement flows
- organisation governance dashboards
- coach revenue share automation
- royalty calculation
- pack similarity enforcement
- protected formula visibility
- sales dashboards
- broad commercial analytics
- automated upsell logic that changes engine access mid-session

A payment path may exist for controlled launch, but payment state must never alter engine truth.

## Proof and export exclusions

V1 must not represent proof as:

- correctness
- coaching validity
- athlete ability
- training effectiveness
- medical clearance
- safety clearance
- suitability clearance
- operational approval
- external certification

Proof may show process integrity only.

## Final exclusion rule

If a feature is listed here, it must remain absent, dormant, or explicitly blocked until a later release-boundary rewrite activates it.### Commercial rollout exceptions (2026-06-13)

The following features are **now permitted** and removed from the exclusion list, subject to copy/claim bans and zero impact on engine truth:

* Stripe self-serve purchase & seat management
* Public status page + error tracking
* Legal doc surfaces (Terms, Privacy, DPA, GDPR export/delete)
* Email session reminders + weekly digest