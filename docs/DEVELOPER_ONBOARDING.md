# DEVELOPER_ONBOARDING

Document class: developer onboarding reference
Status: working reference
Authority: non-canonical, engine-inert
Scope: how to work in this repository without breaking guardrails
Does not define: engine behaviour, CI authority, legal authority, registry data, release scope, replay, evidence, or runtime execution logic

## 1. Purpose

This document gives a new developer a practical path into the Kolosseum repo.

It is written for someone who is still learning to code, program, and build, but wants to work in a senior-developer style.

The aim is to reduce accidental drift, broken branches, bad file encoding, weak commits, and unclear PRs.

## 2. Mental model

This repo is not a casual app repo.

It is an engine-first training platform with strict guardrails.

Most mistakes are not syntax mistakes. Most mistakes are boundary mistakes.

Common boundary mistakes include:

- changing engine behaviour from a product or UI surface
- adding copy that implies safety, advice, optimisation, or guarantees
- treating pilot/operator artefacts as engine truth
- adding future platform scope into v0
- bypassing guards instead of fixing them
- updating snapshots without understanding the contract change
- writing files with BOM or CRLF from PowerShell

## 3. Start every task from clean main

Use this pattern:

    Set-Location C:\Users\rober\kolosseum
    git fetch origin
    git switch main
    git reset --hard origin/main
    git status --short

The working tree should be clean before you start.

Then create a branch:

    git switch -c ticket/short-real-slice-name

## 4. Use the right verification command

For normal development:

    npm run verify

For deeper diagnosis only:

    npm run lint:fast
    npm run test:unit
    npm run build:fast
    npm run dev:status
    npm run diff:summary

Do not start with low-level commands unless you are isolating a specific failure.

## 5. File writing rules

Write text files as UTF-8 without BOM and LF-only.

PowerShell-safe write pattern:

    $Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    $Text = $Text -replace "`r`n", "`n"
    $Text = $Text -replace "`r", "`n"
    [System.IO.File]::WriteAllText($Path, $Text, $Utf8NoBom)

Avoid:

    Set-Content -Encoding UTF8

That can write UTF-8 with BOM on Windows PowerShell.

## 6. Authority levels

Before editing or creating a document, decide what kind of document it is.

Common classes:

- canonical engine law
- CI or guard contract
- registry data
- implementation contract
- product/design reference
- developer onboarding reference
- docs status reference
- prompt/reference material

If a document is product/design guidance, say clearly that it does not define engine behaviour, CI authority, legal authority, registry data, or release scope.

## 7. v0 boundary

Current v0 is the Deterministic Execution Alpha.

Keep v0 focused on:

- individual and coach-managed use
- Phase 1 through Phase 6
- factual runtime execution
- split and return
- partial completion
- coach assignment
- session artefact viewing
- non-binding coach notes
- history counts
- pilot/operator readiness surfaces where explicitly implemented

Do not silently add:

- Phase 7
- Phase 8
- evidence sealing
- exportable proof artefacts
- organisation runtime
- team runtime
- gym runtime
- analytics
- rankings
- predictive readiness
- medical or safety claims
- optimisation claims

## 8. Product/design docs

Product/design docs are useful, but they must remain engine-inert.

Examples:

- docs/product/BRAND_FEEL_PARAMETERS_v0.md
- docs/product/CURRENT_PROJECT_DOCS_STATUS.md
- docs/product/V0_SURFACE_INDEX.md

These documents guide product feel, scope interpretation, and developer orientation.

They must not create engine capability.

## 9. How to read the repo

Start here:

1. README.md
2. docs/COMMANDS.md
3. CONTRIBUTING.md
4. ENGINE_CONTRACT.md
5. docs/product/CURRENT_PROJECT_DOCS_STATUS.md
6. docs/product/V0_SURFACE_INDEX.md
7. package.json
8. .github/workflows/
9. ci/guards/
10. ci/scripts/
11. src/
12. test/

## 10. Pull request standard

A good PR says:

- what was added
- what was changed
- what was not changed
- whether there is engine impact
- what validation was run
- why the change is inside v0 or outside v0

A weak PR says only "updates docs" or "fixes stuff."

## 11. Do not bypass guardrails

If a guard fails, stop and read the failure.

Examples:

- no_bom_guard means rewrite as UTF-8 without BOM
- no_crlf_guard means normalise to LF
- no_mojibake_guard means fix corrupted text encoding
- clean_tree_guard means uncommitted files exist
- sales claim lint means copy or public claim language is unsafe
- v0 boundary guard means the change probably claims unsupported scope

The guard is usually telling you exactly what to fix.

## 12. Final rule

Move slowly enough that the repo remains clean.

Small, well-scoped PRs are better than large mixed changes.

When unsure, document the boundary instead of adding behaviour.