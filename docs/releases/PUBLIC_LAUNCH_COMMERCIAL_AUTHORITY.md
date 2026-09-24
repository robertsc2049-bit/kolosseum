# Kolosseum Public Launch Commercial Pricing and Entitlement Authority

Slice: LAUNCH-02
Release: Kolosseum Public Launch
Status: frozen commercial authority; not public-launch approval.

Commercial state controls product access only. It cannot alter engine legality, deterministic output, registry legality, substitution legality, factual history, proof truth, or coach-athlete relationship truth.

## Individual athlete

- £14.99/month.
- Product: `athlete_individual`; role: `athlete`; tier: `athlete_monthly`.
- The athlete subscription is separate from any coach subscription.

## Coach standard tiers

| Tier | Athlete hard cap | Standard price | Founding intro price |
|---|---:|---:|---:|
| `coach_6` | 6 | £24.99/month | £16.99/month |
| `coach_16` | 16 | £59.99/month | £39.99/month |
| `coach_32` | 32 | £109.99/month | £74.99/month |
| `coach_64` | 64 | £189.99/month | £129.99/month |
| `coach_120` | 120 | £299.99/month | £199.99/month |
| `coach_250` | 250 | £499.99/month | £329.99/month |

Money authority is stored as integer GBP minor units. No floating-point price is authoritative.

## Founding-coach entry offer

The offer is 30 days free, no card required during the free period, six paid months at the tier-specific introductory price, then automatic transition to standard price.

The initial active founding cohort is the first 100 qualifying high-touch founding coaches. This authority may later be explicitly amended up to 250; coaches 101-250 are not silently activated.

A tier upgrade during the introductory period changes tier, hard cap, standard price and tier-specific introductory price. It does not change `intro_period_start_at` or `intro_period_end_at` and does not restart the six-paid-month clock.

## Exact entitlement record

Every launch entitlement record uses exactly: `product`, `account_role`, `tier`, `athlete_capacity`, `trial_state`, `trial_start_at`, `trial_end_at`, `intro_price_state`, `intro_period_start_at`, `intro_period_end_at`, `standard_price_gbp_minor`, `intro_price_gbp_minor`, `billing_state`, `access_state`, `founding_coach`, `founding_cohort_ordinal`, `billing_provider_ids`, `entitlement_metadata`.

Billing provider identifiers and entitlement metadata are opaque commercial metadata only. They are not engine inputs and do not establish relationship truth.

## Capacity law

Coach athlete capacity is server authoritative and hard-capped. Occupied capacity is counted from server-side active coach-athlete relationship state. Any request above the tier cap is rejected as a product-access decision. There is no silent overflow and this is never an engine decision.

## Athlete and coach commercial separation

A coach subscription does not constitute an athlete personal subscription. An athlete subscription does not satisfy a coach subscription. Billing truth and relationship truth are separate authorities.

## Provider boundary

LAUNCH-02 is provider agnostic. It does not connect Stripe, implement checkout, bind provider price IDs, create customers or subscriptions, consume webhooks, or activate a billing portal. Existing historical controlled-launch payment code remains repository implementation, not new public-launch authority. LAUNCH-04 owns production billing lifecycle activation.

Existing controlled-launch organisation seat vocabulary does not authorise organisation, team, gym, or enterprise pricing for this public launch.

## Engine invariance

Executable proof runs the same canonical engine input while varying only tier, price, paid/unpaid state, trial state, founding-coach status, billing provider IDs, and entitlement metadata. Engine output bytes must remain identical because commercial state is never passed into the deterministic runner.

## Executable proof

    node --test test/launch_02_commercial_pricing_entitlement_freeze.test.mjs
    node scripts/launch_02_commercial_pricing_entitlement_guard.mjs

PASS token: `PUBLIC_LAUNCH_COMMERCIAL_AUTHORITY: PASS`

LAUNCH-02 does not authorise public launch. Final authority remains LAUNCH-10.
