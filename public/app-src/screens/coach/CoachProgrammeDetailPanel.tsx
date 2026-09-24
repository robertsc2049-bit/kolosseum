import React from "react";

import { type JsonRecord } from "../../api/transport";
import { formatDate, titleCase } from "../../utils/format";
import { templateStatusBadgeClass } from "./CoachProgrammeLibraryPanel";
import {
  programmeAssignmentUsage,
  programmeDisplayState,
  programmeFamilyVersions,
  programmeVersionNumber
} from "./useCoachProgrammeLibrary";
import { useCoachProgrammeDetail } from "./useCoachProgrammeDetail";

// DEV NOTE: FULL-UI-05A programme detail (read-only) - ported field-for-
// field from public/app/app.js's renderProgrammeDetail() (title/status/
// meta/description/actions) and programmeVersionFamilyHtml()/
// programmeUsageHtml(). Explicitly out of scope, and left legacy: the
// activation validation summary (programmeValidationHtml/
// programmeActivationIssues - a ~200-line rules engine, its own future
// slice), the structure preview (programmePreviewHtml - the deeply nested
// block/week/session/work-item renderer, likewise), and the marketplace
// sharing/release sub-panel (a separate manifest area). All three still
// render into their own static siblings inside #templateDetailPanel, fed
// by a trimmed renderProgrammeDetail() that now only handles those three.
// Action buttons (Edit/Complete/Activate/Duplicate/Archive) dispatch the
// same bridge events CoachProgrammeLibraryPanel.tsx's cards already use -
// no mutation logic is ported here either.

function currentTemplate(templateId: string, templates: JsonRecord[]): JsonRecord | undefined {
  return templates.find((candidate) => String(candidate.template_id) === templateId);
}

function dispatchProgrammeAction(eventName: string, templateId: string) {
  document.dispatchEvent(new CustomEvent(eventName, { detail: { template_id: templateId } }));
}

function openVersionDetail(templateId: string) {
  window.location.hash = `#/coach/programmes/${encodeURIComponent(templateId)}`;
  document.dispatchEvent(new CustomEvent("kolosseum:open-programme-detail", { detail: { template_id: templateId } }));
}

export function CoachProgrammeDetailHeader() {
  const { templateId, templates } = useCoachProgrammeDetail();
  const template = currentTemplate(templateId, templates);
  if (!template) return <h3 id="templateDetailTitle">Programme</h3>;

  const displayState = programmeDisplayState(template, templates);
  const badge = templateStatusBadgeClass(displayState);

  return (
    <div>
      <p className="eyebrow">Programme detail</p>
      <h3 id="templateDetailTitle">{String(template.template_name ?? "Programme")}</h3>
      <div className="template-status-line">
        <span className={badge.className}>{badge.label}</span>
        <span className="badge neutral">Version {programmeVersionNumber(template)}</span>
        <span className="badge neutral">{titleCase(template.activity_id)}</span>
      </div>
    </div>
  );
}

function VersionFamilyList({ template, templates }: { template: JsonRecord; templates: JsonRecord[] }) {
  const versions = programmeFamilyVersions(template, templates);
  return (
    <>
      {versions.map((version) => {
        const displayState = programmeDisplayState(version, templates);
        const badge = templateStatusBadgeClass(displayState);
        const isCurrent = version.template_id === template.template_id;
        return (
          <button
            key={String(version.template_id)}
            className={`programme-version-row template-version-open${isCurrent ? " current" : ""}`}
            type="button"
            onClick={() => openVersionDetail(String(version.template_id))}
          >
            <span>
              <strong>Version {programmeVersionNumber(version)}</strong>
              <small>{String(version.template_name ?? "Programme")}</small>
            </span>
            <span>
              <span className={badge.className}>{badge.label}</span>
              <small>{formatDate(version.updated_at_iso8601)}</small>
            </span>
          </button>
        );
      })}
    </>
  );
}

