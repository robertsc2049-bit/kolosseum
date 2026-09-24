import React, { useRef, useState } from "react";

import { changeAccountPassword } from "../../api/client";

export function PasswordForm({ csrfToken }: { csrfToken: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setResult(null);

    try {
      await changeAccountPassword(
        { current_password: currentPassword, new_password: newPassword },
        csrfToken
      );

      formRef.current?.reset();
      setCurrentPassword("");
      setNewPassword("");
      setResult("Password changed. Other sessions were revoked.");
    }
    catch {
      setResult("Password could not be changed. Check the current password and try again.");
    }
    finally {
      setSaving(false);
    }
  }

  return (
    <form ref={formRef} className="panel form-panel" onSubmit={handleSubmit}>
      <div>
        <p className="eyebrow">Credentials</p>
        <h3>Change password</h3>
        <p className="muted">Changing the password revokes other active sessions.</p>
      </div>

      <label className="field">
        <span>Current password</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          minLength={12}
          maxLength={200}
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
      </label>

      <label className="field">
        <span>New password</span>
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={200}
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
      </label>

      <button className="button primary" type="submit" disabled={saving}>
        Change password
      </button>
      {result ? <p className="inline-result">{result}</p> : null}
    </form>
  );
}
