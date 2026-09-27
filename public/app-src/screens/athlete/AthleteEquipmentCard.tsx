import React, { useEffect, useState } from "react";

import { loadAthleteEquipment, saveAthleteEquipment } from "../../api/athleteOnboardingClient";
import { loadAccountDetail } from "../../api/client";
import { type JsonRecord } from "../../api/transport";

// The equipment a self-directed athlete has. A full gym is assumed until they
// say; once set, recommendations only offer what they can do, and a session
// exercise they can't do is swapped for a flagged substitute (or flagged).

type Option = { equipment_id: string; display_name: string };
const HOME_GYM = ["barbell", "rack", "bench", "plate", "dumbbell", "pull_up_bar", "resistance_band"];

export function AthleteEquipmentCard() {
  const [options, setOptions] = useState<Option[]>([]);
  const [fullGym, setFullGym] = useState(true);
  const [have, setHave] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function apply(result: JsonRecord) {
    setOptions(Array.isArray(result.options) ? (result.options as JsonRecord[]).map((o) => ({ equipment_id: String(o.equipment_id), display_name: String(o.display_name) })) : []);
    setFullGym(result.full_gym !== false);
    setHave(Array.isArray(result.available_equipment) ? result.available_equipment.map(String) : []);
  }

  useEffect(() => {
    let cancelled = false;
    loadAthleteEquipment()
      .then((result) => { if (!cancelled) apply(result); })
      .catch(() => { if (!cancelled) setError("Your equipment could not be loaded. Try again."); })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  function toggle(id: string) {
    setSaved(false);
    setHave((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const account = await loadAccountDetail();
      const csrf = typeof account.csrf_token === "string" ? account.csrf_token : "";
      apply(await saveAthleteEquipment(fullGym ? { full_gym: true } : { available_equipment: have }, csrf));
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

  return (
    <article className="onboarding-card athlete-equipment" data-testid="athlete-equipment">
      <p className="eyebrow">Your equipment</p>
      <h3>What can you train with?</h3>
      <p className="muted">Your exercise options and sessions only use what you have. Anything you can't do is swapped for a substitute that fits - and marked as one.</p>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      {saved ? <p className="muted" role="status">Your equipment is saved.</p> : null}
      <label className="consent-box">
        <input type="checkbox" checked={fullGym} onChange={(event) => { setSaved(false); setFullGym(event.target.checked); }} />
        <span>I train in a full gym (everything available)</span>
      </label>
      {!fullGym ? (
        <>
          <div className="onboarding-actions">
            <button className="button secondary" type="button" onClick={() => { setSaved(false); setHave(HOME_GYM); }}>Home gym</button>
            <button className="button secondary" type="button" onClick={() => { setSaved(false); setHave([]); }}>Bodyweight only</button>
          </div>
          <fieldset className="equipment-options">
            <legend>Equipment I have</legend>
            {options.map((option) => (
              <label key={option.equipment_id} className="equipment-option">
                <input type="checkbox" checked={have.includes(option.equipment_id)} onChange={() => toggle(option.equipment_id)} />
                <span>{option.display_name}</span>
              </label>
            ))}
          </fieldset>
        </>
      ) : null}
      <div className="onboarding-actions">
        <button className="button primary" type="button" disabled={saving} onClick={() => void save()}>Save equipment</button>
      </div>
    </article>
  );
}
