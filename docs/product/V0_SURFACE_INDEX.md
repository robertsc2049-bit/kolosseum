# V0_SURFACE_INDEX

Document class: product surface index
Status: working reference
Authority: non-canonical, engine-inert
Scope: current v0, pilot-adjacent, and product/design surfaces on main
Does not define: engine behaviour, CI authority, legal authority, registry data, release scope, replay, evidence, or runtime execution logic

## 1. Purpose

This document lists the current user-facing, operator-facing, pilot-facing, and product/design surfaces that exist in the repo.

It exists so developers and future AI agents do not confuse completed implementation slices, pilot controls, product references, and future-platform direction.

## 2. Classification key

Active v0 surface:
A surface that belongs to the current v0 product or implementation slice.

Pilot/operator surface:
A surface used to evaluate, prepare, or control a paid coach pilot. It is platform/operator logic, not engine law.

Product/design reference:
A product, design, or documentation guide. It must remain engine-inert.

Diagnostic-only surface:
A fenced or disabled surface that exists for diagnostics only.

Future-platform direction:
A described future surface that is not active v0 unless a later release definition explicitly activates it.

## 3. Current active v0 and adjacent surfaces

| Slice | Surface | Classification | Engine impact | Current meaning |
|---|---|---|---|---|
| S36 | Extra work / deviation event capture | Active v0 surface | None beyond factual runtime event capture | Records factual append-only runtime deviations without mutating future engine behaviour. |
| S37 | Session artefact viewer | Active v0 surface | None | Provides read-only factual session artefact viewing for permitted users. |
| S38 | Non-binding coach notes | Active v0 surface | None | Allows linked coaches to add observational notes that remain non-authoritative and engine-inert. |
| S39 | Coach assignment within limits | Active v0 surface | None | Controls platform visibility and access only. |
| S40 | History counts only | Active v0 surface | None | Provides factual history counts without analytics, scoring, ranking, readiness, or outcome evaluation. |
| S41 | Operator pilot dashboard | Pilot/operator surface | None | Provides factual operator view for pilot readiness source state. |
| S42 | Pilot state machine enforcement | Pilot/operator surface | None | Enforces closed pilot lifecycle transitions. |
| S43 | Support boundary templates | Pilot/operator and support surface | None | Provides factual boundary-safe support templates and operator picker contract. |
| S44 | Public/sales claim registry guard | Product/commercial guard surface | None | Enforces registered, proof-linked, boundary-safe public claims. |
| S45 | Coach-ready pilot acceptance pack | Pilot/operator surface | None | Defines pilot readiness checklist and negative boundary requirements. |
| S46 | Pilot sign-off record | Pilot/operator surface | None | Stores append-only coach_ready or blocked operator sign-off records. |
| S47 | Pilot blocked reason registry | Pilot/operator surface | None | Defines the closed-world blocked reason IDs for pilot sign-off. |
| S48 | Pilot readiness evaluator | Pilot/operator surface | None | Pure evaluator that derives coach_ready or blocked from checklist and boundary data. |
| S49 | Coach queue / review surface | Active v0 surface | None | Derives factual linked-coach review queue status without advice, scoring, ranking, readiness certification, or safety meaning. |
| S50 | Coach queue / review API adapter | Active v0 surface | None | Exposes the S49 factual queue builder through a narrow in-memory adapter without storage, UI, advice, scoring, ranking, readiness certification, or safety meaning. |
| S51 | Coach queue / review route contract | Active v0 surface | None | Defines a handler-level route contract over S50 without Express registration, storage, UI, advice, scoring, ranking, readiness certification, or safety meaning. |
| S52 | Coach queue / review read model fixture pack | Active v0 surface | None | Provides stable fake source records and expected route responses for the S49-S51 coach queue surface without UI, storage, advice, scoring, ranking, readiness certification, or safety meaning. |
| S53 | Coach queue / review minimal UI read model renderer | Active v0 surface | None | Renders fixture-backed coach queue read-model states as deterministic safe HTML without live API, storage, route registration, advice, scoring, ranking, readiness certification, or safety meaning. |
| S54 | Coach queue review static preview page | Active v0 surface | None | Provides a committed static non-production preview artifact generated from S52 fixtures and S53 renderer output without live API, database, route registration, auth, production navigation, advice, scoring, ranking, readiness certification, or safety meaning. |

## 4. Product and design references

| Document | Classification | Engine impact | Meaning |
|---|---|---|---|
| docs/product/BRAND_FEEL_PARAMETERS_v0.md | Product/design reference | None | Defines ecosystem user-feel, visual direction, copy posture, and brand separation. |
| docs/product/BRAND_FEEL_PARAMETERS_v0_PROMPT.md | Prompt/reference material | None | Reusable prompt used to generate the brand-feel reference. |
| docs/product/CURRENT_PROJECT_DOCS_STATUS.md | Docs status reference | None | Records that older attached docs are directionally useful but incomplete against current repo work. |
| docs/product/V0_SURFACE_INDEX.md | Product surface index | None | Maps current v0 and pilot-adjacent surfaces. |

## 5. Diagnostic-only surfaces

| Surface | Classification | Engine impact | Meaning |
|---|---|---|---|
| Public UI diagnostics fence | Diagnostic-only surface | None | Legacy public UI files are fenced and disabled unless explicitly enabled for diagnostics. |

## 6. Future-platform direction

These are not active v0 unless a later release definition explicitly activates them:

- full organisation dashboards
- team-wide operating standards
- compliance exports
- evidence sealing
- proof artefacts
- event readiness dashboards
- broad reporting systems
- staff oversight layers
- cross-entity governance
- advanced AI administration
- ranking
- scoring
- predictive readiness
- organisation runtime
- team runtime
- gym runtime

## 7. Terms that require care

The following terms are allowed only with careful factual framing:

- readiness
- coach_ready
- sign-off
- compliance
- evidence
- proof
- dashboard
- reporting
- oversight
- status
- progress
- performance

Do not use these terms to imply safety, medical judgement, suitability, optimisation, performance prediction, readiness certification, or guaranteed outcomes.

## 8. Senior developer review rule

When adding a new surface, update this document if the new surface changes the repo's product map.

Every new surface should answer:

- Is it active v0, pilot/operator, product/design, diagnostic-only, or future direction?
- Does it affect engine behaviour?
- Does it create public claims?
- Does it introduce role authority?
- Does it require a guard?
- Does it need copy registry treatment?
- Does it risk v0 scope expansion?

## 9. Final rule

This index is a map, not authority.

If this index conflicts with canonical engine, legal, CI, registry, or release-scope documents, the canonical documents win.

If this index conflicts with completed repo work, update this index.