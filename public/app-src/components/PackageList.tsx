import React from "react";

import { type JsonRecord } from "../api/transport";

// Coaching packages as athletes see them: name and price, a line about it,
// and what's included (service_package_service.ts). Paid to the coach or
// gym directly.
export function PackageList({ packages, showDeliveredBy = false, actions }: { packages: JsonRecord[]; showDeliveredBy?: boolean; actions?: (pkg: JsonRecord) => React.ReactNode }) {
  if (!packages.length) return null;
  return (
    <ul className="package-list" aria-label="Packages">
      {packages.map((pkg) => {
        const delivered = Array.isArray(pkg.delivered_by) ? (pkg.delivered_by as JsonRecord[]) : [];
        return (
          <li className="package-card" key={String(pkg.package_id)}>
            <div className="package-card-head">
              <strong>{String(pkg.name)}</strong>
              <span className="package-price">{String(pkg.price_label ?? "")}</span>
            </div>
            {pkg.description ? <p className="muted small">{String(pkg.description)}</p> : null}
            <ul className="package-includes">
              {(Array.isArray(pkg.includes_summary) ? pkg.includes_summary : []).map((line) => <li key={String(line)}>{String(line)}</li>)}
            </ul>
            {showDeliveredBy && delivered.length ? <p className="muted small">{`With ${delivered.map((coach) => String(coach.display_name)).join(", ")}`}</p> : null}
            {actions ? <div className="inline-controls">{actions(pkg)}</div> : null}
          </li>
        );
      })}
    </ul>
  );
}
