import React from "react";

import { type JsonRecord } from "../../api/transport";
import { useCommercialAccount } from "./useCommercialAccount";

// DEV NOTE: FULL-UI-08 commercial/billing - ported from commercial_ui.js's
// #accountCommercialPanel rendering.
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
  const { loading, commercial, history, resultText, resultTone, entitlementText, entitlementTone, busy, openCheckout, openBillingPortal } =
    useCommercialAccount();

  const checkoutAvailable = commercial.checkout_available === true;
  const checkoutRedirectAvailable = commercial.checkout_redirect_available === true;
  const portalAvailable = commercial.portal_available === true;

  return (
    <section id="accountCommercialPanel" className="panel commercial-panel" aria-labelledby="commercialHeading">
      <div className="commercial-heading">
        <div>
          <p className="eyebrow">Controlled-launch commercial access</p>
          <h3 id="commercialHeading">Subscription and billing</h3>
          <p className="muted">Factual product-access and billing records only. Commercial state cannot alter engine truth.</p>
        </div>
        <div className="badge-row">
          <span className="badge neutral">{loading ? "Loading" : humanise(commercial.subscription_state)}</span>
          <span className="badge neutral">{loading ? "Loading" : humanise(commercial.product_access_state)}</span>
        </div>
      </div>

      <div className="commercial-fact-grid">
        <div className="commercial-fact">
          <span>Factual state</span>
          <strong>{humanise(commercial.factual_state)}</strong>
        </div>
        <div className="commercial-fact">
          <span>Billing status</span>
          <strong>{humanise(commercial.billing_status)}</strong>
        </div>
        <div className="commercial-fact">
          <span>Plan</span>
          <strong>{clean(commercial.plan_id) || "—"}</strong>
        </div>
        <div className="commercial-fact">
          <span>Seat allowance</span>
          <strong>{integerOrDash(commercial.seat_limit)}</strong>
        </div>
        <div className="commercial-fact">
          <span>Seat usage</span>
          <strong>{integerOrDash(commercial.occupied_seat_count)}</strong>
        </div>
        <div className="commercial-fact">
          <span>Seats available</span>
          <strong>{integerOrDash(commercial.available_seat_count)}</strong>
        </div>
      </div>

      <div className="commercial-actions">
        <button className="button primary" type="button" disabled={busy || !checkoutAvailable} onClick={() => openCheckout()}>
          {checkoutRedirectAvailable ? "Open checkout" : "Prepare checkout"}
        </button>
        <button className="button secondary" type="button" disabled={busy || !portalAvailable} onClick={() => openBillingPortal()}>
          Open billing portal
        </button>
      </div>

      <p className="muted commercial-boundary-copy">Checkout and portal actions create controlled-launch provider requests. No live provider SDK call is performed by this product slice.</p>
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
