# v1 Registry Expansion Target Plan

## Status

Accepted as a planning target.

Recorded at UTC: 2026-06-04T16:00:08Z

## Context

The v0 release lane is closed.

The v1 entry lane is open.

The v1 supported activities decision is locked.

v0 release tag: v0.1.24

Immutable v0 release commit: 40cc391fcc92027dbcee8313dc571ea6557b8dec

v1 supported activities decision commit: a0eddf79773d6c9b082ab2a825730dad529368f7

The v0.1.24 tag must not be moved, deleted, overwritten, or force-pushed.

This document defines the v1 registry expansion target only. It does not add registry content, implementation code, templates, UI, auth, billing, proof, export, or commercial surfaces.

## Locked v1 supported activities

v1 registry expansion must cover only:

1. powerlifting
2. general_strength
3. rugby_union

No registry entry may imply support for excluded activities.

## Registry expansion objective

The v1 registry must make the coach-athlete product commercially usable for the locked activity set while keeping the deterministic engine boundary intact.

Registry expansion must provide enough coverage for:

- lawful onboarding and declaration
- programme template construction
- deterministic compile path
- substitution selection
- session execution display
- factual history
- coach factual artefact review
- copy/legal claim control
- CI registry law validation

## Required registry domains

The v1 registry expansion target includes these registry domains:

1. activity registry
2. movement pattern registry
3. exercise registry
4. equipment registry
5. exercise-to-activity applicability
6. exercise-to-equipment compatibility
7. substitution edge registry
8. programme template registry
9. instruction and display copy registry
10. copy/legal claim boundary registry

## Activity registry target

The activity registry must contain exactly the locked v1 supported activities unless a later decision record replaces this one:

- powerlifting
- general_strength
- rugby_union

Each activity must define:

- activity id
- display label
- allowed movement patterns
- allowed exercise families
- allowed equipment classes
- allowed programme template types
- allowed substitution scope
- excluded claim language
- copy/legal boundary notes

## Movement pattern coverage target

The v1 movement pattern registry must cover all movement patterns needed for the locked activity set.

Minimum required movement pattern families:

- squat
- hinge
- horizontal_push
- vertical_push
- horizontal_pull
- vertical_pull
- carry
- brace
- lunge_split_stance
- trunk_rotation_anti_rotation
- sprint_acceleration
- deceleration_change_of_direction
- jump_land
- conditioning_general

Powerlifting must cover at least:

- squat
- hinge
- horizontal_push
- brace
- relevant accessory pull and trunk patterns

General strength must cover at least:

- squat
- hinge
- horizontal_push
- vertical_push
- horizontal_pull
- vertical_pull
- carry
- brace
- lunge_split_stance

Rugby union must cover at least:

- squat
- hinge
- horizontal_push
- vertical_push
- horizontal_pull
- vertical_pull
- carry
- brace
- sprint_acceleration
- deceleration_change_of_direction
- jump_land
- conditioning_general

## Exercise registry target

The v1 exercise registry must provide enough exercises for programme construction and substitution coverage across the locked activity set.

Each exercise must define:

- exercise id
- display label
- movement pattern
- primary activity applicability
- secondary activity applicability where lawful
- equipment requirements
- equipment alternatives
- difficulty tier
- joint stress tags
- stimulus intent
- instruction short text
- optional instruction detail text
- contraindication or exclusion tags where factual and non-medical
- substitution eligibility
- template eligibility
- copy/legal boundary flags

Minimum target coverage:

Powerlifting:

- competition squat pathway
- competition bench pathway
- competition deadlift pathway
- close variants
- paused variants
- tempo variants
- partial range variants
- accessory squat/hinge/push/pull/trunk options

General strength:

- squat pattern options
- hinge pattern options
- horizontal push options
- vertical push options
- horizontal pull options
- vertical pull options
- loaded carry options
- trunk/bracing options
- unilateral lower-body options
- lower-equipment alternatives

Rugby union:

- lower-body strength options
- upper-body strength options
- trunk/bracing options
- acceleration support exercises
- deceleration/change-of-direction support exercises
- jump/landing support exercises
- conditioning-compatible options
- field-sport accessory options

## Equipment registry target

