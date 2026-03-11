# Kolosseum

Commands: see `docs/COMMANDS.md`

## What this repo is

Kolosseum is an engine-first training platform repo with strict CI, contract, and repo-hygiene enforcement. The supported workflow is intentionally narrow. Follow it exactly.

## First rule

Do not push directly to `main`.

Work on a ticket branch, open a PR, wait for checks, then merge through the PR path.

## How to validate changes

Use one manual verification signal:

```powershell
npm run verify
```

That is the default supported local check.

## Supported workflow

### Start from main

```powershell
Set-Location C:\Users\rober\kolosseum
git switch main
git pull --ff-only
git switch -c ticket/real-slice-name
```

Use a real branch name. Do not paste placeholder text into Git commands.

### Make changes

After changes, use the standard repo commands:

```powershell
npm run verify
npm run dev:status
gh run list --limit 10
```

### Push through PR flow

```powershell
git push -u origin ticket/real-slice-name
gh pr create
gh pr checks --watch
```

### Merge through the supported helper

```powershell
Merge-KolosseumPr 123
```

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

```powershell
npm run lint:fast
npm run test:unit
npm run test:one -- test/some_test_file.test.mjs
npm run build:fast
npm run dev:status
npm run diff:summary
gh run list --limit 10
```

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

- `docs/COMMANDS.md` for command reference
- `package.json` for supported scripts
- `ci/contracts/` for CI composition manifests
- `.github/workflows/` for GitHub Actions behavior