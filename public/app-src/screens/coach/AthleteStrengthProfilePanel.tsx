import React, { useEffect, useState } from "react";

// DEV NOTE: reused verbatim rather than re-derived - this is the same
// canonical current/superseded/scheduled classification and kg<->lb
// conversion the backend uses (src/api/*coach_workspace* persists through
// it), covered by test/full_ui_08c_strength_reference_lifecycle.test.mjs.
// Re-deriving the classification by hand here would risk silently drifting
// from that law over time.
// eslint-disable-next-line import/no-unresolved
import { projectStrengthReferenceLifecycle } from "../../../../shared/strength-reference/strengthReferenceLifecycle.mjs";

import { type JsonRecord } from "../../api/transport";
import { useAthleteStrengthProfile } from "./useAthleteStrengthProfile";

type Unit = "kg" | "lb";
type Basis = "tested_1rm" | "estimated_1rm" | "training_max";

type BenchmarkDraft = {
  draftKey: string;
  benchmark_id: string;
  exercise_id: string;
  value: string;
  unit: Unit;
  basis: Basis;
  effective_date: string;
  source_note: string;
  replaces_reference_id: string;
  persisted: boolean;
};

type SettingsDraft = {
  preferredWeightUnit: Unit;
  loadRoundingIncrement: string;
  bodyweight: string;
  bodyweightUnit: Unit;
};

const BASIS_LABELS: Record<Basis, string> = {
  tested_1rm: "Tested 1RM",
  estimated_1rm: "Estimated 1RM",
  training_max: "Training max"
};

const STATUS_LABELS: Record<string, string> = {
  current: "Current",
  superseded: "Superseded",
  scheduled: "Scheduled"
};

function asUnit(value: unknown): Unit {
  return value === "lb" ? "lb" : "kg";
}

function asBasis(value: unknown): Basis {
  return value === "estimated_1rm" || value === "training_max" ? value : "tested_1rm";
}

function settingsFromProfile(profile: JsonRecord | null): SettingsDraft {
  const preferredWeightUnit = asUnit(profile?.preferred_weight_unit);
  return {
    preferredWeightUnit,
    loadRoundingIncrement: String(
      profile?.load_rounding_increment ?? (preferredWeightUnit === "lb" ? 5 : 2.5)
    ),
    bodyweight:
      profile?.bodyweight === null || profile?.bodyweight === undefined ? "" : String(profile.bodyweight),
    bodyweightUnit: asUnit(profile?.bodyweight_unit)
  };
}

function benchmarksFromProfile(profile: JsonRecord | null): BenchmarkDraft[] {
  const benchmarks = Array.isArray(profile?.benchmarks) ? (profile!.benchmarks as JsonRecord[]) : [];
  return benchmarks.map((benchmark) => ({
    draftKey: `persisted-${String(benchmark.benchmark_id ?? "")}`,
    benchmark_id: String(benchmark.benchmark_id ?? ""),
    exercise_id: String(benchmark.exercise_id ?? ""),
    value: String(Number(benchmark.value ?? 0)),
    unit: asUnit(benchmark.unit),
    basis: asBasis(benchmark.basis),
    effective_date: String(benchmark.effective_date ?? new Date().toISOString().slice(0, 10)),
    source_note: String(benchmark.source_note ?? ""),
    replaces_reference_id: String(benchmark.replaces_reference_id ?? ""),
    persisted: true
  }));
}

function newBenchmarkDraft(preferredUnit: Unit, exercises: JsonRecord[]): BenchmarkDraft {
  const exercise = exercises[0];
  return {
    draftKey: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    benchmark_id: "",
    exercise_id: exercise ? String(exercise.exercise_id ?? "") : "",
    value: preferredUnit === "lb" ? "225" : "100",
    unit: preferredUnit,
    basis: "tested_1rm",
    effective_date: new Date().toISOString().slice(0, 10),
    source_note: "",
    replaces_reference_id: "",
    persisted: false
  };
}

function benchmarkSummary(record: JsonRecord): string {
  const sourceValue = Number(record.source_value ?? 0);
  const sourceUnit = String(record.source_unit ?? "kg");
  const displayUnit = String(record.display_unit ?? sourceUnit);
  const conversionText =
    sourceUnit === displayUnit ? "" : ` · ${record.display_value} ${displayUnit}`;
  const sourceNote = String(record.source_note ?? "").trim();

  return [
    BASIS_LABELS[asBasis(record.source_type)],
    `${sourceValue} ${sourceUnit}${conversionText}`,
    `Effective ${String(record.effective_date ?? "")}`,
    sourceNote ? `Source: ${sourceNote}` : ""
  ]
    .filter(Boolean)
    .join(" · ");
}

