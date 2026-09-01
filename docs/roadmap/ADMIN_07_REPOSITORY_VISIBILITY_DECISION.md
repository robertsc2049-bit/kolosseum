# ADMIN-07 — Repository Visibility Decision Record

Status: decided on `automation/admin-07-repository-visibility-decision`; visibility change not executed in this slice

Decision date: 2026-09-01

Decision: `MOVE_PRIVATE`

## Goal

Make repository visibility an explicit business and security decision rather than an accidental consequence of the repository's original setup.

## Current state at decision time

The Kolosseum repository is publicly visible and owned by a personal GitHub account. Repository metadata at the time of this decision shows zero forks, zero stars, zero watchers, no GitHub Pages site and no repository homepage.

The repository now contains substantial application source, deterministic engine and registry implementation, product architecture, CI/release law, operational design and commercially relevant implementation detail.

The existing `.github/workflows/release.yml` workflow is a release-verification workflow only. It explicitly uses read-only repository permissions and does not publish or deploy the application. The repository nevertheless has multiple GitHub Actions workflows and any external deployment or integration that is not represented in repository files must be checked separately before a visibility change is executed.

## Boundary

This record makes the visibility decision only.

This slice must not:

- change repository visibility;
- add or remove collaborators;
- rotate secrets or credentials;
- change GitHub Apps, webhooks or deploy keys;
- change CI or release permissions merely to accommodate a future visibility change;
- change deployment configuration;
- delete or rewrite public history.

A visibility change may occur only after explicit owner authorization in a later operation and only after the execution conditions in this record have been checked.

## Assessment — implications of remaining public

### Source-code disclosure

All committed source code remains available to anyone on the internet. This includes application logic, deterministic engine implementation, validation logic, data contracts, CI enforcement mechanisms and implementation history. Public visibility therefore gives competitors or third parties substantially more than a product interface: it gives them the implementation itself.

### Registry and content disclosure

Canonical and materialized registry content, exercise/activity relationships, substitution structure, programme-template implementation, provenance and registry closure mechanisms remain externally inspectable and clonable. These assets represent accumulated product work and reduce the cost for another party to reproduce a materially similar registry surface.

### Architecture disclosure

Repository structure, manifest law, engine boundaries, API shape, persistence assumptions, test strategy, release controls and planned implementation direction can be inferred from source, documentation and commit history. Public architecture can aid external review, but it also removes information asymmetry around how Kolosseum is built.

### Commercial implementation disclosure

Pricing logic or business operations that are committed now or later, feature sequencing, product constraints, launch mechanics, operational controls and internal decision records can become competitor intelligence. A public repository makes it harder to treat implementation detail as confidential commercial know-how.

### Security scrutiny

Public source allows independent scrutiny and can expose defects earlier, but it also gives an attacker complete source-level visibility into implementation choices, dependencies, API behaviour and guard assumptions. Repository privacy is not a substitute for secure engineering; remaining public simply means security controls must assume full hostile source disclosure at all times.

### Contribution and community benefits

Public repositories reduce friction for discovery, external review, issue reporting, forking and community contribution. Those benefits are currently weak for this repository: at decision time it has zero forks, zero stars and zero watchers, and it is not presently operating as an open-source community project.

### Deployment implications

Public visibility can simplify source-based integrations because a deployment service can read the repository without private-repository authorization. That convenience is not sufficient reason to expose the product implementation. Any deployment system that requires repository access should instead be explicitly authorized if the repository becomes private.

The current in-repository release workflow performs verification rather than deployment, so moving private does not conflict with an existing repository-owned publishing workflow.

### Dependency and security tooling implications

Public repositories receive free standard GitHub-hosted Actions usage and broad access to GitHub public-repository security features. Remaining public therefore has a CI cost advantage and may provide security tooling without additional private-repository licensing requirements.

That cost/tooling advantage must be weighed against disclosure of the product implementation rather than treated as a reason to leave visibility accidental.

## Assessment — implications of moving private

### Access control

Repository contents would become accessible only to the owner and explicitly authorized collaborators or integrations. This is materially better aligned with a commercial product whose implementation is not intended to be a public deliverable.

The repository is currently owned by a personal account. Personal-account private repositories have coarse collaborator permissions compared with an organization: collaborators are managed explicitly and should not be added casually. If broader staff, contractor or role-based access becomes necessary, transferring the repository to an appropriately configured GitHub organization should be assessed rather than compensating with uncontrolled collaborator access.

### Collaborator management

