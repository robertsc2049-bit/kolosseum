import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const json = (relative) => JSON.parse(read(relative));

const EXPECTED_PLANS = Object.freeze([
  ["athlete_monthly", "athlete", null, 1499, null],
  ["coach_6", "coach", 6, 2499, 1699],
  ["coach_16", "coach", 16, 5999, 3999],
  ["coach_32", "coach", 32, 10999, 7499],
  ["coach_64", "coach", 64, 18999, 12999],
  ["coach_120", "coach", 120, 29999, 19999],
  ["coach_250", "coach", 250, 49999, 32999]
]);

function fail(reason, details = {}) {
  return Object.freeze({ ok: false, reason_code: reason, details: Object.freeze({ ...details }) });
}

export function validateLaunch04Authority(authority) {
  if (authority?.slice_id !== "LAUNCH-04" || authority?.release_id !== "kolosseum_public_launch") return fail("launch_04_authority_identity_invalid");
  if (authority?.public_launch_authorised !== false || authority?.final_acceptance_gate !== "LAUNCH-10") return fail("launch_04_final_gate_invalid");
  if (authority?.pricing_authority !== "docs/releases/PUBLIC_LAUNCH_COMMERCIAL_AUTHORITY.json") return fail("launch_04_pricing_authority_invalid");
  if (authority?.provider?.name !== "stripe" || authority?.provider?.activation_flag !== "KOLOSSEUM_PUBLIC_LAUNCH_BILLING_ENABLED") return fail("launch_04_provider_invalid");
  if (authority?.provider?.mode_variable !== "KOLOSSEUM_PUBLIC_LAUNCH_BILLING_MODE" || authority?.provider?.production_requires_live_mode !== true || authority?.provider?.production_requires_live_secret !== true) return fail("launch_04_provider_mode_invalid");
  if (authority?.provider?.browser_payment_return_is_trusted !== false || authority?.provider?.signed_webhook_is_trusted !== true) return fail("launch_04_provider_trust_invalid");

  const actualPlans = Object.entries(authority?.plans ?? {}).map(([tier, plan]) => [tier, plan.account_role, plan.athlete_capacity, plan.standard_price_gbp_minor, plan.intro_price_gbp_minor]);
  if (JSON.stringify(actualPlans) !== JSON.stringify(EXPECTED_PLANS)) return fail("launch_04_plan_drift", { actualPlans });

  const founding = authority?.founding_coach_offer ?? {};
  if (founding.active_cohort_limit !== 100 || founding.maximum_authorised_cohort !== 250 || founding.trial_days !== 30 || founding.card_required_to_start_trial !== false || founding.intro_paid_months !== 6 || founding.intro_clock_restarts_on_upgrade !== false || founding.tier_change_preserves_trial_start_end !== true || founding.tier_change_preserves_intro_start_end !== true) return fail("launch_04_founding_offer_invalid");

  const lifecycle = authority?.lifecycle ?? {};
  for (const key of ["coach_trial_start","checkout","tier_change","downgrade_over_capacity","cancellation","renewal","payment_failure","subscription_reconciliation","subscription_end","webhook_idempotency","webhook_ordering","stale_webhook_action"]) {
    if (!lifecycle[key]) return fail("launch_04_lifecycle_incomplete", { key });
  }
  if (authority?.capacity?.source !== "server_relationship_state" || authority?.capacity?.hard_cap !== true || authority?.capacity?.enforced_before_relationship_acceptance_when_public_launch_billing_enabled !== true || authority?.capacity?.over_capacity_result !== "product_access_rejected") return fail("launch_04_capacity_invalid");
  if (authority?.commercial_separation?.athlete_subscription_separate_from_coach_subscription !== true || authority?.commercial_separation?.coach_payment_satisfies_athlete_subscription !== false || authority?.commercial_separation?.athlete_payment_satisfies_coach_subscription !== false || authority?.commercial_separation?.organisation_team_gym_enterprise_tiers_authorised !== false) return fail("launch_04_subscription_separation_invalid");
  if (Object.values(authority?.engine_isolation ?? {}).some((value) => value !== false)) return fail("launch_04_engine_isolation_invalid");
  return Object.freeze({ ok: true });
}

