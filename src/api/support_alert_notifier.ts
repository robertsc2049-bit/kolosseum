// DEV NOTE: API boundary surface. Sends a factual email to the admin
// (KOLOSSEUM_SUPPORT_ALERT_EMAIL_TO) when a new support report is created,
// when a user reports a message (message_safety_service.ts), and when
// someone asks for their data to be deleted (deletion_request_deadlines.ts), so
// founder_admin does not have to poll the admin console. Safe no-op if not
// configured (KOLOSSEUM_SUPPORT_ALERT_EMAIL_TO, RESEND_API_KEY, and a sender:
// KOLOSSEUM_SUPPORT_ALERT_EMAIL_FROM, or KOLOSSEUM_EMAIL_FROM like the
// backup alerts) - never throws, so a failed or unconfigured alert can never
// fail the caller's actual submission.

export type SupportAlertActorType = "athlete_or_coach" | "org_owner";

export type SupportAlertInput = {
  actor_type: SupportAlertActorType;
  correlation_id: string;
  user_id: string;
  description: string;
};

export async function sendAdminEmail(subject: string, lines: string[], what: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.KOLOSSEUM_SUPPORT_ALERT_EMAIL_TO;
  const from = process.env.KOLOSSEUM_SUPPORT_ALERT_EMAIL_FROM || process.env.KOLOSSEUM_EMAIL_FROM;

  if (!apiKey || !to || !from) return;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ from, to: [to], subject, text: lines.join("\n") }),
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      // eslint-disable-next-line no-console
      console.error(`WARN: ${what} email failed (status ${response.status})`);
    }
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.error(`WARN: ${what} email failed to send`, error instanceof Error ? error.message : error);
  }
}

export async function notifySupportRequestCreated(input: SupportAlertInput): Promise<void> {
  await sendAdminEmail(
    `New support report (${input.actor_type})`,
    [
      "A new support report was submitted.",
      "",
      `Actor type: ${input.actor_type}`,
      `User ID: ${input.user_id}`,
      `Correlation ID: ${input.correlation_id}`,
      "",
      "Description:",
      input.description
    ],
    "support alert"
  );
}

export type MessageReportAlertInput = {
  report_id: string;
  reason_label: string;
  sender_role: string;
  has_attachment: boolean;
};

const SENDER_LABELS: Readonly<Record<string, string>> = { coach: "a coach", athlete: "an athlete", org_owner: "a gym or organisation owner" };

// A user reported a message. The email says what kind of report it is and
// where to decide it, never the message itself: reported content (which
// could be abusive or illegal) stays in the admin console.
export async function notifyMessageReported(input: MessageReportAlertInput): Promise<void> {
  const base = (process.env.KOLOSSEUM_PUBLIC_APP_URL || "").replace(/\/$/u, "");
  await sendAdminEmail(
    `Message reported: ${input.reason_label}`,
    [
      `A user reported a message from ${SENDER_LABELS[input.sender_role] ?? "a user"}${input.has_attachment ? " (with a photo or video)" : ""}.`,
      `Reason: ${input.reason_label}`,
      `Report: ${input.report_id}`,
      "",
      `Decide it in the admin console, Reported messages${base ? `: ${base}/admin/` : "."}`,
      "If it shows a risk to someone's life or a child, contact the police."
    ],
    "message report alert"
  );
}
