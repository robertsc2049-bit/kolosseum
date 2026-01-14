\# TICKET 010 — Phase 1 Constraint Envelope (Closed-World · v0-safe)



\## Purpose

Allow lawful declaration of substitution-relevant constraints at engine entry without weakening closed-world guarantees.



\## Scope

\- Phase 1 schema: add optional `constraints` envelope (sealed keys only)

\- Phase 1 validation: reject unknown keys, reject empty envelope

\- Phase 5: consume constraints read-only (no defaults, no inference)

\- Tests: schema + E2E proving lawful constraint triggers substitution deterministically

\- Docs only; no registry expansion



\## New Phase 1 Field (Optional)

constraints?: {

&nbsp; avoid\_joint\_stress\_tags?: string\[];

&nbsp; banned\_equipment\_ids?: string\[];

&nbsp; available\_equipment\_ids?: string\[];

}



\## Validation Rules (Hard)

\- Phase 1 remains additionalProperties:false at root

\- If `constraints` exists:

&nbsp; - it must be an object

&nbsp; - it must NOT be empty

&nbsp; - it must NOT contain unknown keys

&nbsp; - each present key must be a non-empty array of strings

\- Runtime/Phase 5 must treat constraints as inputs only (no mutation)



\## Definition of Done

1\) Schema accepts `constraints` envelope and rejects unknown properties at root and within constraints

2\) Engine accepts a lawful constraints input and remains deterministic

3\) E2E: constraint forces substitution once; Phase 6 emits substituted exercise; no duplicates

4\) All CI gates green (lint + test)



\## Notes

This ticket exposes constraints through Phase 1. It does NOT introduce defaults, inference, or coaching.



