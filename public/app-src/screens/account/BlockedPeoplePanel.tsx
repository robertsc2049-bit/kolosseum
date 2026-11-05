import React, { useEffect, useState } from "react";

import { BLOCKS_CHANGED_EVENT, loadBlocks, unblockUser } from "../../api/messageSafetyClient";
import { type JsonRecord } from "../../api/transport";
import { formatDate } from "../../utils/format";

// People you've blocked from messaging you, and unblocking them. Hidden
// while you haven't blocked anyone.
export function BlockedPeoplePanel() {
  const [blocks, setBlocks] = useState<JsonRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => loadBlocks()
      .then((result) => { if (!cancelled) setBlocks(Array.isArray(result.blocks) ? (result.blocks as JsonRecord[]) : []); })
      .catch(() => { if (!cancelled) setBlocks([]); });
    load();
    // After sign-in, and whenever someone is blocked or unblocked under a
    // message elsewhere on the page.
    window.addEventListener("kolosseum:entry-auth-succeeded", load);
    document.addEventListener(BLOCKS_CHANGED_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener("kolosseum:entry-auth-succeeded", load);
      document.removeEventListener(BLOCKS_CHANGED_EVENT, load);
    };
  }, []);

  async function unblock(userId: string) {
    setError(null);
    try {
      const result = await unblockUser(userId);
      setBlocks(Array.isArray(result.blocks) ? (result.blocks as JsonRecord[]) : []);
    }
    catch {
      setError("They could not be unblocked. Try again.");
    }
  }

  if (!blocks || blocks.length === 0) return null;
  return (
    <article className="panel" data-testid="blocked-people">
      <div>
        <p className="eyebrow">Messages</p>
        <h3>Blocked people</h3>
        <p className="muted">Their messages don't reach you. Unblocking lets new messages through again.</p>
      </div>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      <div className="record-list">
        {blocks.map((block) => (
          <div className="record-row" key={String(block.user_id)}>
            <div>
              <strong>{String(block.display_name ?? "Someone")}</strong>
              <p className="muted small">Blocked {formatDate(block.blocked_at_iso8601)}</p>
            </div>
            <button className="button secondary small-button" type="button" onClick={() => { unblock(String(block.user_id)).catch(() => {}); }}>Unblock</button>
          </div>
        ))}
      </div>
    </article>
  );
}
