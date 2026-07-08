# Developer Operating Conventions

Status: canonical developer operating convention for v1 and later.
Release boundary: applies from S-V1-00 onward.

## Purpose

This file is the entry point for developer operating rules. It does not create product scope. It binds how future work is named, sliced, reviewed, documented, and proved.

## Required reading order

1. docs/dev/NEW_DEVELOPER_START_HERE.md
2. docs/dev/GETTING_STARTED.md
3. docs/dev/REPO_MAP.md
4. docs/roadmap/ACTIVE_RELEASE_BOUNDARY.md
5. docs/dev/NAMING_CONVENTIONS.md
6. docs/dev/BRANCH_AND_PR_CONVENTIONS.md
7. docs/dev/SLICE_TEMPLATE.md
8. docs/dev/CI_FAILURE_GUIDE.md
9. docs/dev/CODE_COMMENT_POLICY.md
10. docs/dev/FUNCTION_DOCUMENTATION_POLICY.md
11. docs/adr/README.md

## Operating law

Docs define law.
Tests prove behaviour.
Comments explain boundaries.
CI blocks drift.

## Slice rule

One active slice at a time.

A slice must have:

- target,
- invariant,
- proof,
- allowed files,
- forbidden files,
- tests,
- rollback plan.

Do not combine unrelated conventions, product functionality, UI polish, registry content, commercial copy, and CI repair in one slice.

## Boundary rule

The deterministic engine must remain isolated from:

- auth,
- UI,
- billing,
- coach notes,
- commercial copy,
- dashboards,
- marketplace,
- messaging,
- organisation logic,
- gym or EPOS logic.

Any new boundary crossing must have a contract, test, and guard.

## Developer notes rule

Add DEV NOTE or JSDoc only where it explains:

- purpose,
- boundary,
- invariant,
- determinism,
- failure behaviour,
- what not to change.

Do not add noisy comments that restate obvious code.

## Naming rule

Use docs/dev/NAMING_CONVENTIONS.md.

Names must be boring, explicit, and searchable. Names must not imply unbuilt product capability.

## PR rule

Use docs/dev/BRANCH_AND_PR_CONVENTIONS.md and .github/pull_request_template.md.

Every PR must describe boundary and proof.

## CI rule

A change is not complete until the relevant local gates pass and GitHub checks are green where applicable.

Preferred proof order:

1. npm.cmd run lint:fast
2. npm.cmd run test:v0 where v0 boundary can be affected
3. npm.cmd run build:fast
4. npm.cmd run test:change
5. npm.cmd run test:full for release or convention changes
6. targeted guard or test for the slice

## No hidden scope rule

Do not introduce hidden v1 features under names such as scaffolding, placeholder, polish, helper, preview, demo, or temporary.

A placeholder is allowed only when it is documented as non-executable, test-bound, and outside engine truth.

## V1 start rule

Before v1 product implementation, confirm:

- active release boundary,
- supported activities,
- registry target,
- app data model freeze point,
- proof layer plan,
- no-coupling tests,
- branch and PR conventions,
- naming conventions.

<!-- S-V1-06:ADR-SYSTEM-START:START -->
## ADR rule

Architecture Decision Records live in `docs/adr`.

ADRs document decisions; they do not create engine law.

Boundary docs and tests remain authoritative where applicable.

Use ADRs for durable architectural or boundary decisions that a future developer must understand without founder memory.

Do not use ADRs to create product scope, alter engine behaviour, alter registry law, authorise app implementation, authorise payment/auth/UI behaviour, or bypass tests and guards.
<!-- S-V1-06:ADR-SYSTEM-START:END -->

<!-- S-V1-07:DEVELOPER-ENTRY-PACK-RULE:START -->
## Developer entry pack rule

The minimum developer entry pack is:

- `README.md`
- `docs/dev/GETTING_STARTED.md`
- `docs/dev/COMMAND_GUIDE.md`
- `docs/dev/REPO_MAP.md`
- `docs/dev/NAMING_CONVENTIONS.md`
- `docs/dev/CI_FAILURE_GUIDE.md`
- `docs/roadmap/ACTIVE_RELEASE_BOUNDARY.md`
- `docs/adr/README.md`

A future developer must be able to find the current release boundary, setup commands, check commands, failure path, naming rules, and what not to touch from these files.

These docs explain authority without creating new product law.
<!-- S-V1-07:DEVELOPER-ENTRY-PACK-RULE:END -->
