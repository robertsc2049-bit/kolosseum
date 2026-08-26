# Registry Module Notes

v0_scope_guard: boundary_doc

Status: active developer note.
Scope: registry documentation binding.

## DEV NOTE: authority boundary

This README explains the registry boundary for future developers. It does not create engine or registry law.

The current loaded registry surface comes from `registries/registry_index.json`. The final architectural classification and final required-active dependency/load order come from `registries/final_registry_surface_manifest.json`. The generated current bundle is `registries/registry_bundle.json`. This README is not authority.

When documentation conflicts, use explicit current canonical/release law and supersession decisions first, then frozen canonical registry law, lawful later human-authorised extensions, executable current contracts/guards, current implementation evidence, planning documents, and developer notes in that order.

## Current loaded registry files

Do not hard-code a domain list in this README. Read `registries/registry_index.json` for the current loaded implementation surface. REG-FULL-00 deliberately leaves that file byte-identical while defining the final target architecture separately.

The generated bundle must be produced from the current registry index and active registry files and must not be hand-edited.

Use `npm run registry:bundle` or `node scripts/bundle_writer.cjs` only in slices authorised to mutate registry truth. REG-FULL-00 is not such a slice.

## Final registry architecture

`registries/final_registry_surface_manifest.json` is the sole machine-readable final registry architecture authority. Every discovered registry concept is classified exactly once as `required_active`, `derived_generated`, `retained_legacy`, `dormant`, or `prohibited`.

Later REG-FULL slices must consume the manifest rather than infer architecture from the current index, bundle, README, historical activation counts, or file presence. REG-FULL-01 must fail closed if that manifest is absent, non-authoritative, unclassified, or reports an unresolved architecture conflict.

## Schema validity and FK closure

Every currently loaded domain remains subject to its existing schema and closed-world FK guards. REG-FULL-01 will close one authoritative schema and canonical ID vocabulary for every final `required_active` registry. Until then, REG-FULL-00 changes no row shape or registry fact.

Existing proof includes `ci/guards/registry_schema_presence_guard.mjs`, `ci/guards/registry_bundle_guard.mjs`, `ci/guards/registry_law_guard.mjs`, and `ci/guards/reg_full_00_final_registry_surface_authority_guard.mjs`.

## No fallback

Registry loading must not use fallback, approximate, guessed, closest-match, inferred, or partial registry behaviour. Missing, malformed, stale or broken registry references are hard failures.

Do not repair a failing registry guard by weakening the guard. Repair the underlying registry/schema/bundle/canonical boundary through the appropriate named slice.

## Historical records

S-REG activation and extension records remain historical truth. The final surface manifest supersedes architectural interpretation only; it does not rewrite what an earlier slice activated, extended, omitted or counted at that time.
