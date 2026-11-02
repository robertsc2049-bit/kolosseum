import React, { useCallback, useEffect, useState } from "react";

import { loadPackageMembers } from "../../api/checkinsClient";
import { archiveCoachPackage, loadCoachPackages, saveCoachPackage } from "../../api/coachBrandingClient";
import { loadAccountDetail } from "../../api/client";
import { type JsonRecord } from "../../api/transport";
import { PackageList } from "../../components/PackageList";
import { paidLabel } from "../../utils/packages";

// A coach's packages: what they offer, at what price and how often it's paid,
// and what's included - shown to athletes on the coach's share page and
// their card. Athletes pay the coach directly (service_package_service.ts).
type Draft = {
  name: string; price: string; currency: string; billing: string; description: string;
  programming: boolean; checkin_calls: string; in_person_sessions: string; session_reviews: string; messaging: boolean;
};

const EMPTY: Draft = {
  name: "", price: "", currency: "GBP", billing: "monthly", description: "",
  programming: true, checkin_calls: "0", in_person_sessions: "0", session_reviews: "none", messaging: false
};

function draftFrom(pkg: JsonRecord): Draft {
  const includes = (pkg.includes ?? {}) as JsonRecord;
  return {
    name: String(pkg.name ?? ""), price: String(pkg.price ?? ""), currency: String(pkg.currency ?? "GBP"), billing: String(pkg.billing ?? "monthly"),
    description: String(pkg.description ?? ""), programming: includes.programming === true, checkin_calls: String(includes.checkin_calls ?? 0),
    in_person_sessions: String(includes.in_person_sessions ?? 0), session_reviews: String(includes.session_reviews ?? "none"), messaging: includes.messaging === true
  };
}

export function packageBody(draft: Draft): JsonRecord {
  return {
    name: draft.name.trim(), price: Number(draft.price), currency: draft.currency, billing: draft.billing, description: draft.description.trim(),
    includes: { programming: draft.programming, checkin_calls: Number(draft.checkin_calls || 0), in_person_sessions: Number(draft.in_person_sessions || 0), session_reviews: draft.session_reviews, messaging: draft.messaging }
  };
}

function errorText(error: unknown): string {
  const payload = ((error as { payload?: JsonRecord }).payload ?? {}) as JsonRecord;
  if (payload.error === "package_limit_reached") return "That's the most packages you can have - remove one first.";
  const fieldErrors = (payload.field_errors ?? {}) as JsonRecord;
  return Object.values(fieldErrors).map(String)[0] ?? "That didn't save. Try again.";
}

export function PackageFields({ draft, setDraft }: { draft: Draft; setDraft: (next: Draft) => void }) {
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const per = draft.billing === "weekly" ? "a week" : draft.billing === "monthly" ? "a month" : "in total";
  return (
    <>
      <label className="field">
        <span>Name</span>
        <input type="text" maxLength={80} required placeholder="Online coaching" value={draft.name} onChange={(event) => set({ name: event.target.value })} />
      </label>
      <div className="inline-controls">
        <label className="field">
          <span>Price</span>
          <input type="number" inputMode="decimal" min={0} step="0.01" required placeholder="80" value={draft.price} onChange={(event) => set({ price: event.target.value })} />
        </label>
        <label className="field">
          <span>Currency</span>
          <select aria-label="Currency" value={draft.currency} onChange={(event) => set({ currency: event.target.value })}>
            <option value="GBP">£ GBP</option>
            <option value="EUR">€ EUR</option>
            <option value="USD">$ USD</option>
          </select>
        </label>
        <label className="field">
          <span>Paid</span>
          <select aria-label="Paid" value={draft.billing} onChange={(event) => set({ billing: event.target.value })}>
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
            <option value="one_off">Once</option>
          </select>
        </label>
      </div>
      <label className="field">
        <span>About it (optional)</span>
        <input type="text" maxLength={500} placeholder="A programme written for you, adjusted every week" value={draft.description} onChange={(event) => set({ description: event.target.value })} />
      </label>
      <fieldset className="package-includes-fields">
        <legend>What's included</legend>
        <label className="checkbox-row"><input type="checkbox" checked={draft.programming} onChange={(event) => set({ programming: event.target.checked })} /> Programming</label>
        <label className="field">
          <span>{`Check-in calls ${per}`}</span>
          <input type="number" min={0} max={30} value={draft.checkin_calls} onChange={(event) => set({ checkin_calls: event.target.value })} />
        </label>
        <label className="field">
          <span>{`In-person sessions ${per}`}</span>
          <input type="number" min={0} max={30} value={draft.in_person_sessions} onChange={(event) => set({ in_person_sessions: event.target.value })} />
        </label>
        <label className="field">
          <span>Session reviews</span>
          <select aria-label="Session reviews" value={draft.session_reviews} onChange={(event) => set({ session_reviews: event.target.value })}>
            <option value="none">None</option>
            <option value="weekly">Weekly review</option>
            <option value="every_session">Every session</option>
          </select>
        </label>
        <label className="checkbox-row"><input type="checkbox" checked={draft.messaging} onChange={(event) => set({ messaging: event.target.checked })} /> Messaging</label>
      </fieldset>
    </>
  );
}