export function AthleteStrengthProfilePanel() {
  const { athleteUserId, loading, error, profile, exercises, save, refresh } = useAthleteStrengthProfile();

  const [settings, setSettings] = useState<SettingsDraft>(() => settingsFromProfile(null));
  const [benchmarks, setBenchmarks] = useState<BenchmarkDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    setSettings(settingsFromProfile(profile));
    setBenchmarks(benchmarksFromProfile(profile));
    // NOTE: deliberately not resetting `result` here - a successful save
    // updates `profile` too, and this effect firing again would otherwise
    // immediately wipe the "Athlete profile saved." message it just set.
  }, [profile]);

  useEffect(() => {
    setResult(null);
  }, [athleteUserId]);

  if (!athleteUserId) return null;

  if (loading && !profile) {
    return (
      <div className="athlete-profile-form">
        <p className="muted small">Loading athlete profile…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="athlete-profile-form">
        <p role="status" className="muted small error">{error}</p>
        <button className="button secondary" type="button" onClick={() => refresh()}>
          Retry
        </button>
      </div>
    );
  }

  const lifecycle = profile
    ? (projectStrengthReferenceLifecycle(profile, settings.preferredWeightUnit) as {
        records: JsonRecord[];
        current_count: number;
      })
    : null;
  const lifecycleById = new Map((lifecycle?.records ?? []).map((record) => [String(record.reference_id ?? ""), record]));
  const currentCount = lifecycle?.current_count ?? 0;

  function updateBenchmark(draftKey: string, patch: Partial<BenchmarkDraft>) {
    setBenchmarks((current) =>
      current.map((row) => (row.draftKey === draftKey ? { ...row, ...patch } : row))
    );
  }

  function removeBenchmark(draftKey: string) {
    setBenchmarks((current) => current.filter((row) => row.draftKey !== draftKey));
  }

  function addBenchmark() {
    setBenchmarks((current) => [...current, newBenchmarkDraft(settings.preferredWeightUnit, exercises)]);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setResult(null);

    try {
      await save({
        preferred_weight_unit: settings.preferredWeightUnit,
        load_rounding_increment: Number(settings.loadRoundingIncrement),
        bodyweight: settings.bodyweight === "" ? null : Number(settings.bodyweight),
        bodyweight_unit: settings.bodyweightUnit,
        benchmarks: benchmarks.map((row) => ({
          benchmark_id: row.benchmark_id,
          exercise_id: row.exercise_id,
          value: Number(row.value),
          unit: row.unit,
          basis: row.basis,
          effective_date: row.effective_date,
          source_note: row.source_note.trim(),
          replaces_reference_id: row.replaces_reference_id || null
        })),
        expected_current_record_sha256:
          typeof profile?.record_sha256 === "string" ? profile.record_sha256 : null
      });
      setResult("Athlete profile saved.");
    }
    catch {
      setResult("Athlete profile could not be saved. Check your connection and try again.");
    }
    finally {
      setSaving(false);
    }
  }

  return (
    <form className="athlete-profile-form" onSubmit={handleSubmit}>
      <div className="profile-settings-grid">
        <label className="field">
          <span>Preferred load unit</span>
          <select
            value={settings.preferredWeightUnit}
            onChange={(event) => setSettings((current) => ({ ...current, preferredWeightUnit: asUnit(event.target.value) }))}
          >
            <option value="kg">Kilograms</option>
            <option value="lb">Pounds</option>
          </select>
        </label>
        <label className="field">
          <span>Load rounding increment</span>
          <input
            type="number"
            min={0.25}
            max={25}
            step={0.25}
            value={settings.loadRoundingIncrement}
            onChange={(event) => setSettings((current) => ({ ...current, loadRoundingIncrement: event.target.value }))}
          />
        </label>
        <label className="field">
          <span>Bodyweight</span>
          <input
            type="number"
            min={10}
            max={500}
            step={0.1}
            placeholder="Optional"
            value={settings.bodyweight}
            onChange={(event) => setSettings((current) => ({ ...current, bodyweight: event.target.value }))}
          />
        </label>
        <label className="field">
          <span>Bodyweight unit</span>
          <select
            value={settings.bodyweightUnit}
            onChange={(event) => setSettings((current) => ({ ...current, bodyweightUnit: asUnit(event.target.value) }))}
          >
            <option value="kg">kg</option>
            <option value="lb">lb</option>
          </select>
        </label>
      </div>

      <div className="panel-header profile-benchmark-header">
        <div>
          <p className="eyebrow">Strength references</p>
          <h3>1RM and training-max records</h3>
          <p className="muted">Record tested or estimated references used to resolve percentage-based working loads.</p>
        </div>
        <button className="button secondary" type="button" onClick={addBenchmark}>
          Add strength record
        </button>
      </div>

      <div className="benchmark-list">
        {benchmarks.length === 0 ? (
          <div className="empty-state compact-empty">
            <h3>No strength references recorded</h3>
            <p>Add a tested 1RM, estimated 1RM, or training max for percentage-based exercises.</p>
          </div>
        ) : (
          benchmarks.map((row) => {
            const record = row.persisted ? lifecycleById.get(row.benchmark_id) : undefined;
            const statusLabel = record
              ? STATUS_LABELS[String(record.lifecycle_status ?? "")] ?? "Current"
              : "Not yet saved";

            return (
              <article className="benchmark-row" key={row.draftKey}>
                <label className="field benchmark-exercise-field">
                  <span>Exercise</span>
                  <select
                    disabled={row.persisted}
                    value={row.exercise_id}
                    onChange={(event) => updateBenchmark(row.draftKey, { exercise_id: event.target.value })}
                  >
                    {exercises.map((exercise) => (
                      <option key={String(exercise.exercise_id)} value={String(exercise.exercise_id)}>
                        {String(exercise.display_name ?? exercise.exercise_id)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field benchmark-value-field">
                  <span>Reference load</span>
                  <input
                    type="number"
                    min={0.25}
                    max={1500}
                    step={0.25}
                    disabled={row.persisted}
                    value={row.value}
                    onChange={(event) => updateBenchmark(row.draftKey, { value: event.target.value })}
                  />
                </label>
                <label className="field benchmark-unit-field">
                  <span>Unit</span>
                  <select
                    disabled={row.persisted}
                    value={row.unit}
                    onChange={(event) => updateBenchmark(row.draftKey, { unit: asUnit(event.target.value) })}
                  >
                    <option value="kg">kg</option>
                    <option value="lb">lb</option>
                  </select>
                </label>
                <label className="field benchmark-basis-field">
                  <span>Record type</span>
                  <select
                    disabled={row.persisted}
                    value={row.basis}
                    onChange={(event) => updateBenchmark(row.draftKey, { basis: asBasis(event.target.value) })}
                  >
                    <option value="tested_1rm">Tested 1RM</option>
                    <option value="estimated_1rm">Estimated 1RM</option>
                    <option value="training_max">Training max</option>
                  </select>
                </label>
                <label className="field benchmark-date-field">
                  <span>Effective date</span>
                  <input
                    type="date"
                    disabled={row.persisted}
                    value={row.effective_date}
                    onChange={(event) => updateBenchmark(row.draftKey, { effective_date: event.target.value })}
                  />
                </label>
                <label className="field benchmark-note-field">
                  <span>Source note</span>
                  <input
                    maxLength={240}
                    placeholder="Optional factual source"
                    disabled={row.persisted}
                    value={row.source_note}
                    onChange={(event) => updateBenchmark(row.draftKey, { source_note: event.target.value })}
                  />
                </label>
                <p className="muted small">{record ? benchmarkSummary(record) : "Not saved yet."}</p>
                <span className="badge neutral">{statusLabel}</span>
                <button
                  className="button danger small-button remove-athlete-benchmark"
                  type="button"
                  disabled={row.persisted}
                  onClick={() => removeBenchmark(row.draftKey)}
                >
                  {row.persisted ? "Immutable record" : "Remove"}
                </button>
              </article>
            );
          })
        )}
      </div>

      <div className="profile-save-row">
        <p className="muted small">
          {benchmarks.length} record{benchmarks.length === 1 ? "" : "s"} · {currentCount} current exercise
          reference{currentCount === 1 ? "" : "s"}
        </p>
        <button className="button primary" type="submit" disabled={saving}>
          Save athlete profile
        </button>
      </div>
      {result ? <p className="inline-result">{result}</p> : null}
    </form>
  );
}
