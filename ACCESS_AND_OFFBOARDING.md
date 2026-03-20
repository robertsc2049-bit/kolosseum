# ACCESS AND OFFBOARDING

## Purpose
This document defines the minimum access, control, and offboarding rules for people who touch the Kolosseum repo, systems, or sensitive operational surfaces.

It exists to reduce:
- access sprawl
- hidden dependency risk
- retained access after departure
- undocumented ownership
- future contractor chaos

This document is operational law for humans and admin process.
If access is unmanaged, the repo is at risk.

---

## 1. Core principles

1. Access must be explicit.
2. Access must be least-privilege.
3. Access must be role-bound, not personality-bound.
4. Access must be revocable quickly.
5. No one should retain access they do not currently need.
6. Ownership of critical systems must always be known.
7. Offboarding is part of security, not an afterthought.
8. Shared secrets without inventory are unacceptable.

---

## 2. Minimum access register

Maintain a live access register covering at least:

- GitHub repo access
- branch protection/admin rights
- CI provider access
- package registry access
- domain / DNS access
- hosting / infrastructure access
- database access
- analytics access
- email / transactional service access
- payment processor access
- design / asset platform access
- documentation platform access
- backup / export access

For each system record:
- system name
- owner
- current access holders
- role level
- why access exists
- how revocation is performed
- whether recovery / break-glass exists

If this register does not exist or is stale, operational risk is active.

---

## 3. Access tiers

### Tier 1 - Founder / primary owner
Can control:
- repo administration
- branch protection
- billing-critical systems
- domain / DNS
- infrastructure ownership
- secrets rotation decisions
- emergency recovery

### Tier 2 - Core engineering / trusted maintainer
Can control only what is needed for active delivery:
- repo contribution
- approved CI interaction
- approved infrastructure surfaces
- issue / PR workflow
- environment access as required

### Tier 3 - Contractor / temporary contributor
Time-bounded, task-bounded access only:
- repo contribution where needed
- no unnecessary admin
- no persistent access after task ends
- no undocumented shared accounts

### Tier 4 - Read-only / reviewer
- read-only where possible
- no admin
- no secret access
- no deployment rights unless explicitly required

---

## 4. Repo access rules

### Required rules
- main branch protection stays on
- admin rights are tightly limited
- contributors use named accounts only
- no anonymous or shared repo identities
- access is granted only for current work
- dormant access is removed

### Forbidden
- shared GitHub logins
- permanent admin rights for convenience
- giving write/admin when read is enough
- leaving former contributors in privileged roles

---

## 5. Secrets and credentials

### Rules
- secrets must not live in casual chat notes or random local files
- secrets must be inventoried by system and owner
- shared credentials should be eliminated where possible
- when shared credentials exist temporarily, they must be rotated after contributor exit
- sensitive tokens must have clear rotation and revocation paths

### Minimum tracked items
- GitHub tokens
- deployment tokens
- package registry tokens
- CI tokens
- payment keys
- email service keys
- cloud credentials
- database credentials
- domain registrar credentials

### Hard rule
Unknown secrets ownership is not acceptable.

---

## 6. Device and environment expectations

For anyone doing active dev work, define:
- whether device is personal or company-owned
- whether disk encryption is required
- whether browser profile separation is required
- where code may be stored
- whether local production data access is forbidden
- whether secrets may be stored locally
- expected MFA use on critical systems

For bootstrap stage, keep this practical:
- named device
- MFA on critical accounts
- password manager in use
- no raw secret sprawl across desktop notes

---

## 7. Onboarding minimum

Before granting meaningful access, define:

- what role the person has
- what systems they actually need
- who approves their access
- what start date and expected end date apply
- what outputs they are responsible for
- how they will hand back work

Minimum onboarding checklist:
- account identity verified
- least-privilege access granted
- branch / PR workflow explained
- repo operating rules acknowledged
- boundary map acknowledged
- secrets handling expectations stated
- offboarding trigger agreed in advance

---

## 8. Offboarding triggers

Offboarding must occur when:
- contract ends
- contributor leaves
- contributor pauses indefinitely
- trust boundary changes
- role changes enough that old access is no longer justified
- credentials are suspected compromised

Offboarding is not optional because the person is trusted.
Trust is not a control surface.

---

## 9. Offboarding checklist

When offboarding a contributor, do all applicable steps:

### Repo / GitHub
- remove repo access
- remove team membership
- remove admin rights
- remove branch protection bypass rights
- close or transfer assigned admin tasks

### CI / deployment
- revoke CI access
- revoke deployment permissions
- remove environment secret visibility
- rotate exposed tokens if needed

### Infrastructure / services
- remove cloud access
- remove database access
- remove analytics access
- remove email service access
- remove payment-service access
- remove domain / DNS access where applicable

### Secrets
- rotate any secret they knew or may have copied
- invalidate personal tokens
- remove machine keys where applicable

### Knowledge / ownership
- recover documentation
- recover outstanding branch / PR context
- reassign ownership of active tasks
- confirm no sole dependency remains on departed contributor

### Confirmation
- log offboarding date
- log systems revoked
- log rotations performed
- log remaining residual risks if any

---

## 10. Single points of failure

At all times identify whether any one person uniquely controls:
- GitHub admin
- domain registrar
- hosting account
- payment processor
- email provider
- critical secrets store

If yes, document it and reduce the risk over time.

Bootstrap reality is fine.
Unknown fragility is not.

---

## 11. Contractor-specific rules

For future contractors:
- use time-bounded access wherever possible
- grant repo and system access only for current slice or deliverable
- do not grant broad admin for speed
- require work through PRs, not direct uncontrolled changes
- require documented handoff before access removal
- rotate sensitive access after contractor exit if exposure existed

---

## 12. Documentation ownership

The following docs should stay aligned with access reality:
- `DEV_OPERATING_RULES.md`
- `REPO_BOUNDARY_MAP.md`
- `PR_CHECKLIST.md`
- `ACCESS_AND_OFFBOARDING.md`

If access reality changes, update this document.
Stale access docs are operationally dangerous.

---

## 13. Final rule

Any person with repo or system access must satisfy all of the following:
- access is explicit
- access is justified
- access is documented
- access is revocable
- ownership is known
- offboarding path is known in advance

If any of those are false, access control is incomplete and must be corrected.