// Who is on the coach's packages, payment due first. They put athletes on a
// package, and record payments, from the athlete's check-ins.
function PackageMembers({ version }: { version: number }) {
  const [members, setMembers] = useState<JsonRecord[]>([]);
  useEffect(() => {
    let live = true;
    loadPackageMembers().then(
      (payload) => { if (live) setMembers(Array.isArray(payload.members) ? (payload.members as JsonRecord[]) : []); },
      () => { if (live) setMembers([]); }
    );
    return () => { live = false; };
  }, [version]);
  if (!members.length) return null;
  const due = members.filter((member) => member.payment_due).length;
  return (
    <details className="package-members" data-testid="package-members" open={due > 0}>
      <summary>{`On your packages (${members.length})${due ? ` - ${due} payment${due === 1 ? "" : "s"} due` : ""}`}</summary>
      <div className="record-list">
        {members.map((member) => (
          <article className="record-row" key={String(member.membership_id)}>
            <div>
              <strong>{String(member.athlete_display_name)}</strong>
              <p className="muted small">{String(((member.package ?? {}) as JsonRecord).name ?? "")}</p>
              <p className={member.payment_due ? "field-error" : "muted small"}>{paidLabel(member)}</p>
            </div>
          </article>
        ))}
      </div>
      <p className="muted small">Open an athlete's profile and use Package and check-ins to put them on a package or record a payment.</p>
    </details>
  );
}

export function CoachPackagesPanel() {
  const [packages, setPackages] = useState<JsonRecord[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [removing, setRemoving] = useState<string | null>(null);

  const show = (payload: JsonRecord) => setPackages(Array.isArray(payload.packages) ? (payload.packages as JsonRecord[]) : []);

  const refresh = useCallback(async () => {
    setVersion((n) => n + 1);
    try { show(await loadCoachPackages()); }
    catch { setPackages(null); }
  }, []);

  useEffect(() => {
    refresh();
    document.addEventListener("kolosseum:account-role-known", refresh);
    return () => document.removeEventListener("kolosseum:account-role-known", refresh);
  }, [refresh]);

  if (!packages) return null;

  async function act(action: (token: string) => Promise<JsonRecord>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const account = await loadAccountDetail();
      show(await action(typeof account.csrf_token === "string" ? account.csrf_token : ""));
      setVersion((n) => n + 1);
      return true;
    }
    catch (caught) {
      setError(errorText(caught));
      return false;
    }
    finally {
      setBusy(false);
    }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = editing === "new" ? null : editing;
    if (await act((token) => saveCoachPackage(id, packageBody(draft), token))) {
      setEditing(null);
      setDraft(EMPTY);
    }
  }

  return (
    <section className="panel" aria-labelledby="coachPackagesHeading" data-testid="coach-packages">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Packages</p>
          <h3 id="coachPackagesHeading">What you offer</h3>
          <p className="muted">Your packages show on your share page and to your athletes. Athletes pay you directly - nothing is taken in the app.</p>
        </div>
      </div>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      {packages.length === 0 && editing === null ? <p className="muted small">No packages yet.</p> : null}
      {editing === null ? (
        <>
          <PackageList packages={packages} actions={(pkg) => (
            <>
              <button className="button secondary small" type="button" disabled={busy} onClick={() => { setEditing(String(pkg.package_id)); setDraft(draftFrom(pkg)); }}>Edit</button>
              {removing === String(pkg.package_id) ? (
                <>
                  <p className="small">Remove it? Athletes stop seeing it; anyone already on it stays on it until you end or change their package.</p>
                  <button className="button primary small" type="button" disabled={busy} onClick={() => void act((token) => archiveCoachPackage(String(pkg.package_id), token)).then(() => setRemoving(null))}>Yes, remove it</button>
                  <button className="button secondary small" type="button" onClick={() => setRemoving(null)}>Keep it</button>
                </>
              ) : (
                <button className="button secondary small" type="button" disabled={busy} onClick={() => setRemoving(String(pkg.package_id))}>Remove</button>
              )}
            </>
          )} />
          <div className="inline-controls">
            <button className="button primary" type="button" onClick={() => { setEditing("new"); setDraft(EMPTY); }}>Add a package</button>
          </div>
          <PackageMembers version={version} />
        </>
      ) : (
        <form className="athlete-detail-note-form" data-testid="package-form" onSubmit={save}>
          <PackageFields draft={draft} setDraft={setDraft} />
          <div className="inline-controls">
            <button className="button primary" type="submit" disabled={busy}>{editing === "new" ? "Add package" : "Save package"}</button>
            <button className="button secondary" type="button" onClick={() => { setEditing(null); setError(null); }}>Cancel</button>
          </div>
        </form>
      )}
    </section>
  );
}
