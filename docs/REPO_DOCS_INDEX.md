# REPO_DOCS_INDEX

Document class: repository documentation index
Status: working reference
Authority: non-canonical, engine-inert
Scope: documentation navigation for developers, reviewers, and future AI agents
Does not define: engine behaviour, CI authority, legal authority, registry data, release scope, replay, evidence, or runtime execution logic

## 1. Purpose

This document is the front-door map for Kolosseum repository documentation.

Use it to decide which document to read before editing code, docs, product surfaces, CI, registries, or public copy.

## 2. Start here

Read these first:

1. `README.md`
2. `docs/COMMANDS.md`
3. `CONTRIBUTING.md`
4. `docs/DEVELOPER_ONBOARDING.md`
5. `docs/ARCHITECTURE.md`
6. `docs/SENIOR_DEVELOPER_REVIEW_CHECKLIST.md`

## 3. Core contract and boundary docs

Read these before touching engine behaviour, contracts, boundaries, or product scope:

| Document | Purpose |
|---|---|
| `ENGINE_CONTRACT.md` | Defines Phase 1 through Phase 6 engine contract and deterministic guarantees. |
| `docs/product/CURRENT_PROJECT_DOCS_STATUS.md` | States which project docs are current and which older docs are incomplete. |
| `docs/product/V0_SURFACE_INDEX.md` | Maps active v0, pilot/operator, product/design, diagnostic-only, and future-platform surfaces. |

## 4. Product and design reference docs

Read these before changing UI, product copy, brand language, or public-facing surfaces:

| Document | Purpose |
|---|---|
| `docs/product/BRAND_FEEL_PARAMETERS_v0.md` | Defines ecosystem user feel, visual direction, copy posture, and brand separation. |
| `docs/product/BRAND_FEEL_PARAMETERS_v0_PROMPT.md` | Stores the reusable prompt used to generate the brand-feel reference. |

## 5. Workflow and command docs

Read these before running commands, pushing branches, or debugging CI:

| Document | Purpose |
|---|---|
| `docs/COMMANDS.md` | Defines the normal command contract and diagnostic commands. |
| `CONTRIBUTING.md` | Defines branch, PR, file hygiene, and contribution workflow rules. |
| `package.json` | Lists supported npm scripts. |

## 6. Review docs

Read these before reviewing a PR or asking an AI agent to modify the repo:

| Document | Purpose |
|---|---|
| `docs/SENIOR_DEVELOPER_REVIEW_CHECKLIST.md` | Gives PR and slice review discipline. |
| `docs/DEVELOPER_ONBOARDING.md` | Explains safe learning/building workflow for this repo. |
| `docs/ARCHITECTURE.md` | Explains repo structure, responsibility boundaries, and safe navigation. |

## 7. CI and implementation areas

Inspect these when debugging guard, workflow, test, or build behaviour:

| Area | Purpose |
|---|---|
| `.github/workflows/` | GitHub Actions workflow definitions. |
| `ci/guards/` | Guard scripts enforcing repo and product invariants. |
| `ci/scripts/` | CI orchestration, golden, schema, and validation scripts. |
| `ci/contracts/` | CI composition contracts and manifests. |
| `test/` | Unit, contract, and behaviour tests. |
| `src/` | Application and platform implementation. |
| `engine/` | Engine package and deterministic engine surface. |
| `registries/` | Closed-world registry data. |
| `scripts/` | Developer, runner, guard, and operational scripts. |

## 8. When adding new docs

New docs should state:

- Document class
- Status
- Authority
- Scope
- Does not define

Product/design docs must remain engine-inert.

Developer docs must not create runtime capability.

Prompt docs must not override canonical engine, CI, legal, registry, or release-scope documents.

## 9. When to update this index

Update this document when:

- a new senior developer doc is added
- a new product/design reference is added
- a major v0 surface map changes
- a new canonical contract doc is added
- the recommended repo reading order changes
- a document becomes obsolete or superseded

## 10. Final rule

If a developer cannot find the right document from this index, the docs system is not good enough.

Keep this index short, current, and useful.