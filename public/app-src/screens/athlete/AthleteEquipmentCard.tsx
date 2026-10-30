import React, { useEffect, useState } from "react";

import { loadAthleteEquipment, requestCoaching, saveAthleteEquipment, saveAthleteGyms, searchGyms } from "../../api/athleteOnboardingClient";
import { loadAccountDetail } from "../../api/client";
import { type JsonRecord } from "../../api/transport";

// The equipment a self-directed athlete has. A full gym is assumed until they
// say; once set, recommendations only offer what they can do, and a session
// exercise they can't do is swapped for a flagged substitute (or flagged).
// First where they train, then - for anything short of a full gym - what they
// have, as tappable chips grouped the way a gym is laid out.
// An athlete can choose up to 3 listed gyms and name one their main gym: its
// listed equipment is theirs, and what they choose here is their home kit on
// top of it.

type Option = { equipment_id: string; display_name: string };
type GymCoach = { coach_gym_id: string; display_name: string; business_name: string | null; asked: boolean };
type Gym = { org_id: string; display_name: string; area: string; equipment_count: number; listed: boolean; coaches: GymCoach[] };
type MainGym = { org_id: string; display_name: string; equipment: string[] };
const MAX_GYMS = 3;

const gymFrom = (g: JsonRecord): Gym => ({
  org_id: String(g.org_id), display_name: String(g.display_name ?? ""), area: String(g.area ?? ""),
  equipment_count: Number(g.equipment_count ?? 0), listed: g.listed !== false,
  coaches: Array.isArray(g.coaches) ? (g.coaches as JsonRecord[]).map((c) => ({
    coach_gym_id: String(c.coach_gym_id), display_name: String(c.display_name ?? ""),
    business_name: typeof c.business_name === "string" && c.business_name ? c.business_name : null, asked: c.asked === true
  })) : []
});

// The coaches a gym has confirmed: the athlete asks one to coach them, with
// an optional short note; the coach then sends the usual invitation.
function GymCoaches({ gym, onAsked }: { gym: Gym; onAsked: (coachGymId: string) => void }) {
  const [asking, setAsking] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!gym.coaches.length) return null;
  async function send(coachGymId: string) {
    setBusy(true);
    setError(null);
    try {
      const account = await loadAccountDetail();
      await requestCoaching(coachGymId, note.trim(), typeof account.csrf_token === "string" ? account.csrf_token : "");
      onAsked(coachGymId);
      setAsking(null);
      setNote("");
    }
    catch (caught) {
      const code = String(((caught as { payload?: JsonRecord }).payload ?? {}).error ?? "");
      setError(code === "coaching_request_already_coached" ? "They already coach you." : code === "coaching_request_already_sent" ? "You've already asked them." : "Your request couldn't be sent. Try again.");
    }
    finally {
      setBusy(false);
    }
  }
  return (
    <div className="gym-coaches" data-testid="gym-coaches">
      <p className="choice-hint">Coaches at {gym.display_name}:</p>
      <ul>
        {gym.coaches.map((coach) => (
          <li key={coach.coach_gym_id}>
            <span>{coach.display_name}{coach.business_name ? ` · ${coach.business_name}` : ""}</span>{" "}
            {coach.asked ? <span className="muted small">Asked - they'll invite you if they can take you on</span> : asking === coach.coach_gym_id ? (
              <span className="inline-controls">
                <input type="text" maxLength={300} placeholder="A line about you and your goals (optional)" value={note} onChange={(event) => setNote(event.target.value)} />
                <button className="button primary small" type="button" disabled={busy} onClick={() => void send(coach.coach_gym_id)}>Send</button>
                <button className="button secondary small" type="button" disabled={busy} onClick={() => setAsking(null)}>Cancel</button>
              </span>
            ) : (
              <button className="button secondary small" type="button" onClick={() => { setAsking(coach.coach_gym_id); setNote(""); }}>Ask to coach me</button>
            )}
          </li>
        ))}
      </ul>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
    </div>
  );
}

const markAsked = (list: Gym[], coachGymId: string): Gym[] =>
  list.map((gym) => ({ ...gym, coaches: gym.coaches.map((coach) => (coach.coach_gym_id === coachGymId ? { ...coach, asked: true } : coach)) }));
type Mode = "full_gym" | "home_gym" | "bodyweight" | "custom";

