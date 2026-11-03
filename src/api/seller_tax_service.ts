// DEV NOTE: Coaches' tax details, and what they were paid each quarter, for
// reporting to HMRC under the digital platform reporting rules (The Reporting
// Platform Operators (Due Diligence and Reporting Requirements) Regulations
// 2023): a coach selling packages through Kolosseum is a seller of personal
// services, and the platform reports each seller's name, address, date of
// birth (individuals), tax number, VAT number and what they were paid per
// quarter by 31 January after the calendar year. The coach enters and keeps
// their details up to date; only they and the platform admin see them. What
// a coach was paid comes from the payments they record against packages
// (product_package_payments, valued at the package price) - payments are
// made outside the app, so these are the amounts as recorded.
import { pool } from "../db/pool.js";
import { CoachCheckinError } from "./coach_checkin_service.js";

type Json = Record<string, unknown>;
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const isRecord = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);

// National Insurance number (two letters, six digits, A-D) and UTR (10 digits).
const NINO = /^[A-Z]{2}\d{6}[A-D]$/u;
const UTR = /^\d{10}$/u;
const UK_VAT = /^GB(\d{9}|\d{12})$/u;
const UK_COMPANY = /^([A-Z]{2}\d{6}|\d{8})$/u;
const POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/u;

const compact = (value: unknown) => text(value).toUpperCase().replace(/\s+/gu, "");

function dayValue(value: unknown): string | null {
  const raw = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === raw ? raw : null;
}

function yearsBefore(years: number): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth(), now.getUTCDate())).toISOString().slice(0, 10);
}

export type TaxDetails = {
  seller_type: "individual" | "company"; legal_name: string; date_of_birth: string | null; company_number: string | null;
  tax_number_type: "nino" | "utr" | "other" | null; tax_number: string | null; vat_number: string | null;
  address_line1: string; address_line2: string | null; city: string; postcode: string; country: string;
};

// Checks and tidies what the coach entered; field errors say what to fix.
export function validateTaxDetails(input: unknown): { details: TaxDetails | null; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const body = isRecord(input) ? input : {};
  const sellerType = body.seller_type === "company" ? "company" : body.seller_type === "individual" ? "individual" : null;
  if (!sellerType) errors.seller_type = "Choose whether you're paid as yourself or through a company.";
  const legalName = text(body.legal_name).slice(0, 200);
  if (!legalName) errors.legal_name = sellerType === "company" ? "Your company's registered name." : "Your full legal name, as HMRC has it.";
  const country = compact(body.country) || "GB";
  if (!/^[A-Z]{2}$/u.test(country)) errors.country = "Choose a country.";
  const uk = country === "GB";

  let dateOfBirth: string | null = null;
  let companyNumber: string | null = null;
  if (sellerType === "individual") {
    dateOfBirth = dayValue(body.date_of_birth);
    if (!dateOfBirth || dateOfBirth > yearsBefore(18) || dateOfBirth < "1900-01-01") errors.date_of_birth = "Your date of birth (you need to be 18 or over).";
  }
  else if (sellerType === "company") {
    companyNumber = compact(body.company_number) || null;
    if (!companyNumber) errors.company_number = "Your company registration number.";
    else if (uk && !UK_COMPANY.test(companyNumber)) errors.company_number = "A Companies House number is 8 characters, like 01234567 or SC123456.";
  }

  const taxNumberType = body.tax_number_type === "nino" || body.tax_number_type === "utr" || body.tax_number_type === "other" ? body.tax_number_type : null;
  const taxNumber = compact(body.tax_number) || null;
  if (sellerType === "individual" || taxNumber) {
    if (!taxNumberType) errors.tax_number_type = "Choose which tax number you're giving.";
    else if (!taxNumber) errors.tax_number = "Your tax number.";
    else if (taxNumberType === "nino" && !NINO.test(taxNumber)) errors.tax_number = "A National Insurance number looks like QQ123456C.";
    else if (taxNumberType === "utr" && !UTR.test(taxNumber)) errors.tax_number = "A UTR is 10 digits.";
    else if (taxNumber.length > 30) errors.tax_number = "That's too long for a tax number.";
  }

  const vatNumber = compact(body.vat_number) || null;
  if (vatNumber && uk && !UK_VAT.test(vatNumber)) errors.vat_number = "A UK VAT number looks like GB123456789.";
  else if (vatNumber && vatNumber.length > 20) errors.vat_number = "That's too long for a VAT number.";

  const line1 = text(body.address_line1).slice(0, 200);
  const city = text(body.city).slice(0, 100);
  const postcodeRaw = text(body.postcode).toUpperCase().replace(/\s+/gu, " ");
  if (!line1) errors.address_line1 = "The first line of your address.";
  if (!city) errors.city = "Your town or city.";
  if (!postcodeRaw) errors.postcode = "Your postcode.";
  else if (uk && !POSTCODE.test(postcodeRaw)) errors.postcode = "That doesn't look like a UK postcode.";
  const postcode = uk && POSTCODE.test(postcodeRaw) ? `${postcodeRaw.replace(" ", "").slice(0, -3)} ${postcodeRaw.replace(" ", "").slice(-3)}` : postcodeRaw.slice(0, 20);

  if (Object.keys(errors).length || !sellerType) return { details: null, errors };
  return {
    details: {
      seller_type: sellerType, legal_name: legalName, date_of_birth: dateOfBirth, company_number: companyNumber,
      tax_number_type: taxNumber ? taxNumberType : null, tax_number: taxNumber, vat_number: vatNumber,
      address_line1: line1, address_line2: text(body.address_line2).slice(0, 200) || null, city, postcode, country
    },
    errors
  };
}

