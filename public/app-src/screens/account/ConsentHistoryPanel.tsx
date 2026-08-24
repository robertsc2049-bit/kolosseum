import React from "react";

import type { JsonRecord } from "../../api/client";
import { formatDate, titleCase } from "../../utils/format";

export function ConsentHistoryPanel({
  account,
  terms,
  consentHistory
}: {
  account: JsonRecord | null;
  terms: JsonRecord | null;
  consentHistory: JsonRecord[];
}) {
  const currentTerms = String(terms?.current_terms_version ?? account?.current_terms_version ?? "");
  const currentConsent = String(terms?.current_consent_version ?? account?.current_consent_version ?? "");
  const acceptedTerms = String(account?.accepted_terms_version ?? "");
  const acceptedConsent = String(account?.accepted_consent_version ?? "");

  return (
    <article className="panel">
      <div>
        <p className="eyebrow">Terms and consent</p>
        <h3>Current and accepted versions</h3>
      </div>

      <div className="commercial-fact-grid account-version-grid">
        <div className="commercial-fact">
          <span>Current terms</span>
          <strong>{currentTerms || "Unavailable"}</strong>
        </div>
        <div className="commercial-fact">
          <span>Accepted terms</span>
          <strong>{acceptedTerms || "Not recorded"}</strong>
        </div>
        <div className="commercial-fact">
          <span>Current consent</span>
          <strong>{currentConsent || "Unavailable"}</strong>
        </div>
        <div className="commercial-fact">
          <span>Accepted consent</span>
          <strong>{acceptedConsent || "Not recorded"}</strong>
        </div>
      </div>

      <div>
        <p className="eyebrow">Versioned history</p>
        <h4>Account history</h4>
      </div>

      <div className="record-list compact-record-list">
        {consentHistory.length === 0 ? (
          <div className="empty-state compact-empty">
            <p>No consent or verification events recorded.</p>
          </div>
        ) : (
          consentHistory.map((event, index) => {
            const payload =
              event.event_payload && typeof event.event_payload === "object"
                ? (event.event_payload as JsonRecord)
                : {};

            const versions = [
              payload.terms_version ? `Terms ${payload.terms_version}` : "",
              payload.consent_version ? `Consent ${payload.consent_version}` : ""
            ].filter(Boolean);

            return (
              <article className="record-card" key={String(event.event_id ?? index)}>
                <div>
                  <strong>{titleCase(event.event_type)}</strong>
                  <p>{formatDate(event.occurred_at_iso8601)}</p>
                  {versions.length > 0 ? <p className="muted small">{versions.join(" · ")}</p> : null}
                </div>
              </article>
            );
          })
        )}
      </div>
    </article>
  );
}
