# Registry Module Notes

v0_scope_guard: boundary_doc

Status: active developer note.
Scope: registry documentation binding.

## DEV NOTE: authority boundary

This README explains the registry boundary for future developers. It does not create engine or registry law.

The current loaded registry surface comes from `registries/registry_index.json`. The final architectural classification and final required-active dependency/load order come from `registries/final_registry_surface_manifest.json`. The generated current bundle is `registries/registry_bundle.json`. This README is not authority.

When documentation conflicts, use explicit current canonical/release law and supersession decisions first, then frozen canonical registry law, lawful later human-authorised extensions, executable current contracts/guards, current implementation evidence, planning documents, and developer notes in that order.

## Current loaded registry files

Do not hard-code a domain list in this README. Read `registries/registry_index.json` for the current loaded implementation surface. REG-FULL-00 defined the final target architecture separately from the compact loader index. REG-FULL-01 preserves that compact index as a compatibility loading surface while closing canonical schema and ID authority.

The generated bundle must be produced from the current registry index and active registry files and must not be hand-edited.

Use `npm run registry:bundle` or `node scripts/bundle_writer.cjs` only in slices authorised to mutate registry representation or truth. REG-FULL-01 lawfully regenerates the bundle after schema/ID normalization without adding registry facts.

## Final registry architecture

`registries/final_registry_surface_manifest.json` is the sole machine-readable final registry architecture authority. Every discovered registry concept is classified exactly once as `required_active`, `derived_generated`, `retained_legacy`, `dormant`, or `prohibited`.

Later REG-FULL slices must consume the manifest rather than infer architecture from the current index, bundle, README, historical activation counts, or file presence. REG-FULL-01 consumes that authority through `registries/final_registry_schema_manifest.json`, which is the sole machine-readable final schema/ID authority.

## Schema validity and FK closure

Every final `required_active` registry has exactly one authoritative Draft 2020-12 schema named by `registries/final_registry_schema_manifest.json`. Every canonical row uses one domain-specific primary-key vocabulary and closed-world properties; alternate aliases and undocumented fields are prohibited.

The compact files named by `registries/registry_index.json` are compatibility loading projections, not parallel canonical schema authorities. Do not add a new field or alias to a compact projection without first changing the final schema authority deliberately.

Existing proof includes `ci/guards/registry_schema_presence_guard.mjs`, `ci/guards/registry_bundle_guard.mjs`, `ci/guards/registry_law_guard.mjs`, `ci/guards/reg_full_00_final_registry_surface_authority_guard.mjs`, and `ci/guards/reg_full_01_registry_schema_closure_guard.mjs`.

## No fallback

Registry loading must not use fallback, approximate, guessed, closest-match, inferred, or partial registry behaviour. Missing, malformed, stale or broken registry references are hard failures.

Do not repair a failing registry guard by weakening the guard. Repair the underlying registry/schema/bundle/canonical boundary through the appropriate named slice.

## Historical records

S-REG activation and extension records remain historical truth. The final surface manifest supersedes architectural interpretation only; it does not rewrite what an earlier slice activated, extended, omitted or counted at that time.
