# V1 Stripe Checkout Controlled Launch

Status: active v1 controlled-launch boundary document.
Slice: S-V1-P-02.
Version: 1.1.0.

## Purpose

This document defines the controlled-launch checkout entry surface.

The slice creates a Stripe-ready or equivalent checkout contract. It does not add a live Stripe SDK dependency.

The checkout path creates a billing/access record only.

Webhook handling records provider event state against the billing/access record only.

## Live implementation note (2026-08-17)

The real, live individual-coach checkout and webhook implementation now lives outside this
contract module, in `src/api/product_commercial_service.ts`,
`src/api/product_commercial.routes.ts`, and `src/api/product_commercial_webhook.routes.ts`,
under FULL-UI-08 authority. That live path makes real Stripe Checkout Session and Billing
Portal Session calls and verifies real webhook signatures - the top-level release boundary
already permits this ("Stripe self-serve purchase and seat management" as a controlled-launch
exception).

This contract module (`src/v1ControlledLaunchCheckout.mjs` and its two adapters) remains a
dormant reference contract only: it still does not add a live Stripe SDK dependency itself,
is not imported by the live path, and is not mounted as a live route. It continues to define
the record shapes the live path's own state machine is modelled on.

## Allowed scope

S-V1-P-02 permits:

- controlled-launch checkout session request creation
- Stripe-ready provider session request shape
- equivalent checkout provider session request shape
- billing/access record creation
- webhook event handling for checkout completion, checkout expiry, and payment failure
- factual copy for checkout and billing access state
- API-shaped adapters for checkout and webhook requests

## Not included

S-V1-P-02 does not implement:

- live Stripe SDK calls
- Stripe secret handling
- Stripe signature verification
- customer portal
- self-serve seat management
- enterprise procurement
- enterprise billing
- multi-entity billing
- organisation billing
- marketplace billing
- revenue share
- royalties
- invoices
- tax handling
- automated mid-session upsell control

## Boundary invariants

1. Checkout creates billing/access records only.
2. Webhook handling updates billing/access records only.
3. Payment provider state is not deterministic input.
4. Payment provider state is not compile input.
5. Payment provider state is not substitution input.
6. Payment provider state is not replay input.
7. Payment provider state is not proof input.
8. Payment provider state is not factual history input.
9. Billing/access records may control product access only where the payment boundary permits it.
10. No checkout or webhook state can alter engine legality, compile output, substitution selection, replay records, proof records, or factual history records.

## Contract files

- `src/v1ControlledLaunchCheckout.mjs`
- `src/api/v1ControlledLaunchCheckoutApi.mjs`
- `src/api/v1ControlledLaunchWebhookHandler.mjs`
- `test/s_v1_p_02_stripe_checkout_controlled_launch.test.mjs`
- `ci/guards/s_v1_p_02_stripe_checkout_controlled_launch_guard.mjs`
- `copy/controlled_launch_checkout_copy.json`

## Required proof

The slice must prove:

- checkout path creates billing/access record only
- checkout path does not perform live provider calls
- webhook path updates billing/access record only
- payment cannot mutate engine legality
- payment cannot mutate compile output
- payment cannot mutate substitution
- payment cannot mutate replay
- payment cannot mutate proof
- payment cannot mutate factual history
- enterprise procurement is refused
- multi-entity billing is refused
- revenue share is refused
- royalties are refused
- copy is factual
- generated failure token index
- generated guard index
- generated checksum manifest
- standard proof sequence

## Failure token

`CI_V1_STRIPE_CHECKOUT_CONTROLLED_LAUNCH`

## Final rule

If checkout or webhook state changes deterministic legality, compile output, substitution, replay, proof, or factual history, the implementation is invalid.