export class BodyMetricsAndHabitsLifecycleError
  extends Error {
  readonly code: string;
}

export function normaliseBodyMetricEntry(
  input: unknown
): Readonly<{
  metric_type: string;
  value: number;
  unit: string;
  effective_date: string;
  source: string;
  note: string | null;
}>;

export function normaliseHabitDefinition(
  input: unknown
): Readonly<{
  habit_label: string;
  cadence: string;
}>;

export function normaliseHabitCompletionDate(
  input: unknown
): string;

export function computeHabitStreak(
  completionDates: readonly string[],
  asOfDateInput: string,
  cadence: string
): Readonly<{
  current_streak_length: number;
  longest_streak_length: number;
  total_completions: number;
}>;
