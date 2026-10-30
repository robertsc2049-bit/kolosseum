import React, { useState } from "react";

import { type JsonRecord, addAccountRole, switchAccountRole } from "../../api/client";
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

// Open the app at the role's home. The app always lives at /app/, so only a
// real reload (not a hash change) re-reads the account as the other role.
function reloadAt(homeRoute: unknown) {
  window.history.replaceState(null, "", `/app/${typeof homeRoute === "string" && homeRoute.startsWith("#/") ? homeRoute : ""}`);
  window.location.reload();
}

// One login, both roles: a coach who also trains, or an athlete who also
// coaches, switches between the two here - or adds the other role.
export function AccountRoleSwitch({ account, csrfToken }: { account: JsonRecord | null; csrfToken: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!account) return null;
  const acting = account.actor_type === "coach" ? "coach" : "athlete";
  const roles = Array.isArray(account.roles) ? account.roles.map(String) : [acting];
  const other: "coach" | "athlete" = acting === "coach" ? "athlete" : "coach";
  const hasBoth = roles.includes("coach") && roles.includes("athlete");
  async function go(action: "add" | "switch") {
    setBusy(true);
    setError(null);
    try {
      const result = action === "add" ? await addAccountRole(other, csrfToken) : await switchAccountRole(other, csrfToken);
      reloadAt((result.account as JsonRecord | undefined)?.actor_home_route);
    }
    catch (caught) {
      setError(caught instanceof Error ? caught.message : "That didn't work - try again.");
      setBusy(false);
    }
  }
  return (
    <div className="account-role-switch" data-testid="account-role-switch">
      {hasBoth ? (
        <>
          <p className="muted small">{acting === "coach" ? "You're in your coaching workspace. Your own training is one tap away." : "You're in your own training. Your coaching workspace is one tap away."}</p>
          <button className="button primary small-button" type="button" disabled={busy} onClick={() => void go("switch")}>
            {other === "coach" ? "Switch to coaching" : "Switch to my training"}
          </button>
        </>
      ) : (
        <>
          <p className="muted small">{acting === "coach" ? "Train yourself too? Add an athlete side to this account - same login - and switch between coaching and your own training." : "Coach others too? Add a coaching workspace to this account - same login - and switch between your training and coaching."}</p>
          <button className="button secondary small-button" type="button" disabled={busy} onClick={() => void go("add")}>
            {other === "athlete" ? "Also train as an athlete" : "Also coach athletes"}
          </button>
        </>
      )}
      {error ? <p className="field-error" role="alert">{error}</p> : null}
    </div>
  );
}

export function AccountIdentityHeaderCard() {
  const { loading, account, csrfToken } = useAccountIdentityHeader();
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
          <span id="accountRoleBadge" className="badge neutral">{Array.isArray((account as JsonRecord | null)?.roles) && ((account as JsonRecord).roles as unknown[]).length > 1 ? `Coach and athlete · now ${roleLabel((account as JsonRecord | null)?.actor_type).toLowerCase()}` : roleLabel((account as JsonRecord | null)?.actor_type)}</span>
          <span id="accountStateBadge" className={accountStateClass(accountState)}>{titleCase(accountState)}</span>
          <span id="accountVerificationBadge" className={emailVerified ? "badge complete" : "badge neutral"}>
            {emailVerified ? "Email verified" : "Email not verified"}
          </span>
        </div>
        <AccountRoleSwitch account={account as JsonRecord | null} csrfToken={csrfToken} />
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
