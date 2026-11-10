import React, { useEffect, useState } from "react";

import { completeEmailVerification, requestEmailVerification } from "../../api/client";
import { ACCOUNT_IDENTITY_UPDATED_EVENT } from "./ProfileForm";
import { useAccountDetail } from "./useAccountDetail";

// Signing up emails a 6-digit verification code straight away
// (product_account_service.ts), but nothing on screen asked for it - the
// only place to enter it was Account → Verify email address. This asks at
// the top of the app until the email is verified, or the person says
// "Later" (remembered in this browser only).
const LATER_KEY = "kolosseum.verify-email-later";

function laterChosen(userId: string): boolean {
  try { return window.localStorage.getItem(LATER_KEY) === userId; }
  catch { return false; }
}

export function VerifyEmailPrompt() {
  const [refreshToken, setRefreshToken] = useState(0);
  const { loading, account, csrfToken, refresh } = useAccountDetail(refreshToken);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);

  // Verified on the Account page instead: hide here too.
  useEffect(() => {
    const onUpdated = () => setRefreshToken((current) => current + 1);
    document.addEventListener(ACCOUNT_IDENTITY_UPDATED_EVENT, onUpdated);
    return () => document.removeEventListener(ACCOUNT_IDENTITY_UPDATED_EVENT, onUpdated);
  }, []);

  const userId = String(account?.user_id ?? "");
  if (loading || !account || hidden || account.email_verified === true || !userId || laterChosen(userId)) return null;

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !/^\d{6}$/u.test(code.trim())) {
      setResult("Enter the 6-digit code from the email.");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const response = await completeEmailVerification({ code: code.trim() }, csrfToken);
      document.dispatchEvent(new CustomEvent(ACCOUNT_IDENTITY_UPDATED_EVENT, { detail: response.account }));
      await refresh();
    }
    catch {
      setResult("That code didn't work - it may have expired. Send a new one and try again.");
    }
    finally {
      setBusy(false);
    }
  }

  async function sendNew() {
    setBusy(true);
    setResult(null);
    try {
      const response = await requestEmailVerification(csrfToken);
      const developmentCode = typeof response.development_code === "string" ? response.development_code : "";
      if (developmentCode) setCode(developmentCode);
      setResult(developmentCode ? `Development code: ${developmentCode}` : "New code sent - it can take a minute, so check your spam folder too.");
    }
    catch {
      setResult("A new code couldn't be sent. Check your connection and try again.");
    }
    finally {
      setBusy(false);
    }
  }

  function later() {
    try { window.localStorage.setItem(LATER_KEY, userId); }
    catch { /* storage unavailable: just hide for now */ }
    setHidden(true);
  }

  return (
    <form className="panel verify-email-prompt" data-testid="verify-email-prompt" aria-labelledby="verifyEmailPromptHeading" onSubmit={(event) => { verify(event).catch(() => {}); }}>
      <p className="eyebrow">One more thing</p>
      <h3 id="verifyEmailPromptHeading">Verify your email</h3>
      <p className="muted">We emailed a 6-digit code to {String(account.email ?? "your address")} when you signed up. Enter it here so we know we can reach you.</p>
      <label className="field">
        <span>Code from the email</span>
        <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} />
      </label>
      {result ? <p className="inline-result" role="status">{result}</p> : null}
      <div className="inline-controls">
        <button className="button primary" type="submit" disabled={busy}>Verify</button>
        <button className="button secondary" type="button" disabled={busy} onClick={() => { sendNew().catch(() => {}); }}>Send a new code</button>
        <button className="button secondary" type="button" onClick={later}>Later</button>
      </div>
    </form>
  );
}
