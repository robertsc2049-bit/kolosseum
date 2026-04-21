# v0 manual runtime checklist

Status key:
- GREEN = proven live
- AMBER = not yet proven
- RED = failed / forbidden surface reachable

## [1] Athlete onboarding completes successfully

- Status: GREEN
- Evidence: Completed athlete onboarding end to end in live v0 path on 2026-04-21; Phase 1 accepted and compile proceeded successfully.
- Notes: Tested manually on local main.

## [2] Individual session compiles and executes

- Status: GREEN
- Evidence: Ran individual session compile and execution end to end in live v0 path on 2026-04-21 with no runtime failure.
- Notes: Tested manually on local main.

## [3] Coach assigns a session successfully

- Status: GREEN
- Evidence: Observed coach assignment complete successfully in live v0 path on 2026-04-21.
- Notes: Tested manually on local main.

## [4] Athlete executes assigned session successfully

- Status: GREEN
- Evidence: Observed athlete execute assigned session successfully in live v0 path on 2026-04-21.
- Notes: Tested manually on local main.

## [5] Split mid-session works

- Status: GREEN
- Evidence: Observed split mid-session complete successfully in live v0 path on 2026-04-21.
- Notes: Tested manually on local main.

## [6] Return path offers 'Continue where I left off'

- Status: GREEN
- Evidence: Observed return path show 'Continue where I left off' in live v0 path on 2026-04-21.
- Notes: Tested manually on local main.

## [7] Return path offers 'Skip and move on'

- Status: GREEN
- Evidence: Observed return path show 'Skip and move on' in live v0 path on 2026-04-21.
- Notes: Tested manually on local main.

## [8] Partial completion remains factual only

- Status: GREEN
- Evidence: Observed partial completion remain factual only in live v0 path on 2026-04-21.
- Notes: Tested manually on local main.

## [9] Coach can only assign, view factual artefacts, and write non-binding notes

- Status: GREEN
- Evidence: Confirmed coach could only assign, view factual artefacts, and write non-binding notes in live v0 path on 2026-04-21.
- Notes: Tested manually on local main.

## [10] No org/team/unit/gym runtime is reachable in active v0 path

- Status: GREEN
- Evidence: Confirmed no org/team/unit/gym runtime was reachable in active v0 path on 2026-04-21.
- Notes: Tested manually on local main.

## [11] No Phase 7/8 evidence-export path is reachable in active v0 path

- Status: GREEN
- Evidence: Confirmed no Phase 7/8 evidence-export path was reachable in active v0 path on 2026-04-21.
- Notes: Tested manually on local main.

## Final operational call

- Runtime readiness: All 11 runtime checks proven green in live path.
- Ship / hold: SHIP
- Blocking failures: None