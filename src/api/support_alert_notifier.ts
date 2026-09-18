// DEV NOTE: API boundary surface. Sends a factual email notification when a
// new support report is created, so founder_admin does not have to manually
// poll /admin/support-requests or /admin/org-owner-support-requests. Safe
// no-op if not configured (KOLOSSEUM_SUPPORT_ALERT_EMAIL_TO/_FROM,
// RESEND_API_KEY) - never throws, so a failed or unconfigured alert can
// never fail the caller's actual support-report submission.

export type SupportAlertActorType = "athlete_or_coach" | "org_owner";

export type SupportAlertInput = {
  actor_type: SupportAlertActorType;
  correlation_id: string;
  user_id: string;
  description: string;
};

export async function notifySupportRequestCreated(input: SupportAlertInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.KOLOSSEUM_SUPPORT_ALERT_EMAIL_TO;
  const from = process.env.KOLOSSEUM_SUPPORT_ALERT_EMAIL_FROM;

  if (!apiKey || !to || !from) return;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `New support report (${input.actor_type})`,
        text: [
          "A new support report was submitted.",
          "",
          `Actor type: ${input.actor_type}`,
          `User ID: ${input.user_id}`,
          `Correlation ID: ${input.correlation_id}`,
          "",
          "Description:",
          input.description
        ].join("\n")
      }),
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      // eslint-disable-next-line no-console
      console.error(`WARN: support alert email failed (status ${response.status})`);
    }
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.error("WARN: support alert email failed to send", error instanceof Error ? error.message : error);
  }
}
