# V1 Rollback Runbook

Status: Authoritative  
Scope: Operational rollback only  
Applies to: v0 / freeze-controlled release surfaces

## Purpose

This runbook defines the only lawful rollback posture for a frozen Kolosseum release surface.

Rollback exists to reduce or remove operational exposure while preserving truth, determinism, auditability, and freeze integrity.

Rollback is operational access control.
Rollback is not truth repair.

## Hard boundaries

Rollback MUST NOT:

- modify historical truth
- rewrite recorded data
- suppress or rewrite audit trails
- alter engine legality
- alter engine determinism
- alter replay output
- alter evidence eligibility
- destroy evidence artefacts
- hot-swap registries
- mutate registry payloads
- bypass CI
- bypass replay prerequisites
- re-enable dormant proof-layer phases
- invent missing data
- reconstruct missing data by inference
- use fallback behaviour to preserve availability

## Allowed rollback actions

Rollback MAY:

- disable UI access
- disable API routes
- suspend integrations
- remove export access
- withdraw non-engine presentation surfaces
- revert non-engine operational exposure
- place the service into a limited operational mode that preserves existing truth surfaces

## Required rollback method

1. Identify the affected non-engine surface.
2. Disable or withdraw that operational surface explicitly.
3. Log the rollback action with timestamp and actor.
4. Preserve all existing historical truth, traces, and audit surfaces.
5. Preserve all frozen artefacts unchanged.
6. Re-run freeze compatibility verification before promotion or further rollback expansion.

## Required operator assertions

Operators MUST assert all of the following before rollback is treated as lawful:

- no historical truth was modified
- no registry was mutated
- no replay requirement was bypassed
- no evidence artefact was deleted or rewritten
- no dormant proof-layer phase was re-enabled
- rollback remained operational only

## Final rule

If a rollback step would change truth instead of access,
the rollback is illegal and must not be executed.