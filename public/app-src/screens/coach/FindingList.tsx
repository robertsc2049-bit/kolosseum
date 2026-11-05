import React, { useState } from "react";

// What stands out, most important first: each finding in a plain sentence,
// with what published research found about it where there is any (cited by
// author and year - the full sources are under "What this means"). Kolosseum
// states facts and research; the coach decides. The top few show, the rest
// one tap away, so the two that matter aren't lost in twelve.

export type Finding = { id: string; section: string; level: "alert" | "watch" | "good" | "info"; text: string; evidence?: string };
export const LEVEL_LABEL: Record<string, string> = { alert: "Red flag", watch: "Amber flag", good: "Going well", info: "Note" };
export const TOP_FINDINGS = 5;

export function FindingList({ findings, compact = false, showAll = false, emptyText = "Nothing stands out yet - more logged sessions will show patterns." }: {
  findings: readonly Finding[];
  compact?: boolean;
  showAll?: boolean;
  emptyText?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!findings.length) return <p className="muted small">{emptyText}</p>;
  const all = showAll || expanded || compact || findings.length <= TOP_FINDINGS;
  const shown = all ? findings : findings.slice(0, TOP_FINDINGS);
  return (
    <>
      <ul className={`analysis-findings${compact ? " is-compact" : ""}`}>
        {shown.map((finding) => (
          <li key={finding.id} className={`analysis-finding is-${finding.level}`}>
            {compact ? null : <span className="analysis-finding-level">{LEVEL_LABEL[finding.level]}</span>}
            <span className="analysis-finding-body">
              <span>{finding.text}</span>
              {!compact && finding.evidence ? <span className="analysis-finding-evidence">{finding.evidence}</span> : null}
            </span>
          </li>
        ))}
      </ul>
      {!compact && !showAll && findings.length > TOP_FINDINGS ? (
        <button type="button" className="text-button analysis-findings-more" aria-expanded={expanded} onClick={() => setExpanded((open) => !open)}>
          {expanded ? "Show the top 5 only" : `Show all ${findings.length}`}
        </button>
      ) : null}
    </>
  );
}
