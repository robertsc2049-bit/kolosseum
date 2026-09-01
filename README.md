<!-- DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts, deterministic checks, and developer handover standards. Do not introduce hidden defaults, broad discovery, or unreviewed boundary changes. -->

# Kolosseum

Docs index: see `docs/REPO_DOCS_INDEX.md`

Commands: see `docs/COMMANDS.md`

## What this repo is

Kolosseum is an engine-first training platform repo with strict CI, contract, and repo-hygiene enforcement. The supported workflow is intentionally narrow. Follow it exactly.

## First rule

Do not push directly to `main`.

Work on a ticket branch, open a PR, wait for checks, then merge through the PR path.

## How to validate changes

Use one manual verification signal:

    npm run verify

That is the default supported local check.

## Supported workflow

### Start from main

    Set-Location C:\path\to\kolosseum
    git switch main
    git pull --ff-only
    git switch -c ticket/real-slice-name

Use a real branch name. Do not paste placeholder text into Git commands.

### Make changes

After changes, use the standard repo commands:

    npm run verify
    npm run dev:status
    gh run list --limit 10

### Push through PR flow

    git push -u origin ticket/real-slice-name
    gh pr create
    gh pr checks --watch

### Merge through the supported helper

    Merge-KolosseumPr 123

That helper is expected to:

- wait for PR checks
- merge via PR
- return local repo to `main`
- pull latest `main`
- show latest GitHub Actions runs

## Repo rules

- `main` is PR-only. Do not bypass this with direct pushes.
- If checks fail, fix the failure. Do not bypass guards.
- `npm run verify` is the canonical manual verification command.
- Lower-level commands are for diagnosis, not the normal workflow.
- Keep the working tree clean after changes.
- If `package-lock.json` changes, `LOCKFILE_CHANGE_NOTE.md` must also be updated and staged, LF-only.
- Repo text files must be written as UTF-8 without BOM and LF line endings.
- Prefer PowerShell commands from repo root.

## Debug-only commands

Useful for isolating failures, not as the normal workflow:

    npm run lint:fast
    npm run test:unit
    npm run test:one -- test/some_test_file.test.mjs
    npm run build:fast
    npm run dev:status
    npm run diff:summary
    gh run list --limit 10

Use them to identify the failing layer. Use `npm run verify` when you want the single authoritative local signal.

## Session and API hardening status

The repo includes contract coverage around the session API and handler and service seams. Recent work has hardened executed-handler paths and preserved explicit error contracts across:

- `appendRuntimeEvent`
- `getSessionState`
- `listRuntimeEvents`
- `startSession`

That coverage is enforced through CI cluster manifests. When adding a new handler-level contract test, wire it into the appropriate manifest so it becomes part of standard CI.

## CI and workflow expectations

- PR checks are the source of truth for mergeability.
- Local green matters, but PR green is what counts.
- Do not assume a single check is enough unless the repo rules explicitly say so.
- Any automation that merges PRs must respect the repository ruleset and the full required check set.

## Where to look next

Start with:

- `docs/REPO_DOCS_INDEX.md` for the full documentation map
- `docs/DEVELOPER_ONBOARDING.md` for safe learning/building workflow
- `docs/ARCHITECTURE.md` for repo structure and boundaries
- `docs/SENIOR_DEVELOPER_REVIEW_CHECKLIST.md` for PR review discipline
- `docs/product/V0_SURFACE_INDEX.md` for the current v0 and pilot surface map
- `docs/product/CURRENT_PROJECT_DOCS_STATUS.md` for current docs currency
- `docs/COMMANDS.md` for command reference
- `package.json` for supported scripts
- `ci/contracts/` for CI composition manifests
- `.github/workflows/` for GitHub Actions behaviour

<!-- S-V1-07:DEVELOPER-ENTRY-PACK:START -->
## Developer Entry Pack

Status: minimum developer handover entry point.
Slice: S-V1-07.

A future developer should be able to open this repo, understand the current release boundary, run setup/check commands, and know what not to touch without founder memory.

Read in this order:

1. `docs/dev/GETTING_STARTED.md` - local setup, first checks, and current boundary pointers.
2. `docs/dev/COMMAND_GUIDE.md` - supported setup commands and check commands.
3. `docs/dev/REPO_MAP.md` - where repo areas live and what each area owns.
4. `docs/roadmap/ACTIVE_RELEASE_BOUNDARY.md` - current release boundary pointer.
5. `docs/v1/V1_RELEASE_BOUNDARY.md` - active v1 release boundary.
6. `docs/v1/V1_NOT_IN_SCOPE.md` - explicit exclusions and what not to touch.
7. `docs/dev/NAMING_CONVENTIONS.md` - naming rules for files, branches, slices, guards, tokens, events, routes, and IDs.
8. `docs/dev/CI_FAILURE_GUIDE.md` - how to handle failing CI without weakening boundaries.
9. `docs/adr/README.md` - architecture decision records. ADRs document decisions; they do not create engine law.

Local setup command:

    npm.cmd ci

Primary local check command:

    npm.cmd run verify

Generated-file refresh commands:

    npm.cmd run guard:index
    node ci/scripts/run_failure_token_index_guard.mjs --write
    npm.cmd run hash:write

Authority rule:

Docs define law.
Tests prove behaviour.
Comments explain boundaries.
CI blocks drift.

Do not touch runtime behaviour, engine behaviour, app implementation, registry content, payment/auth/UI implementation, workflows, or generated files unless a named slice explicitly permits it and states Boundary, Proof, and Non-scope.
<!-- S-V1-07:DEVELOPER-ENTRY-PACK:END -->
