import React, { useEffect, useState } from "react";

import { type JsonRecord, updateAccountProfile } from "../../api/client";

// DEV NOTE: dispatched after a successful profile/verification update so
// legacy app.js's identity card (name/email/badges in the sidebar and the
// #view-account header, which stays legacy-rendered this slice) can call its
// existing applyAccountIdentity()/renderIdentity()/renderAccount() with the
// fresh account payload rather than showing a stale value. See app.js's new
// listener for this event.
export const ACCOUNT_IDENTITY_UPDATED_EVENT = "kolosseum:account-identity-updated";

function dispatchAccountIdentityUpdated(account: JsonRecord) {
  document.dispatchEvent(new CustomEvent(ACCOUNT_IDENTITY_UPDATED_EVENT, { detail: account }));
}

export function ProfileForm({
  account,
  csrfToken,
  onSaved
}: {
  account: JsonRecord | null;
  csrfToken: string;
  onSaved: (developmentCode: string | null) => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(String(account?.display_name ?? ""));
    setEmail(String(account?.email ?? ""));
  }, [account]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setResult(null);

    try {
      const response = await updateAccountProfile(
        { display_name: displayName.trim(), email: email.trim().toLowerCase() },
        csrfToken
      );

      const updatedAccount = response.account as JsonRecord;
      dispatchAccountIdentityUpdated(updatedAccount);

      const developmentCode = (response.verification as JsonRecord | undefined)?.development_code;
      const developmentCodeText = typeof developmentCode === "string" ? developmentCode : null;

      setResult(
        developmentCodeText
          ? `Profile updated. Development verification code: ${developmentCodeText}`
          : "Profile updated."
      );
      onSaved(developmentCodeText);
    }
    catch {
      setResult("Profile could not be updated. Check your connection and try again.");
    }
    finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel form-panel" onSubmit={handleSubmit}>
      <div>
        <p className="eyebrow">Profile</p>
        <h3>Identity details</h3>
      </div>

      <label className="field">
        <span>Display name</span>
        <input
          required
          maxLength={80}
          autoComplete="name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
      </label>

      <label className="field">
        <span>Email</span>
        <input
          required
          maxLength={254}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>

      <button className="button primary" type="submit" disabled={saving}>
        Save profile
      </button>
      {result ? <p className="inline-result">{result}</p> : null}
    </form>
  );
}
