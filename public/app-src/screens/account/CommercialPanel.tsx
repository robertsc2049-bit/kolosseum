import React, { useEffect, useMemo, useState } from "react";

import { type JsonRecord } from "../../api/transport";
import { useCommercialAccount } from "./useCommercialAccount";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function humanise(value: unknown): string {
  const text = clean(value);
  return text ? text.replaceAll("_", " ").replace(/\b\w/gu, (letter) => letter.toUpperCase()) : "—";
}

function dateTime(value: unknown): string {
  const candidate = clean(value);
  if (!candidate) return "—";
  const date = new Date(candidate);
  return Number.isNaN(date.getTime()) ? candidate : date.toLocaleString();
}

function integerOrDash(value: unknown): string {
  return Number.isInteger(value) ? String(value) : "—";
}

function gbp(value: unknown): string {
  return typeof value === "number" && Number.isInteger(value)
    ? new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value / 100)
    : "—";
}

function HistoryRecord({ record }: { record: JsonRecord }) {
  const state = clean(record.billing_status) || clean(record.billing_access_state) || clean(record.return_outcome) || "recorded";
  return (
    <article className="commercial-history-record">
      <strong>{humanise(record.record_type)}</strong>
      <p className="muted">{dateTime(record.effective_at_iso8601)} · {humanise(state)}</p>
    </article>
  );
}