const HOME_GYM = ["barbell", "rack", "bench", "plate", "dumbbell", "pull_up_bar", "resistance_band"];
// Always available, so never offered as a choice.
const ALWAYS = new Set(["bodyweight", "open_floor_space"]);
const GROUPS: Array<[string, string[]]> = [
  ["Free weights", ["barbell", "plate", "dumbbell", "adjustable_dumbbell", "hex_dumbbell", "kettlebell", "trap_bar", "medicine_ball", "squat_bar", "safety_squat_bar", "deadlift_bar"]],
  ["Racks, benches and bars", ["rack", "bench", "box", "pull_up_bar", "dip_bars", "landmine_attachment", "glute_ham_bench", "gymnastics_rings", "climbing_rope"]],
  ["Machines and cables", ["cable_machine", "machine_general", "cardio_machine_general", "cable_rope_attachment", "cable_straight_bar_attachment", "cable_v_bar_attachment", "cable_single_handle_attachment", "cable_lat_bar_attachment"]],
  ["Bands and portable kit", ["resistance_band", "jump_rope"]],
  ["Strongman and sleds", ["sled", "yoke", "tire", "atlas_stone", "strongman_log", "axle_bar", "sandbag"]]
];
const MODES: Array<[Mode, string]> = [["full_gym", "Full gym"], ["home_gym", "Home gym"], ["bodyweight", "Bodyweight only"], ["custom", "Choose my own"]];

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
const modeFor = (fullGym: boolean, have: string[]): Mode =>
  fullGym ? "full_gym" : have.length === 0 ? "bodyweight" : sameSet(have, HOME_GYM) ? "home_gym" : "custom";

