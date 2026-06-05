# Documentation Search Guide

This guide gives deterministic commands for finding Kolosseum rules in the repo.

Use search before relying on memory.

## Basic Search

Run from repo root:

    git grep -n "search term"

Examples:

    git grep -n "deterministic"
    git grep -n "substitution"
    git grep -n "release boundary"

## Case-Insensitive Search

    git grep -ni "search term"

Examples:

    git grep -ni "readiness"
    git grep -ni "fatigue"
    git grep -ni "recommend"

## Search Headings

Markdown headings are useful search anchors.

    git grep -n "^#"
    git grep -n "^##"
    git grep -n "^###"

## Search For Scope Boundaries

    git grep -ni "v0"
    git grep -ni "v1"
    git grep -ni "release boundary"
    git grep -ni "not-v1"
    git grep -ni "post-v1"
    git grep -ni "excluded"
    git grep -ni "non-goal"
    git grep -ni "non-goals"

## Search For Engine And Proof Rules

    git grep -ni "engine"
    git grep -ni "deterministic"
    git grep -ni "canonical"
    git grep -ni "hash"
    git grep -ni "replay"
    git grep -ni "proof"
    git grep -ni "evidence"
    git grep -ni "no-coupling"

## Search For Registry Rules

    git grep -ni "registry"
    git grep -ni "exercise"
    git grep -ni "equipment"
    git grep -ni "supported activities"
    git grep -ni "foreign key"
    git grep -ni "closure"

## Search For Substitution Rules

    git grep -ni "substitution"
    git grep -ni "substitute"
    git grep -ni "fallback"
    git grep -ni "equipment"
    git grep -ni "intent"
    git grep -ni "specificity"

## Search For Claim-Language Risk

    git grep -ni "recommend"
    git grep -ni "recommended"
    git grep -ni "optimal"
    git grep -ni "safe"
    git grep -ni "safer"
    git grep -ni "risk"
    git grep -ni "injury"
    git grep -ni "fatigue"
    git grep -ni "readiness"
    git grep -ni "effective"

Finding these words does not automatically mean the repo is wrong. Some files may document banned language. Review context before changing anything.

## Search For Coach Notes Boundary

    git grep -ni "coach notes"
    git grep -ni "notes"
    git grep -ni "engine-invisible"
    git grep -ni "review"

## Search For Live Session Status Boundary

    git grep -ni "live session"
    git grep -ni "session status"
    git grep -ni "in_progress"
    git grep -ni "split"
    git grep -ni "returned"
    git grep -ni "partially_completed"

## Search For Developer Handover Material

    git grep -ni "DEV NOTE"
    git grep -ni "handover"
    git grep -ni "new developer"
    git grep -ni "repo map"
    git grep -ni "architecture boundary"

## PowerShell Search Alternative

If Git search is not enough:

    Get-ChildItem -Recurse -File | Select-String -Pattern "search term"

Example:

    Get-ChildItem -Recurse -File | Select-String -Pattern "substitution"

## Search Discipline

Before changing behaviour, search for:

1. The feature name.
2. The boundary name.
3. The error token.
4. The related test.
5. The release or slice document.

Do not implement from memory when a repo rule exists.
