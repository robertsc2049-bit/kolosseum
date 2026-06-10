
// DEV NOTE: Application source surface. Keep product/UI behaviour separated from deterministic
// engine truth. UI, notes, and workflow convenience must not change canonical engine inputs or
// outputs unless routed through an explicit validated contract.

type CoachQueueReviewRendererItem = {
  queue_item_id: string;
  coach_id: string;
  athlete_id: string;
  queue_status: string;
  review_required: boolean;
  blocked_reasons: readonly string[];
  source_record_refs: readonly string[];
};

type CoachQueueReviewRendererResponse =
  | {
      status: 200;
      body: {
        ok: true;
        surface_id: string;
        version: string;
        coach_id: string;
        items: readonly CoachQueueReviewRendererItem[];
      };
    }
  | {
      status: 400 | 404 | 405 | 503;
      body: {
        ok: false;
        surface_id: string;
        version: string;
        error: string;
      };
    };

export const coachQueueReviewUiRendererSurfaceId =
  "coach_queue_review_ui_renderer" as const;

export const coachQueueReviewUiRendererVersion = "1.0.0" as const;

export interface CoachQueueReviewUiRenderResult {
  surface_id: typeof coachQueueReviewUiRendererSurfaceId;
  version: typeof coachQueueReviewUiRendererVersion;
  html: string;
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderStatusLabel(status: string): string {
  if (status === "review_required") {
    return "Review required";
  }

  if (status === "available") {
    return "Record available";
  }

  if (status === "blocked") {
    return "Blocked";
  }

  return "Blocked";
}

function renderErrorLabel(error: string): string {
  if (error === "coach_id_required") {
    return "Required coach identifier missing";
  }

  if (error === "source_unavailable") {
    return "Source unavailable";
  }

  if (error === "route_not_found") {
    return "Route unavailable";
  }

  if (error === "method_not_allowed") {
    return "Method unavailable";
  }

  return "Request unavailable";
}

function renderSourceRefs(sourceRecordRefs: readonly string[]): string {
  if (sourceRecordRefs.length === 0) {
    return '<p class="kq-muted">Source records: none</p>';
  }

  const refs = sourceRecordRefs
    .map((ref) => `<li>${escapeHtml(ref)}</li>`)
    .join("");

  return `<div class="kq-section"><h4>Source records</h4><ul>${refs}</ul></div>`;
}

function renderBlockedReasons(blockedReasons: readonly string[]): string {
  if (blockedReasons.length === 0) {
    return "";
  }

  const reasons = blockedReasons
    .map((reason) => `<li>${escapeHtml(reason)}</li>`)
    .join("");

  return `<div class="kq-section"><h4>Blocked reasons</h4><ul>${reasons}</ul></div>`;
}

function renderQueueItems(
  items: readonly {
    queue_item_id: string;
    coach_id: string;
    athlete_id: string;
    queue_status: string;
    review_required: boolean;
    blocked_reasons: readonly string[];
    source_record_refs: readonly string[];
  }[],
): string {
  if (items.length === 0) {
    return '<section class="kq-empty"><h3>No review items</h3></section>';
  }

  return items
    .map((item) => {
      const statusLabel = renderStatusLabel(item.queue_status);

      return [
        `<article class="kq-card" data-status="${escapeHtml(item.queue_status)}">`,
        `<header><p class="kq-eyebrow">Queue item</p><h3>${escapeHtml(item.queue_item_id)}</h3></header>`,
        `<p><strong>Status:</strong> ${escapeHtml(statusLabel)}</p>`,
        `<p><strong>Athlete ID:</strong> ${escapeHtml(item.athlete_id)}</p>`,
        `<p><strong>Coach ID:</strong> ${escapeHtml(item.coach_id)}</p>`,
        renderSourceRefs(item.source_record_refs),
        renderBlockedReasons(item.blocked_reasons),
        `</article>`,
      ].join("");
    })
    .join("");
}

export function renderCoachQueueReviewReadModel(
  response: CoachQueueReviewRendererResponse,
): CoachQueueReviewUiRenderResult {
  if (!response.body.ok) {
    const errorLabel = renderErrorLabel(response.body.error);

    return {
      surface_id: coachQueueReviewUiRendererSurfaceId,
      version: coachQueueReviewUiRendererVersion,
      html: [
        '<section class="kq-shell" data-surface="coach_queue_review">',
        '<header class="kq-header"><h2>Coach queue</h2></header>',
        `<section class="kq-error"><h3>${escapeHtml(errorLabel)}</h3><p>${escapeHtml(response.body.error)}</p></section>`,
        '</section>',
      ].join(""),
    };
  }

  return {
    surface_id: coachQueueReviewUiRendererSurfaceId,
    version: coachQueueReviewUiRendererVersion,
    html: [
      '<section class="kq-shell" data-surface="coach_queue_review">',
      '<header class="kq-header">',
      '<h2>Coach queue</h2>',
      `<p><strong>Coach ID:</strong> ${escapeHtml(response.body.coach_id)}</p>`,
      `<p><strong>Queue item count:</strong> ${response.body.items.length}</p>`,
      '</header>',
      '<section class="kq-list">',
      renderQueueItems(response.body.items),
      '</section>',
      '</section>',
    ].join(""),
  };
}
