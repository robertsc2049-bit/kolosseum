// The builder's programme body for a Kolosseum programme
// (product/programmes/kolosseum_programmes_v1.mjs notation -> POST /templates),
// used by scripts/seed_kolosseum_programmes.mjs and the programme tests.

// One builder work item from the programme notation.
export function workItem(item, index, items) {
  const reps = item.reps;
  const timed = typeof reps === "object" && !Array.isArray(reps) && "seconds" in reps;
  const distance = typeof reps === "object" && !Array.isArray(reps) && "metres" in reps;
  const range = Array.isArray(reps);
  const fixedReps = typeof reps === "number" ? reps : range ? reps[1] : 5;
  const load = item.load;
  return {
    work_item_id: "", order_index: index + 1, exercise_id: item.id, planned_sets: item.sets,
    prescription_mode: timed ? "duration" : distance ? "distance" : "reps",
    rep_mode: range ? "range" : "fixed", planned_reps: fixedReps, rep_min: range ? reps[0] : fixedReps, rep_max: range ? reps[1] : fixedReps, tempo: "",
    duration_mode: "fixed", planned_duration_seconds: timed ? reps.seconds : 30, duration_min_seconds: timed ? reps.seconds : 30, duration_max_seconds: timed ? reps.seconds : 30,
    distance_mode: "fixed", distance_unit: "meters", planned_distance_value: distance ? reps.metres : 20, distance_min_value: distance ? reps.metres : 20, distance_max_value: distance ? reps.metres : 20,
    load_mode: load === "bw" ? "bodyweight" : "pct" in load ? "percent_1rm" : "rpe" in load ? "rpe" : "fixed_weight",
    percent_1rm: load !== "bw" && "pct" in load ? load.pct : 75,
    weight_value: load !== "bw" && "kg" in load ? load.kg : 20, weight_unit: "kg",
    rpe_value: load !== "bw" && "rpe" in load ? load.rpe : 8, borg_value: 13, cr10_value: 5,
    rest_seconds: item.rest ?? 120, role: index === items.findIndex((other) => !other.segment) ? "primary" : "accessory", coaching_notes: item.note ?? "", segment: item.segment ?? "working",
    group_id: item.group?.id ?? "", group_type: item.group?.type ?? "straight",
    group_time_cap_seconds: item.group?.cap ?? 0, group_round_seconds: item.group?.round ?? 0, group_total_rounds: item.group?.rounds ?? 0
  };
}

export function templateBody(programme, coachUserId) {
  return {
    coach_user_id: coachUserId, template_version: 1, template_name: programme.template_name, description: programme.description, activity_id: programme.activity_id,
    blocks: programme.blocks.map((block, b) => ({
      block_id: "", order_index: b + 1, name: block.name, description: "", block_type: block.block_type, week_count: block.weeks.length,
      weeks: block.weeks.map((sessions, w) => ({
        week_id: "", order_index: w + 1,
        sessions: sessions.map((session, s) => ({ session_id: "", order_index: s + 1, title: session.title, coaching_notes: "", work_items: session.items.map(workItem) }))
      }))
    })),
    updated_at_iso8601: new Date().toISOString()
  };
}
