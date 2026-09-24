import React, { useState } from "react";

import { completeEmailVerification, requestEmailVerification } from "../../api/client";
import { ACCOUNT_IDENTITY_UPDATED_EVENT } from "./ProfileForm";

export function EmailVerificationPanel({
  emailVerified,
  csrfToken,
  onVerified
}: {
  emailVerified: boolean;
  csrfToken: string;
  onVerified: () => void;
}) {
  const [code, setCode] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleRequestCode() {
    if (requesting || emailVerified) return;
    setRequesting(true);
    setResult(null);

    try {
      const response = await requestEmailVerification(csrfToken);
      const developmentCode = typeof response.development_code === "string" ? response.development_code : "";

      if (developmentCode) setCode(developmentCode);

      setResult(
        response.already_verified
          ? "Email is already verified."
          : developmentCode
            ? `Development code: ${developmentCode}`
            : "Verification code requested."
      );
    }
    catch {
      setResult("The verification code could not be requested. Check your connection and try again.");
    }
    finally {
      setRequesting(false);
    }
  }

  async function handleVerify() {
    if (verifying || emailVerified) return;
    setVerifying(true);
    setResult(null);

    try {
      const response = await completeEmailVerification({ code: code.trim() }, csrfToken);
      document.dispatchEvent(new CustomEvent(ACCOUNT_IDENTITY_UPDATED_EVENT, { detail: response.account }));
      setResult("Email verified.");
      onVerified();
    }
    catch {
      setResult("Email could not be verified. Check the code and try again.");
    }
    finally {
      setVerifying(false);
    }
  }

  return (
    <article className="panel form-panel">
      <div>
        <p className="eyebrow">Email verification</p>
        <h3>Verify email address</h3>
        <p className="muted">Request and enter the six-digit verification code.</p>
      </div>

      <button
        className="button secondary"
        type="button"
        disabled={emailVerified || requesting}
        onClick={handleRequestCode}
      >
        Request code
      </button>

      <label className="field">
        <span>Verification code</span>
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
      </label>

      <button
        className="button primary"
        type="button"
        disabled={emailVerified || verifying}
        onClick={handleVerify}
      >
        Verify email
      </button>
      {result ? <p className="inline-result">{result}</p> : null}
    </article>
  );
}