export function CommercialPanel() {
  const {
    loading,
    commercial,
    history,
    resultText,
    resultTone,
    entitlementText,
    entitlementTone,
    busy,
    startTrial,
    openCheckout,
    changeTier,
    cancelSubscription,
    reconcileSubscription,
    openBillingPortal
  } = useCommercialAccount();

  const publicLaunch = clean(commercial.commercial_scope).startsWith("public_launch_");
  const currentTier = clean(commercial.tier) || clean(commercial.plan_id);
  const tierOptions = useMemo(
    () => Array.isArray(commercial.tier_options) ? (commercial.tier_options as JsonRecord[]) : [],
    [commercial.tier_options]
  );
  const [selectedTier, setSelectedTier] = useState(currentTier);

  useEffect(() => {
    if (currentTier) setSelectedTier(currentTier);
  }, [currentTier]);

  const checkoutAvailable = commercial.checkout_available === true;
  const checkoutRedirectAvailable = commercial.checkout_redirect_available === true;
  const portalAvailable = commercial.portal_available === true;
  const trialAvailable = commercial.trial_start_available === true;
  const tierChangeAvailable = commercial.tier_change_available === true;
  const cancelAvailable = commercial.cancel_available === true;
  const reconcileAvailable = commercial.reconcile_available === true;
  const selectedOption = tierOptions.find((option) => clean(option.tier) === selectedTier);
  const introActive = commercial.founding_coach === true && clean(commercial.intro_price_state) !== "completed";

  return (
    <section id="accountCommercialPanel" className="panel commercial-panel" aria-labelledby="commercialHeading">
      <div className="commercial-heading">
        <div>
          <p className="eyebrow">{publicLaunch ? "Public-launch commercial access" : "Controlled-launch commercial access"}</p>
          <h3 id="commercialHeading">Subscription and billing</h3>
          <p className="muted">Factual product-access and billing records only. Commercial state cannot alter engine truth.</p>
        </div>
        <div className="badge-row">
          <span className="badge neutral">{loading ? "Loading" : humanise(commercial.subscription_state)}</span>
          <span className="badge neutral">{loading ? "Loading" : humanise(commercial.product_access_state)}</span>
        </div>
      </div>

      <div className="commercial-fact-grid">
        <div className="commercial-fact"><span>Billing status</span><strong>{humanise(commercial.billing_status)}</strong></div>
        <div className="commercial-fact"><span>Plan</span><strong>{currentTier || "—"}</strong></div>
        <div className="commercial-fact"><span>Athlete allowance</span><strong>{integerOrDash(commercial.seat_limit)}</strong></div>
        <div className="commercial-fact"><span>Athletes connected</span><strong>{integerOrDash(commercial.occupied_seat_count)}</strong></div>
        <div className="commercial-fact"><span>Capacity available</span><strong>{integerOrDash(commercial.available_seat_count)}</strong></div>
        <div className="commercial-fact"><span>Trial</span><strong>{humanise(commercial.trial_state)}</strong></div>
      </div>

      {publicLaunch && tierOptions.length > 0 ? (
        <div className="commercial-plan-control">
          <label htmlFor="commercialTierSelect">Subscription plan</label>
          <select
            id="commercialTierSelect"
            value={selectedTier}
            disabled={busy}
            onChange={(event) => setSelectedTier(event.target.value)}
          >
            {tierOptions.map((option) => {
              const tier = clean(option.tier);
              const capacity = option.athlete_capacity;
              const standard = gbp(option.standard_price_gbp_minor);
              const intro = option.intro_price_gbp_minor === null || option.intro_price_gbp_minor === undefined
                ? null
                : gbp(option.intro_price_gbp_minor);
              return (
                <option key={tier} value={tier}>
                  {humanise(tier)} · {capacity === null ? "individual" : `up to ${String(capacity)} athletes`} · {introActive && intro ? `${intro} intro` : standard}/month
                </option>
              );
            })}
          </select>
          {selectedOption ? (
            <p className="muted">
              Standard {gbp(selectedOption.standard_price_gbp_minor)}/month
              {selectedOption.intro_price_gbp_minor !== null && selectedOption.intro_price_gbp_minor !== undefined
                ? ` · Founding-coach intro ${gbp(selectedOption.intro_price_gbp_minor)}/month after the 30-day trial.`
                : ""}
            </p>
          ) : null}
        </div>
      ) : null}

      {publicLaunch && commercial.founding_coach === true ? (
        <p className="muted">
          Founding coach #{String(commercial.founding_cohort_ordinal ?? "—")} · intro period {dateTime(commercial.intro_period_start_at)} to {dateTime(commercial.intro_period_end_at)}. Tier changes retain this clock.
        </p>
      ) : null}

      <div className="commercial-actions">
        {publicLaunch && trialAvailable ? (
          <button className="button secondary" type="button" disabled={busy || !selectedTier} onClick={() => startTrial(selectedTier)}>
            Start 30-day trial
          </button>
        ) : null}
        <button className="button primary" type="button" disabled={busy || !checkoutAvailable} onClick={() => openCheckout(publicLaunch ? selectedTier : undefined)}>
          {checkoutRedirectAvailable ? "Open checkout" : "Prepare checkout"}
        </button>
        {publicLaunch && tierChangeAvailable ? (
          <button className="button secondary" type="button" disabled={busy || !selectedTier || selectedTier === currentTier} onClick={() => changeTier(selectedTier)}>
            Change plan
          </button>
        ) : null}
        {publicLaunch && reconcileAvailable ? (
          <button className="button secondary" type="button" disabled={busy} onClick={() => reconcileSubscription()}>
            Refresh Stripe state
          </button>
        ) : null}
        <button className="button secondary" type="button" disabled={busy || !portalAvailable} onClick={() => openBillingPortal()}>
          Open billing portal
        </button>
        {publicLaunch && cancelAvailable ? (
          <button className="button secondary" type="button" disabled={busy} onClick={() => cancelSubscription()}>
            Cancel at period end
          </button>
        ) : null}
      </div>

      <p className="muted commercial-boundary-copy">
        {publicLaunch
          ? "Stripe controls payment confirmation. Billing and entitlement state control product access only and never alter engine, registry, substitution, factual history, proof or relationship truth."
          : "Controlled-launch provider requests remain available while the public-launch billing flag is disabled."}
      </p>
      {entitlementText ? <p className="inline-result commercial-entitlement-error" data-tone={entitlementTone}>{entitlementText}</p> : null}
      {resultText ? <p className="inline-result" data-tone={resultTone}>{resultText}</p> : null}

      <div>
        <p className="eyebrow">Commercial record history</p>
        <div className="record-list compact-record-list">
          {loading ? (
            <div className="empty-state compact-empty"><p>Loading commercial account history…</p></div>
          ) : history.length === 0 ? (
            <div className="empty-state compact-empty"><p>No commercial account records.</p></div>
          ) : (
            history.map((record, index) => <HistoryRecord key={`${String(record.record_type)}-${index}`} record={record} />)
          )}
        </div>
      </div>
    </section>
  );
}
