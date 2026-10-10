// Warm-up and cool-down for a training session (pure: no registry, no I/O).
//
// Every session opens with a few minutes of dynamic mobility for what it
// trains and closes with stretches for the same muscles (the mobility
// exercises; bodyweight only, so any gym will do). A day's focus comes from
// its exercises' movement patterns: lower body, upper body or both, with
// drills that open up the hips and hamstrings before sprinting or jumping, a
// calf stretch after it, and wrist stretches after grip work. A session has
// room for at most `maxItems` exercises, so a long session gets a shorter
// warm-up and cool-down rather than going over.
//
// Used by the Kolosseum programmes (product/programmes) and by the sessions
// the app builds for a self-directed athlete (src/api/session_bookends.ts).

const LOWER = /^(squat|hinge|single_leg_|knee_|hip_|calf_raise|tibialis_raise|jump_|sprint_|deceleration|change_of_direction|locomotion_run|conditioning_sled)/u;
const UPPER = /^(horizontal_|vertical_|incline_push|decline_push|angled_push|scapular_|shoulder_|elbow_|forearm_|grip_)/u;
const FAST = /^(jump_|sprint_|deceleration|change_of_direction|locomotion_run)/u;
const GRIP = /^(grip_|forearm_)/u;

export const BUILD_UP_NOTE = "Then build up to your first working set in a few lighter sets.";
const HOLD = "Hold each side, breathing slowly.";

// A drill or stretch: one set of `reps` or `seconds`, with a note.
const warm = (id, dose, note) => ({ exercise_id: id, segment: "warm_up", ...dose, note });
const cool = (id, note = HOLD) => ({ exercise_id: id, segment: "cool_down", seconds: 45, note });

// What a session trains, from its exercises' movement patterns.
export function sessionFocus(exerciseIds, patternOf) {
  const patterns = exerciseIds.map((id) => patternOf(String(id).replace(/__r[0-9]+$/u, "")) ?? "");
  const lower = patterns.filter((p) => LOWER.test(p)).length;
  const upper = patterns.filter((p) => UPPER.test(p)).length;
  return {
    region: lower && !upper ? "lower" : upper && !lower ? "upper" : "full",
    fast: patterns.some((p) => FAST.test(p)),
    grip: patterns.filter((p) => GRIP.test(p)).length >= 2
  };
}

function warmUpFor({ region, fast }) {
  if (region === "upper") return [warm("arm_circles", { seconds: 30 }, "Small to big, both directions."), warm("quadruped_thoracic_rotation", { reps: 6 }, "Each side."), warm("cat_cow", { reps: 8 }, "Slowly, with the breath.")];
  if (fast) return [warm("worlds_greatest_stretch", { reps: 4 }, "Each side."), warm("walking_lunge_with_rotation", { reps: 6 }, "Each leg."), warm("walking_straight_leg_kick", { reps: 8 }, "Each leg; height comes gradually.")];
  if (region === "lower") return [warm("worlds_greatest_stretch", { reps: 4 }, "Each side."), warm("leg_swing", { reps: 10 }, "Each leg."), warm("open_close_gate", { reps: 6 }, "Each leg, both directions.")];
  return [warm("worlds_greatest_stretch", { reps: 4 }, "Each side."), warm("arm_circles", { seconds: 30 }, "Small to big, both directions."), warm("leg_swing", { reps: 10 }, "Each leg.")];
}

function coolDownFor({ region, fast, grip }) {
  const lower = fast ? [cool("kneeling_hip_flexor_stretch"), cool("wall_calf_stretch")] : [cool("kneeling_hip_flexor_stretch"), cool("lying_hamstring_stretch")];
  const upper = [cool("doorway_chest_stretch"), cool("kneeling_lat_stretch", "Hold, breathing slowly.")];
  const list = region === "lower" ? lower : region === "upper" ? upper : [lower[0], upper[1]];
  return grip ? [list[0], cool("wrist_flexor_stretch", "Hold each hand, breathing slowly.")] : list;
}

// The warm-up and cool-down for a session of `exerciseIds`: drills and
// stretches not already in it, within `maxItems` in all. The last warm-up
// drill's note says to ramp into the first working set.
export function sessionBookends(exerciseIds, patternOf, maxItems = 12) {
  const taken = new Set(exerciseIds.map(String));
  const focus = sessionFocus(exerciseIds, patternOf);
  const room = Math.max(0, maxItems - exerciseIds.length);
  const coolDown = coolDownFor(focus).filter((item) => !taken.has(item.exercise_id)).slice(0, room >= 3 ? 2 : room >= 2 ? 1 : 0);
  const warmUp = warmUpFor(focus).filter((item) => !taken.has(item.exercise_id)).slice(0, Math.min(3, room - coolDown.length));
  if (warmUp.length) warmUp[warmUp.length - 1] = { ...warmUp[warmUp.length - 1], note: `${warmUp[warmUp.length - 1].note} ${BUILD_UP_NOTE}` };
  return { focus, warm_up: warmUp, cool_down: coolDown };
}
