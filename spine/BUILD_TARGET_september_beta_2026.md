# BUILD_TARGET_september_beta_2026
# Status: Authoritative · Closed-world · Rewrite-only

0. PURPOSE – Enable Phase 7 & 8 only from 2026-09-01 → 2026-09-30 UTC.
1. ENGINE COMPATIBILITY  EB2-1.0.0
2. ACTOR TYPES           individual_user, coach
3. EXECUTION SCOPES      individual, coach_managed
4. ACTIVITIES            powerlifting, rugby_union, general_strength
5. ENGINE PHASES         Phase 1 → Phase 8 inclusive

FINAL RULE – anything not expressly permitted above does not exist in this beta.
## BETA-01 Spine Artefact Manifest Guard

BETA-01:SPINE-ARTEFACT-MANIFEST:START

Machine-checkable artefact manifest: spine/BETA_ARTEFACT_MANIFEST.json.

Rules:
- Artefact reachability is explicit-manifest-only.
- Missing beta artefacts fail closed.
- Orphan artefacts under spine/ fail closed.
- Phase 7 and Phase 8 reachability is beta-only under september_controlled_beta_2026.
- Fallback, discovery, inference, and defaults are not permitted.

BETA-01:SPINE-ARTEFACT-MANIFEST:END
## BETA-02 Checksum and Generated Drift Guard

BETA-02:CHECKSUM-GENERATED-DRIFT:START

Machine-checkable generated drift guard: ci/scripts/sha256_guard.mjs.

Rules:
- Placeholder checksums in beta seal scope fail closed.
- docs/checksums.sha256 must be the deterministic generated output.
- Beta spine artefact manifest JSON must stay stable.
- Generated index drift remains blocked by the existing generated index guards.

BETA-02:CHECKSUM-GENERATED-DRIFT:END
## BETA-03 CI Token Report Contract

BETA-03:CI-TOKEN-REPORT-CONTRACT:START

Machine-checkable CI token report contract: ci/scripts/ci_token_report.mjs.

Rules:
- Guard failures use structured JSON reports.
- Failure records include stable token and message fields.
- File, path, line, column, source, severity, and details are carried when available.
- The token catalogue covers spine, schema, registry, copy, replay, Phase 7, and Phase 8 guard topics.
- Token meaning remains owned by the emitting guard and source file.

BETA-03:CI-TOKEN-REPORT-CONTRACT:END
## BETA-05 Phase 1 Schema Closure

BETA-05:PHASE1-SCHEMA-CLOSURE:START

Machine-checkable Phase 1 schema closure: docs/v0/phase1_declaration_surface.schema.json, ci/contracts/phase1_v0_truth_surface.json, scripts/ci-enforce-phase1.mjs, test/beta_05_phase1_schema_closure.test.mjs.

Rules:
- Phase 1 accepts only explicit beta declarations.
- Unknown fields, missing required fields, explicit nulls, version mismatches, unsupported enums, unsupported actors, unsupported scopes, unsupported activities, and invalid presentation flags fail closed.
- Consent, age declaration, jurisdiction acknowledgement, location, equipment profile, and presentation flags are present and validated.
- coach_managed requires governing_authority_id.
- Positive fixtures cover powerlifting, rugby_union, and general_strength.
- Negative fixtures cover unknown field, missing consent, bad version, unsupported activity, invalid scope, and invalid presentation flag.
- Accepted Phase 1 input may be emitted byte-for-byte without enrichment, defaults, coercion, inference, or mutation.
- Presentation flags are Class C and must remain engine-inert.

BETA-05:PHASE1-SCHEMA-CLOSURE:END
## BETA-06 CL Gate Separation

BETA-06:CL-GATE-SEPARATION:START

Machine-checkable CL gate separation: docs/beta/BETA_06_CL_GATE_SEPARATION.md, src/betaClGateSeparation.mjs, test/beta_06_cl_gate_separation.test.mjs.

Rules:
- Controlled-launch legal permission is evaluated before technical engine work.
- Missing or false consent refuses controlled launch before engine, replay, evidence, or proof artefact creation.
- Missing or false jurisdiction acknowledgement refuses controlled launch before engine, replay, evidence, or proof artefact creation.
- Unsupported age declarations refuse controlled launch before engine, replay, evidence, or proof artefact creation.
- Unsupported actor or execution-scope declarations refuse controlled launch before engine, replay, evidence, or proof artefact creation.
- CL refusal returns product/legal refusal codes and neutral copy IDs only.
- CL refusal must not emit CI failure tokens, runtime technical failure tokens, replay records, evidence envelopes, proof artefacts, or engine artefacts.
- Technical failure remains a separate domain from CL legal refusal.

