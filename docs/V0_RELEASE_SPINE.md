# V0 Release Spine

## Purpose
This document defines the single release spine for v0.

A slice only counts as v0 progress if it hardens, proves, or exposes this path.  
If a change does not improve this path, it is not a v0 blocker.

---

## V0 outcome
A coach can generate a session, start it, run it, split it, return to it, continue or skip safely, and trust the state/events contract before and after restart.

---

## Canonical v0 flow

1. Submit valid Phase 1 input.
2. Compile a block.
3. Compile with `create_session=true`.
4. Start the created session.
5. Read `/sessions/:id/state`.
6. Read `/sessions/:id/events`.
7. Complete current exercise.
8. Split the session.
9. Read gated state and verify return-decision contract.
10. Resolve gate with `RETURN_CONTINUE` or `RETURN_SKIP`.
11. Read live state/events and verify cache parity.
12. Restart process.
13. Re-read live state/events and verify restart parity.
14. Apply one valid downstream progress write.
15. Verify append-only event growth.
16. Verify stale replay is rejected.
17. Verify reload parity after rejection.
18. Verify stable final response shape.

---

## V0 must-pass capabilities

### Input and compile
- [ ] Valid Phase 1 input succeeds.
- [ ] Unsupported or malformed input fails cleanly.
- [ ] `/blocks/compile` returns stable response shape.
- [ ] `/blocks/compile?create_session=true` returns stable response shape and `session_id`.

### Session lifecycle
- [ ] `POST /sessions/:id/start` succeeds.
- [ ] `GET /sessions/:id/state` succeeds.
- [ ] `GET /sessions/:id/events` succeeds.
- [ ] State payload shape is stable.
- [ ] Events payload shape is stable.

### Runtime progress
- [ ] `COMPLETE_EXERCISE` advances session correctly.
- [ ] `SPLIT_SESSION` gates the session correctly.
- [ ] `RETURN_CONTINUE` ungates correctly.
- [ ] `RETURN_SKIP` ungates correctly.
- [ ] Current-step identity advances coherently after valid progress.

### Restart and replay safety
- [ ] Fresh restart preserves live state.
- [ ] Fresh restart preserves live events.
- [ ] Cached vs uncached state parity holds.
- [ ] Cached vs uncached events parity holds.
- [ ] Accepted downstream progress appends exactly one event.
- [ ] Replayed accepted progress is rejected.
- [ ] Replayed stale return decision is rejected.
- [ ] Replayed stale split is rejected.
- [ ] Rejected replay cannot drift state.
- [ ] Rejected replay cannot drift events.

### API contract
- [ ] Stable allowlisted success response shapes exist for v0 endpoints.
- [ ] Stable error contract exists for expected client mistakes.
- [ ] No legacy gate-field leakage.
- [ ] Runtime trace contract is explicit and stable.

---

## Official v0 release scenarios

### Scenario A: return continue
1. Compile with `create_session=true`
2. Start session
3. Read state/events
4. Complete first exercise
5. Split session
6. Confirm gated return decision state
7. Resolve with `RETURN_CONTINUE`
8. Read live state/events
9. Restart process
10. Read state/events again
11. Complete next exercise
12. Verify append-only events
13. Verify stale replay rejection
14. Verify reload parity

### Scenario B: return skip
1. Compile with `create_session=true`
2. Start session
3. Read state/events
4. Complete first exercise
5. Split session
6. Confirm gated return decision state
7. Resolve with `RETURN_SKIP`
8. Read live state/events
9. Restart process
10. Read state/events again
11. Complete next exercise
12. Verify append-only events
13. Verify stale replay rejection
14. Verify reload parity

These are the release-gate stories.  
Anything else is supporting evidence, not the spine.

---

## Not v0 blockers
The following are explicitly not required to call v0 shippable:

- Marketplace
- Payments
- Messaging
- Wearables
- Federation modules
- Coach CRM expansion
- Rich analytics
- Broad multi-sport feature depth beyond the supported v0 lane
- Additional edge-case proofs that do not strengthen the release spine

---

## Rule for next slices
Every new slice should answer one of these questions:

1. Does it strengthen a must-pass capability?
2. Does it strengthen Scenario A or Scenario B?
3. Does it expose the release spine more clearly to a thin UI or demo shell?

If the answer is no, it is probably not the next best v0 slice.

---

## Immediate next engineering objective
Build or lock a single-owner release-gate smoke path that proves the full v0 flow end to end for:

- `RETURN_CONTINUE`
- `RETURN_SKIP`

That path should be treated as the primary v0 acceptance gate.