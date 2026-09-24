<!-- DEV NOTE: Repository-governance reference for ADMIN-01. GitHub ruleset state remains the external enforcement authority; this document records the audited check contexts and bypass policy that must match that live ruleset. -->

# GitHub Merge Enforcement

Status: ADMIN-01 required CI enforcement closure.
Repository: `robertsc2049-bit/kolosseum`.
Default branch: `main`.
Ruleset: repository ruleset `11819074` (`master`), targeting `~DEFAULT_BRANCH`.

## Purpose

The normal merge path must require the same CI surfaces that are treated as authoritative during manual merge review. A branch being merely up to date with `main` is not sufficient.

GitHub required-status-check rules match check/job context names, not workflow display names. GitHub Actions is the expected source for these checks (`integration_id: 15368`).

## Authoritative workflows and required contexts

The seven authoritative workflows expand to ten required check contexts because three workflows contain multiple required jobs.

| Workflow | Required GitHub check context |
| --- | --- |
| `v0 test suite` | `v0-test-suite` |
| `runnable-v0` | `runnable-v0` |
| `engine-status` | `engine-status-guard-pull_request` |
| `engine-status` | `engine-status-smoke-pull_request` |
| `vertical-slice` | `plan-session-api` |
| `vertical-slice` | `tier1-smoke-db` |
| `comprehensive test suite` | `comprehensive-test-suite` |
| `green` | `green-unit` |
| `green` | `green-integration` |
| `ci` | `ci` |

All ten contexts must be required from GitHub Actions app id `15368`.

The `engine-status` job names include `${{ github.event_name }}` deliberately. That workflow runs for both feature-branch pushes and pull requests; event-qualified names prevent a successful push run from satisfying the pull-request context requirement.

## Required branch rules

The active default-branch ruleset must retain all of the following:

- enforcement: `active`;
- target: `~DEFAULT_BRANCH`;
- pull request required before merge;
- one approving review required;
- stale approvals dismissed on push;
- review-thread resolution required;
- extra approval for unattributed changes required;
- strict required-status-check policy enabled, so the PR branch must be current with the base branch;
- all ten required contexts above, sourced from GitHub Actions app id `15368`;
- deletion protection;
- non-fast-forward protection.

## Bypass audit and decision

The pre-ADMIN-01 ruleset contained six always-bypass entries:

| Actor | Pre-ADMIN-01 mode | ADMIN-01 decision | Reason | Can bypass required CI after ADMIN-01? | Can bypass PR review after ADMIN-01? |
| --- | --- | --- | --- | --- | --- |
| Deploy keys (`DeployKey`, actor id `null`) | `always` | REMOVE | No default-branch deploy-key write path is required by the protected PR workflow. | No | No |
| Maintain role (`RepositoryRole` id `2`) | `always` | REMOVE | Maintainers can work through the normal PR path; broad default-branch bypass defeats CI enforcement. | No | No |
| Write role (`RepositoryRole` id `4`) | `always` | REMOVE | Writers can work through the normal PR path; broad default-branch bypass defeats CI enforcement. | No | No |
| Admin role (`RepositoryRole` id `5`) | `always` | RETAIN as `pull_request` only | Preserve explicit audited admin-merge/recovery capability without permitting direct pushes to `main`. | Yes, only when an admin explicitly invokes PR bypass | Yes, only when an admin explicitly invokes PR bypass |
| GitHub Copilot code review (`Integration` id `946600`) | `always` | REMOVE | Review automation does not require default-branch bypass. | No | No |
| GitHub Copilot coding agent (`Integration` id `1143301`) | `always` | REMOVE | Agent work can use feature branches and PRs; default-branch bypass is unnecessary. | No | No |

Owner decision for ADMIN-01: the only retained bypass is repository admin, narrowed to `pull_request` mode. It exists for explicit admin recovery/merge use, not as the normal merge path. Normal merges require every status check and the configured review requirements.

## PR-only main recovery

The obsolete workflow `.github/workflows/protect_main_autorevert.yml` was removed by ADMIN-01 because it attempted `git push origin HEAD:main` after generating a revert.

The retained `.github/workflows/protect-main-auto-revert.yml` creates a revert branch and opens a normal PR. Recovery therefore remains auditable and subject to the protected PR path rather than relying on a direct write to `main`.

## Required live ruleset state

The final `required_status_checks` rule must use strict mode and the following checks:

```json
{
  "strict_required_status_checks_policy": true,
  "do_not_enforce_on_create": false,
  "required_status_checks": [
    { "context": "v0-test-suite", "integration_id": 15368 },
    { "context": "runnable-v0", "integration_id": 15368 },
    { "context": "engine-status-guard-pull_request", "integration_id": 15368 },
    { "context": "engine-status-smoke-pull_request", "integration_id": 15368 },
    { "context": "plan-session-api", "integration_id": 15368 },
    { "context": "tier1-smoke-db", "integration_id": 15368 },
    { "context": "comprehensive-test-suite", "integration_id": 15368 },
    { "context": "green-unit", "integration_id": 15368 },
    { "context": "green-integration", "integration_id": 15368 },
    { "context": "ci", "integration_id": 15368 }
  ]
}
```

The final bypass list must be:

```json
[
  { "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "pull_request" }
]
```

## Acceptance proof

ADMIN-01 is complete only when live GitHub API inspection proves all of the following simultaneously:

1. repository default branch is `main`;
2. ruleset `11819074` is active and targets `~DEFAULT_BRANCH`;
3. pull requests remain mandatory;
4. strict required-status-check policy is `true`;
5. all ten contexts above are present and bound to GitHub Actions app id `15368`;
6. deletion and non-fast-forward rules remain present;
7. bypass actors exactly equal the single PR-only admin entry above;
8. a test PR behind `main` is blocked until updated;
9. a current test PR is blocked while any one required context is absent or failing.

If live ruleset state differs from this document, the live ruleset is authoritative and ADMIN-01 is not complete; repair the ruleset rather than weakening this policy.
