import React, { useCallback, useEffect, useState } from "react";

import { addCoachGym, linkCoachGym, loadCoachGyms, removeCoachGym, searchCoachGyms } from "../../api/coachBrandingClient";
import { loadAccountDetail } from "../../api/client";
import { type JsonRecord } from "../../api/transport";

// The gyms a coach works out of. A gym on Kolosseum waits for the gym to
// confirm; one that isn't on Kolosseum yet is typed in, and linked in one
// tap once that gym signs up (coach_gym_service.ts).
const STATUS_LABEL: Record<string, string> = {
  pending: "Waiting for the gym to confirm",
  confirmed: "Confirmed by the gym",
  declined: "The gym didn't confirm this",
  unlisted: "Not on Kolosseum yet"
};

const ERROR_MESSAGES: Record<string, string> = {
  coach_gym_limit_reached: "You can list up to 5 gyms - remove one first.",
  coach_gym_already_listed: "That gym is already in your list.",
  coach_gym_already_linked: "That gym is already linked.",
  coach_gym_not_found: "That gym isn't on Kolosseum any more.",
  coach_gym_invalid: "Give the gym's name (up to 120 characters)."
};

function errorMessage(error: unknown): string {
  const payload = error instanceof Error ? (error as Error & { payload?: unknown }).payload : undefined;
  const code = typeof (payload as JsonRecord | undefined)?.error === "string" ? String((payload as JsonRecord).error) : "";
  return ERROR_MESSAGES[code] ?? "That didn't work. Try again.";
}

async function csrf(): Promise<string> {
  const account = await loadAccountDetail();
  return typeof account.csrf_token === "string" ? account.csrf_token : "";
}

function place(gym: JsonRecord): string {
  return gym.area ? `${String(gym.gym_name ?? gym.display_name ?? "")}, ${String(gym.area)}` : String(gym.gym_name ?? gym.display_name ?? "");
}

export function CoachGymsPanel() {
  const [gyms, setGyms] = useState<JsonRecord[] | null>(null);
  const [maxGyms, setMaxGyms] = useState(5);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<JsonRecord[]>([]);
  const [searched, setSearched] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [typedArea, setTypedArea] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const show = useCallback((payload: JsonRecord) => {
    setGyms(Array.isArray(payload.gyms) ? (payload.gyms as JsonRecord[]) : []);
    if (typeof payload.max_gyms === "number") setMaxGyms(payload.max_gyms);
  }, []);

  const refresh = useCallback(async () => {
    try {
      show(await loadCoachGyms());
      setError(null);
    }
    catch (caught) {
      setError(errorMessage(caught));
    }
  }, [show]);

  useEffect(() => {
    refresh();
    document.addEventListener("kolosseum:account-role-known", refresh);
    return () => document.removeEventListener("kolosseum:account-role-known", refresh);
  }, [refresh]);

  async function act(action: (token: string) => Promise<JsonRecord>) {
    setBusy(true);
    setError(null);
    try {
      show(await action(await csrf()));
      return true;
    }
    catch (caught) {
      setError(errorMessage(caught));
      return false;
    }
    finally {
      setBusy(false);
    }
  }

  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (query.trim().length < 2) return;
    try {
      const payload = await searchCoachGyms(query.trim());
      setResults(Array.isArray(payload.gyms) ? (payload.gyms as JsonRecord[]) : []);
      setSearched(true);
    }
    catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function addTyped(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await act((token) => addCoachGym({ gym_name: typedName.trim(), area: typedArea.trim() }, token))) {
      setTypedName("");
      setTypedArea("");
    }
  }

  const list = gyms ?? [];
  const full = list.length >= maxGyms;

  return (
    <section className="panel" aria-labelledby="coachGymsHeading" data-testid="coach-gyms-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Gyms</p>
          <h3 id="coachGymsHeading">Gyms I coach at</h3>
          <p className="muted">Your athletes see these on your card. A gym on Kolosseum confirms you work there first; one that isn't on Kolosseum yet you can link once it joins.</p>
        </div>
      </div>

      {error ? <p className="field-error" role="alert">{error}</p> : null}

      <div className="record-list">
        {gyms === null ? null : list.length === 0 ? (
          <p className="muted small">No gyms yet.</p>
        ) : list.map((gym) => {
          const id = String(gym.coach_gym_id);
          const matches = Array.isArray(gym.now_on_kolosseum) ? (gym.now_on_kolosseum as JsonRecord[]) : [];
          return (
            <article className="record-row" key={id}>
              <div>
                <strong>{place(gym)}</strong>
                <p className="muted small">{STATUS_LABEL[String(gym.link_status)] ?? ""}</p>
                {matches.map((match) => (
                  <p className="muted small" key={String(match.org_id)}>
                    {`${place(match)} is now on Kolosseum. `}
                    <button type="button" className="button secondary small-button" disabled={busy} onClick={() => void act((token) => linkCoachGym(id, String(match.org_id), token))}>
                      Link it
                    </button>
                  </p>
                ))}
              </div>
              <button type="button" className="button secondary" disabled={busy} onClick={() => void act((token) => removeCoachGym(id, token))}>
                Remove
              </button>
            </article>
          );
        })}
      </div>

      {full ? <p className="muted small">{`You've listed ${maxGyms} gyms - the most you can.`}</p> : (
        <>
          <form className="inline-controls" onSubmit={search}>
            <label className="field">
              <span>Find a gym on Kolosseum</span>
              <input type="search" placeholder="Gym name or town" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <button className="button secondary" type="submit">Search</button>
          </form>
          {results.length > 0 ? (
            <div className="record-list">
              {results.map((gym) => (
                <article className="record-row" key={String(gym.org_id)}>
                  <strong>{place(gym)}</strong>
                  <button type="button" className="button primary" disabled={busy} onClick={() => void act((token) => addCoachGym({ org_id: String(gym.org_id) }, token)).then((ok) => { if (ok) setResults([]); })}>
                    Add
                  </button>
                </article>
              ))}
            </div>
          ) : searched ? <p className="muted small">No gym on Kolosseum matches that - add it below instead.</p> : null}

          <form className="athlete-detail-note-form" onSubmit={addTyped}>
            <p className="muted small">Not on Kolosseum yet?</p>
            <label className="field">
              <span>Gym name</span>
              <input type="text" maxLength={120} value={typedName} onChange={(event) => setTypedName(event.target.value)} />
            </label>
            <label className="field">
              <span>Town or area (optional)</span>
              <input type="text" maxLength={120} value={typedArea} onChange={(event) => setTypedArea(event.target.value)} />
            </label>
            <div className="inline-controls">
              <button className="button secondary" type="submit" disabled={busy || !typedName.trim()}>Add gym</button>
            </div>
          </form>
        </>
      )}
    </section>
  );
}
