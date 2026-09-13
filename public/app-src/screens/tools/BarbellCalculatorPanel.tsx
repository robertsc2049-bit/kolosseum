import React from "react";

import { PlateWarmupCalculatorFields } from "../../components/PlateWarmupCalculator";

// DEV NOTE: standalone barbell/plate calculator - a dedicated view/nav
// item (#view-calculator, data-view="calculator") available to both
// athlete and coach roles (a bare .nav-item, matching the "account" nav
// button's own role-neutral pattern - see renderRoleNavigation() in
// app.js), unlike PlateWarmupCalculator.tsx's collapsible disclosure
// embedded in an active athlete session (pre-filled from the current
// exercise's prescription). Shares that same component's
// PlateWarmupCalculatorFields body with no pre-fill, since there's no
// exercise context on a standalone tool page - lives under screens/tools/
// rather than screens/athlete/ or screens/coach/ since it belongs to
// neither, mirroring screens/account/'s precedent for a role-neutral
// screen.
export function BarbellCalculatorPanel() {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Tools</p>
          <h2>Barbell calculator</h2>
          <p className="muted">Work out plate loading and a warm-up ramp for any target weight.</p>
        </div>
      </div>
      <article className="panel">
        <PlateWarmupCalculatorFields initialTarget="" initialUnit="kg" />
      </article>
    </>
  );
}
