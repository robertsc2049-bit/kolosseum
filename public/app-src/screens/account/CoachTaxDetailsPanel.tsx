import React, { useCallback, useEffect, useState } from "react";

import { loadTaxDetails, saveTaxDetails } from "../../api/checkinsClient";
import { loadAccountDetail } from "../../api/client";
import { type JsonRecord } from "../../api/transport";
import { ENTRY_AUTH_SUCCEEDED_EVENT } from "../entry/useEntryAuth";

// A coach's tax details (seller_tax_service.ts): Kolosseum may have to report
// what coaches are paid through packages to HMRC each year, so a coach who
// sells packages is asked for them. Only they and Kolosseum's admin see them.
type Draft = {
  seller_type: string; legal_name: string; date_of_birth: string; company_number: string; tax_number_type: string; tax_number: string;
  vat_number: string; address_line1: string; address_line2: string; city: string; postcode: string; country: string;
};

const EMPTY: Draft = {
  seller_type: "individual", legal_name: "", date_of_birth: "", company_number: "", tax_number_type: "nino", tax_number: "",
  vat_number: "", address_line1: "", address_line2: "", city: "", postcode: "", country: "GB"
};

const REFRESH_EVENTS = [ENTRY_AUTH_SUCCEEDED_EVENT, "kolosseum:account-role-known"];

function draftFrom(details: JsonRecord): Draft {
  const out = { ...EMPTY };
  for (const key of Object.keys(EMPTY) as (keyof Draft)[]) {
    if (details[key] != null) out[key] = String(details[key]);
  }
  if (!details.tax_number_type) out.tax_number_type = details.seller_type === "company" ? "" : "nino";
  return out;
}

// "QQ••••56C" - enough to recognise, not to copy.
export function maskTaxNumber(value: unknown): string {
  const raw = String(value ?? "");
  return raw.length > 4 ? `${raw.slice(0, 2)}${"•".repeat(raw.length - 5)}${raw.slice(-3)}` : raw;
}

const TAX_NUMBER_LABEL: Record<string, string> = { nino: "National Insurance number", utr: "UTR", other: "Tax number" };

