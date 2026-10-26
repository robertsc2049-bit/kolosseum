// DEV NOTE: Emails a person their 6-digit account code - to verify their
// email address or to reset a forgotten password - through Resend
// (RESEND_API_KEY), from KOLOSSEUM_EMAIL_FROM (else the support-alert
// sender). Until this existed, production created codes and never delivered
// them. Never throws, and callers don't wait on it: a failed or unconfigured
// email can't fail the request, and a reset request for an address with no
// account takes the same time as one for a real account.

export type AccountCodeKind = "email_verification" | "password_reset";

const SUBJECTS: Record<AccountCodeKind, string> = {
  email_verification: "Your Kolosseum verification code",
  password_reset: "Your Kolosseum password reset code"
};

export function accountCodeEmail(kind: AccountCodeKind, code: string, minutes: number): { subject: string; text: string } {
  const what = kind === "password_reset"
    ? "Use this code to set a new password for your Kolosseum account"
    : "Use this code to verify your email address for Kolosseum";
  return {
    subject: SUBJECTS[kind],
    text: [
      `${what}:`,
      "",
      `    ${code}`,
      "",
      `It expires in ${minutes} minutes and can be used once.`,
      "",
      kind === "password_reset"
        ? "If you didn't ask to reset your password, ignore this email - your password hasn't changed."
        : "If you didn't create a Kolosseum account or change your email, ignore this email."
    ].join("\n")
  };
}

export async function sendAccountCodeEmail(to: string, kind: AccountCodeKind, code: string, minutes: number): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.KOLOSSEUM_EMAIL_FROM || process.env.KOLOSSEUM_SUPPORT_ALERT_EMAIL_FROM;
  if (!apiKey || !from || !to) return false;
  try {
    const { subject, text } = accountCodeEmail(kind, code, minutes);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text }),
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) {
      // eslint-disable-next-line no-console
      console.error(`WARN: account code email failed (status ${response.status})`);
      return false;
    }
    return true;
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.error("WARN: account code email failed to send", error instanceof Error ? error.message : error);
    return false;
  }
}
