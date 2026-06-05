# Repository Map

This file explains the main repo areas and how to think about them.

It is a navigation guide only. It does not create product law.

## Core Areas

### `/docs`

Product, release, architecture, proof, developer, and operating documents.

Use this area to understand why the system exists, what is in scope, what is excluded, and how developers should work safely.

### `/docs/dev`

Developer-facing navigation and handover material.

This area should explain:

- How to enter the repo safely
- Where to find rules
- How to search
- What not to touch
- How docs are maintained

### `/contracts`

Contracts define expected structures, boundaries, and data surfaces.

Treat contracts as stronger than explanatory docs.

### `/registries`

Registry content and registry rules.

Registry behaviour must remain explicit, validated, and closed over supported v1 scope.

Do not use registry content to smuggle in unsupported sports, unsupported equipment behaviour, recommendation language, or hidden fallback semantics.

### `/tests`

Tests are executable proof.

When docs and implementation disagree, tests expose the current enforced behaviour. If the enforced behaviour is wrong, fix it through a proper slice, not by silently changing tests.

### `/scripts`

Repo automation, CI helpers, validation scripts, and developer checks.

Scripts should fail clearly and explain what boundary was violated.

### `/src`

Application and engine implementation.

Engine code must remain deterministic and isolated from UI, auth, billing, notes, dashboards, AI, and coach convenience layers unless a contract explicitly allows the data boundary.

### `/public` or UI areas

User-facing surfaces.

UI may display factual outputs, but must not create engine truth or make unsupported recommendations.

## Boundary Areas To Protect

### Engine Boundary

The engine owns deterministic compile/execution truth.

It must not consume:

- Coach notes
- AI output
- UI-only state
- Marketing copy
- Billing state
- Dashboard summaries
- Inferred fatigue/readiness/risk labels

### Coach Notes Boundary

Coach notes are factual review/support material.

They must remain engine-invisible.

### Registry Boundary

Registries define supported content and allowed mappings.

Do not add temporary fallback behaviour. Temporary fallback becomes hidden product law.

### Proof Boundary

Replay, hashes, evidence, and runtime proof must be reproducible.

Do not let convenience data alter proof.

### Copy Boundary

Copy must avoid unsupported claims.

Use factual wording such as:

- recorded
- reported
- declared
- completed
- skipped
- substituted
- changed
- selected period
- coach review

Avoid unsupported wording such as:

- optimal
- safe
- safer
- effective
- recommends
- fatigue
- readiness
- risk
- injury risk
- programme worked
- programme failed