function UsageList({ templateId, assignments, relationships }: { templateId: string; assignments: JsonRecord[]; relationships: JsonRecord[] }) {
  const usage = programmeAssignmentUsage(templateId, assignments);

  if (usage.records.length === 0) {
    return (
      <div className="empty-state compact-empty">
        <p>No assignment records use this exact programme version.</p>
      </div>
    );
  }

  return (
    <>
      <div className="programme-usage-summary">
        <div><span>Assignments</span><strong>{usage.assignmentCount}</strong></div>
        <div><span>Athletes</span><strong>{usage.athleteCount}</strong></div>
        <div><span>Latest</span><strong>{formatDate(usage.latestAt)}</strong></div>
      </div>
      <div className="programme-assignment-records">
        {usage.records.map((assignment) => {
          const athleteId = String(assignment.assigned_athlete_id ?? "");
          const athlete = relationships.find((entry) => String(entry.athlete_user_id) === athleteId);
          const assignmentId = String(assignment.assignment_id ?? "");
          const assignmentState = String(assignment.assignment_status ?? "assigned");
          return (
            <article className="programme-assignment-record" key={assignmentId}>
              <div>
                <strong>{String(athlete?.display_name ?? athleteId ?? "Athlete")}</strong>
                <small>{assignmentId}</small>
              </div>
              <div>
                <span className="badge neutral">{titleCase(assignmentState)}</span>
                <small>{formatDate(assignment.requested_at_iso8601)}</small>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

export function CoachProgrammeDetailPanel() {
  const { templateId, templates, assignments, relationships, loading, error } = useCoachProgrammeDetail();
  const template = currentTemplate(templateId, templates);

  if (loading && !template) {
    return <div className="programme-detail-facts">Loading programme detail…</div>;
  }

  if (error) {
    return (
      <div className="empty-state compact-empty">
        <p>{error}</p>
      </div>
    );
  }

  if (!template) return null;

  const storedStatus = String(template.template_status ?? "draft");
  const versions = programmeFamilyVersions(template, templates);
  const usage = programmeAssignmentUsage(templateId, assignments);
  const eventPlan = template?.event_plan && typeof template.event_plan === "object" ? (template.event_plan as JsonRecord) : null;

  return (
    <>
      <div className="programme-detail-facts">
        <div><span>Family versions</span><strong>{versions.length}</strong></div>
        <div><span>Blocks</span><strong>{Number(template.block_count ?? 0)}</strong></div>
        <div><span>Weeks</span><strong>{Number(template.week_count ?? 0)}</strong></div>
        <div><span>Sessions</span><strong>{Number(template.session_count ?? 0)}</strong></div>
        <div><span>Assignments</span><strong>{usage.assignmentCount}</strong></div>
        <div><span>Updated</span><strong>{formatDate(template.updated_at_iso8601)}</strong></div>
        {eventPlan ? <div><span>Event</span><strong>{String(eventPlan.event_name ?? "Event")}</strong></div> : null}
      </div>

      <p className="programme-detail-description muted">
        {String(template.description ?? "").trim() || "No programme description was recorded."}
      </p>

      <div className="button-row programme-detail-actions">
        {storedStatus === "draft" ? (
          <button className="button secondary" type="button" onClick={() => dispatchProgrammeAction("kolosseum:edit-programme", templateId)}>
            Edit draft
          </button>
        ) : null}
        {storedStatus === "draft" ? (
          <button className="button secondary" type="button" onClick={() => dispatchProgrammeAction("kolosseum:complete-programme", templateId)}>
            Save complete template
          </button>
        ) : null}
        {storedStatus === "complete" ? (
          <button className="button primary" type="button" onClick={() => dispatchProgrammeAction("kolosseum:activate-programme", templateId)}>
            Activate programme
          </button>
        ) : null}
        {storedStatus !== "draft" ? (
          <button className="button secondary" type="button" onClick={() => dispatchProgrammeAction("kolosseum:duplicate-programme", templateId)}>
            Duplicate version
          </button>
        ) : null}
        {storedStatus !== "archived" ? (
          <button className="button secondary" type="button" onClick={() => dispatchProgrammeAction("kolosseum:archive-programme", templateId)}>
            Archive programme
          </button>
        ) : null}
      </div>

      <div className="programme-detail-grid">
        <article className="programme-detail-section">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Version family</p>
              <h4>Version metadata</h4>
            </div>
          </div>
          <div className="programme-version-list">
            <VersionFamilyList template={template} templates={templates} />
          </div>
        </article>

        <article className="programme-detail-section">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Recorded use</p>
              <h4>Assignment usage</h4>
            </div>
          </div>
          <div className="programme-usage-list">
            <UsageList templateId={templateId} assignments={assignments} relationships={relationships} />
          </div>
        </article>
      </div>
    </>
  );
}
