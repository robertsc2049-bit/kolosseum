\# TICKET\_012 — Phase3 Constraint Precedence \& Merge Law (Phase1 Sovereignty)



DATE: 2026-01-14

ENGINE\_VERSION: EB2-1.0.0

SCOPE: Phase 3 constraint resolution

STATUS: IMPLEMENTING



---



\## 0) Purpose



Phase 3 must not override or inject constraints when the caller has explicitly provided a Phase 1 constraints envelope.



This ticket formalises and enforces the precedence law:

\- Phase 1 constraints are authoritative when present (including empty object `{}`).

\- Phase 3 may only inject demo/default constraints when Phase 1 constraints are absent (`undefined`).



---



\## 1) Precedence Law (Authoritative)



\### 1.1 Source priority (highest → lowest)

1\) Phase 1: `canonicalInput.constraints` (presence matters; `{}` is intentional)

2\) Phase 3 derived/demo defaults (only if Phase 1 envelope absent)

3\) Engine defaults (only if both absent)



\### 1.2 Merge policy (key-level)

If Phase 1 constraints object exists:

\- Phase 3 MUST NOT override any key.

\- Phase 3 MAY only fill missing keys IF and ONLY IF we explicitly decide to support partial filling.

For EB2-1.0.0 starter, we enforce a stricter rule:

\- If Phase 1 constraints envelope exists, Phase 3 does not inject anything. No fill.



---



\## 2) Behavioural Requirements



\### 2.1 Envelope present

Input:

\- `constraints: {}`



Expected:

\- Phase 3 emits empty constraints (no defaults injected)



\### 2.2 Envelope absent

Input:

\- no `constraints` property



Expected:

\- Phase 3 may emit demo defaults for powerlifting (e.g. shoulder\_high) if demo behaviour remains enabled.



---



\## 3) Implementation Notes



\- Phase 2 canonical JSON must preserve `constraints:{}` presence (covered by Ticket 011).

\- Phase 3 must read `canonicalInput.constraints` and treat “present” as authoritative.



---



\## 4) Tests



Add explicit tests:

1\) Constraints envelope `{}` suppresses Phase 3 defaults (Phase 5 no-op baseline remains true).

2\) Absence of envelope allows defaults (optional, but must be deterministic if present).



---



\## 5) Done Criteria



\- All tests green (`npm run lint`, `npm test`)

\- Phase 3 never injects defaults when Phase 1 constraints envelope exists

\- One commit + tag `v0-ticket012`