export function AthleteEquipmentCard() {
  const [options, setOptions] = useState<Option[]>([]);
  const [mode, setMode] = useState<Mode>("full_gym");
  const [have, setHave] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [mainGym, setMainGym] = useState<MainGym | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Gym[] | null>(null);
  const [gymBusy, setGymBusy] = useState(false);
  const [gymError, setGymError] = useState<string | null>(null);

  function apply(result: JsonRecord) {
    const nextHave = Array.isArray(result.available_equipment) ? result.available_equipment.map(String) : [];
    setOptions(Array.isArray(result.options) ? (result.options as JsonRecord[]).map((o) => ({ equipment_id: String(o.equipment_id), display_name: String(o.display_name) })) : []);
    setHave(nextHave);
    const main = result.main_gym && typeof result.main_gym === "object" ? (result.main_gym as JsonRecord) : null;
    setMainGym(main ? { org_id: String(main.org_id), display_name: String(main.display_name ?? ""), equipment: Array.isArray(main.equipment) ? main.equipment.map(String) : [] } : null);
    setGyms(Array.isArray(result.gyms) ? (result.gyms as JsonRecord[]).map(gymFrom) : []);
    setMode(main ? (nextHave.length ? "custom" : "bodyweight") : modeFor(result.full_gym !== false, nextHave));
  }

  async function csrfToken(): Promise<string> {
    const account = await loadAccountDetail();
    return typeof account.csrf_token === "string" ? account.csrf_token : "";
  }

  async function search() {
    setGymError(null);
    if (query.trim().length < 2) { setResults([]); return; }
    try {
      const found = await searchGyms(query.trim());
      setResults(Array.isArray(found.gyms) ? (found.gyms as JsonRecord[]).map(gymFrom) : []);
    }
    catch {
      setGymError("Gyms could not be searched. Try again.");
    }
  }

  async function saveGyms(ids: string[], mainId: string | null) {
    setGymBusy(true);
    setGymError(null);
    setSaved(false);
    try {
      apply(await saveAthleteGyms({ gym_org_ids: ids, main_org_id: ids.length ? (mainId && ids.includes(mainId) ? mainId : ids[0]) : null }, await csrfToken()));
      setResults(null);
      setQuery("");
    }
    catch {
      setGymError("Your gyms could not be saved. Try again.");
    }
    finally {
      setGymBusy(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    loadAthleteEquipment()
      .then((result) => { if (!cancelled) apply(result); })
      .catch(() => { if (!cancelled) setError("Your equipment could not be loaded. Try again."); })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  function chooseMode(next: Mode) {
    setSaved(false);
    setMode(next);
    if (next === "home_gym") setHave(HOME_GYM);
    if (next === "bodyweight") setHave([]);
  }

  function toggle(id: string) {
    setSaved(false);
    const next = have.includes(id) ? have.filter((x) => x !== id) : [...have, id];
    setHave(next);
    setMode(next.length === 0 ? "bodyweight" : sameSet(next, HOME_GYM) ? "home_gym" : "custom");
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      apply(await saveAthleteEquipment(mode === "full_gym" && !mainGym ? { full_gym: true } : { available_equipment: have }, await csrfToken()));
      setSaved(true);
    }
    catch {
      setError("Your equipment could not be saved. Try again.");
    }
    finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;

  const byId = new Map(options.map((o) => [o.equipment_id, o]));
  const grouped = new Set(GROUPS.flatMap(([, ids]) => ids));
  const other = options.filter((o) => !grouped.has(o.equipment_id) && !ALWAYS.has(o.equipment_id)).map((o) => o.equipment_id);
  const all: Array<[string, string[]]> = [...GROUPS, ["Other", other]];
  const sections: Array<[string, string[]]> = all
    .map(([title, ids]) => [title, ids.filter((id) => byId.has(id))] as [string, string[]])
    .filter(([, ids]) => ids.length > 0);

  return (
    <article className="onboarding-card athlete-equipment" data-testid="athlete-equipment">
      <p className="eyebrow">Your equipment</p>
      <h3>What can you train with?</h3>
      <p className="muted">Your exercise options and sessions only use what you have. Anything you can't do is swapped for a substitute that fits - and marked as one.</p>
      <section className="athlete-gyms" data-testid="athlete-gyms">
        <h4>Your gyms</h4>
        <p className="choice-hint">Choose the gym you train at and its listed equipment counts as yours. The gym only sees how many athletes chose it, never who.</p>
        {gymError ? <p className="field-error" role="alert">{gymError}</p> : null}
        {gyms.length ? (
          <ul className="athlete-gym-list">
            {gyms.map((gym) => (
              <li key={gym.org_id}>
                <label className="choice-chip">
                  <input type="radio" name="main-gym" checked={mainGym?.org_id === gym.org_id} disabled={gymBusy || !gym.listed} onChange={() => void saveGyms(gyms.map((g) => g.org_id), gym.org_id)} />
                  <span>{gym.display_name}{gym.area ? `, ${gym.area}` : ""}{mainGym?.org_id === gym.org_id ? " - main gym" : ""}</span>
                </label>
                {!gym.listed ? <span className="muted"> No longer listed - its equipment doesn't count.</span> : null}
                <button className="button secondary small" type="button" disabled={gymBusy} onClick={() => void saveGyms(gyms.filter((g) => g.org_id !== gym.org_id).map((g) => g.org_id), mainGym?.org_id ?? null)}>Remove</button>
                <GymCoaches gym={gym} onAsked={(id) => { setGyms((list) => markAsked(list, id)); setResults((list) => (list ? markAsked(list, id) : list)); }} />
              </li>
            ))}
          </ul>
        ) : null}
        {gyms.length < MAX_GYMS ? (
          <form className="athlete-gym-search" onSubmit={(event) => { event.preventDefault(); void search(); }}>
            <label className="field">
              <span>Find a gym by name or town</span>
              <input type="search" value={query} maxLength={80} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <button className="button secondary" type="submit">Search</button>
          </form>
        ) : <p className="choice-hint">You've chosen {MAX_GYMS} gyms - remove one to add another.</p>}
        {results ? (
          results.length ? (
            <ul className="athlete-gym-results">
              {results.filter((gym) => !gyms.some((g) => g.org_id === gym.org_id)).map((gym) => (
                <li key={gym.org_id}>
                  <span>{gym.display_name}, {gym.area} <span className="muted">({gym.equipment_count} pieces of kit)</span></span>
                  <button className="button secondary small" type="button" disabled={gymBusy} onClick={() => void saveGyms([...gyms.map((g) => g.org_id), gym.org_id], mainGym?.org_id ?? null)}>Add</button>
                  <GymCoaches gym={gym} onAsked={(id) => { setGyms((list) => markAsked(list, id)); setResults((list) => (list ? markAsked(list, id) : list)); }} />
                </li>
              ))}
            </ul>
          ) : <p className="choice-hint">No listed gyms match. Your gym can list itself for free from the organisation app.</p>
        ) : null}
      </section>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      {saved ? <p className="muted" role="status">Your equipment is saved.</p> : null}
      {mainGym ? <p className="choice-hint">The {mainGym.equipment.length} pieces of kit listed at {mainGym.display_name} count as yours. Add your home kit below - anything you have away from the gym.</p> : null}
      <fieldset className="choice-chips equipment-mode">
        <legend>{mainGym ? "Your home kit" : "Where do you train?"}</legend>
        {MODES.filter(([value]) => !mainGym || value !== "full_gym").map(([value, label]) => (
          <label key={value} className="choice-chip">
            <input type="radio" name="equipment-mode" checked={mode === value} onChange={() => chooseMode(value)} />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
      {mode === "full_gym" ? <p className="choice-hint">Everything is available.</p> : null}
      {mode === "bodyweight" && !mainGym ? <p className="choice-hint">Bodyweight exercises only - add anything you do have below.</p> : null}
      {mode !== "full_gym" ? (
        <div className="choice-section">
          {sections.map(([title, ids]) => (
            <fieldset key={title} className="choice-chips equipment-options">
              <legend>{title}</legend>
              {ids.map((id) => (
                <label key={id} className="choice-chip equipment-option">
                  <input type="checkbox" checked={have.includes(id)} onChange={() => toggle(id)} />
                  <span>{byId.get(id)?.display_name ?? id}</span>
                </label>
              ))}
            </fieldset>
          ))}
        </div>
      ) : null}
      <div className="onboarding-actions">
        <button className="button primary" type="button" disabled={saving} onClick={() => void save()}>{mainGym ? "Save home kit" : "Save equipment"}</button>
      </div>
    </article>
  );
}