export function runLaunch04Guard() {
  const authority = json("docs/releases/PUBLIC_LAUNCH_BILLING_LIFECYCLE.json");
  const pricing = json("docs/releases/PUBLIC_LAUNCH_COMMERCIAL_AUTHORITY.json");
  const result = validateLaunch04Authority(authority);
  if (!result.ok) return result;

  const priceProjection = [
    ["athlete_monthly", pricing.products.athlete_individual.standard_price_gbp_minor, null],
    ...pricing.products.coach.tiers.map((tier) => [tier.tier, tier.standard_price_gbp_minor, tier.intro_price_gbp_minor])
  ];
  const lifecycleProjection = Object.entries(authority.plans).map(([tier, plan]) => [tier, plan.standard_price_gbp_minor, plan.intro_price_gbp_minor]);
  if (JSON.stringify(priceProjection) !== JSON.stringify(lifecycleProjection)) return fail("launch_04_launch_02_price_drift");

  const service = read("src/api/public_launch_billing_service.ts");
  const aux = read("src/api/public_launch_billing_aux_service.ts");
  const routes = read("src/api/product_commercial.routes.ts");
  const webhookRoutes = read("src/api/product_commercial_webhook.routes.ts");
  const relationship = read("src/api/relationship_invitation_service.ts");
  const ui = read("public/app-src/screens/account/CommercialPanel.tsx");
  const client = read("public/app-src/api/commercialClient.ts");

  if (/from\s+["'][^"']*engine|require\([^)]*engine/iu.test(`${service}\n${aux}`)) return fail("launch_04_engine_import_forbidden");
  for (const symbol of ["startPublicLaunchCoachTrial","createPublicLaunchCheckout","changePublicLaunchCoachTier","cancelPublicLaunchBilling","reconcilePublicLaunchBilling","recordPublicLaunchBillingWebhookEvent","assertPublicLaunchCoachCapacity"]) {
    if (!service.includes(`export async function ${symbol}`)) return fail("launch_04_service_surface_missing", { symbol });
  }
  for (const route of ["/trial","/checkout","/tier","/cancel","/reconcile","/portal","/payment-return"]) {
    if (!routes.includes(`\"${route}\"`)) return fail("launch_04_route_missing", { route });
  }
  if (!webhookRoutes.includes("stripe.webhooks.constructEvent") || !webhookRoutes.includes("recordPublicLaunchBillingWebhookEvent")) return fail("launch_04_webhook_signature_boundary_missing");
  if (!service.includes("stripe_event_id") && !service.includes("webhook_idempotent_replay")) return fail("launch_04_webhook_idempotency_missing");
  if (!service.includes("webhook_stale_ignored") || !service.includes("latest_provider_event_created")) return fail("launch_04_webhook_ordering_missing");
  if (!service.includes("process.env.KOLOSSEUM_PUBLIC_LAUNCH_BILLING_MODE") || !service.includes("sk_live_") || !service.includes("sk_test_")) return fail("launch_04_test_live_boundary_missing");
  if (!relationship.includes("assertPublicLaunchCoachCapacity") || relationship.indexOf("assertPublicLaunchCoachCapacity") > relationship.lastIndexOf("relationship_state")) return fail("launch_04_relationship_capacity_wiring_missing");
  for (const action of ["requestCommercialTrial","requestCommercialCheckout","requestCommercialTierChange","requestCommercialCancellation","requestCommercialReconciliation","requestCommercialBillingPortal"]) {
    if (!client.includes(action)) return fail("launch_04_client_action_missing", { action });
  }
  for (const label of ["Start 30-day trial","Open checkout","Change plan","Refresh Stripe state","Open billing portal","Cancel at period end"]) {
    if (!ui.includes(label)) return fail("launch_04_ui_action_missing", { label });
  }
  return Object.freeze({ ok: true });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = runLaunch04Guard();
  if (!result.ok) {
    console.error(`${result.reason_code}: ${JSON.stringify(result.details ?? {})}`);
    process.exit(1);
  }
  console.log("PUBLIC_LAUNCH_BILLING_LIFECYCLE: PASS");
}
