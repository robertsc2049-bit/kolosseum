// DEV NOTE: programme-marketplace browse (FULL-UI-67) - a separate API
// area from coach-workspace, hence its own client file. Session-
// authenticated (authenticatedCoach(request, false)), read-only.

import { type JsonRecord, request } from "./transport";

export async function loadMarketplaceTemplates(): Promise<JsonRecord[]> {
  const response = await request("GET", "/programme-marketplace/templates");
  return Array.isArray(response.templates) ? (response.templates as JsonRecord[]) : [];
}

// DEV NOTE: a template's own marketplace sharing preference + release
// history/action - ported from public/app/app.js's
// refreshTemplateSharingPreference()/confirmSaveTemplateSharing()/
// refreshTemplateReleaseHistory()/confirmReleaseTemplate().

export type TemplateSharingPreference = {
  shared_publicly: boolean;
  price_label: string;
  payment_methods_note: string;
};

export async function loadTemplateSharingPreference(templateId: string): Promise<TemplateSharingPreference> {
  const response = await request("GET", `/programme-marketplace/templates/${encodeURIComponent(templateId)}/sharing`);
  const preference = response.sharing_preference as JsonRecord | undefined;
  return {
    shared_publicly: preference?.shared_publicly === true,
    price_label: typeof preference?.price_label === "string" ? preference.price_label : "",
    payment_methods_note: typeof preference?.payment_methods_note === "string" ? preference.payment_methods_note : ""
  };
}

export async function saveTemplateSharingPreference(
  templateId: string,
  input: { sharedPublicly: boolean; priceLabel: string; paymentMethodsNote: string },
  csrfToken: string
): Promise<void> {
  await request(
    "POST",
    `/programme-marketplace/templates/${encodeURIComponent(templateId)}/sharing`,
    {
      shared_publicly: input.sharedPublicly,
      price_label: input.priceLabel || null,
      payment_methods_note: input.paymentMethodsNote || null
    },
    csrfToken
  );
}

export async function loadTemplateReleaseHistory(templateId: string): Promise<JsonRecord[]> {
  const response = await request("GET", `/programme-marketplace/templates/${encodeURIComponent(templateId)}/releases`);
  return Array.isArray(response.releases) ? (response.releases as JsonRecord[]) : [];
}

export async function releaseTemplate(templateId: string, buyerAccountCode: string, csrfToken: string): Promise<void> {
  await request(
    "POST",
    `/programme-marketplace/templates/${encodeURIComponent(templateId)}/release`,
    { buyer_account_code: buyerAccountCode },
    csrfToken
  );
}
