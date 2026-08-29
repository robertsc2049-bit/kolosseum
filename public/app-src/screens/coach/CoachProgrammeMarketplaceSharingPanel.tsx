import React, { useState } from "react";

import { type JsonRecord } from "../../api/transport";
import { formatDate } from "../../utils/format";
import { useCoachProgrammeMarketplaceSharing } from "./useCoachProgrammeMarketplaceSharing";

// DEV NOTE: FULL-UI-05A programme marketplace sharing/release sub-panel
// (its own manifest area) - ported field-for-field from public/app/app.js's
// templateDetailSharingSection markup and its four handler functions (see
// useCoachProgrammeMarketplaceSharing.ts's own DEV NOTE). Replaces the
// whole static #templateDetailSharingSection, including its hidden-toggle -
// no other legacy code depended on that section.

function ReleaseHistoryList({ releases }: { releases: JsonRecord[] }) {
  if (releases.length === 0) {
    return <p className="muted small">Not released to any coach yet.</p>;
  }

  return (
    <>
      {releases.map((release, index) => (
        <article className="record-row" key={String(release.buyer_coach_user_id ?? index)}>
          <div>
            <strong>Released to {String(release.buyer_coach_user_id ?? "")}</strong>
            <p className="muted small">{formatDate(release.released_at_iso8601)}</p>
          </div>
        </article>
      ))}
    </>
  );
}

export function CoachProgrammeMarketplaceSharingPanel() {
  const { shareable, sharing, savingSharing, sharingStatus, releases, releasing, releaseStatus, saveSharing, release } =
    useCoachProgrammeMarketplaceSharing();

  const [sharedPublicly, setSharedPublicly] = useState(false);
  const [priceLabel, setPriceLabel] = useState("");
  const [paymentMethodsNote, setPaymentMethodsNote] = useState("");
  const [buyerAccountCode, setBuyerAccountCode] = useState("");

  React.useEffect(() => {
    setSharedPublicly(sharing.shared_publicly);
    setPriceLabel(sharing.price_label);
    setPaymentMethodsNote(sharing.payment_methods_note);
  }, [sharing]);

  if (!shareable) return null;

  return (
    <div className="programme-detail-section">
      <p className="eyebrow">Marketplace</p>

      <form
        className="athlete-detail-note-form"
        onSubmit={(event) => {
          event.preventDefault();
          saveSharing({ sharedPublicly, priceLabel, paymentMethodsNote });
        }}
      >
        <label className="check-line">
          <input type="checkbox" checked={sharedPublicly} onChange={(event) => setSharedPublicly(event.target.checked)} />
          <span>Share this programme publicly with other coaches</span>
        </label>

        <label className="field">
          <span>Price (optional - shown to other coaches only, never charged by Kolosseum)</span>
          <input
            type="text"
            maxLength={40}
            placeholder="e.g. £49"
            autoComplete="off"
            value={priceLabel}
            onChange={(event) => setPriceLabel(event.target.value)}
          />
        </label>

        <label className="field">
          <span>Accepted payment methods (optional)</span>
          <input
            type="text"
            maxLength={200}
            placeholder="e.g. Venmo @handle, PayPal"
            autoComplete="off"
            value={paymentMethodsNote}
            onChange={(event) => setPaymentMethodsNote(event.target.value)}
          />
        </label>

        <button className="button secondary" type="submit" disabled={savingSharing}>Save marketplace details</button>
        <p className="muted small" role="status" aria-live="polite">{sharingStatus}</p>
      </form>

      <div className="programme-detail-section">
        <p className="eyebrow">Release</p>
        <p className="muted small">
          Once a buying coach has paid you however you've arranged, release a full copy of this programme to their account.
        </p>

        <form
          className="athlete-detail-note-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const trimmedCode = buyerAccountCode.trim();
            if (!trimmedCode) return;
            const released = await release(trimmedCode);
            if (released) setBuyerAccountCode("");
          }}
        >
          <label className="field">
            <span>Buyer's account code</span>
            <input
              type="text"
              autoComplete="off"
              placeholder="coach_..."
              required
              value={buyerAccountCode}
              onChange={(event) => setBuyerAccountCode(event.target.value)}
            />
          </label>
          <button className="button primary" type="submit" disabled={releasing}>Release to this coach</button>
          <p className="muted small" role="status" aria-live="polite">{releaseStatus}</p>
        </form>

        <div className="record-list">
          <ReleaseHistoryList releases={releases} />
        </div>
      </div>
    </div>
  );
}
