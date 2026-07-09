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
