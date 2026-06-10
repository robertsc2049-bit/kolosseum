# P169 — Coach History Counts Demo

Document ID: p169_coach_history_counts_demo
Status: demo-proof
Scope: v0 factual history counts only
Engine Compatibility: EB2-1.0.0

## Purpose

This document pins a narrow coach-visible history counts surface for v0.

The surface exists to answer only:
- what happened
- how many times it happened
- within what explicit time window it happened

This surface does not perform analytics, scoring, ranking, interpretation, coaching judgement, readiness estimation, or narrative framing.

## Boundary

Allowed:
- factual counts of explicit execution events
- grouped counts by explicit factual dimensions
- date-window totals
- per-athlete factual summaries within granted coach scope
- explicit session-state counts

Forbidden:
- analytics
- scoring
- trends
- insights
- recommendations
- readiness
- compliance
- adherence scoring
- performance interpretation
- improvement / decline framing
- risk / safety / suitability framing
- rankings or comparisons

## Canonical fit

This demo is valid only as a v0 counts-only history surface.

It is aligned to:
- v0 includes onboarding forms, session execution UI, history counts, coach assignment, factual artefact viewing, and non-binding coach notes
- v0 excludes dashboards, analytics, rankings, messaging, readiness scoring, and outcome evaluation
- coach visibility is observational only
- descriptive reporting may count and group facts, but must not interpret them

## Allowed source facts

Only explicit recorded facts may feed this surface.

Allowed fact classes:
- session_assigned
- session_started
- session_completed
- session_partially_completed
- split_return_used
- extra_work_recorded
- prescribed_work_skipped
- work_dropped
- substitution_recorded
- runtime_event_recorded

## Allowed counters

The following counters are allowed:

- assigned_sessions_count
- started_sessions_count
- completed_sessions_count
- partial_completion_count
- split_return_count
- extra_work_count
- skipped_work_count
- dropped_work_count
- substitution_count
- runtime_event_count

## Allowed grouping keys

The following grouping keys are allowed:

- athlete_id
- session_id
- activity_id
- event_type
- event_date_utc
- explicit_date_window

No other grouping keys are allowed in this demo proof.

## Allowed copy

Allowed copy must remain neutral and factual.

Examples:
- Sessions assigned
- Sessions started
- Sessions completed
- Partial completions
- Split / return uses
- Extra work recorded
- Prescribed work skipped
- Work dropped
- Substitutions recorded
- Runtime events recorded
- Date range
- Counts by event type

## Forbidden copy

The following semantic classes are forbidden in this demo:
- analytics
- score
- scoring
- trend
- trends
- insight
- insights
- risk
- risky
- safer
- safety
- readiness
- fatigue
- recovery
- compliance
- adherent
- adherence
- performance
- improving
- decline
- regression
- rank
- ranking
- top athlete
- behind
- on track
- needs attention
- recommendation
- recommend
- optimise
- optimize

## Example factual payload

```json
{
  "coach_id": "coach_001",
  "athlete_id": "ath_001",
  "window": {
    "from_utc": "2026-04-01T00:00:00Z",
    "to_utc": "2026-04-07T23:59:59Z"
  },
  "counts": {
    "assigned_sessions_count": 4,
    "started_sessions_count": 4,
    "completed_sessions_count": 3,
    "partial_completion_count": 1,
    "split_return_count": 1,
    "extra_work_count": 2,
    "skipped_work_count": 1,
    "dropped_work_count": 1,
    "substitution_count": 2,
    "runtime_event_count": 11
  },
  "grouped_counts": [
    { "event_type": "session_completed", "count": 3 },
    { "event_type": "session_partially_completed", "count": 1 },
    { "event_type": "substitution_recorded", "count": 2 }
  ]
}
```

## Example rendered panel

Title:
Coach history counts

Rows:
- Sessions assigned: 4
- Sessions started: 4
- Sessions completed: 3
- Partial completions: 1
- Split / return uses: 1
- Extra work recorded: 2
- Prescribed work skipped: 1
- Work dropped: 1
- Substitutions recorded: 2
- Runtime events recorded: 11

Footer:
Date range: 2026-04-01 to 2026-04-07 UTC

## Non-goals

This surface does not:
- explain why anything happened
- compare athletes
- score behaviour
- label consistency
- predict readiness
- evaluate outcomes
- recommend action
- imply risk, safety, benefit, or suitability

## Reference fence

This demo may reference only the following authority surfaces by name:

- Kolosseum_v0_redefinition
- PRODUCT REQUIREMENTS DOCUMENT (PRD)
- COACH_RELATIONSHIP_AUTHORITY_LAW
- reporting and neutral summary / counts-only surfaces

This demo must not reference dashboards, messaging, rankings, readiness, scoring, or broader org analytics surfaces.

## Final rule

If this surface says more than what happened, how many times it happened, and within what explicit date window it happened, it is out of bounds for v0.