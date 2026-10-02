import React, { useEffect, useState } from "react";

import { loadAthleteEquipment, saveAthleteEquipment } from "../../api/athleteOnboardingClient";
import { loadAccountDetail } from "../../api/client";
import { type JsonRecord } from "../../api/transport";

// The equipment a self-directed athlete has. A full gym is assumed until they
// say; once set, recommendations only offer what they can do, and a session
// exercise they can't do is swapped for a flagged substitute (or flagged).
// First where they train, then - for anything short of a full gym - what they
// have, as tappable chips grouped the way a gym is laid out.

type Option = { equipment_id: string; display_name: string };
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

  function apply(result: JsonRecord) {
    const nextHave = Array.isArray(result.available_equipment) ? result.available_equipment.map(String) : [];
    setOptions(Array.isArray(result.options) ? (result.options as JsonRecord[]).map((o) => ({ equipment_id: String(o.equipment_id), display_name: String(o.display_name) })) : []);
    setHave(nextHave);
    setMode(modeFor(result.full_gym !== false, nextHave));
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
      const account = await loadAccountDetail();
      const csrf = typeof account.csrf_token === "string" ? account.csrf_token : "";
      apply(await saveAthleteEquipment(mode === "full_gym" ? { full_gym: true } : { available_equipment: have }, csrf));
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
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      {saved ? <p className="muted" role="status">Your equipment is saved.</p> : null}
      <fieldset className="choice-chips equipment-mode">
        <legend>Where do you train?</legend>
        {MODES.map(([value, label]) => (
          <label key={value} className="choice-chip">
            <input type="radio" name="equipment-mode" checked={mode === value} onChange={() => chooseMode(value)} />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
      {mode === "full_gym" ? <p className="choice-hint">Everything is available.</p> : null}
      {mode === "bodyweight" ? <p className="choice-hint">Bodyweight exercises only - add anything you do have below.</p> : null}
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
        <button className="button primary" type="button" disabled={saving} onClick={() => void save()}>Save equipment</button>
      </div>
    </article>
  );
}
