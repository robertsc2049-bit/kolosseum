// DEV NOTE: Weekly hard-set ranges per muscle group, by training level - the
// coach's reference for whether a week gives a group enough to build it
// (the minimum) without more than the athlete can recover from (the
// maximum). Sets are counted the way the builder and progress insights
// count them (src/api/exercise_muscles.ts): a full set for each group an
// exercise targets, half a set for each group only its secondary muscles
// reach.
//
// The numbers follow the dose-response work on weekly sets per muscle
// (Schoenfeld et al.'s meta-analyses; the minimum-to-maximum-recoverable
// framing coaches know from Israetel's volume landmarks), set lower for a
// beginner, who grows on little and recovers from less, and higher for a
// pro. Groups that get a full set from many compound lifts (glutes from
// every squat, hinge and lunge; lower back from every hinge) sit higher, and
// were checked against Kolosseum's own coach-written programmes so a sound
// meet-prep or strongman block reads "in range". "Shoulders" is front, side
// and rear delts together - three areas coaches dose separately - so its
// ceiling sits above the other major groups'. A beginner's ceiling allows
// the 15 squat sets of a three-day novice 5x5, a dose novices widely recover from.
//
// A minimum is given only for the major groups a balanced programme trains
// directly. Being under it is not a fault when the sport doesn't want size
// there - it's the dose that usually builds muscle, not a requirement. The
// coach decides; nothing here changes a programme.

export const VOLUME_LEVELS = Object.freeze(["beginner", "amateur", "pro"]);
export const DEFAULT_VOLUME_LEVEL = "amateur";

const range = (min, max) => Object.freeze({ min, max });

export const MUSCLE_VOLUME_RANGES = Object.freeze({
  beginner: Object.freeze({
    chest: range(6, 16), back: range(6, 18), shoulders: range(6, 16), quads: range(6, 16), hamstrings: range(4, 12), glutes: range(4, 18),
    biceps: range(null, 14), triceps: range(null, 12), traps: range(null, 12), forearms_grip: range(null, 14), abs_obliques: range(null, 14),
    lower_back: range(null, 14), calves_shins: range(null, 12), adductors: range(null, 12), neck: range(null, 10), rotator_cuff: range(null, 10), hip_flexors: range(null, 10)
  }),
  amateur: Object.freeze({
    chest: range(8, 22), back: range(10, 24), shoulders: range(8, 26), quads: range(8, 22), hamstrings: range(6, 20), glutes: range(6, 30),
    biceps: range(null, 20), triceps: range(null, 20), traps: range(null, 20), forearms_grip: range(null, 20), abs_obliques: range(null, 20),
    lower_back: range(null, 25), calves_shins: range(null, 18), adductors: range(null, 16), neck: range(null, 15), rotator_cuff: range(null, 14), hip_flexors: range(null, 14)
  }),
  pro: Object.freeze({
    chest: range(10, 26), back: range(12, 28), shoulders: range(10, 32), quads: range(10, 26), hamstrings: range(8, 24), glutes: range(8, 34),
    biceps: range(null, 24), triceps: range(null, 26), traps: range(null, 24), forearms_grip: range(null, 24), abs_obliques: range(null, 24),
    lower_back: range(null, 30), calves_shins: range(null, 22), adductors: range(null, 20), neck: range(null, 18), rotator_cuff: range(null, 16), hip_flexors: range(null, 16)
  })
});

// Groups a sport trains on purpose: no maximum there (a grip athlete's
// forearms, a weightlifter's squatting). Mirrors SPORT_FOCUS_GROUPS in
// src/api/exercise_muscles.ts.
export const VOLUME_FOCUS_GROUPS = Object.freeze({
  grip_sport: Object.freeze(["forearms_grip"]),
  olympic_weightlifting: Object.freeze(["quads", "glutes", "lower_back"])
});

export function volumeLevel(level) {
  return VOLUME_LEVELS.includes(level) ? level : DEFAULT_VOLUME_LEVEL;
}

// The range for one group at a level; { min: null, max: null } for a group
// with none (conditioning) or with no ceiling for this sport.
export function muscleVolumeRange(group, level, activityId = "") {
  const found = MUSCLE_VOLUME_RANGES[volumeLevel(level)][group];
  if (!found) return range(null, null);
  const focus = (VOLUME_FOCUS_GROUPS[activityId] ?? []).includes(group);
  return focus ? range(found.min, null) : found;
}

// "under" | "in_range" | "over", or null when the group has no range to
// read against (no minimum and under the maximum counts as in range).
export function volumeStatus(sets, volumeRange) {
  if (!Number.isFinite(sets)) return null;
  if (volumeRange.max !== null && sets > volumeRange.max) return "over";
  if (volumeRange.min !== null && sets < volumeRange.min) return "under";
  if (volumeRange.min === null && volumeRange.max === null) return null;
  return "in_range";
}

// "8-22 sets", "up to 20 sets".
export function rangeText(volumeRange) {
  if (volumeRange.min !== null && volumeRange.max !== null) return `${volumeRange.min}-${volumeRange.max} sets`;
  if (volumeRange.max !== null) return `up to ${volumeRange.max} sets`;
  if (volumeRange.min !== null) return `${volumeRange.min}+ sets`;
  return "";
}
