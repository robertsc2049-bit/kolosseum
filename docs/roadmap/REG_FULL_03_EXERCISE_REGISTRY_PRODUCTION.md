# REG-FULL-03 - Exercise Registry Production

## Status
Production content slice for the locked v1 activity set: `powerlifting`, `general_strength`, and `rugby_union`.

## Production closure
REG-FULL-03 replaces the 19-row seed exercise surface with a 215-exercise production universe. It preserves every pre-existing exercise ID and closes all 54 REG-FULL-02 movement patterns with explicit exercise content.

The resulting active surface contains:
- 215 exercise records;
- 4 controlled exercise-name token records (the three historical S-REG-31 tokens plus `front_plank_token`);
- 1,785 explicit exercise/activity/context applicability records;
- 165 powerlifting-applicable exercises across 41 canonical movement patterns;
- 215 general-strength-applicable exercises across all 54 canonical movement patterns;
- 215 rugby-union-applicable exercises across all 54 canonical movement patterns.

## Powerlifting content
Powerlifting includes the three competition lifts and substantial training variants: high-bar and low-bar squat, paused/tempo/box/pin squat, front squat, sumo/paused/tempo/deficit/block/rack/partial deadlift, Romanian deadlift, good morning, paused/tempo/close-grip/Spoto/pin/floor bench press, plus row, pull, triceps, grip, carry and trunk-support work.

Only `back_squat`, `bench_press`, and `deadlift` are marked allowed in the `powerlifting` `competition` applicability context. Training variants remain explicit training/testing content rather than being mislabeled as competition exercises.

## General strength content
General strength has substantial bilateral and unilateral squat/hinge coverage; horizontal, incline, decline, vertical and angled pushes; horizontal and vertical pulls; shoulder/scapular and arm accessories; bilateral/unilateral carries; anti-extension, anti-rotation and anti-lateral-flexion trunk work; isolation work; locomotion; jumping; sprint support; medicine-ball work; and conditioning-compatible records.

## Rugby union content
Rugby union includes the strength surface plus explicit acceleration, maximum-velocity sprinting, deceleration, change-of-direction, vertical/horizontal jump and landing-control work, crawling/locomotion, medicine-ball field-support work, and cyclical/row/sled conditioning records.

## Per-exercise required metadata
Every exercise explicitly carries the S-V1-21 canonical fields plus the existing runtime execution fields. Instructions include a short instruction, at least three detailed execution steps, at least three coaching cues and at least three common faults. Equipment requirements and alternatives are checked both against the active equipment registry and the movement-scoped equipment vocabulary.

`stimulus_intent` remains `strength` because REG-FULL-02 deliberately preserved the current activity stimulus vocabulary. REG-FULL-03 does not silently widen activity law.

## Applicability and substitution boundary
Every declared exercise/activity pair has explicit `training`, `testing`, and `competition` records. Training is allowed for every declared pair. Testing is allowed only for the production testable movement families. Competition is allowed only for the three powerlifting competition lifts; other rows are explicitly prohibited rather than omitted.

Each exercise carries `substitution_eligibility`, and each applicability row carries `substitution_applicability`. REG-FULL-03 does **not** create final substitution edges. The authoritative `substitution_registry` remains reserved for REG-FULL-06, as required by the REG-FULL-00 surface authority.

## Historical activation compatibility
S-REG-31 and S-REG-33 remain historical activation proofs. REG-FULL-03 must not rewrite their historical activation record counts. Their executable validators may be adjusted only so historical counts validate the historical activation baseline while later authorised registry expansion is permitted and still fully FK/coverage checked.

## Acceptance
REG-FULL-03 is accepted only when its exact production validator and negative tests pass, registry law and bundle guards pass, generated evidence is refreshed through canonical writers, and authoritative GitHub CI is green.