const DETAILS_SELECT = `
  SELECT seller_type, legal_name, date_of_birth::text AS date_of_birth, company_number, tax_number_type, tax_number, vat_number,
         address_line1, address_line2, city, postcode, country, updated_at
  FROM product_coach_tax_details`;

function detailsView(row: Json | undefined): Json | null {
  if (!row) return null;
  return {
    seller_type: row.seller_type, legal_name: row.legal_name, date_of_birth: row.date_of_birth ?? null, company_number: row.company_number ?? null,
    tax_number_type: row.tax_number_type ?? null, tax_number: row.tax_number ?? null, vat_number: row.vat_number ?? null,
    address_line1: row.address_line1, address_line2: row.address_line2 ?? null, city: row.city, postcode: row.postcode, country: row.country,
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at
  };
}

// The coach's own details, and whether they sell packages (when they're
// asked for them).
export async function getCoachTaxDetails(coachUserId: string): Promise<Json> {
  const [details, packages] = await Promise.all([
    pool.query(`${DETAILS_SELECT} WHERE coach_user_id = $1`, [coachUserId]),
    pool.query(`SELECT count(*)::int AS n FROM product_package_memberships WHERE coach_user_id = $1`, [coachUserId])
  ]);
  return { ok: true, tax_details: detailsView(details.rows[0] as Json | undefined), sells_packages: Number(packages.rows[0]?.n ?? 0) > 0 };
}

export async function saveCoachTaxDetails(coachUserId: string, input: unknown): Promise<Json> {
  const { details, errors } = validateTaxDetails(input);
  if (!details) throw new CoachCheckinError("tax_details_invalid", 422, errors);
  await pool.query(
    `INSERT INTO product_coach_tax_details (coach_user_id, seller_type, legal_name, date_of_birth, company_number, tax_number_type, tax_number, vat_number,
       address_line1, address_line2, city, postcode, country)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (coach_user_id) DO UPDATE SET seller_type = EXCLUDED.seller_type, legal_name = EXCLUDED.legal_name, date_of_birth = EXCLUDED.date_of_birth,
       company_number = EXCLUDED.company_number, tax_number_type = EXCLUDED.tax_number_type, tax_number = EXCLUDED.tax_number, vat_number = EXCLUDED.vat_number,
       address_line1 = EXCLUDED.address_line1, address_line2 = EXCLUDED.address_line2, city = EXCLUDED.city, postcode = EXCLUDED.postcode,
       country = EXCLUDED.country, updated_at = now()`,
    [coachUserId, details.seller_type, details.legal_name, details.date_of_birth, details.company_number, details.tax_number_type, details.tax_number,
      details.vat_number, details.address_line1, details.address_line2, details.city, details.postcode, details.country]
  );
  return getCoachTaxDetails(coachUserId);
}

// --- The admin's yearly report -------------------------------------------------------

export class SellerTaxReportError extends Error {}

