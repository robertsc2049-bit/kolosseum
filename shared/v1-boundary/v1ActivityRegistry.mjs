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
  }),
  Object.freeze({
    activity_id: "hyrox",
    display_label: "Hyrox",
    event_types: Object.freeze([
      Object.freeze({ event_type_id: "hyrox_race", display_label: "Hyrox race" }),
      Object.freeze({ event_type_id: "hyrox_simulation", display_label: "Hyrox simulation" }),
      Object.freeze({ event_type_id: "test_day", display_label: "Test day" }),
      Object.freeze({ event_type_id: "other", display_label: "Other event" })
    ]),
    programme_template_family_ids: Object.freeze([
      "hyrox_novice",
      "hyrox_intermediate",
      "hyrox_race_prep"
    ])
  }),
  Object.freeze({
    activity_id: "crossfit",
    display_label: "CrossFit",
    event_types: Object.freeze([
      Object.freeze({ event_type_id: "crossfit_competition", display_label: "CrossFit competition" }),
      Object.freeze({ event_type_id: "wod_event", display_label: "WOD event" }),
      Object.freeze({ event_type_id: "test_day", display_label: "Test day" }),
      Object.freeze({ event_type_id: "other", display_label: "Other event" })
    ]),
    programme_template_family_ids: Object.freeze([
      "crossfit_novice",
      "crossfit_intermediate",
      "crossfit_low_equipment"
    ])
  }),
  Object.freeze({
    activity_id: "football_soccer",
    display_label: "Football",
    event_types: Object.freeze([
      Object.freeze({ event_type_id: "football_soccer_match", display_label: "Football match" }),
      Object.freeze({ event_type_id: "football_soccer_tournament", display_label: "Football tournament" }),
      Object.freeze({ event_type_id: "test_day", display_label: "Test day" }),
      Object.freeze({ event_type_id: "other", display_label: "Other event" })
    ]),
    programme_template_family_ids: Object.freeze([
      "football_soccer_off_season",
      "football_soccer_pre_season",
      "football_soccer_in_season",
      "football_soccer_low_equipment"
    ])
  }),
  Object.freeze({
    activity_id: "netball",
    display_label: "Netball",
    event_types: Object.freeze([
      Object.freeze({ event_type_id: "netball_match", display_label: "Netball match" }),
      Object.freeze({ event_type_id: "netball_tournament", display_label: "Netball tournament" }),
      Object.freeze({ event_type_id: "test_day", display_label: "Test day" }),
      Object.freeze({ event_type_id: "other", display_label: "Other event" })
    ]),
    programme_template_family_ids: Object.freeze([
      "netball_off_season",
      "netball_pre_season",
      "netball_in_season",
      "netball_low_equipment"
    ])
  }),
  Object.freeze({
    activity_id: "basketball",
    display_label: "Basketball",
    event_types: Object.freeze([
      Object.freeze({ event_type_id: "basketball_match", display_label: "Basketball match" }),
      Object.freeze({ event_type_id: "basketball_tournament", display_label: "Basketball tournament" }),
      Object.freeze({ event_type_id: "test_day", display_label: "Test day" }),
      Object.freeze({ event_type_id: "other", display_label: "Other event" })
    ]),
    programme_template_family_ids: Object.freeze([
      "basketball_off_season",
      "basketball_pre_season",
      "basketball_in_season",
      "basketball_low_equipment"
    ])
  }),
  Object.freeze({
    activity_id: "rugby_sevens",
    display_label: "Rugby sevens",
    event_types: Object.freeze([
      Object.freeze({ event_type_id: "rugby_sevens_match", display_label: "Rugby sevens match" }),
      Object.freeze({ event_type_id: "rugby_sevens_tournament", display_label: "Rugby sevens tournament" }),
      Object.freeze({ event_type_id: "test_day", display_label: "Test day" }),
      Object.freeze({ event_type_id: "other", display_label: "Other event" })
    ]),
    programme_template_family_ids: Object.freeze([
      "rugby_sevens_off_season",
      "rugby_sevens_pre_season",
      "rugby_sevens_in_season",
      "rugby_sevens_low_equipment"
    ])
  }),
  Object.freeze({
    activity_id: "field_hockey",
    display_label: "Field hockey",
    event_types: Object.freeze([
      Object.freeze({ event_type_id: "field_hockey_match", display_label: "Field hockey match" }),
      Object.freeze({ event_type_id: "field_hockey_tournament", display_label: "Field hockey tournament" }),
      Object.freeze({ event_type_id: "test_day", display_label: "Test day" }),
      Object.freeze({ event_type_id: "other", display_label: "Other event" })
    ]),
    programme_template_family_ids: Object.freeze([
      "field_hockey_off_season",
      "field_hockey_pre_season",
      "field_hockey_in_season",
      "field_hockey_low_equipment"
    ])
  }),
  Object.freeze({
    activity_id: "ice_hockey",
    display_label: "Ice hockey",
    event_types: Object.freeze([
      Object.freeze({ event_type_id: "ice_hockey_match", display_label: "Ice hockey match" }),
      Object.freeze({ event_type_id: "ice_hockey_tournament", display_label: "Ice hockey tournament" }),
      Object.freeze({ event_type_id: "test_day", display_label: "Test day" }),
      Object.freeze({ event_type_id: "other", display_label: "Other event" })
    ]),
    programme_template_family_ids: Object.freeze([
      "ice_hockey_off_season",
      "ice_hockey_pre_season",
      "ice_hockey_in_season",
      "ice_hockey_low_equipment"
    ])
  }),
  Object.freeze({
    activity_id: "volleyball",
    display_label: "Volleyball",
    event_types: Object.freeze([
      Object.freeze({ event_type_id: "volleyball_match", display_label: "Volleyball match" }),
      Object.freeze({ event_type_id: "volleyball_tournament", display_label: "Volleyball tournament" }),
      Object.freeze({ event_type_id: "test_day", display_label: "Test day" }),
      Object.freeze({ event_type_id: "other", display_label: "Other event" })
    ]),
    programme_template_family_ids: Object.freeze([
      "volleyball_off_season",
      "volleyball_pre_season",
      "volleyball_in_season",
      "volleyball_low_equipment"
    ])
  }),
  Object.freeze({
    activity_id: "cricket",
    display_label: "Cricket",
    event_types: Object.freeze([
      Object.freeze({ event_type_id: "cricket_match", display_label: "Cricket match" }),
      Object.freeze({ event_type_id: "cricket_tournament", display_label: "Cricket tournament" }),
      Object.freeze({ event_type_id: "test_day", display_label: "Test day" }),
      Object.freeze({ event_type_id: "other", display_label: "Other event" })
    ]),
    programme_template_family_ids: Object.freeze([
      "cricket_off_season",
      "cricket_pre_season",
      "cricket_in_season",
      "cricket_low_equipment"
    ])
  }),
  Object.freeze({
    activity_id: "american_football",
    display_label: "American football",
    event_types: Object.freeze([
      Object.freeze({ event_type_id: "american_football_match", display_label: "American football match" }),
      Object.freeze({ event_type_id: "american_football_tournament", display_label: "American football tournament" }),
      Object.freeze({ event_type_id: "test_day", display_label: "Test day" }),
      Object.freeze({ event_type_id: "other", display_label: "Other event" })
    ]),
    programme_template_family_ids: Object.freeze([
      "american_football_off_season",
      "american_football_pre_season",
      "american_football_in_season",
      "american_football_low_equipment"
    ])
  }),
  Object.freeze({
    activity_id: "athletics",
    display_label: "Athletics",
    event_types: Object.freeze([
      Object.freeze({ event_type_id: "athletics_competition", display_label: "Athletics competition" }),
      Object.freeze({ event_type_id: "test_day", display_label: "Test day" }),
      Object.freeze({ event_type_id: "other", display_label: "Other event" })
    ]),
    programme_template_family_ids: Object.freeze([
      "athletics_novice",
      "athletics_intermediate",
      "athletics_low_equipment"
    ])
  }),
  Object.freeze({
    activity_id: "swimming",
    display_label: "Swimming",
    event_types: Object.freeze([
      Object.freeze({ event_type_id: "swimming_competition", display_label: "Swimming competition" }),
      Object.freeze({ event_type_id: "test_day", display_label: "Test day" }),
      Object.freeze({ event_type_id: "other", display_label: "Other event" })
    ]),
    programme_template_family_ids: Object.freeze([
      "swimming_novice",
      "swimming_intermediate",
      "swimming_low_equipment"
    ])
  }),
  Object.freeze({
    activity_id: "olympic_weightlifting",
    display_label: "Olympic weightlifting",
    event_types: Object.freeze([
      Object.freeze({ event_type_id: "olympic_weightlifting_competition", display_label: "Olympic weightlifting competition" }),
      Object.freeze({ event_type_id: "test_day", display_label: "Test day" }),
      Object.freeze({ event_type_id: "other", display_label: "Other event" })
    ]),
    programme_template_family_ids: Object.freeze([
      "olympic_weightlifting_novice",
      "olympic_weightlifting_intermediate",
      "olympic_weightlifting_low_equipment"
    ])
  }),
  Object.freeze({
    activity_id: "cycling",
    display_label: "Cycling",
    event_types: Object.freeze([
      Object.freeze({ event_type_id: "cycling_competition", display_label: "Cycling competition" }),
      Object.freeze({ event_type_id: "test_day", display_label: "Test day" }),
      Object.freeze({ event_type_id: "other", display_label: "Other event" })
    ]),
    programme_template_family_ids: Object.freeze([
      "cycling_novice",
      "cycling_intermediate",
      "cycling_low_equipment"
    ])
  }),
  Object.freeze({
    activity_id: "rowing",
    display_label: "Rowing",
    event_types: Object.freeze([
      Object.freeze({ event_type_id: "rowing_competition", display_label: "Rowing competition" }),
      Object.freeze({ event_type_id: "test_day", display_label: "Test day" }),
      Object.freeze({ event_type_id: "other", display_label: "Other event" })
    ]),
    programme_template_family_ids: Object.freeze([
      "rowing_novice",
      "rowing_intermediate",
      "rowing_low_equipment"
    ])
  }),
  Object.freeze({
    activity_id: "kayaking",
    display_label: "Kayaking",
    event_types: Object.freeze([
      Object.freeze({ event_type_id: "kayaking_competition", display_label: "Kayaking competition" }),
      Object.freeze({ event_type_id: "test_day", display_label: "Test day" }),
      Object.freeze({ event_type_id: "other", display_label: "Other event" })
    ]),
    programme_template_family_ids: Object.freeze([
      "kayaking_novice",
      "kayaking_intermediate",
      "kayaking_low_equipment"
    ])
  }),
  Object.freeze({
    activity_id: "boxing",
    display_label: "Boxing",
    event_types: Object.freeze([
      Object.freeze({ event_type_id: "boxing_competition", display_label: "Boxing competition" }),
      Object.freeze({ event_type_id: "test_day", display_label: "Test day" }),
      Object.freeze({ event_type_id: "other", display_label: "Other event" })
    ]),
    programme_template_family_ids: Object.freeze([
      "boxing_novice",
      "boxing_intermediate",
      "boxing_low_equipment"
    ])
  }),
  Object.freeze({
    activity_id: "wrestling",
    display_label: "Wrestling",
    event_types: Object.freeze([
      Object.freeze({ event_type_id: "wrestling_competition", display_label: "Wrestling competition" }),
      Object.freeze({ event_type_id: "test_day", display_label: "Test day" }),
      Object.freeze({ event_type_id: "other", display_label: "Other event" })
    ]),
    programme_template_family_ids: Object.freeze([
      "wrestling_novice",
      "wrestling_intermediate",
      "wrestling_low_equipment"
    ])
  }),
  Object.freeze({
    activity_id: "judo",
    display_label: "Judo",
    event_types: Object.freeze([
      Object.freeze({ event_type_id: "judo_competition", display_label: "Judo competition" }),
      Object.freeze({ event_type_id: "test_day", display_label: "Test day" }),
      Object.freeze({ event_type_id: "other", display_label: "Other event" })
    ]),
    programme_template_family_ids: Object.freeze([
      "judo_novice",
      "judo_intermediate",
      "judo_low_equipment"
    ])
  }),
  Object.freeze({
    activity_id: "brazilian_jiu_jitsu",
    display_label: "Brazilian jiu-jitsu",
    event_types: Object.freeze([
      Object.freeze({ event_type_id: "brazilian_jiu_jitsu_competition", display_label: "Brazilian jiu-jitsu competition" }),
      Object.freeze({ event_type_id: "test_day", display_label: "Test day" }),
      Object.freeze({ event_type_id: "other", display_label: "Other event" })
    ]),
    programme_template_family_ids: Object.freeze([
      "brazilian_jiu_jitsu_novice",
      "brazilian_jiu_jitsu_intermediate",
      "brazilian_jiu_jitsu_low_equipment"
    ])
  }),
  Object.freeze({
    activity_id: "muay_thai",
    display_label: "Muay Thai",
    event_types: Object.freeze([
      Object.freeze({ event_type_id: "muay_thai_competition", display_label: "Muay Thai competition" }),
      Object.freeze({ event_type_id: "test_day", display_label: "Test day" }),
      Object.freeze({ event_type_id: "other", display_label: "Other event" })
    ]),
    programme_template_family_ids: Object.freeze([
      "muay_thai_novice",
      "muay_thai_intermediate",
      "muay_thai_low_equipment"
    ])
  }),
  Object.freeze({
    activity_id: "mma",
    display_label: "MMA",
    event_types: Object.freeze([
      Object.freeze({ event_type_id: "mma_competition", display_label: "MMA competition" }),
      Object.freeze({ event_type_id: "test_day", display_label: "Test day" }),
      Object.freeze({ event_type_id: "other", display_label: "Other event" })
    ]),
    programme_template_family_ids: Object.freeze([
      "mma_novice",
      "mma_intermediate",
      "mma_low_equipment"
    ])
  }),
  Object.freeze({
    activity_id: "tennis",
    display_label: "Tennis",
    event_types: Object.freeze([
      Object.freeze({ event_type_id: "tennis_competition", display_label: "Tennis competition" }),
      Object.freeze({ event_type_id: "test_day", display_label: "Test day" }),
      Object.freeze({ event_type_id: "other", display_label: "Other event" })
    ]),
    programme_template_family_ids: Object.freeze([
      "tennis_novice",
      "tennis_intermediate",
      "tennis_low_equipment"
    ])
  }),
  Object.freeze({
    activity_id: "triathlon",
    display_label: "Triathlon",
    event_types: Object.freeze([
      Object.freeze({ event_type_id: "triathlon_competition", display_label: "Triathlon competition" }),
      Object.freeze({ event_type_id: "test_day", display_label: "Test day" }),
      Object.freeze({ event_type_id: "other", display_label: "Other event" })
    ]),
    programme_template_family_ids: Object.freeze([
      "triathlon_novice",
      "triathlon_intermediate",
      "triathlon_low_equipment"
    ])
  }),
  Object.freeze({
    activity_id: "rugby_league",
    display_label: "Rugby league",
    event_types: Object.freeze([
      Object.freeze({ event_type_id: "rugby_league_match", display_label: "Rugby league match" }),
      Object.freeze({ event_type_id: "rugby_league_tournament", display_label: "Rugby league tournament" }),
      Object.freeze({ event_type_id: "test_day", display_label: "Test day" }),
      Object.freeze({ event_type_id: "other", display_label: "Other event" })
    ]),
    programme_template_family_ids: Object.freeze([
      "rugby_league_off_season", "rugby_league_pre_season", "rugby_league_in_season", "rugby_league_low_equipment"
    ])
  }),
  Object.freeze({
    activity_id: "street_lifting",
    display_label: "Street lifting",
    event_types: Object.freeze([
      Object.freeze({ event_type_id: "street_lifting_competition", display_label: "Street lifting competition" }),
      Object.freeze({ event_type_id: "strength_event", display_label: "Strength event" }),
      Object.freeze({ event_type_id: "test_day", display_label: "Test day" }),
      Object.freeze({ event_type_id: "other", display_label: "Other event" })
    ]),
    programme_template_family_ids: Object.freeze([
      "street_lifting_novice",
      "street_lifting_intermediate",
      "street_lifting_low_equipment"
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