The v1 equipment registry must define equipment needed for the locked activity set without implying gym access, EPOS, facility operations, or marketplace scope.

Minimum equipment classes:

- barbell
- rack
- bench
- plates
- dumbbell
- kettlebell
- cable_machine
- resistance_band
- bodyweight
- pull_up_bar
- trap_bar
- medicine_ball
- sled
- box
- machine_general
- cardio_machine_general
- open_floor_space

Each equipment item must define:

- equipment id
- display label
- equipment class
- activity applicability
- movement pattern applicability
- substitution relevance
- template relevance
- low-equipment alternative relevance
- copy/legal boundary notes

## Substitution registry target

The substitution registry must preserve deterministic selection.

Substitution coverage must define:

- source exercise id
- target exercise id
- movement pattern preservation
- stimulus intent preservation
- equipment downgrade or lateral swap
- excluded equipment handling
- joint stress handling
- activity applicability
- difficulty tier compatibility
- deterministic ordering key

Substitution rules must preserve:

1. safety and explicit constraints first
2. movement intent
3. stimulus intent
4. activity applicability
5. equipment availability
6. difficulty compatibility
7. deterministic tie-break order

No substitution edge may cross into an excluded activity.

No substitution edge may imply optimisation, recommendation, diagnosis, readiness, injury risk, or medical safety.

## Programme template registry target

The v1 programme template registry must support only the locked activity set.

Template families:

Powerlifting:

- novice strength block
- intermediate strength block
- meet-preparation block without unsupported taper claims
- general powerlifting maintenance block

General strength:

- novice general strength block
- intermediate general strength block
- low-equipment general strength block
- return-to-consistent-training block without rehabilitation claims

Rugby union:

- general off-season strength block
- pre-season strength and conditioning block
- in-season maintenance block
- low-equipment field-sport support block

Each template must define:

- template id
- activity id
- intended programme length
- session frequency
- movement pattern coverage
- exercise eligibility
- equipment requirements
- substitution compatibility
- progression mode boundary
- copy/legal boundary notes

Templates must not claim:

- injury prevention
- performance optimisation
- readiness prediction
- fatigue detection
- medical rehabilitation
- sport-wide completeness
- team management
- organisation management

## Copy/legal registry target

The copy/legal boundary registry must provide approved wording for:

- supported activity labels
- unsupported activity refusals
- registry coverage explanations
- substitution explanations
- template boundary explanations
- factual history explanations
- coach review explanations

Allowed language must remain factual:

- supported
- recorded
- declared
- selected
- available
- substituted
- completed
- skipped
- not reached
- reviewed by coach

Forbidden language includes:

- optimal
- recommended
- safe
- injury risk
- readiness
- fatigue
- diagnosis
- rehabilitation
- predicts
- prevents
- improves performance
- guarantees
- sport complete
- all athletes
- all sports

## CI proof target

Future implementation slices must add or update CI checks proving:

- locked supported activity set remains closed
- excluded activities cannot enter active v1 registry
- every exercise maps to a known movement pattern
- every exercise maps to at least one locked activity
- every exercise uses known equipment ids
- every substitution source and target exists
- substitution edges preserve movement pattern
- substitution edges do not cross excluded activities
- templates only reference known exercises
- templates only target locked activities
- copy contains no forbidden claim language
- registry output is deterministic
- no coach notes, auth, billing, UI, or commercial data enter engine truth

## Explicit exclusions

This registry expansion target does not include:

- strongman
- bodybuilding
- weightlifting
- combat sports
- running-specific programming
- cycling-specific programming
- swimming-specific programming
- tactical or uniformed-force-specific packs
- youth-specific packs
- rehabilitation-specific packs
- organisations
- teams
- gyms
- units
- federations
- marketplace
- messaging
- EPOS
- gym access
- enterprise billing
- broad analytics

## Guardrails

Do not alter v0 release tag.

Do not alter package version.

Do not create another release tag.

Do not change engine behaviour in this slice.

Do not add implementation code in this slice.

Do not add registry content in this slice.

Do not add templates in this slice.

Do not widen v1 beyond powerlifting, general_strength, and rugby_union.

## Next lane

The next lane is v1 coach-athlete journey map.

That lane must define the required coach and athlete flows before registry implementation begins.