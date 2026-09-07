/**
 * DEV NOTE:
 * Purpose: Single source of truth for v1's growing supported-activity set - the
 * id, display label, event types, and programme-template family ids every
 * consumer (guards, registry pipeline scripts, server constants, UI dropdowns)
 * previously re-declared independently.
 * Boundary: This module describes product-facing activity metadata only. It
 * must never be imported by v0-era engine/declaration-surface code, which
 * stays permanently locked to its own frozen 3-activity set regardless of how
 * many v1 activities this list grows to.
 * Determinism: The array is static, frozen, and ordered; consumers must not
 * re-sort or mutate it before reading.
 * Failure: Adding an activity means appending one record here - it does not
 * by itself widen any of the deliberate governance-lock guards
 * (v1_locked_activity_set_guard.mjs, s_v1_20_supported_activity_set_lock_guard.mjs)
 * which require their own independently hand-typed literal to be bumped on
 * purpose.
 */

/**
 * @typedef {Readonly<{ event_type_id: string, display_label: string }>} V1ActivityEventType
 * @typedef {Readonly<{
 *   activity_id: string,
 *   display_label: string,
 *   event_types: readonly V1ActivityEventType[],
 *   programme_template_family_ids: readonly string[]
 * }>} V1ActivityConfig
 */

/** @type {readonly V1ActivityConfig[]} */
const V1_ACTIVITIES = Object.freeze([
  Object.freeze({
    activity_id: "powerlifting",
    display_label: "Powerlifting",
    event_types: Object.freeze([
      Object.freeze({ event_type_id: "powerlifting_meet", display_label: "Powerlifting meet" }),
      Object.freeze({ event_type_id: "strength_event", display_label: "Strength event" }),
      Object.freeze({ event_type_id: "test_day", display_label: "Test day" }),
      Object.freeze({ event_type_id: "other", display_label: "Other event" })
    ]),
    programme_template_family_ids: Object.freeze([
      "powerlifting_novice",
      "powerlifting_intermediate",
      "powerlifting_maintenance",
      "powerlifting_meet_prep"
    ])
  }),
  Object.freeze({
    activity_id: "general_strength",
    display_label: "General strength",
    event_types: Object.freeze([
      Object.freeze({ event_type_id: "strength_event", display_label: "Strength event" }),
      Object.freeze({ event_type_id: "test_day", display_label: "Test day" }),
      Object.freeze({ event_type_id: "other", display_label: "Other event" })
    ]),
    programme_template_family_ids: Object.freeze([
      "general_strength_novice",
      "general_strength_intermediate",
      "general_strength_low_equipment"
    ])
  }),
  Object.freeze({
    activity_id: "rugby_union",
    display_label: "Rugby union",
    event_types: Object.freeze([
      Object.freeze({ event_type_id: "rugby_match", display_label: "Rugby match" }),
      Object.freeze({ event_type_id: "rugby_tournament", display_label: "Rugby tournament" }),
      Object.freeze({ event_type_id: "test_day", display_label: "Test day" }),
      Object.freeze({ event_type_id: "other", display_label: "Other event" })
    ]),
    programme_template_family_ids: Object.freeze([
      "rugby_union_off_season",
      "rugby_union_pre_season",
      "rugby_union_in_season",
      "rugby_union_low_equipment"
    ])
  }),
  Object.freeze({
    activity_id: "strongman",
    display_label: "Strongman",
    event_types: Object.freeze([
      Object.freeze({ event_type_id: "strongman_competition", display_label: "Strongman competition" }),
      Object.freeze({ event_type_id: "strength_event", display_label: "Strength event" }),
      Object.freeze({ event_type_id: "test_day", display_label: "Test day" }),
      Object.freeze({ event_type_id: "other", display_label: "Other event" })
    ]),
    programme_template_family_ids: Object.freeze([
      "strongman_novice",
      "strongman_intermediate",
      "strongman_low_equipment"
    ])
  })
]);

/** @type {readonly string[]} */
const V1_ACTIVITY_IDS = Object.freeze(V1_ACTIVITIES.map((activity) => activity.activity_id));

/** @type {Readonly<Record<string, V1ActivityConfig>>} */
const V1_ACTIVITIES_BY_ID = Object.freeze(
  Object.fromEntries(V1_ACTIVITIES.map((activity) => [activity.activity_id, activity]))
);

/**
 * FUNCTION NOTE:
 * Export: getV1ActivityConfig
 * Purpose: Looks up the full config record (label, event types, programme
 * template family ids) for one v1 activity id.
 * Inputs: Use the explicit caller-provided activity id only; do not infer or
 * default to any activity.
 * Output: Returns the frozen config record, or undefined when the id is not
 * a currently supported v1 activity.
 * Boundary: This export only reads the static activity list; it must not be
 * used to widen, filter, or bypass assertActivityIsV1Supported's own check.
 * Determinism: The same activity id always returns the same record reference.
 * Failure: Returns undefined rather than throwing, so callers that need a
 * hard failure must still call assertActivityIsV1Supported explicitly.
 */
export function getV1ActivityConfig(activityId) {
  return V1_ACTIVITIES_BY_ID[activityId];
}

export { V1_ACTIVITIES, V1_ACTIVITY_IDS, V1_ACTIVITIES_BY_ID };
