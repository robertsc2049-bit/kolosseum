import React, { useState } from "react";

import { type JsonRecord } from "../api/transport";

// Medical stand-down, shared by the athlete's profile and a coach's view of
// their athlete. Shows an active stand-down and lets it end only once a
// medical professional has cleared the athlete; otherwise lets one be
// recorded with the date they gave. After a head injury the date passing ends
// nothing - only clearance does. No medical advice, nothing prescribed.

const REASON_LABEL: Record<string, string> = { head_injury: "head injury", medical: "medical reason" };

export function StandDownPanel({ standDown, busy, error, whose, onRecord, onEnd }: {
  standDown: JsonRecord | null;
  busy: boolean;
  error: string | null;
  whose: "your" | "their";
  onRecord: (input: { reason: "head_injury" | "medical"; until_date: string }) => void;
  onEnd: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<"head_injury" | "medical">("head_injury");
  const [until, setUntil] = useState("");
  const [cleared, setCleared] = useState(false);

  if (standDown) {
    const headInjury = standDown.reason === "head_injury";
    const recordedBy = standDown.recorded_by === "coach" ? "the coach" : "the athlete";
    return (
      <div className="stand-down active" data-testid="stand-down">
        <strong>{headInjury ? "Stood down from training until medically cleared" : `Stood down from training until ${String(standDown.until_date)}`}</strong>
        <p className="muted">{headInjury
          ? `Reason: head injury. Recorded by ${recordedBy}. Earliest date given: ${String(standDown.until_date)}. No sessions until it's confirmed below that a medical professional has cleared ${whose === "your" ? "you" : "them"} to train - the date passing doesn't end this.`
          : `Reason: ${REASON_LABEL[String(standDown.reason)] ?? "medical"}. Recorded by ${recordedBy}. No sessions until then.`}</p>
        <label className="consent-box">
          <input type="checkbox" checked={cleared} onChange={(event) => setCleared(event.target.checked)} />
          <span>A medical professional has cleared {whose === "your" ? "me" : "them"} to train</span>
        </label>
        <button className="button secondary" type="button" disabled={busy || !cleared} onClick={onEnd}>End stand-down</button>
        {error ? <p className="field-error" role="alert">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="stand-down" data-testid="stand-down">
      {!open ? (
        <button className="button secondary" type="button" onClick={() => setOpen(true)}>Record a head injury or medical stand-down</button>
      ) : (
        <div className="stand-down-form">
          <p className="muted">{reason === "head_injury"
            ? `No sessions until it's confirmed here that a medical professional has cleared ${whose === "your" ? "you" : "them"} to train. Enter the earliest date they gave - the date passing doesn't end the stand-down.`
            : `No sessions until the date ${whose} medical professional gives.`}</p>
          <label className="field">
            <span>Reason</span>
            <select aria-label="Stand-down reason" value={reason} onChange={(event) => setReason(event.target.value === "medical" ? "medical" : "head_injury")}>
              <option value="head_injury">Head injury / suspected concussion</option>
              <option value="medical">Another medical reason</option>
            </select>
          </label>
          <label className="field">
            <span>No training until</span>
            <input type="date" aria-label="No training until" value={until} onChange={(event) => setUntil(event.target.value)} />
          </label>
          <button className="button primary" type="button" disabled={busy || !until} onClick={() => onRecord({ reason, until_date: until })}>Record stand-down</button>
          <button className="button secondary" type="button" onClick={() => setOpen(false)}>Cancel</button>
        </div>
      )}
      {error ? <p className="field-error" role="alert">{error}</p> : null}
    </div>
  );
}
