\# TICKET 002 — PHASE 3 CONSTRAINT EMISSION (v0)



\## Goal

Phase 3 must output a deterministic `constraints` object that is consumed by Phase 4 (program assembly) and Phase 5 (substitution/adjustment), without introducing any non-determinism or athlete-reporting burden.



\## Why this exists

We need a stable place in the pipeline where:

\- registries are loaded (and verified)

\- minimal, defensible “constraint emission” can occur

\- later phases can consume constraints without re-deciding policy



This ticket is not “constraint resolution” in the full legal sense. It is a v0 emission mechanism with one demo rule.



\## Inputs

\- Phase 2 canonical input (canonical JSON bytes/string; hash available)

\- Registry index + registry files (read-only)

\- No external services



\## Outputs (contract)

Phase 3 returns:

\- `ok: true`

\- `phase3` object:

&nbsp; - `constraints\_resolved: true` (v0: always true if registries load)

&nbsp; - `notes: string\[]`

&nbsp; - `registry\_index\_version: string`

&nbsp; - `loaded\_registries: string\[]` (names, in index order)

&nbsp; - `constraints: { ... }` (may be empty object but must exist)



On failure:

\- `ok: false`

\- `failure\_token: "registry\_load\_failed" | other CI token`

\- `details?: unknown`



\## Determinism requirements

\- Given the same canonical input + same registry files, Phase 3 output must be identical.

\- Phase 3 must not depend on system time, random, locale, or OS-specific iteration ordering.

\- Registry load order must follow `registry\_index.json.registry\_order` exactly.



\## v0 Demo Rule (minimal)

Emit:

\- `constraints.avoid\_joint\_stress\_tags = \["shoulder\_high"]`

when:

\- `activity\_id === "powerlifting"`



Otherwise emit:

\- `constraints = {}` (or an object with empty arrays)



This is intentionally simplistic; it exists to prove end-to-end propagation.



\## CI / Tests (must exist)

\- Phase 3 loads registries in index order (assert order)

\- Phase 3 includes `registry\_index\_version`

\- E2E test proves: Phase 3 emits constraints → Phase 4 consumes them → Phase 5 substitution behavior reflects constraints



\## Files touched (expected)

\- `engine/src/phases/phase3.ts`

\- `engine/src/registries/loadRegistries.ts` (if needed)

\- tests:

&nbsp; - `test/registries.test.mjs`

&nbsp; - `test/registry.test.mjs`

&nbsp; - E2E test (added/updated)



\## Acceptance

\- `npm run lint` passes

\- `npm test` passes

\- `npm run run:cli -- examples\\phase1\_min.json` prints Phase 3 with constraints present and registries listed



