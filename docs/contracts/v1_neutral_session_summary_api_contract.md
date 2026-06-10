# V1 Neutral Session Summary API Contract

Document ID: v1_neutral_session_summary_api_contract
Status: Draft for enforcement
Scope: v0 active boundary only
Audience: API / UI / CI / tests

## Purpose

Expose exactly one stable, factual, deterministic single-session summary surface for UI and demo use.

This surface is:

- single-session only
- derived from recorded session/runtime events only
- factual
- deterministic
- no-inference
- no-advice
- closed to extra semantic fields

## Route

`GET /sessions/:sessionId/summary`

## Response contract

```json
{
  "session_id": "string",
  "run_id": "string",
  "status": "ready | in_progress | partial | completed",
  "prescribed_items_total": 0,
  "prescribed_items_completed": 0,
  "prescribed_items_skipped": 0,
  "prescribed_items_remaining": 0,
  "extra_work_event_count": 0,
  "split_event_count": 0,
  "return_continue_count": 0,
  "return_skip_count": 0,
  "runtime_event_count": 0,
  "started_at_utc": null,
  "completed_at_utc": null
}
```

## Allowed fields (closed set)

- `session_id`
- `run_id`
- `status`
- `prescribed_items_total`
- `prescribed_items_completed`
- `prescribed_items_skipped`
- `prescribed_items_remaining`
- `extra_work_event_count`
- `split_event_count`
- `return_continue_count`
- `return_skip_count`
- `runtime_event_count`
- `started_at_utc`
- `completed_at_utc`

No other fields are permitted.

## Banned semantic fields

Any appearance of fields like the following is a contract violation:

- `score`
- `quality`
- `adherence`
- `compliance`
- `performance`
- `trend`
- `insight`
- `recommendation`
- `next_action`
- `warning`
- `risk`
- `readiness`
- `fatigue`
- `improvement`
- `regression`
- `summary_text`
- `interpretation`
- `reason`
- `explanation`
- `projected_*`
- `estimated_*`

## Determinism rules

The summary must be:

- derived only from session truth plus append-only runtime events
- identical for identical underlying state
- byte-stable after canonical JSON serialisation
- independent of presentation flags, nd_mode, coach notes, payment state, or product flags

## No-inference rules

The summary must not:

- rank
- score
- evaluate
- explain
- recommend
- predict
- infer readiness
- infer adherence
- infer quality
- infer intent
- infer performance

## Status semantics

Allowed values:

- `ready`
- `in_progress`
- `partial`
- `completed`

No additional status values are permitted.

## Derivation rules

- `prescribed_items_total` = total prescribed executable work items in session truth
- `prescribed_items_completed` = count of prescribed work items completed in runtime truth
- `prescribed_items_skipped` = count of prescribed work items skipped or dropped in runtime truth
- `prescribed_items_remaining` = `prescribed_items_total - prescribed_items_completed - prescribed_items_skipped`
- `extra_work_event_count` = count of extra-work runtime events only
- `split_event_count` = count of session split events only
- `return_continue_count` = count of return-continue decisions only
- `return_skip_count` = count of return-skip decisions only
- `runtime_event_count` = total count of accepted runtime events
- `started_at_utc` = first runtime timestamp that lawfully marks session start, else `null`
- `completed_at_utc` = terminal completion timestamp if completed, else `null`

## Final rule

If a desired UI field cannot be derived mechanically from existing session truth and runtime events, it does not belong in this API.