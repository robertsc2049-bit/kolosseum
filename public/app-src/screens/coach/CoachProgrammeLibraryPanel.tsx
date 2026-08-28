import React, { useMemo, useState } from "react";

import { type JsonRecord } from "../../api/transport";
import { countdownLabel, formatDate, titleCase } from "../../utils/format";
import {
  filteredProgrammeTemplates,
  programmeAssignmentUsage,
  programmeDisplayState,
  programmeFamilyVersions,
  programmeVersionNumber,
  type ProgrammeSortMode,
  useCoachProgrammeLibrary
} from "./useCoachProgrammeLibrary";

// DEV NOTE: FULL-UI-05A programme library (read-only) - ported from
// public/app/app.js's renderTemplateLibrary()/templateCard()/
// templateStatusBadge(). The programme detail panel and builder stay
// legacy (out of scope) - every card action below dispatches a bridge
// CustomEvent that a listener in app.js forwards to the existing,
// untouched legacy functions (openProgrammeDetail/openTemplateBuilder/
// completeTemplateById/activateTemplateById/duplicateTemplate/
// archiveTemplate) rather than porting any mutation logic here.

export function templateStatusBadgeClass(status: string): { label: string; className: string } {
  if (status === "active") return { label: "Active", className: "badge complete" };
  if (status === "archived") return { label: "Archived", className: "badge neutral" };
  if (status === "superseded") return { label: "Superseded", className: "badge warning" };
  if (status === "complete") return { label: "Complete", className: "badge status-complete" };
  return { label: "Draft", className: "badge active" };
}

// Same capturing-phase click-listener race documented in
// CoachEventsLibraryPanel.tsx's openEventDetail() - route_bootstrap.js's
// global click listener also matches this button's [data-template-id]
// ancestor, so the bridge event is dispatched directly rather than relying
// solely on the resulting hashchange.
function openProgrammeDetail(templateId: string) {
  window.location.hash = `#/coach/programmes/${encodeURIComponent(templateId)}`;
  document.dispatchEvent(new CustomEvent("kolosseum:open-programme-detail", { detail: { template_id: templateId } }));
}

function dispatchProgrammeAction(eventName: string, templateId: string) {
  document.dispatchEvent(new CustomEvent(eventName, { detail: { template_id: templateId } }));
}

export function CoachProgrammeMetricsPanel() {
  const { templates } = useCoachProgrammeLibrary();

  const counts = useMemo(() => {
    const result = { draft: 0, complete: 0, active: 0, archived: 0, superseded: 0 };
    for (const template of templates) {
      const displayState = programmeDisplayState(template, templates) as keyof typeof result;
      result[displayState] = (result[displayState] ?? 0) + 1;
    }
    return result;
  }, [templates]);

  return (
    <>
      <article className="panel metric-card"><span>Draft programmes</span><strong>{counts.draft}</strong></article>
      <article className="panel metric-card"><span>Complete programmes</span><strong>{counts.complete}</strong></article>
      <article className="panel metric-card"><span>Active programmes</span><strong>{counts.active}</strong></article>
      <article className="panel metric-card"><span>Archived programmes</span><strong>{counts.archived}</strong></article>
      <article className="panel metric-card"><span>Superseded versions</span><strong>{counts.superseded}</strong></article>
    </>
  );
}

