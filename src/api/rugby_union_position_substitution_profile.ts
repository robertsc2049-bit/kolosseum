// DEV NOTE: service/UI-layer-only exercise exclusion data, consulted exactly
// once inside buildV1SubstitutionInput() (session_substitution_registry.ts)
// to narrow which already activity-eligible substitution edge target gets
// offered for display. Not a sealed S-REG content registry - carries no
// independent applicability authority, never enters phase1_input, compiled
// programme output, or v1SubstitutionEngineContract.mjs's exact-keyed input
// object (see docs/roadmap/V1_ENGINE_UI_AUTH_BOUNDARY.md - "athlete profile
// display state" stays engine-invisible; this narrowing only ever affects
// which exercise the substitution service surfaces, never engine truth).
//
// Content is a starting point for a coaching-content owner to review and
// refine, not a final word - the general shape (front row deprioritises
// reactive jump-landing patterns, ball-carrying backs deprioritise heavy
// static bilateral carries) is defensible S&C reasoning but not the only
// valid one. The narrowing this feeds is safe by construction even if a
// given entry turns out to be wrong: it can only ever remove candidates
// from an already-lawful pool, never add one, and the caller falls back to
// the unnarrowed pool whenever narrowing would empty it out.

export type RugbyUnionPositionExclusionEntry = Readonly<{
  activity_id: "rugby_union";
  position: string;
  excluded_movement_pattern_ids?: readonly string[];
  excluded_exercise_ids?: readonly string[];
  copy_boundary_notes: string;
}>;

const FRONT_ROW_NOTES =
  "front-row profile deprioritises reactive jump-landing patterns as a swapped-in alternative";
const BALL_CARRIER_NOTES =
  "ball-carrying-back profile deprioritises heavy static bilateral carries as a swapped-in alternative";

export const RUGBY_UNION_POSITION_SUBSTITUTION_PROFILE: Readonly<
  Record<string, RugbyUnionPositionExclusionEntry>
> = Object.freeze({
  rugby_union__loosehead_prop: Object.freeze({
    activity_id: "rugby_union",
    position: "loosehead_prop",
    excluded_movement_pattern_ids: Object.freeze(["jump_vertical", "jump_horizontal"]),
    copy_boundary_notes: FRONT_ROW_NOTES
  }),
  rugby_union__tighthead_prop: Object.freeze({
    activity_id: "rugby_union",
    position: "tighthead_prop",
    excluded_movement_pattern_ids: Object.freeze(["jump_vertical", "jump_horizontal"]),
    copy_boundary_notes: FRONT_ROW_NOTES
  }),
  rugby_union__hooker: Object.freeze({
    activity_id: "rugby_union",
    position: "hooker",
    excluded_movement_pattern_ids: Object.freeze(["jump_vertical", "jump_horizontal"]),
    copy_boundary_notes: FRONT_ROW_NOTES
  }),
  rugby_union__lock: Object.freeze({
    activity_id: "rugby_union",
    position: "lock",
    excluded_movement_pattern_ids: Object.freeze(["jump_horizontal"]),
    copy_boundary_notes: "second-row profile deprioritises horizontal-bound jump patterns as a swapped-in alternative"
  }),
  rugby_union__flanker: Object.freeze({
    activity_id: "rugby_union",
    position: "flanker",
    copy_boundary_notes: "back-row hybrid profile - no exclusions for v1"
  }),
  rugby_union__number8: Object.freeze({
    activity_id: "rugby_union",
    position: "number8",
    copy_boundary_notes: "back-row hybrid profile - no exclusions for v1"
  }),
  rugby_union__scrum_half: Object.freeze({
    activity_id: "rugby_union",
    position: "scrum_half",
    excluded_movement_pattern_ids: Object.freeze(["carry_bilateral"]),
    copy_boundary_notes: BALL_CARRIER_NOTES
  }),
  rugby_union__fly_half: Object.freeze({
    activity_id: "rugby_union",
    position: "fly_half",
    excluded_movement_pattern_ids: Object.freeze(["carry_bilateral"]),
    copy_boundary_notes: BALL_CARRIER_NOTES
  }),
  rugby_union__centre: Object.freeze({
    activity_id: "rugby_union",
    position: "centre",
    copy_boundary_notes: "midfield profile - no exclusions for v1"
  }),
  rugby_union__wing: Object.freeze({
    activity_id: "rugby_union",
    position: "wing",
    excluded_movement_pattern_ids: Object.freeze(["carry_bilateral"]),
    copy_boundary_notes: BALL_CARRIER_NOTES
  }),
  rugby_union__fullback: Object.freeze({
    activity_id: "rugby_union",
    position: "fullback",
    excluded_movement_pattern_ids: Object.freeze(["carry_bilateral"]),
    copy_boundary_notes: BALL_CARRIER_NOTES
  })
});
