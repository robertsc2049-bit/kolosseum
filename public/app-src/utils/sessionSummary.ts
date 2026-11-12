// "Finish session now" (and stopping, then choosing to skip the rest) is
// recorded as a pause followed by skipping the rest. When every pause ended
// that way, with no carrying on, the session simply finished early - say so,
// instead of "Paused 1 time" and "Came back and skipped the rest".
export function finishedEarly(summary: Record<string, unknown> | null | undefined): boolean {
  if (!summary) return false;
  const splits = Number(summary.split_event_count ?? 0);
  return splits > 0 && Number(summary.return_continue_count ?? 0) === 0 && Number(summary.return_skip_count ?? 0) === splits;
}
