# P155 — Session History Counts Contract

Status: Proposed
Scope: v0 only
Mode: BUILD
Rewrite Policy: rewrite-only

## Target

Formalise the minimal v0 history surface: counts, dates, durations, and completion state.

## Invariant

v0 session history must stay factual and minimal.

The history surface is limited to factual history fields such as:

- session counts
- started_at or completed_at style dates
- duration facts
- completion state facts

The history surface must not widen into rankings, readiness, advice, recommendations, or scoring.

## Proof

One automated contract cluster must prove all of the following:

1. the session-state read model remains the source boundary for factual session summary/history surfaces
2. existing session execution summary surfaces expose count-based and completion-based history facts only
3. existing block execution summary surfaces expose count-based history facts only
4. API and consumer-facing contracts for session state remain factual and do not widen into rankings, advice, readiness, or scoring
5. contradictory widening vocabulary fails the contract

## Allowed History Facts

- sessions_total
- sessions_ended
- work_items_done
- work_items_total
- session_ended
- execution_status
- split_entered
- split_return_decision
- event_count
- started_at
- completed_at
- duration_ms

## Explicit Exclusions

- rankings
- leaderboards
- readiness
- advice
- recommendations
- scoring
- coaching judgements
- dashboard expansion
- organisation, team, unit, or gym history surfaces

## Completion Rule

This slice is complete only when the minimal history surface is pinned to factual count/date/duration/completion facts and any widening into rankings, advice, readiness, or scoring fails.