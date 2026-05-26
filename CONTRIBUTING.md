# Contributing

This repository uses a narrow, guard-heavy workflow. Follow it exactly.

## First rule

Do not push directly to `main`.

Work on a branch, open a pull request, let checks run, then merge through the PR path.

## Normal local check

Before pushing a normal change, run:

    npm run verify

This is the supported local verification signal for humans.

## Branch workflow

From the repo root:

    git fetch origin
    git switch main
    git reset --hard origin/main
    git switch -c ticket/short-real-slice-name

Use a real branch name. Do not paste placeholder text into commands.

## File hygiene

Repo text files must be:

- UTF-8 without BOM
- LF-only line endings
- free of mojibake
- free of accidental generated junk

When writing files from PowerShell, prefer .NET UTF8Encoding(false) rather than `Set-Content -Encoding UTF8`.

## Commit and push

After changes:

    git status --short
    npm run verify
    git add <files>
    git commit -m "Clear commit message"
    git push -u origin <branch>

If hooks fail, fix the issue. Do not use `--no-verify`.

## Pull requests

A PR should state:

- what changed
- what files were added or updated
- why the change is engine-inert or what contract it touches
- what validation was run

PR checks are the source of truth for mergeability.

## Lockfile rule

If `package-lock.json` changes, update and stage `LOCKFILE_CHANGE_NOTE.md` as required by repo guards.

## Contract changes

If a change alters behaviour covered by `ENGINE_CONTRACT.md`, treat it as a contract change.

Do not update golden outputs just to make a failing test pass. Understand the behaviour change first.

## Documentation changes

Docs should state their authority level.

Use clear headers such as:

- Document class
- Status
- Authority
- Scope
- Does not define

Do not let product/design docs define engine behaviour, CI authority, legal authority, registry data, or release scope.

## If CI fails

The fix is required. Do not bypass guards.

Use diagnostic commands only to locate the failing layer, then return to:

    npm run verify