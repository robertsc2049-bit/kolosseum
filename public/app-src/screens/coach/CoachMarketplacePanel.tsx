import React, { useMemo, useState } from "react";

import { type JsonRecord } from "../../api/transport";
import { titleCase } from "../../utils/format";
import { useCoachMarketplace } from "./useCoachMarketplace";

// DEV NOTE: FULL-UI-67 programme marketplace browse - ported from
// app.js's renderMarketplace()/filteredMarketplaceTemplates()/
// marketplaceSearchText(). Read-only: browsing here never clones or
// assigns a programme (see test/full_ui_67_programme_marketplace_surface.
// test.mjs). The *sharing* toggle a coach uses to publish their own
// template (templateDetailSharedCheckbox, confirmSaveTemplateSharing)
// lives on the Programme Template Detail page instead and is unrelated -
// stays legacy, untouched by this slice.

function marketplaceSearchText(template: JsonRecord): string {
  return [template.template_name, template.description, template.activity_id, template.coach_display_name, template.coach_brand_tagline]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ");
}

type SortMode = "updated_desc" | "name_asc" | "coach_asc";

function sortTemplates(templates: JsonRecord[], sortMode: SortMode): JsonRecord[] {
  const sorted = [...templates];
  sorted.sort((left, right) => {
    if (sortMode === "name_asc") {
      return String(left.template_name ?? "").localeCompare(String(right.template_name ?? ""));
    }
    if (sortMode === "coach_asc") {
      return (
        String(left.coach_display_name ?? "").localeCompare(String(right.coach_display_name ?? "")) ||
        String(left.template_name ?? "").localeCompare(String(right.template_name ?? ""))
      );
    }
    return String(right.updated_at_iso8601 ?? "").localeCompare(String(left.updated_at_iso8601 ?? ""));
  });
  return sorted;
}

export function CoachMarketplacePanel() {
  const { loading, error, templates } = useCoachMarketplace();
  const [search, setSearch] = useState("");
  const [activityFilter, setActivityFilter] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("updated_desc");

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = templates.filter((template) => {
      if (activityFilter !== "all" && String(template.activity_id ?? "") !== activityFilter) return false;
      return !query || marketplaceSearchText(template).includes(query);
    });
    return sortTemplates(filtered, sortMode);
  }, [templates, search, activityFilter, sortMode]);

  if (loading && templates.length === 0) {
    return <p className="muted small">Loading marketplace…</p>;
  }

  if (error) {
    return <p role="status" className="muted small error">{error}</p>;
  }

  return (
    <>
      <div className="programme-library-controls" aria-label="Marketplace filters">
        <label className="field programme-search-field">
          <span>Search marketplace</span>
          <input
            type="search"
            autoComplete="off"
            placeholder="Name, activity or coach"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <label className="field">
          <span>Activity</span>
          <select value={activityFilter} onChange={(event) => setActivityFilter(event.target.value)}>
            <option value="all">All activities</option>
            <option value="powerlifting">Powerlifting</option>
            <option value="general_strength">General strength</option>
            <option value="rugby_union">Rugby union</option>
          </select>
        </label>

        <label className="field">
          <span>Sort</span>
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
            <option value="updated_desc">Recently updated</option>
            <option value="name_asc">Name A–Z</option>
            <option value="coach_asc">Coach A–Z</option>
          </select>
        </label>
      </div>

      <div className="record-list">
        {templates.length === 0 ? (
          <div className="empty-state">
            <h3>No shared programmes yet</h3>
            <p>Complete or active programmes another coach shares publicly will appear here.</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <h3>No programmes match</h3>
            <p>Try a different search term or activity filter.</p>
          </div>
        ) : (
          visible.map((template, index) => (
            <article
              className="record-row marketplace-template-row"
              style={template.coach_brand_color ? { borderLeft: `3px solid ${String(template.coach_brand_color)}` } : undefined}
              key={String(template.template_id ?? index)}
            >
              <div>
                <strong>{String(template.template_name ?? "")}</strong>
                <p className="muted small">
                  {titleCase(template.activity_id)} · {String(template.template_status ?? "")}
                </p>
                {template.description ? <p className="muted small">{String(template.description)}</p> : null}
                {template.price_label ? (
                  <p className="muted small">
                    <strong>{String(template.price_label)}</strong>
                  </p>
                ) : null}
                {template.payment_methods_note ? (
                  <p className="muted small">Accepted payment: {String(template.payment_methods_note)}</p>
                ) : null}
                <p className="muted small">
                  Shared by {String(template.coach_display_name ?? "")}
                  {template.coach_brand_tagline ? ` — ${String(template.coach_brand_tagline)}` : ""}
                </p>
              </div>
            </article>
          ))
        )}
      </div>
    </>
  );
}