export function CoachTaxDetailsPanel() {
  const [payload, setPayload] = useState<JsonRecord | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try { setPayload(await loadTaxDetails()); }
    catch { setPayload(null); }
  }, []);

  useEffect(() => {
    refresh();
    for (const name of REFRESH_EVENTS) document.addEventListener(name, refresh);
    return () => { for (const name of REFRESH_EVENTS) document.removeEventListener(name, refresh); };
  }, [refresh]);

  if (!payload) return null;
  const details = (payload.tax_details ?? null) as JsonRecord | null;
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const fieldError = (key: string) => (fieldErrors[key] ? <span className="field-error">{fieldErrors[key]}</span> : null);
  const company = draft.seller_type === "company";

  function startEditing() {
    setDraft(details ? draftFrom(details) : EMPTY);
    setFieldErrors({});
    setError(null);
    setNotice(null);
    setEditing(true);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const account = await loadAccountDetail();
      const body: JsonRecord = { ...draft };
      if (company) body.date_of_birth = "";
      else body.company_number = "";
      setPayload(await saveTaxDetails(body, typeof account.csrf_token === "string" ? account.csrf_token : ""));
      setEditing(false);
      setNotice("Tax details saved.");
    }
    catch (caught) {
      const fields = (((caught as { payload?: JsonRecord }).payload ?? {}).field_errors ?? {}) as Record<string, string>;
      setFieldErrors(fields);
      setError(Object.keys(fields).length ? "Check the details marked below." : "That didn't save. Try again.");
    }
    finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="coachTaxHeading" data-testid="coach-tax-details">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Tax details</p>
          <h3 id="coachTaxHeading">For HMRC reporting</h3>
          <p className="muted">
            Kolosseum may have to tell HMRC each year what you're paid through your packages, with your name, address and tax number.
            Only you and Kolosseum's admin see these.
          </p>
        </div>
      </div>
      {notice ? <p className="muted small" role="status">{notice}</p> : null}
      {!editing ? (
        details ? (
          <div className="tax-details-summary">
            <p><strong>{String(details.legal_name)}</strong>{details.seller_type === "company" ? ` - company ${String(details.company_number ?? "")}` : ""}</p>
            <p className="muted small">{[details.address_line1, details.address_line2, details.city, details.postcode].filter(Boolean).map(String).join(", ")}</p>
            {details.tax_number ? <p className="muted small">{`${TAX_NUMBER_LABEL[String(details.tax_number_type)] ?? "Tax number"}: ${maskTaxNumber(details.tax_number)}`}</p> : null}
            {details.vat_number ? <p className="muted small">{`VAT: ${String(details.vat_number)}`}</p> : null}
            <button className="button secondary" type="button" onClick={startEditing}>Change tax details</button>
          </div>
        ) : (
          <div>
            {payload.sells_packages ? <p className="field-error">You sell packages - add your tax details.</p> : <p className="muted small">Not added yet. You'll need these once you sell packages.</p>}
            <button className="button primary" type="button" onClick={startEditing}>Add tax details</button>
          </div>
        )
      ) : (
        <form className="tax-details-form" onSubmit={save} noValidate>
          {error ? <p className="field-error" role="alert">{error}</p> : null}
          <fieldset>
            <legend>You're paid as</legend>
            <label className="checkbox-row"><input type="radio" name="seller_type" checked={!company} onChange={() => set({ seller_type: "individual", tax_number_type: draft.tax_number_type || "nino" })} /> Myself (sole trader or individual)</label>
            <label className="checkbox-row"><input type="radio" name="seller_type" checked={company} onChange={() => set({ seller_type: "company" })} /> A company</label>
          </fieldset>
          <label className="field">
            <span>{company ? "Company name (as registered)" : "Full legal name"}</span>
            <input type="text" autoComplete={company ? "organization" : "name"} maxLength={200} value={draft.legal_name} onChange={(event) => set({ legal_name: event.target.value })} />
            {fieldError("legal_name")}
          </label>
          {company ? (
            <label className="field">
              <span>Company registration number</span>
              <input type="text" maxLength={20} value={draft.company_number} onChange={(event) => set({ company_number: event.target.value })} />
              {fieldError("company_number")}
            </label>
          ) : (
            <label className="field">
              <span>Date of birth</span>
              <input type="date" autoComplete="bday" value={draft.date_of_birth} onChange={(event) => set({ date_of_birth: event.target.value })} />
              {fieldError("date_of_birth")}
            </label>
          )}
          <div className="inline-controls">
            <label className="field">
              <span>{company ? "Tax number (optional)" : "Tax number"}</span>
              <select aria-label="Tax number type" value={draft.tax_number_type} onChange={(event) => set({ tax_number_type: event.target.value })}>
                {company ? <option value="">None</option> : null}
                <option value="nino">National Insurance number</option>
                <option value="utr">UTR (Unique Taxpayer Reference)</option>
                <option value="other">Another country's tax number</option>
              </select>
              {fieldError("tax_number_type")}
            </label>
            <label className="field">
              <span>{TAX_NUMBER_LABEL[draft.tax_number_type] ?? "Tax number"}</span>
              <input type="text" autoComplete="off" maxLength={30} value={draft.tax_number} onChange={(event) => set({ tax_number: event.target.value })} />
              {fieldError("tax_number")}
            </label>
          </div>
          <label className="field">
            <span>VAT number (if you're VAT registered)</span>
            <input type="text" maxLength={20} value={draft.vat_number} onChange={(event) => set({ vat_number: event.target.value })} />
            {fieldError("vat_number")}
          </label>
          <label className="field">
            <span>{company ? "Registered address" : "Home address"}</span>
            <input type="text" autoComplete="address-line1" maxLength={200} value={draft.address_line1} onChange={(event) => set({ address_line1: event.target.value })} />
            {fieldError("address_line1")}
          </label>
          <label className="field">
            <span>Address line 2 (optional)</span>
            <input type="text" autoComplete="address-line2" maxLength={200} value={draft.address_line2} onChange={(event) => set({ address_line2: event.target.value })} />
          </label>
          <div className="inline-controls">
            <label className="field">
              <span>Town or city</span>
              <input type="text" autoComplete="address-level2" maxLength={100} value={draft.city} onChange={(event) => set({ city: event.target.value })} />
              {fieldError("city")}
            </label>
            <label className="field">
              <span>Postcode</span>
              <input type="text" autoComplete="postal-code" maxLength={20} value={draft.postcode} onChange={(event) => set({ postcode: event.target.value })} />
              {fieldError("postcode")}
            </label>
          </div>
          <label className="field">
            <span>Country</span>
            <select aria-label="Country" value={draft.country} onChange={(event) => set({ country: event.target.value })}>
              <option value="GB">United Kingdom</option>
              <option value="IE">Ireland</option>
              <option value="US">United States</option>
              <option value="AU">Australia</option>
              <option value="CA">Canada</option>
              <option value="NZ">New Zealand</option>
            </select>
            {fieldError("country")}
          </label>
          <div className="inline-controls">
            <button className="button primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save tax details"}</button>
            <button className="button secondary" type="button" disabled={busy} onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      )}
    </section>
  );
}
