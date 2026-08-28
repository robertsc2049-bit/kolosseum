import React from "react";

import { type JsonRecord } from "../../api/transport";
import { titleCase } from "../../utils/format";
import {
  exerciseDisplayName,
  programmePreviewLoad,
  programmePreviewPrescription,
  templateRecordToDraft,
  type ProgrammeWorkItemDraft
} from "./programmeDraft";
import { useCoachProgrammeStructure } from "./useCoachProgrammeStructure";

// DEV NOTE: FULL-UI-05A programme structure preview (read-only) - ported
// field-for-field from public/app/app.js's programmePreviewHtml(). Shares
// useCoachProgrammeStructure.ts with CoachProgrammeValidationPanel.tsx (see
// that hook's own DEV NOTE) and templateRecordToDraft()/exerciseDisplayName()/
// programmePreviewPrescription()/programmePreviewLoad() with
// programmeDraft.ts, ported once for both panels.

function WorkItemRow({ workItem, templateExercises }: { workItem: ProgrammeWorkItemDraft; templateExercises: JsonRecord[] }) {
  return (
    <li>
      <div>
        <strong>{exerciseDisplayName(workItem.exercise_id, templateExercises)}</strong>
        <span>{titleCase(workItem.role)}</span>
        {workItem.segment !== "working" ? <span className="badge neutral">{titleCase(workItem.segment)}</span> : null}
        {workItem.group_id ? <span className="badge neutral">{titleCase(workItem.group_type)}</span> : null}
      </div>
      <span>
        {workItem.planned_sets} sets · {programmePreviewPrescription(workItem)} · {programmePreviewLoad(workItem)} · {workItem.rest_seconds}s rest
        {workItem.tempo ? ` · Tempo ${workItem.tempo}` : ""}
      </span>
      {workItem.coaching_notes ? <p className="muted small programme-preview-notes">{workItem.coaching_notes}</p> : null}
    </li>
  );
}

export function CoachProgrammePreviewPanel() {
  const { templateId, templates, templateExercises, loading, error } = useCoachProgrammeStructure();
  const template = templates.find((candidate) => String(candidate.template_id) === templateId);

  if (loading && !template) return null;
  if (error) return <p className="muted small">{error}</p>;
  if (!template) return null;

  const draft = templateRecordToDraft(template);
  const blocks = draft.blocks;

  if (blocks.length === 0) {
    return (
      <div className="empty-state compact-empty">
        <p>No persisted programme structure is available.</p>
      </div>
    );
  }

  return (
    <>
      {blocks.map((programmeBlock, blockIndex) => (
        <article className="programme-preview-block" key={programmeBlock.block_id || blockIndex}>
          <div className="programme-preview-block-heading">
            <div>
              <p className="eyebrow">Block {blockIndex + 1}</p>
              <h5>{programmeBlock.name || `Block ${blockIndex + 1}`}</h5>
            </div>
            <div className="template-status-line">
              <span className="badge neutral">{titleCase(programmeBlock.block_type)}</span>
              <span className="badge neutral">{programmeBlock.weeks.length} week{programmeBlock.weeks.length === 1 ? "" : "s"}</span>
            </div>
          </div>
          {programmeBlock.description ? <p className="muted small">{programmeBlock.description}</p> : null}
          <div className="programme-preview-weeks">
            {programmeBlock.weeks.map((week, weekIndex) => (
              <details className="programme-preview-week" open={blockIndex === 0 && weekIndex === 0} key={week.week_id || weekIndex}>
                <summary>
                  <span>Week {weekIndex + 1}</span>
                  <span>{week.sessions.length} session{week.sessions.length === 1 ? "" : "s"}</span>
                </summary>
                <div className="programme-preview-sessions">
                  {week.sessions.map((session, sessionIndex) => (
                    <article className="programme-preview-session" key={session.session_id || sessionIndex}>
                      <div className="programme-preview-session-heading">
                        <strong>{session.title || `Session ${sessionIndex + 1}`}</strong>
                        <span className="badge neutral">{session.work_items.length} exercise{session.work_items.length === 1 ? "" : "s"}</span>
                      </div>
                      {session.coaching_notes ? <p className="muted small programme-preview-notes">{session.coaching_notes}</p> : null}
                      <ol>
                        {session.work_items.map((workItem, workItemIndex) => (
                          <WorkItemRow workItem={workItem} templateExercises={templateExercises} key={workItem.work_item_id || workItemIndex} />
                        ))}
                      </ol>
                    </article>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </article>
      ))}
    </>
  );
}