export const SELLER_TAX_REPORT_COLUMNS = [
  "coach_user_id", "account_email", "details_added", "seller_type", "legal_name", "date_of_birth", "company_number", "tax_number_type", "tax_number",
  "vat_number", "address_line1", "address_line2", "city", "postcode", "country", "currency",
  "q1_paid", "q1_payments", "q2_paid", "q2_payments", "q3_paid", "q3_payments", "q4_paid", "q4_payments", "year_paid", "platform_fees"
] as const;

// Every coach who recorded a payment in the calendar year, or has a
// package or tax details: their details and what they were paid each quarter
// (amounts in major units, e.g. pounds), one row per currency. Coaches
// without details show details_added = no, so the admin can chase them.
export async function sellerTaxReport(yearInput: unknown): Promise<{ year: number; columns: readonly string[]; rows: Record<string, string>[] }> {
  const year = Number(yearInput);
  const thisYear = new Date().getUTCFullYear();
  if (!Number.isInteger(year) || year < 2024 || year > thisYear) throw new SellerTaxReportError("seller_tax_report_year_invalid");
  const from = `${year}-01-01`;
  const to = `${year + 1}-01-01`;
  const paid = await pool.query(
    `SELECT coach_user_id, currency, EXTRACT(QUARTER FROM recorded_at AT TIME ZONE 'UTC')::int AS quarter,
            sum(amount_minor)::bigint AS amount_minor, count(*) FILTER (WHERE periods <> 0)::int AS payments
     FROM product_package_payments
     WHERE recorded_at >= $1::date AND recorded_at < $2::date
     GROUP BY coach_user_id, currency, quarter`,
    [from, to]
  );
  const coaches = await pool.query(
    `SELECT a.user_id, a.email_canonical, d.seller_type, d.legal_name, d.date_of_birth::text AS date_of_birth, d.company_number, d.tax_number_type,
            d.tax_number, d.vat_number, d.address_line1, d.address_line2, d.city, d.postcode, d.country
     FROM product_accounts a
     LEFT JOIN product_coach_tax_details d ON d.coach_user_id = a.user_id
     WHERE a.user_id = ANY($1::text[])
        OR d.coach_user_id IS NOT NULL
        OR EXISTS (SELECT 1 FROM product_package_memberships m WHERE m.coach_user_id = a.user_id AND m.started_on < $2::date)
     ORDER BY a.user_id`,
    [[...new Set(paid.rows.map((row) => String(row.coach_user_id)))], to]
  );
  const byCoach = new Map<string, Map<string, { quarters: { amount: number; count: number }[] }>>();
  for (const row of paid.rows) {
    const coach = byCoach.get(String(row.coach_user_id)) ?? new Map();
    const currency = coach.get(String(row.currency)) ?? { quarters: [0, 1, 2, 3].map(() => ({ amount: 0, count: 0 })) };
    const q = currency.quarters[Number(row.quarter) - 1];
    q.amount += Number(row.amount_minor);
    q.count += Number(row.payments);
    coach.set(String(row.currency), currency);
    byCoach.set(String(row.coach_user_id), coach);
  }
  const major = (minor: number) => (minor / 100).toFixed(2);
  const rows: Record<string, string>[] = [];
  for (const coach of coaches.rows as Json[]) {
    const base: Record<string, string> = {
      coach_user_id: String(coach.user_id), account_email: String(coach.email_canonical ?? ""), details_added: coach.seller_type ? "yes" : "no"
    };
    for (const key of ["seller_type", "legal_name", "date_of_birth", "company_number", "tax_number_type", "tax_number", "vat_number", "address_line1", "address_line2", "city", "postcode", "country"]) {
      base[key] = coach[key] == null ? "" : String(coach[key]);
    }
    const currencies = byCoach.get(String(coach.user_id)) ?? new Map([["GBP", { quarters: [0, 1, 2, 3].map(() => ({ amount: 0, count: 0 })) }]]);
    for (const [currency, { quarters }] of currencies) {
      const row: Record<string, string> = { ...base, currency };
      quarters.forEach((q, i) => { row[`q${i + 1}_paid`] = major(q.amount); row[`q${i + 1}_payments`] = String(q.count); });
      row.year_paid = major(quarters.reduce((sum, q) => sum + q.amount, 0));
      // Kolosseum takes no fee on packages yet.
      row.platform_fees = "0.00";
      rows.push(row);
    }
  }
  return { year, columns: SELLER_TAX_REPORT_COLUMNS, rows };
}
