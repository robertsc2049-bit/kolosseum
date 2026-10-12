import React from "react";

import { type GroupVolume, HIGH_WEEKLY_SETS, MAJOR_MUSCLE_GROUPS, MUSCLE_GROUPS, type MuscleOption, SPORT_FOCUS_GROUPS, type VolumeItem, formatSets, weeklyMuscleVolume } from "../utils/muscleGroups";

// Hard sets per muscle group for a week, so a coach can see at a glance
// whether it's balanced: what each group gets, what gets a lot, and which
// major groups get no direct work.
export function MuscleVolumeList({ volume, title, note, open = false, focusGroups = [], highSets = HIGH_WEEKLY_SETS }: {
  volume: readonly GroupVolume[];
  title: string;
  note: string;
  open?: boolean;
  // The sport's own focus (grip sport's forearms): high there is the point.
  focusGroups?: readonly string[];
  // Where "very high" starts: higher for a pro (the server sends it).
  highSets?: number;
}) {
  const high = (v: GroupVolume) => v.sets > highSets && !focusGroups.includes(v.group);
  if (!volume.length) return null;
  const top = [...volume].sort((a, b) => b.sets - a.sets).slice(0, 3).map((v) => `${v.label} ${formatSets(v.sets)}`).join(" · ");
  const trained = new Set(volume.map((v) => v.group));
  const untrained = MUSCLE_GROUPS.filter((g) => MAJOR_MUSCLE_GROUPS.includes(g.id) && !trained.has(g.id)).map((g) => g.label);
  return (
    <details className="weekly-muscle-volume" open={open}>
      <summary>{`${title}: ${top}`}</summary>
      <p className="muted small">{note}</p>
      <ul className="weekly-muscle-volume-list">
        {volume.map((v) => (
          <li key={v.group} data-high={high(v) ? "true" : undefined}>
            <span>{v.label}</span>
            <strong>{formatSets(v.sets)}</strong>
            {high(v) ? <small className="field-warning">Very high - check recovery</small> : null}
          </li>
        ))}
      </ul>
      {untrained.length ? <p className="muted small">{`No direct work: ${untrained.join(", ")}.`}</p> : null}
    </details>
  );
}

// A planned week in the coach builder.
export function WeeklyMuscleVolume({ items, exercises, activityId = "" }: {
  items: readonly VolumeItem[];
  exercises: ReadonlyMap<string, MuscleOption>;
  activityId?: string;
}) {
  return (
    <MuscleVolumeList
      volume={weeklyMuscleVolume(items, exercises)}
      title="Sets per muscle group"
      note="Hard strength sets planned this week; a secondary muscle counts as half a set. Jumps, sprints, throws, Olympic lifts, carries, conditioning, warm-ups and cool-downs aren't counted."
      focusGroups={SPORT_FOCUS_GROUPS[activityId] ?? []}
    />
  );
}

// What the athlete actually logged over the last 7 days (progress insights).
export function LoggedMuscleVolume({ weekly }: { weekly: unknown }) {
  const groups = weekly && typeof weekly === "object" && Array.isArray((weekly as { groups?: unknown }).groups)
    ? ((weekly as { groups: unknown[] }).groups as GroupVolume[]).filter((g) => g && typeof g.sets === "number")
    : [];
  if (!groups.length) return null;
  const focus = (weekly as { focus_groups?: unknown }).focus_groups;
  const highSets = (weekly as { high_sets?: unknown }).high_sets;
  return (
    <article className="record-card" data-testid="logged-muscle-volume">
      <MuscleVolumeList
        volume={groups}
        title="Sets per muscle group, last 7 days"
        note="Hard strength sets logged in the last 7 days; a secondary muscle counts as half a set. Jumps, sprints, throws, Olympic lifts, carries and conditioning aren't counted."
        open
        focusGroups={Array.isArray(focus) ? focus.map(String) : []}
        highSets={typeof highSets === "number" && highSets > 0 ? highSets : HIGH_WEEKLY_SETS}
      />
    </article>
  );
}
