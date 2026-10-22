// DEV NOTE: Repository automation script. Adds the position/event-group
// programmes in scripts/program_role_microcycles.mjs MORE_ROLE_MICROCYCLES to
// the program registry - only groups it doesn't have yet, so the registry's
// later hand-fixes are never overwritten. Each group gets its full-body
// session and training week at all three levels, derived by the level
// generator's own rules (scripts/generate_program_level_variants.mjs). Then
// run scripts/apply_pro_methods.mjs for the new groups' pro versions. Run
// from repo root.
import fs from "node:fs";

import { MORE_ROLE_MICROCYCLES } from "./program_role_microcycles.mjs";
import { allowed, ex, STRENGTH, parseItem, weekForLevels, checkWeek, dayOut, variant, asEntry, beginnerOf, proOf, strengthBeginner, strengthPro, FIXED_EXERCISES } from "./generate_program_level_variants.mjs";

const FILE = "registries/program/program.registry.json";
const prog = JSON.parse(fs.readFileSync(FILE, "utf8"));

const markFixed = (target, activity) => {
  const fixed = new Set(FIXED_EXERCISES[activity] ?? []);
  target.item_prescriptions = target.item_prescriptions.map((pr, i) => {
    const { fixed: _drop, ...rest } = pr;
    return fixed.has(target.exercise_eligibility[i]) ? { ...rest, fixed: true } : rest;
  });
};

let added = 0;
for (const [activity, roles] of Object.entries(MORE_ROLE_MICROCYCLES)) {
  const entry = prog.entries.find((candidate) => candidate.activity_id === activity);
  if (!entry) throw new Error(`${activity}: not in the program registry`);
  entry.role_variants ??= {};
  for (const [role, { session, week }] of Object.entries(roles)) {
    if (entry.role_variants[role]) continue;
    const label = `${activity}/${role}`;
    const items = session.map(parseItem);
    for (const [id] of items) if (!ex[id] || !allowed(id, activity)) throw new Error(`${label}: ${id} not training-allowed`);
    const levels = STRENGTH.has(activity)
      ? { beginner: strengthBeginner(items, activity), pro: strengthPro(items, activity) }
      : { beginner: beginnerOf(asEntry(activity, items)), pro: proOf(asEntry(activity, items)) };
    const days = weekForLevels(activity, week.map(([day_id, focus, dayItems]) => ({ day_id, focus, items: dayItems.map(parseItem) })));
    checkWeek(label, activity, days);
    const v = {
      ...variant(items),
      level_variants: {
        beginner: { ...variant(levels.beginner), microcycle: days.beginner.map(dayOut) },
        pro: { ...variant(levels.pro), microcycle: days.pro.map(dayOut) }
      },
      microcycle: days.amateur.map(dayOut)
    };
    for (const target of [v, v.level_variants.beginner, v.level_variants.pro]) {
      markFixed(target, activity);
      for (const day of target.microcycle) markFixed(day, activity);
    }
    entry.role_variants[role] = v;
    added += 1;
  }
}
fs.writeFileSync(FILE, JSON.stringify(prog, null, 2) + "\n");
console.log("role programmes added:", added);