Every human or machine requiring repository access must be intentional. Before the visibility change, record the required collaborators, GitHub Apps, CI identities, deploy keys, webhooks and external services. Remove obsolete access rather than carrying it forward by default.

Future onboarding and offboarding must include repository-access review.

### CI and GitHub plan implications

Standard GitHub-hosted Actions usage is free for public repositories. Private repositories consume the account's included Actions minutes and storage allowance, with usage above the allowance billed or blocked according to the account plan and billing configuration.

The repository currently runs several substantial workflow families. Before changing visibility, confirm the account's current GitHub plan, included Actions allowance, payment/budget controls and expected CI consumption. Private-repository CI cost is an accepted operational consequence of the decision, but it must not be discovered accidentally after the change.

Some GitHub security capabilities available to public repositories can become plan- or license-dependent when a repository is private. Dependency graph and Dependabot behaviour, code scanning, secret protection and any Advanced Security capability in use must be verified against the account's actual plan before execution.

### Deployment integrations

Any external deployment or build integration that currently relies on unauthenticated public cloning will need explicit private-repository authorization. Before execution, verify all GitHub Apps, OAuth installations, deploy keys, webhooks, package/release consumers and hosting platforms that read this repository.

The current repository contains no GitHub Pages site, and the repository-owned release workflow does not publish the product. These facts reduce the immediate migration surface but do not prove that no external integration exists.

### Public issue and pull-request history expectations

Making the repository private restricts repository issues, pull requests, Actions logs and normal repository URLs to authorized users. External links to those resources should therefore be expected to stop working for unauthenticated or unauthorized users.

Moving private does not undo previous disclosure. Any source, commit, document, clone, cache or copy obtained while the repository was public must be treated as already disclosed. GitHub also documents that public forks of a repository are detached rather than made private when a public repository becomes private. Repository metadata currently reports zero forks, but that must be checked again immediately before execution.

GitHub erases stars and watchers when changing a public repository to private. Both counts are zero at this decision point, so there is currently no community-ranking value to preserve.

### External links and documentation

Any website, documentation, support material, automation or third-party record that points directly to repository files, issues, pull requests, raw GitHub content or Actions output must be audited. Public-facing material that needs to remain accessible should be hosted separately from the private source repository.

## Decision rationale

Kolosseum is being developed as a commercial product, not as an open-source project. The repository now contains implementation detail that has direct replication value: product architecture, registry content, engine logic, CI law and operational design.

The current measurable benefit of public visibility is low: there are no forks, stars or watchers and no GitHub Pages surface. The principal remaining advantages are lower-friction public access, free public-repository Actions minutes and some public-repository security tooling. Those benefits do not outweigh continuing source, architecture, registry and commercial disclosure.

Repository privacy will not make already-public material secret again and will not replace secure engineering. Its value is prospective: it stops routine unrestricted disclosure of future implementation and makes repository access an explicit controlled privilege.

## Execution authorization gate

The decision above does not itself authorize a visibility change.

A later visibility-change operation may proceed only after explicit owner authorization and after all of the following are confirmed:

1. The repository is still the intended repository and its current visibility is verified immediately before the change.
2. Current fork, star, watcher and GitHub Pages state is recorded.
3. Required human collaborators are identified and unnecessary access is removed.
4. Required GitHub Apps, webhooks, deploy keys, OAuth integrations and machine users are identified and confirmed to support private-repository access.
5. All deployment/build systems that consume repository source are identified and a private-repository authentication path is confirmed.
6. The GitHub account plan, private Actions allowance, storage allowance, billing/budget behaviour and likely CI usage are reviewed.
7. Security tooling that may change when moving private is identified and its post-change availability is confirmed.
8. Public-facing links to repository files, issues, pull requests, raw content, releases or Actions logs are identified and either accepted as becoming private or migrated to an appropriate public location.
9. The owner explicitly authorizes the visibility change after reviewing the checks above.
10. Immediately after the change, checkout, pull/push, PR CI, Green CI, release verification and any deployment integration relied upon by the product are smoke-tested.

If any required integration cannot operate against a private repository, the visibility change must not be executed until that integration is repaired, replaced or explicitly retired.

## Done condition

Repository visibility is now an intentional product decision. The intended end state is private, while the actual visibility change remains a separate owner-authorized operation with explicit integration checks.

## External platform facts checked for this decision

The assessment above was checked against current GitHub documentation for repository visibility changes, personal-repository access and collaboration, and GitHub Actions billing/usage on 2026-09-01. Platform terms and plan limits can change, so the execution operation must re-check them rather than relying indefinitely on this record.
