import React, { useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { loadProgrammeCatalogueListing, saveProgrammeCatalogueListing } from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";
import { SPORT_FAMILIES } from "../../components/SportPicker";
import { titleCase } from "../../utils/format";

// "Publish to athletes": a Kolosseum programme author lists one of their
// active programmes for athletes without a coach (src/api/
// programme_catalogue_service.ts) - who it suits (levels; sports, or any
// sport), how many days a week, and which of their programmes athletes are
// offered once they finish it. Only shown to catalogue authors.

const LEVELS: Array<[string, string]> = [["beginner", "Beginner"], ["amateur", "Amateur"], ["pro", "Pro"]];

function daysInFirstWeek(template: JsonRecord): number {
  const structure = template.template_structure && typeof template.template_structure === "object" ? template.template_structure as JsonRecord : {};
  const block = Array.isArray(structure.blocks) ? (structure.blocks as JsonRecord[])[0] : undefined;
  const week = block && Array.isArray(block.weeks) ? (block.weeks as JsonRecord[])[0] : undefined;
  if (!week) return 3;
  const days = Array.isArray(week.days) ? (week.days as JsonRecord[]).length : 0;
  const sessions = Array.isArray(week.sessions) ? (week.sessions as JsonRecord[]).length : 0;
  return Math.min(7, Math.max(1, days || sessions || 3));
}

export function ProgrammeCatalogueListingSection({ template }: { template: JsonRecord }) {
  const templateId = String(template.template_id ?? "");
  const [author, setAuthor] = useState(false);
  const [listing, setListing] = useState<JsonRecord | null>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [levels, setLevels] = useState<string[]>([]);
  const [general, setGeneral] = useState(true);
  const [sports, setSports] = useState<string[]>([]);
  const [days, setDays] = useState(3);
  const [nextId, setNextId] = useState("");
  const [others, setOthers] = useState<JsonRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<JsonRecord>({});

  function apply(next: JsonRecord | null) {
    setListing(next);
    setTitle(String(next?.title ?? template.template_name ?? ""));
    setSummary(String(next?.summary ?? ""));
    setLevels(Array.isArray(next?.levels) ? (next!.levels as unknown[]).map(String) : []);
    const ids = Array.isArray(next?.activity_ids) ? (next!.activity_ids as unknown[]).map(String) : [];
    setGeneral(ids.length === 0);
    setSports(ids);
    setDays(Number(next?.days_per_week) || daysInFirstWeek(template));
    setNextId(String(next?.next_listing_id ?? ""));
  }

  useEffect(() => {
    let cancelled = false;
    setStatus(null);
    loadProgrammeCatalogueListing(templateId)
      .then((result) => {
        if (cancelled) return;
        setAuthor(result.catalogue_author === true);
        setOthers(Array.isArray(result.other_listings) ? (result.other_listings as JsonRecord[]) : []);
        apply(result.listing && typeof result.listing === "object" ? (result.listing as JsonRecord) : null);
      })
      .catch(() => { if (!cancelled) setAuthor(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  async function save(listed: boolean) {
    setSaving(true);
    setStatus(null);
    setFieldErrors({});
    try {
      const account = await loadAccountDetail();
      const csrf = typeof account.csrf_token === "string" ? account.csrf_token : "";
      const result = await saveProgrammeCatalogueListing(templateId, {
        title: title.trim(), summary: summary.trim(), levels, activity_ids: general ? [] : sports, days_per_week: days, next_listing_id: nextId, listed
      }, csrf);
      apply(result.listing as JsonRecord);
      setStatus(listed ? "Listed for athletes." : "No longer listed - athletes already running it can finish it.");
    }
    catch (caught) {
      const payload = (caught as { payload?: JsonRecord })?.payload;
      setFieldErrors((payload?.field_errors as JsonRecord | undefined) ?? {});
      setStatus("The listing could not be saved - check the highlighted fields.");
    }
    finally {
      setSaving(false);
    }
  }

  if (!author) return null;
  const active = template.template_status === "active";
  const listed = listing?.listed === true;
  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  return (
    <article className="programme-detail-section programme-catalogue-listing">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Kolosseum programmes</p>
          <h4>Publish to athletes</h4>
        </div>
        {listing ? <span className={`badge ${listed ? "complete" : "neutral"}`}>{listed ? "Listed" : "Not listed"}</span> : null}
      </div>
      {!active ? (
        <p className="muted">Activate this programme to publish it. Athletes run the exact version you publish.</p>
      ) : (
        <>
          <p className="muted">Athletes without a coach can start this programme. They see it if it suits their level and sport.</p>
          <label className="field">
            <span>Title athletes see</span>
            <input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="field">
            <span>Summary</span>
            <textarea value={summary} maxLength={400} placeholder="Who it's for and what it builds" onChange={(event) => setSummary(event.target.value)} />
            {fieldErrors.summary ? <small className="field-error">{String(fieldErrors.summary)}</small> : null}
          </label>
          <fieldset className="choice-chips">
            <legend>Levels</legend>
            {LEVELS.map(([value, label]) => (
              <label key={value} className="choice-chip">
                <input type="checkbox" checked={levels.includes(value)} onChange={() => setLevels(toggle(levels, value))} />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
          {fieldErrors.levels ? <p className="field-error">{String(fieldErrors.levels)}</p> : null}
          <fieldset className="choice-chips">
            <legend>Sports</legend>
            <label className="choice-chip">
              <input type="radio" name={`catalogue-sports-${templateId}`} checked={general} onChange={() => setGeneral(true)} />
              <span>Any sport</span>
            </label>
            <label className="choice-chip">
              <input type="radio" name={`catalogue-sports-${templateId}`} checked={!general} onChange={() => setGeneral(false)} />
              <span>Specific sports</span>
            </label>
          </fieldset>
          {!general ? (
            <div className="choice-section">
              {SPORT_FAMILIES.map(([family, ids]) => (
                <fieldset key={family} className="choice-chips">
                  <legend>{family}</legend>
                  {ids.map((id) => (
                    <label key={id} className="choice-chip">
                      <input type="checkbox" checked={sports.includes(id)} onChange={() => setSports(toggle(sports, id))} />
                      <span>{titleCase(id)}</span>
                    </label>
                  ))}
                </fieldset>
              ))}
            </div>
          ) : null}
          <label className="field">
            <span>Training days a week</span>
            <select value={days} onChange={(event) => setDays(Number(event.target.value))}>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            {fieldErrors.days_per_week ? <small className="field-error">{String(fieldErrors.days_per_week)}</small> : null}
          </label>
          {others.length > 0 ? (
            <label className="field">
              <span>When athletes finish it, offer next</span>
              <select value={nextId} onChange={(event) => setNextId(event.target.value)}>
                <option value="">Nothing - they choose for themselves</option>
                {others.map((other) => (
                  <option key={String(other.listing_id)} value={String(other.listing_id)}>
                    {`${String(other.title)}${other.listed === false ? " (not listed)" : ""}`}
                  </option>
                ))}
              </select>
              {fieldErrors.next_listing_id ? <small className="field-error">{String(fieldErrors.next_listing_id)}</small> : null}
            </label>
          ) : null}
          {status ? <p className="muted small" role="status">{status}</p> : null}
          <div className="button-row">
            <button className="button primary" type="button" disabled={saving || (!general && sports.length === 0)} onClick={() => void save(true)}>
              {listed ? "Update listing" : "Publish to athletes"}
            </button>
            {listed ? <button className="button secondary" type="button" disabled={saving} onClick={() => void save(false)}>Unlist</button> : null}
          </div>
        </>
      )}
    </article>
  );
}
