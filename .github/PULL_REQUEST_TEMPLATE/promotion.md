# Promotion PR

<!--
DEV NOTE: This template is for promotion PRs only.

A promotion PR should move an already-proven slice toward the protected branch or release boundary. It must not introduce new scope, new engine behaviour, new canonical authority, or hidden cleanup work.

Keep every answer specific enough that a future developer can understand exactly what is being promoted, why it is allowed, what invariant was preserved, and what proof was run.
-->

## Summary

<!--
DEV NOTE: State the promotion target in concrete terms.

Use this section to identify the slice, branch, PR, or artefact being promoted. Do not use vague wording such as "general cleanup" or "misc fixes". If the promotion contains more than one logical change, it is probably too broad.
-->

- Promotion slice:
- Scope:
- Invariant:
- Proof:

## Checks

<!--
DEV NOTE: These checks are promotion gates, not advisory reminders.

Tick an item only when the exact check has passed for this promotion state. Do not tick based on an earlier branch state, assumed CI behaviour, or local memory. If a check is intentionally not applicable, explain why in Notes rather than deleting the line.
-->

- [ ] targeted proof passed
- [ ] lint:fast passed
- [ ] dev:status passed
- [ ] clean working tree before push
- [ ] recent CI visibility checked

## Freeze Confirmation

<!--
DEV NOTE: This section protects sealed or freeze-sensitive surfaces.

A promotion must not accidentally alter freeze state, active seal state, sealed manifests, release-note boundaries, or any surface that claims a stronger release state than the promoted slice proves.
-->

- [ ] freeze_state_confirmed
- [ ] active_seal_state_confirmed
- [ ] sealed_surface_manifest_confirmed
- [ ] release_notes_boundary_confirmed

## Notes

<!--
DEV NOTE: Record promotion-specific risk and follow-up without expanding the PR.

Risk notes should describe the remaining risk after proof, not argue that risk is impossible. Follow-up should capture later work without implementing it here. Do not use this section to smuggle extra scope into the promotion.
-->

- Promotion notes:
- Risk notes:
- Follow-up:
