import React, { useSyncExternalStore } from "react";

import { DEFAULT_VOLUME_LEVEL, VOLUME_LEVELS, muscleVolumeRange, rangeText, volumeLevel, volumeStatus } from "../../../shared/muscle-volume-ranges/muscleVolumeRanges.mjs";
import { type GroupVolume, MAJOR_MUSCLE_GROUPS, MUSCLE_GROUPS, type MuscleOption, type VolumeItem, formatSets, weeklyMuscleVolume } from "../utils/muscleGroups";

const LEVEL_LABELS: Readonly<Record<string, string>> = { beginner: "Beginner", amateur: "Amateur", pro: "Pro" };

// Hard sets per muscle group for a week, so a coach can see at a glance
// whether it's balanced: each group against its weekly range for the
// athlete's level (under it, in it, or over what they can recover from),
// and which major groups get no direct work. An athlete sees their sets and
// a recovery warning, never the ranges - those are the coach's to read.
export function MuscleVolumeList({ volume, title, note, open = false, level = DEFAULT_VOLUME_LEVEL, activityId = "", coach = false, children }: {
  volume: readonly GroupVolume[];
  title: string;
  note: string;
  open?: boolean;
  level?: string;
  activityId?: string;
  coach?: boolean;
  children?: React.ReactNode;
}) {
  if (!volume.length) return null;
  const top = [...volume].sort((a, b) => b.sets - a.sets).slice(0, 3).map((v) => `${v.label} ${formatSets(v.sets)}`).join(" · ");
  const trained = new Set(volume.map((v) => v.group));
  const untrained = MUSCLE_GROUPS.filter((g) => MAJOR_MUSCLE_GROUPS.includes(g.id) && !trained.has(g.id)).map((g) => g.label);
  const rows = volume.map((v) => {
    const range = muscleVolumeRange(v.group, level, activityId);
    return { ...v, range, status: volumeStatus(v.sets, range) };
  });
  const counts = coach ? { under: rows.filter((r) => r.status === "under").length, over: rows.filter((r) => r.status === "over").length } : null;
  const flags = counts && (counts.under || counts.over)
    ? ` (${[counts.over ? `${counts.over} over` : "", counts.under ? `${counts.under} under` : ""].filter(Boolean).join(", ")})`
    : "";
  return (
    <details className="weekly-muscle-volume" open={open}>
      <summary>{`${title}: ${top}${flags}`}</summary>
      <p className="muted small">{note}</p>
      {children}
      <ul className="weekly-muscle-volume-list">
        {rows.map((v) => (
          <li key={v.group} data-high={v.status === "over" ? "true" : undefined} data-status={coach && v.status ? v.status : undefined}>
            <span>{v.label}</span>
            <strong>{formatSets(v.sets)}</strong>
            {coach && v.status === "over" ? <small className="field-warning">{`Over ${v.range.max} a week - check recovery`}</small> : null}
            {coach && v.status === "under" ? <small className="volume-under">{`Under ${v.range.min} a week (${rangeText(v.range)})`}</small> : null}
            {coach && v.status === "in_range" ? <small className="muted">{rangeText(v.range)}</small> : null}
            {!coach && v.status === "over" ? <small className="field-warning">Very high - check recovery</small> : null}
          </li>
        ))}
      </ul>
      {untrained.length ? <p className="muted small">{`No direct work: ${untrained.join(", ")}.`}</p> : null}
      {coach ? (
        <p className="muted small">
          {`Ranges for ${LEVEL_LABELS[volumeLevel(level)]}: under is less than usually builds muscle there - fine when size there isn't the aim; over is more than most recover from.`}
        </p>
      ) : null}
    </details>
  );
}

// The level the builder reads its weeks against: one choice for every week
// on the page, remembered in this browser.
const LEVEL_KEY = "kolosseum:builder-volume-level";
const levelListeners = new Set<() => void>();
let builderLevel: string = (() => {
  try { return volumeLevel(window.localStorage.getItem(LEVEL_KEY) ?? ""); } catch { return DEFAULT_VOLUME_LEVEL; }
})();
function setBuilderLevel(level: string) {
  builderLevel = volumeLevel(level);
  try { window.localStorage.setItem(LEVEL_KEY, builderLevel); } catch { /* private window: this page only */ }
  levelListeners.forEach((listener) => listener());
}
function useBuilderLevel(): string {
  return useSyncExternalStore((listener) => { levelListeners.add(listener); return () => levelListeners.delete(listener); }, () => builderLevel);
}

// A planned week in the coach builder.
export function WeeklyMuscleVolume({ items, exercises, activityId = "" }: {
  items: readonly VolumeItem[];
  exercises: ReadonlyMap<string, MuscleOption>;
  activityId?: string;
}) {
  const level = useBuilderLevel();
  return (
    <MuscleVolumeList
      volume={weeklyMuscleVolume(items, exercises)}
      title="Sets per muscle group"
      note="Hard strength sets planned this week; a secondary muscle counts as half a set. Jumps, sprints, throws, Olympic lifts, carries, conditioning, warm-ups and cool-downs aren't counted."
      level={level}
      activityId={activityId}
      coach
    >
      <label className="volume-level-select">
        <span>Check against</span>
        <select value={level} onChange={(event) => setBuilderLevel(event.target.value)}>
          {VOLUME_LEVELS.map((value: string) => <option key={value} value={value}>{LEVEL_LABELS[value]}</option>)}
        </select>
      </label>
    </MuscleVolumeList>
  );
}

// What the athlete actually logged over the last 7 days (progress insights).
// The coach's view reads it against the athlete's level; the athlete's own
// doesn't show ranges.
export function LoggedMuscleVolume({ weekly, coach = false }: { weekly: unknown; coach?: boolean }) {
  const groups = weekly && typeof weekly === "object" && Array.isArray((weekly as { groups?: unknown }).groups)
    ? ((weekly as { groups: unknown[] }).groups as GroupVolume[]).filter((g) => g && typeof g.sets === "number")
    : [];
  if (!groups.length) return null;
  const level = (weekly as { level?: unknown }).level;
  const activityId = (weekly as { activity_id?: unknown }).activity_id;
  return (
    <article className="record-card" data-testid="logged-muscle-volume">
      <MuscleVolumeList
        volume={groups}
        title="Sets per muscle group, last 7 days"
        note="Hard strength sets logged in the last 7 days; a secondary muscle counts as half a set. Jumps, sprints, throws, Olympic lifts, carries and conditioning aren't counted."
        open
        level={typeof level === "string" ? level : DEFAULT_VOLUME_LEVEL}
        activityId={typeof activityId === "string" ? activityId : ""}
        coach={coach}
      />
    </article>
  );
}
