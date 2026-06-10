# ARCHITECTURE

Document class: developer architecture reference
Status: working reference
Authority: non-canonical, engine-inert
Scope: repo structure, responsibility boundaries, and safe navigation
Does not define: engine behaviour, CI authority, legal authority, registry data, release scope, replay, evidence, or runtime execution logic

## 1. Purpose

This document explains how the Kolosseum repository is organised and how a developer should think about the main directories, contracts, guards, scripts, and product documentation.

It is a navigation and architecture reference. It does not override canonical engine, legal, CI, registry, or release-scope documents.

## 2. Architectural posture

Kolosseum is an engine-first training platform repository.

The dominant design principle is controlled determinism.

The repo is designed to make accidental drift difficult by using:

- narrow human workflow
- strict CI and local guards
- contract documents
- generated or pinned artefact checks
- registry validation
- golden output checks
- public/sales claim checks
- v0 boundary checks
- file hygiene guards

The repo should be treated as a controlled system, not a casual app workspace.

## 3. High-level responsibility map

| Area | Responsibility | Developer rule |
|---|---|---|
| `src/` | Application and platform implementation code | Keep behaviour explicit, tested, and inside v0 scope. |
| `engine/` | Engine package and exported deterministic engine surface | Treat changes as high-risk unless explicitly scoped. |
| `test/` | Unit and contract tests | Add or update tests when behaviour changes. |
| `ci/guards/` | Guard scripts enforcing repo and product invariants | Do not bypass. Update only with clear reason. |
| `ci/scripts/` | CI orchestration, golden, schema, and validation scripts | Treat as infrastructure. Keep deterministic. |
| `ci/contracts/` | CI composition contracts and manifests | Keep aligned when adding guarded test surfaces. |
| `registries/` | Registry data and registry-related artefacts | Closed-world data. Do not infer or silently extend. |
| `docs/` | Developer, product, contract, and surface documentation | State authority level clearly. |
| `docs/product/` | Product/design/status references | Engine-inert. Must not create engine capability. |
| `scripts/` | Developer, guard, runner, and operational scripts | Prefer deterministic PowerShell-safe workflows. |
| `.github/workflows/` | GitHub Actions workflows | PR checks are merge source of truth. |
| `dist/` | Build output where applicable | Do not hand-edit. |
| `examples/` | Example payloads and runner fixtures | Keep aligned with current contracts. |
| `out/` | Local/export output where applicable | Do not treat as source of truth. |

## 4. Engine and platform separation

The engine is responsible for deterministic training computation and contract-bound output.

The platform may add storage, visibility, operator workflow, pilot workflow, product references, support templates, and access surfaces where explicitly implemented.

Platform surfaces must not silently mutate engine truth.

Product/design references must not create engine behaviour.

Pilot/operator artefacts must not become public claims or engine authority.

## 5. Current v0 shape

Current v0 should be understood as the Deterministic Execution Alpha.

v0 includes the implemented current and adjacent surfaces listed in:

    docs/product/V0_SURFACE_INDEX.md

v0 remains bounded by the current release-scope and engine-contract documents.

Do not infer v0 capability from future-platform language, product ambition, or brand-feel docs.

## 6. Engine contract

The primary engine contract is:

    ENGINE_CONTRACT.md

Treat the following as contract-sensitive:

- Phase 1 through Phase 6 behaviour
- runner output shape
- CLI output shape
- deterministic ordering
- notes strings in golden outputs
- golden hashes
- registry-derived output
- Phase 6 stub and non-empty session shape
- exported CLI files

If a change alters behaviour covered by `ENGINE_CONTRACT.md`, treat it as a contract change.

Do not update golden outputs just to make a failing test pass.

## 7. CI and guard architecture

The repo uses layered guardrails.

Important guard categories include:

- clean working tree checks
- file encoding and line-ending checks
- repo contract checks
- workflow policy checks
- engine contract checks
- golden manifest and golden output checks
- schema checks
- registry checks
- commercial artefact checks
- public/sales claim checks
- v0 boundary consistency checks
- Phase 1 acceptance record checks

A failed guard is usually not noise. Read the failure and fix the cause.

## 8. Developer workflow architecture

Normal local workflow:

    npm run verify

Diagnostic workflow:

    npm run lint:fast
    npm run test:unit
    npm run build:fast
    npm run dev:status
    npm run diff:summary

PR workflow:

    git fetch origin
    git switch main
    git reset --hard origin/main
    git switch -c ticket/short-real-slice-name
    npm run verify
    git add <files>
    git commit -m "Clear commit message"
    git push -u origin <branch>
    gh pr create

Do not push directly to `main`.

## 9. Documentation architecture

Docs should state their authority level.

Recommended header fields:

- Document class
- Status
- Authority
- Scope
- Does not define

Examples of engine-inert documents:

- `docs/DEVELOPER_ONBOARDING.md`
- `docs/product/CURRENT_PROJECT_DOCS_STATUS.md`
- `docs/product/BRAND_FEEL_PARAMETERS_v0.md`
- `docs/product/V0_SURFACE_INDEX.md`

These documents help developers work correctly. They do not create runtime capability.

## 10. Product and claim boundaries

Kolosseum product copy and public claims are controlled.

Avoid unsupported claims around:

- safety
- medical meaning
- injury prevention
- optimisation
- suitability
- guaranteed progress
- readiness certification
- performance prediction
- organisation/team/gym runtime if not active

When in doubt, use factual language:

- recorded
- available
- declared
- submitted
- review required
- blocked
- not available
- coach_ready
- history available

## 11. Registry posture

Registries are closed-world data sources.

Do not add values casually.

Do not infer unknown values.

Do not silently coerce values.

Do not use registry edits to smuggle new product capability.

Registry changes should have clear purpose, guard coverage, and tests where applicable.

## 12. Testing posture

A senior developer should ask:

- What behaviour changed?
- What contract owns that behaviour?
- What test proves it?
- What guard prevents future drift?
- What docs need updating?
- What public or product copy risk exists?
- Does this affect v0 boundary?

Small deterministic tests are better than broad vague tests.

## 13. Common risk patterns

High-risk changes include:

- engine output changes
- registry changes
- golden output updates
- public claim changes
- workflow changes
- API contract changes
- role or permission changes
- Phase 1 acceptance changes
- anything using readiness, proof, evidence, safety, compliance, or optimisation language

Treat those as senior-review required.

## 14. Repo reading order

Recommended order for a new developer:

1. `README.md`
2. `docs/COMMANDS.md`
3. `CONTRIBUTING.md`
4. `docs/DEVELOPER_ONBOARDING.md`
5. `docs/ARCHITECTURE.md`
6. `ENGINE_CONTRACT.md`
7. `docs/product/CURRENT_PROJECT_DOCS_STATUS.md`
8. `docs/product/V0_SURFACE_INDEX.md`
9. `package.json`
10. `.github/workflows/`
11. `ci/guards/`
12. `ci/scripts/`
13. `src/`
14. `test/`

## 15. Final rule

The architecture is intentionally narrow.

Do not add capability because the product direction sounds plausible.

Add capability only when it is scoped, tested, guarded, documented, and inside the active boundary.