function TemplateCard({ template, allTemplates, assignments }: { template: JsonRecord; allTemplates: JsonRecord[]; assignments: JsonRecord[] }) {
  const templateId = String(template.template_id);
  const storedStatus = String(template.template_status ?? "draft");
  const displayState = programmeDisplayState(template, allTemplates);
  const sessionCount = Number(template.session_count ?? 0);
  const structure = template.template_structure && typeof template.template_structure === "object" ? (template.template_structure as JsonRecord) : {};
  const blockCount = Number(template.block_count ?? (Array.isArray(structure.blocks) ? structure.blocks.length : 1));
  const weekCount = Number(template.week_count ?? 0);
  const version = programmeVersionNumber(template);
  const versions = programmeFamilyVersions(template, allTemplates);
  const usage = programmeAssignmentUsage(templateId, assignments);
  const eventPlan = template?.event_plan && typeof template.event_plan === "object" ? (template.event_plan as JsonRecord) : null;
  const badge = templateStatusBadgeClass(displayState);

  return (
    <article className="template-card" data-template-id={templateId} data-template-state={displayState}>
      <div>
        <h3>{String(template.template_name ?? "")}</h3>
        <p>{titleCase(template.activity_id)} · Version {version} of {versions.length}</p>
        <div className="template-card-facts">
          <span>{blockCount} block{blockCount === 1 ? "" : "s"}</span>
          <span>{weekCount} week{weekCount === 1 ? "" : "s"}</span>
          <span>{sessionCount} session{sessionCount === 1 ? "" : "s"}</span>
          <span>{usage.assignmentCount} assignment{usage.assignmentCount === 1 ? "" : "s"}</span>
        </div>
        {eventPlan ? (
          <div className="template-event-line">
            <span className="badge neutral">{titleCase(eventPlan.event_type)}</span>
            <strong>{String(eventPlan.event_name ?? "")}</strong>
            <span>{formatDate(eventPlan.event_date)}</span>
            <span>{countdownLabel(eventPlan.event_date)}</span>
          </div>
        ) : null}
        <div className="template-status-line">
          <span className={badge.className}>{badge.label}</span>
          <span className="badge neutral">{formatDate(template.updated_at_iso8601)}</span>
        </div>
      </div>
      <div className="template-card-actions">
        <button className="button secondary small-button template-detail" type="button" onClick={() => openProgrammeDetail(templateId)}>
          View detail
        </button>
        {storedStatus === "draft" ? (
          <button className="button secondary small-button template-edit" type="button" onClick={() => dispatchProgrammeAction("kolosseum:edit-programme", templateId)}>
            Edit
          </button>
        ) : null}
        {storedStatus === "draft" ? (
          <button className="button secondary small-button template-complete" type="button" onClick={() => dispatchProgrammeAction("kolosseum:complete-programme", templateId)}>
            Mark complete
          </button>
        ) : null}
        {storedStatus === "complete" ? (
          <button className="button primary small-button template-activate" type="button" onClick={() => dispatchProgrammeAction("kolosseum:activate-programme", templateId)}>
            Activate
          </button>
        ) : null}
        {storedStatus !== "draft" ? (
          <button className="button secondary small-button template-duplicate" type="button" onClick={() => dispatchProgrammeAction("kolosseum:duplicate-programme", templateId)}>
            Duplicate version
          </button>
        ) : null}
        {storedStatus !== "archived" ? (
          <button className="button secondary small-button template-archive" type="button" onClick={() => dispatchProgrammeAction("kolosseum:archive-programme", templateId)}>
            Archive
          </button>
        ) : null}
      </div>
    </article>
  );
}

export function CoachProgrammeLibraryPanel() {
  const { loading, error, templates, assignments, refresh } = useCoachProgrammeLibrary();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activityFilter, setActivityFilter] = useState("all");
  const [sortMode, setSortMode] = useState<ProgrammeSortMode>("updated_desc");

  const visible = useMemo(
    () => filteredProgrammeTemplates(templates, assignments, { search, statusFilter, activityFilter, sortMode }),
    [templates, assignments, search, statusFilter, activityFilter, sortMode]
  );

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setActivityFilter("all");
    setSortMode("updated_desc");
  }

  return (
    <>
      <div className="programme-library-controls" aria-label="Programme library filters">
        <label className="field programme-search-field">
          <span>Search programmes</span>
          <input
            type="search"
            autoComplete="off"
            placeholder="Name, activity, event or version"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <label className="field">
          <span>State</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All states</option>
            <option value="draft">Draft</option>
            <option value="complete">Complete</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="superseded">Superseded</option>
          </select>
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
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value as ProgrammeSortMode)}>
            <option value="updated_desc">Recently updated</option>
            <option value="name_asc">Name A–Z</option>
            <option value="version_desc">Highest version</option>
            <option value="usage_desc">Most assignments</option>
          </select>
        </label>

        <button className="button secondary programme-clear-filters" type="button" onClick={clearFilters}>
          Clear filters
        </button>
      </div>

      <div className="programme-library-result-line">
        <p className="muted small">{visible.length} of {templates.length} programme{templates.length === 1 ? "" : "s"}</p>
        <p className="muted small" role="status" aria-live="polite">
          {loading
            ? "Loading programme records…"
            : error
              ? error
              : `Updated ${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date())}.`}
        </p>
      </div>

      {error ? (
        <div className="empty-state">
          <h3>Programme library could not be loaded</h3>
          <p>{error}</p>
          <button className="button secondary" type="button" onClick={() => refresh()}>Retry</button>
        </div>
      ) : templates.length === 0 && !loading ? (
        <div className="empty-state">
          <h3>No programmes created</h3>
          <p>Create a programme with at least one training block before assigning training.</p>
        </div>
      ) : visible.length === 0 && !loading ? (
        <div className="empty-state">
          <h3>No programmes match these filters</h3>
          <p>Clear or change the search, state or activity filters.</p>
        </div>
      ) : (
        <div className="template-library">
          {visible.map((template) => (
            <TemplateCard key={String(template.template_id)} template={template} allTemplates={templates} assignments={assignments} />
          ))}
        </div>
      )}
    </>
  );
}
