# P171 — Live Demo Failure Recovery Runbook

Document ID: p171_live_demo_failure_recovery_runbook  
Status: Draft for v0 demo proof  
Scope: Founder / operator live demo handling only  
Engine Compatibility: EB2-1.0.0  
Release Applicability: v0 Deterministic Execution Alpha  
Rewrite Policy: rewrite_only

## 0. Purpose

This runbook defines the only lawful operator recovery path when a live demo surface misbehaves during a v0 founder or coach walkthrough.

This runbook governs operator behaviour only.

It does not define:
- engine behaviour
- retry logic
- fallback logic inside code
- recovery semantics inside the product
- new product claims

If a live surface misbehaves, the operator may move only to a pinned live artefact or pinned stop condition.

## 1. Non-Negotiable Rules

1. No improvising product claims during recovery.
2. No "best effort", "graceful", "try anyway", or "closest match" language.
3. No engine retry, no hidden alternate logic, no mutation, no recovery code path.
4. Every recovery step must point to a live v0 artefact only.
5. If a referenced fallback artefact is missing, the recovery proof fails.
6. If the operator reaches the terminal stop condition, the demo stops cleanly without claim expansion.

## 2. v0 Boundary

This runbook is limited to the current v0 demo boundary only:

- onboarding / declaration flow
- session execution UI
- history counts / neutral summaries
- coach assignment
- factual artefact viewing
- non-binding coach notes

The following are out of bounds for recovery routing:

- Phase 7 truth projection
- Phase 8 evidence sealing
- export or audit envelope claims
- org / team / unit / gym runtime
- dashboards
- analytics
- rankings
- messaging
- broader platform governance surfaces

## 3. Allowed Operator Recovery Language

Allowed:
- "This surface is not the one I am using to prove the flow. I am moving to the corresponding factual artefact."
- "I am staying inside the proven v0 path."
- "I am not making claims beyond what this artefact shows."

Forbidden:
- "This normally recovers automatically."
- "The system gracefully falls back."
- "It usually fixes itself."
- "It should still work."
- "We can try again and it will probably be fine."
- "The product also supports..."
- any language implying safety, optimisation, correction, recommendation, or hidden capability

## 4. Deterministic Recovery Order

The fallback order is fixed and must not be changed during the live demo.

### Step 1 — Continue Primary Surface
Trigger:
- current surface is rendering and usable

Action:
- continue the planned demo path

### Step 2 — Switch to Corresponding Factual Artefact
Trigger:
- current live UI surface misbehaves visually or interaction is unstable
- corresponding factual artefact exists and is live

Action:
- move immediately to the mapped factual artefact
- describe only what is visibly present

### Step 3 — Switch to Completed Execution Proof Surface
Trigger:
- execution surface cannot be demonstrated cleanly
- completed execution artefact exists and is live

Action:
- show the pinned completed artefact for the same proof path

### Step 4 — Switch to Adjacent Coach Proof Surface
Trigger:
- coach interaction surface is unstable
- coach assignment or coach notes proof surface exists and is live

Action:
- show the mapped coach proof surface only

### Step 5 — Switch to History / Counts Proof Surface
Trigger:
- session or coach surface cannot be shown cleanly
- history counts proof surface exists and is live

Action:
- show neutral history/counts artefact only

### Step 6 — Terminal Stop Condition
Trigger:
- no mapped live v0 artefact can be shown cleanly

Action:
- stop the demo
- use only the pinned stop language
- do not improvise any product capability or roadmap claim

## 5. Surface-to-Artefact Mapping Rule

Each trigger surface must map to exactly one deterministic next step in the machine-readable manifest.

Mappings must:
- resolve to a real repo artefact
- remain inside v0
- point only to live demo surfaces or factual artefacts
- terminate cleanly

Mappings must not:
- point to dormant proof-layer artefacts
- point to future scope
- point to non-existent demo packs
- point to analytics, dashboards, evidence, or export surfaces

## 6. Terminal Stop Script

Use only:

"This surface is not the one I am using to prove the flow. I am moving to the corresponding factual artefact."

If no lawful artefact remains:

"I am staying inside the proven v0 path."

"I am not making claims beyond what this artefact shows."

If no lawful artefact can be shown after that, end the demo.

## 7. Proof Requirements

This runbook is considered proven only if all of the following are true:

- the fallback order is machine-declared
- every target artefact resolves
- every target artefact is inside the allowed v0 live set
- every trigger surface has exactly one next step
- the last step is a terminal stop step
- banned improvisational recovery language is absent
- missing artefacts fail verification

## 8. Final Rule

This runbook is operator governance only.

It must never be read as permission to add runtime fallback, retry, recovery, or claim-expansion behaviour to the product.

If a live demo misbehaves, the operator may only route to already-live v0 proof surfaces or stop.