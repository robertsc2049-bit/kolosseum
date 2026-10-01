import React, { useEffect, useState } from "react";

import { loadWeightClass, saveWeightClass } from "../../api/athleteOnboardingClient";
import { loadAccountDetail } from "../../api/client";
import { type JsonRecord } from "../../api/transport";

// A fighter's weight class. In the 4 weeks before a fight (their competition
// date or a fixture) the gym keeps strength without building muscle mass.
// Kolosseum gives no weight-cutting, diet or hydration advice.

const COMBAT = new Set(["boxing", "muay_thai", "mma", "wrestling", "judo", "brazilian_jiu_jitsu"]);
export const isCombatActivity = (activityId: unknown) => COMBAT.has(String(activityId ?? ""));

export function WeightClassCard() {
  const [competes, setCompetes] = useState(false);
  const [kg, setKg] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function apply(result: JsonRecord) {
    setCompetes(result.competes_at_weight_class === true);
    setKg(result.weight_class_kg === null || result.weight_class_kg === undefined ? "" : String(result.weight_class_kg));
  }

  useEffect(() => {
    let cancelled = false;
    loadWeightClass()
      .then((result) => { if (!cancelled) apply(result); })
      .catch(() => { if (!cancelled) setError("Your weight class could not be loaded. Try again."); })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const account = await loadAccountDetail();
      const csrf = typeof account.csrf_token === "string" ? account.csrf_token : "";
      apply(await saveWeightClass({ competes_at_weight_class: competes, weight_class_kg: competes && kg.trim() ? Number(kg) : null }, csrf));
      setSaved(true);
    }
    catch {
      setError("Your weight class could not be saved. Check the weight and try again.");
    }
    finally {
      setSaving(false);
    }
  }

  if (!loaded) return <p className="dashboard-status" role="status">Loading your weight class…</p>;

  return (
    <div className="panel weight-class-card" data-testid="weight-class">
      <h4>Weight class</h4>
      <p className="muted">If you compete at a weight class, the 4 weeks before a fight keep your strength without building muscle mass (anything above 6 reps becomes at most 3 sets of 6). Set your fight date as your competition date or a fixture. Kolosseum gives no weight-cutting advice - follow your coach and medical team.</p>
      <label className="check-line">
        <input type="checkbox" checked={competes} onChange={(event) => { setCompetes(event.target.checked); setSaved(false); }} />
        <span>I compete at a weight class</span>
      </label>
      {competes ? (
        <label className="field">
          <span>Weight class (kg, optional)</span>
          <input type="number" inputMode="decimal" min={40} max={160} step={0.1} value={kg} onChange={(event) => { setKg(event.target.value); setSaved(false); }} />
        </label>
      ) : null}
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      {saved ? <p className="inline-result" role="status">Saved.</p> : null}
      <div className="button-row">
        <button className="button primary" type="button" disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Save weight class"}</button>
      </div>
    </div>
  );
}
