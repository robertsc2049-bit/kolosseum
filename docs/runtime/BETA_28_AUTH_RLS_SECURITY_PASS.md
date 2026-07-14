# BETA-28 Auth RLS Security Pass

## Status

BETA-28 adds a fail-closed application authorization policy, protected resource API adapter, additive PostgreSQL row-level security migration, sensitive-action audit events, production dependency audit, and tracked-file secret scan.

It protects beta sessions, projection records, replay verdicts, sealed evidence, export operations, and coach notes.

## Existing boundary

The existing product contains deterministic product-auth records and relationship contracts, but it does not contain a credential provider or global credential middleware.

The existing legacy `/sessions` and `/blocks` routes remain unchanged so BETA-28 does not silently break the v0 runtime contract.

No legacy route rewiring is performed.

New beta-sensitive routes must use the BETA-28 protected resource adapter or an equivalent adapter that preserves this contract.

## Authenticated principal

A protected operation receives a server-resolved principal containing:

- authentication state;
- user identifier;
- actor type;
- account state.

The principal must be populated by trusted authentication code.

Client input cannot supply resource ownership.

An unauthenticated request fails closed.

A suspended account fails closed before ownership or relationship evaluation.

No credential provider is created by this slice.

## Owner-only access

An `individual_user` may access only resources whose server-resolved `owner_user_id` matches the authenticated user.

Session access is owner-only unless a valid coach relationship grants the requested action.

A wrong user is denied.

## Coach relationship-scoped access

Coach access requires:

- an authenticated active coach account;
- a relationship matching the coach;
- a relationship matching the resource owner;
- a permitted resource type;
- a permitted action;
- an allowed relationship status.

An active coach may access currently authorised sessions, projection records, replay verdicts, evidence, exports, and coach notes according to explicit policy.

An archived coach may read or export historical projection, replay verdict, evidence, export, and note records. Archived access cannot write sessions or coach notes.

A pending relationship is denied.

A revoked relationship is denied by the dedicated revoked coach lockout.

## Projection and replay verdict access

Projection and replay verdict records are sealed artefacts.

Owners may read or export their own records.

Policy-permitted active or archived coaches may read or export records for the related individual.

No user or coach may mutate sealed projection or replay verdict truth.

## Evidence access

Evidence ownership is resolved from trusted storage metadata.

Owners and policy-permitted coaches may read or export evidence.

BETA-26 checksum and immutability rules remain authoritative.

Manual creation, partial evidence, regeneration, update, deletion, and checksum failure remain denied.

## Export access

The protected resource API performs authorization before invoking the BETA-27 export service.

Successful operation responses are returned unchanged.

The security adapter does not parse, regenerate, timestamp, reserialise, or mutate exported bytes.

Revoked, suspended, unauthenticated, wrong-owner, and policy-excluded requests never invoke the export operation.

## Coach notes

Coach notes require an active coach relationship and explicit note permission.

Archived coaches may read historical notes but cannot add or update notes.

Revoked coaches and suspended accounts cannot access notes.

Notes remain non-binding and engine-invisible.

## Sealed artefact mutation

Any `write` or `mutate` action against a sealed resource is denied before the underlying operation is called.

The PostgreSQL migration also installs a trigger that rejects update or delete operations against sealed artefact rows.

## Row-level security

The additive migration creates:

- beta account state;
- coach relationship state;
- generic projection, replay verdict, and evidence byte storage;
- coach note storage;
- append-only security audit storage;
- ownership columns for blocks and sessions;
- RLS helper functions;
- owner and relationship-scoped policies;
- manual artefact insert denial;
- sealed artefact mutation denial;
- audit mutation denial.

The production runtime database role must not own the protected tables.

After verified authentication, application code must use `SET LOCAL` for:

- `app.user_id`;
- `app.actor_type`;
- `app.account_state`;
- `app.security_action`.

Table-owner and migration roles remain administrative and must not be used by the application runtime.

## Audit logging

Sensitive operations emit factual append-only events for:

- security access requested;
- security access granted;
- security access denied;
- sealed artefact mutation denied.

Audit events contain no training interpretation, recommendation, readiness, safety, or performance claims.

## Dependency audit

Run:

`npm.cmd run security:dependency-audit`

The command audits production dependencies and fails on high or critical vulnerabilities.

## Secret scan

Run:

`npm.cmd run security:secret-scan`

The scan examines Git-tracked text files for high-confidence private keys and service tokens.

Tracked `.env` files are denied unless they are clearly named examples, samples, or templates.

Secret values are never printed in findings.

## Proof

Run:

`npm.cmd run proof:beta-28`

The proof includes:

- unauthenticated access denial;
- wrong-user denial;
- revoked coach denial;
- suspended account denial;
- owner-only session access;
- active coach relationship access;
- archived historical access restrictions;
- projection access;
- replay verdict access;
- evidence access;
- export access;
- coach notes access;
- sealed artefact mutation denial before execution;
- unchanged successful export response;
- sensitive-action audit events;
- row-level security policy verification;
- tracked-file secret scan;
- production dependency audit;
- manifest and v0 compatibility.
