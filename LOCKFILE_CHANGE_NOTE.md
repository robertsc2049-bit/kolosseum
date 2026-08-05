<!-- DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts, deterministic checks, and developer handover standards. Do not introduce hidden defaults, broad discovery, or unreviewed boundary changes. -->

# LOCKFILE CHANGE NOTE

Release: v0.1.24
Commit amended from local release commit: 52342942df6f8572ff7e105e16145a90ede45761

package-lock.json changed because package.json version was bumped from 0.1.23 to 0.1.24 for the immutable release tag.

No dependency additions, removals, or version changes were intended in this release note.
## BETA-28 auth RLS security pass

Commit subject: BETA-28 auth RLS security pass

package-lock.json changed through the non-breaking production dependency remediation command:

`npm audit fix --package-lock-only --omit=dev --audit-level=high`

No direct dependency declaration was intentionally added to or removed from package.json.

Verified production dependency audit:

- high: 0;
- critical: 0.

Verified tracked-file secret scan:

- findings: 0.

This note is committed in the same BETA-28 range as package-lock.json. The remediation does not alter Kolosseum engine law, deterministic output, registry content, sealed artefact bytes, access-policy decisions, or intended user-facing behaviour.

## FULL-UI-02 production dependency audit refresh

Commit subject: fix(ci): bind full UI guard governance

Production dependency audit totals before remediation:

- high: 1;
- critical: 0;
- affected audit entries: fast-uri.

package-lock.json was refreshed through:

`npm audit fix --package-lock-only --omit=dev --audit-level=high`

No direct dependency declaration was added to or removed from package.json by the audit repair.

Verified totals after remediation:

- high: 0;
- critical: 0.

This refresh does not alter Kolosseum engine law, deterministic output, registry content, sealed artefact bytes, access-policy decisions, runtime scope, or intended user-facing behaviour.

## FULL-UI-25 production dependency audit refresh

Commit subject: fix(deps): resolve fast-uri and js-yaml high-severity advisories

Production dependency audit totals before remediation:

- high: 1;
- critical: 0;
- affected audit entries: fast-uri.

package-lock.json was refreshed through:

`npm audit fix --package-lock-only --omit=dev --audit-level=high`

No direct dependency declaration was added to or removed from package.json by the audit repair.

Verified totals after remediation:

- high: 0;
- critical: 0.

This refresh does not alter Kolosseum engine law, deterministic output, registry content, sealed artefact bytes, access-policy decisions, runtime scope, or intended user-facing behaviour.

## Part E live messaging: add ws dependency

Commit subject: feat(messaging): add live delivery via WebSocket push (part E)

package-lock.json changed because a new direct dependency was added:

- `ws` (`^8.21.2`) added to `dependencies`.
- `@types/ws` (`^8.18.1`) added to `devDependencies`.

`ws` is the minimal, standard native WebSocket server implementation for
Node, used to push coach<->athlete and org-owner<->coach messages live to
connected clients on top of the existing async send/refresh flow. This
matches the repo's existing posture of small, purpose-specific dependencies
(`express`, `pg`, `ajv`, `dotenv`). No other dependency versions were
intentionally changed; any other lockfile movement is transitive
resolution from this addition.

This change does not alter Kolosseum engine law, deterministic output,
registry content, sealed artefact bytes, access-policy decisions, or any
existing user-facing behaviour - it is purely additive.
