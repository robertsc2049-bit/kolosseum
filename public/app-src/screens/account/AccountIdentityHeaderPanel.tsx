import React, { useState } from "react";

import { type JsonRecord } from "../../api/client";
import { initials, titleCase } from "../../utils/format";
import { useAccountIdentityHeader } from "./useAccountIdentityHeader";

// DEV NOTE: see useAccountIdentityHeader.ts. accountStateClass/roleLabel
// mirror app.js's now-removed renderAccount() badge logic exactly.

function accountStateClass(accountState: string): string {
  if (accountState === "active") return "badge complete";
  if (accountState === "suspended") return "badge warning";
  return "badge danger";
}

function roleLabel(actorType: unknown): string {
  return actorType === "coach" ? "Coach" : "Athlete";
}

export function AccountIdentityHeaderCard() {
  const { loading, account } = useAccountIdentityHeader();
  const name = String((account as JsonRecord | null)?.display_name ?? "Kolosseum user");
  const email = String((account as JsonRecord | null)?.email ?? "");
  const accountState = String((account as JsonRecord | null)?.account_state ?? "active");
  const emailVerified = (account as JsonRecord | null)?.email_verified === true;

  if (loading && !account) {
    return (
      <article className="panel account-card">
        <div className="large-avatar" id="accountAvatar">K</div>
        <div>
          <h3>Loading…</h3>
        </div>
      </article>
    );
  }

  return (
    <article className="panel account-card">
      <div className="large-avatar" id="accountAvatar">{initials(name)}</div>
      <div>
        <h3 id="accountName">{name}</h3>
        <p id="accountEmail" className="muted">{email}</p>
        <div className="badge-row">
          <span id="accountRoleBadge" className="badge neutral">{roleLabel((account as JsonRecord | null)?.actor_type)}</span>
          <span id="accountStateBadge" className={accountStateClass(accountState)}>{titleCase(accountState)}</span>
          <span id="accountVerificationBadge" className={emailVerified ? "badge complete" : "badge neutral"}>
            {emailVerified ? "Email verified" : "Email not verified"}
          </span>
        </div>
      </div>
    </article>
  );
}

export function AccountCodeCard() {
  const { account } = useAccountIdentityHeader();
  const [notice, setNotice] = useState<string | null>(null);
  const code = String((account as JsonRecord | null)?.user_id ?? "—");

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setNotice("Account code copied.");
    }
    catch {
      setNotice("Copy was blocked by the browser.");
    }
  }

  return (
    <article className="panel">
      <p className="eyebrow">Account code</p>
      <h3 id="accountCode">{code}</h3>
      <p className="muted">Use this code only when intentionally connecting a coach and athlete.</p>
      <button className="button secondary" type="button" onClick={copyCode}>Copy code</button>
      {notice ? <p role="status" className="muted small">{notice}</p> : null}
    </article>
  );
}
