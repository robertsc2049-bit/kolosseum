import React from "react";

import { useRole } from "../../utils/role";
import { useAccountBranding } from "./useAccountBranding";

// DEV NOTE: FULL-UI-65 coach branding - ported from coach_branding_ui.js's
// #accountBrandingPanel. This panel mounts inside the shared #view-account
// section used by both actors, so (unlike every other single-actor panel
// migrated so far) it reads role from the same localStorage key legacy's
// readRole() reads and renders nothing for an athlete - matching legacy's
// elements.panel.hidden = !isCoach gate.
const DEFAULT_BRAND_COLOR = "#d2a952";

export function AccountBrandingPanel() {
  const isCoach = useRole() === "coach";
  const { brandColor, brandTagline, statusMessage, statusTone, saving, setBrandColor, setBrandTagline, saveBranding } = useAccountBranding();

  if (!isCoach) return null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveBranding();
  }

  return (
    <section className="panel" aria-labelledby="brandingHeading">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Branding</p>
          <h3 id="brandingHeading">Your athletes' view of you</h3>
          <p className="muted">An accent colour and optional tagline shown on your athletes' "My coach" card. Not a claim about qualifications or results.</p>
        </div>
      </div>

      <form className="athlete-detail-note-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Accent colour</span>
          <input type="color" value={brandColor || DEFAULT_BRAND_COLOR} onChange={(event) => setBrandColor(event.target.value)} />
        </label>

        <label className="field">
          <span>Tagline (optional)</span>
          <input
            type="text"
            maxLength={120}
            placeholder="Strength coaching, factual and simple."
            value={brandTagline}
            onChange={(event) => setBrandTagline(event.target.value)}
          />
        </label>

        <div className="inline-controls">
          <button className="button primary" type="submit" disabled={saving}>Save branding</button>
        </div>
      </form>

      {statusMessage ? (
        <p className="dashboard-status" role="status" aria-live="polite" data-tone={statusTone}>{statusMessage}</p>
      ) : null}

      <div className="record-card">
        <div className="record-meta">
          <span className="muted small">Preview</span>
        </div>
        <div className="coach-brand-preview" style={{ "--coach-brand-color": brandColor || DEFAULT_BRAND_COLOR } as React.CSSProperties}>
          <strong>Your athletes will see this next to your name</strong>
          {brandTagline ? <p className="muted small">{brandTagline}</p> : null}
        </div>
      </div>
    </section>
  );
}