BETA-06:CL-GATE-SEPARATION:END
## BETA-07 Registry Loader Core

BETA-07:REGISTRY-LOADER-CORE:START

Machine-checkable registry loader core: docs/beta/BETA_07_REGISTRY_LOADER_CORE.md, ci/registry/s_reg_04_legacy_to_canonical_registry_bridge.mjs, test/beta_07_registry_loader_core.test.mjs, ci/fixtures/beta_07_registry_loader_core/.

Rules:
- Registry loading uses the canonical beta order: activity, movement, exercise, program.
- Registry loading is atomic and returns a runtime store only after all required registries validate.
- Partial loading, fallback loading, discovery loading, and runtime mutation are not permitted.
- Missing registry, duplicate registry ID, registry ID mismatch, unknown registry reference, and downstream forward reference all fail closed with stable BETA-07 loader tokens.
- The runtime registry store is deep-frozen and read-only.
- BETA-07 extends the existing S-REG-04 registry bridge module and does not create a duplicate loader.

BETA-07:REGISTRY-LOADER-CORE:END
## BETA-08 Registry FK and Enum Guard

BETA-08:REGISTRY-FK-ENUM-GUARD:START

Machine-checkable registry FK and enum guard: docs/beta/BETA_08_REGISTRY_FK_ENUM_GUARD.md, ci/registry/beta_08_registry_fk_enum_guard.mjs, test/beta_08_registry_fk_enum_guard.test.mjs, ci/fixtures/beta_08_registry_fk_enum_guard/.

Rules:
- Registry references and enum tokens are closed-world for beta registry-linked paths.
- Unknown enum tokens fail closed.
- Duplicate registry entry IDs fail closed.
- Unresolved FK references fail closed.
- Activity/subdivision mismatches fail closed.
- Metric/activity mismatches fail closed.
- Phase 1 declared metrics require matching 1C-A metric-to-exercise links.
- Derived-only metrics are refused from Phase 1 declarations.
- Registry cross-domain contamination fails closed.
- BETA-08 composes the existing BETA-07 atomic registry loader and does not create a duplicate loader or activate candidate registries.

BETA-08:REGISTRY-FK-ENUM-GUARD:END
## BETA-09 Phase 2 Canonical Hash

BETA-09:PHASE2-CANONICAL-HASH:START

Machine-checkable Phase 2 canonical hash: docs/beta/BETA_09_PHASE2_CANONICAL_HASH.md, engine/src/phases/phase2.ts, test/beta_09_phase2_canonical_hash.test.mjs.

Rules:
- Phase 2 canonicalises exact canonical Phase 1 JSON bytes using UTF-8.
- Object keys are sorted lexicographically at every object level.
- Canonical JSON emits no insignificant whitespace.
- Malformed JSON, trailing commas, and comments fail closed for byte/string input.
- Defaults, field removal, and value coercion are not permitted.
- Explicit legal null is preserved.
- Hash scope is exactly canonical_input_json bytes only.
- SHA256 hashes are lowercase hexadecimal.
- Repeated Phase 2 canonicalisation must be byte-identical and replayable.
- Downstream mutation must cause a recomputed hash mismatch.

BETA-09:PHASE2-CANONICAL-HASH:END
## BETA-10 Phase 3 Constraint Prune

BETA-10:PHASE3-CONSTRAINT-PRUNE:START

Machine-checkable Phase 3 constraint prune: docs/beta/BETA_10_PHASE3_CONSTRAINT_PRUNE.md, engine/src/phases/phase3.ts, engine/src/phases/beta10Phase3ConstraintPrune.ts, test/beta_10_phase3_constraint_prune.test.mjs.

Rules:
- Phase 3 beta constraint resolution is deterministic and staged in this order: authority, consent, declared legality, context, equipment, activity/role.
- Constraint stages are remove-only and must not expand the candidate solution space.
- Invalid authority fails before later pruning.
- Consent violation fails before later pruning.
- Declared legality, context, equipment, and activity/role constraints may only remove existing candidates.
- Unavailable required equipment fails closed.
- Unsupported beta activity fails closed.
- Empty solution space emits empty_solution_space and does not synthesize an alternative.
- BETA-10 does not add registry content, activate candidate registries, or alter downstream programme assembly semantics.

BETA-10:PHASE3-CONSTRAINT-PRUNE:END
