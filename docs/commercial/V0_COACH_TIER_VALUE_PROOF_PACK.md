# V0 Coach Tier Value Proof Pack

Document ID: v0_coach_tier_value_proof_pack
Status: Draft for enforcement
Scope: active v0 coach tier only
Audience: Commercial / Product / Founder / Review

## Purpose

Provide one factual artefact pack showing exactly what a coach gets in active v0.

## Invariant

- pricing and sales claims for coach tier must map only to implemented behaviour
- every claim must map to a pinned surface id
- no authority, compliance, replay, evidence, export, or outcome claims are permitted unless separately implemented and proven

## Included claims

### assignment

Coach can assign work within the active v0 coach path.

Pinned surface ids:
- coach.assignment.write
- coach.assignment.read

### execution_view

Coach can view factual execution artefacts and summaries only.

Pinned surface ids:
- coach.execution.summary.read
- coach.execution.state.read

### notes_boundary

Coach notes are non-binding and do not alter engine legality or execution authority.

Pinned surface ids:
- coach.notes.non_binding
- coach.notes.boundary.read

### history_counts

Coach can view factual history counts only where the v0 surface exposes counts.

Pinned surface ids:
- coach.history.counts.read

## Banned commercial drift

- compliance monitoring
- athlete accountability enforcement
- readiness scoring
- performance improvement claims
- evidence export
- proof replay
- override authority
- legal or safety assurance
- automatic coaching decisions

## Final rule

If a coach tier claim cannot be mapped to a pinned implemented surface id in this pack, it must not appear in pricing, sales, or founder demo material.