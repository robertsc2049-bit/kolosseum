import React, { useCallback, useEffect, useState } from "react";

import { loadCoachShareLink, saveCoachShareLink } from "../../api/coachBrandingClient";
import { loadAccountDetail } from "../../api/client";
import { type JsonRecord } from "../../api/transport";

// A coach's share link: a public page (/c/<slug>) with a QR code, to post on
// social media or print for the gym wall. Off until the coach switches it
// on (coach_share_link_service.ts).
const ERROR_MESSAGES: Record<string, string> = {
  coach_share_link_slug_invalid: "Use 3-40 letters, numbers and dashes.",
  coach_share_link_slug_reserved: "That address is reserved - pick a different one.",
  coach_share_link_slug_taken: "Another coach has that address - pick a different one."
};

function errorMessage(error: unknown): string {
  const payload = error instanceof Error ? (error as Error & { payload?: unknown }).payload : undefined;
  const code = typeof (payload as JsonRecord | undefined)?.error === "string" ? String((payload as JsonRecord).error) : "";
  return ERROR_MESSAGES[code] ?? "That didn't work. Try again.";
}

type ShareLink = { slug: string; enabled: boolean; path: string };

export function CoachShareLinkPanel() {
  const [link, setLink] = useState<ShareLink | null>(null);
  const [slug, setSlug] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const show = useCallback((payload: JsonRecord) => {
    const current = (payload.share_link ?? null) as ShareLink | null;
    setLink(current);
    setSlug(current?.slug ?? String(payload.suggested_slug ?? ""));
    setLoaded(true);
  }, []);

  const refresh = useCallback(async () => {
    try {
      show(await loadCoachShareLink());
      setError(null);
    }
    catch (caught) {
      setError(errorMessage(caught));
    }
  }, [show]);

  useEffect(() => {
    refresh();
    document.addEventListener("kolosseum:account-role-known", refresh);
    return () => document.removeEventListener("kolosseum:account-role-known", refresh);
  }, [refresh]);

  async function save(enabled: boolean) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const account = await loadAccountDetail();
      show(await saveCoachShareLink({ slug: slug.trim().toLowerCase(), enabled }, typeof account.csrf_token === "string" ? account.csrf_token : ""));
      setNotice(enabled ? "Your link is on." : "Your link is off - the page and QR code no longer work.");
    }
    catch (caught) {
      setError(errorMessage(caught));
    }
    finally {
      setBusy(false);
    }
  }

  const on = link?.enabled === true;
  const pageUrl = link ? `${window.location.origin}${link.path}` : "";
  const qrPath = link ? `${link.path}/qr.png` : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setNotice("Link copied.");
    }
    catch {
      setNotice(`Copy this link: ${pageUrl}`);
    }
  }

  async function share() {
    const title = "Train with me on Kolosseum";
    try {
      const response = await fetch(qrPath, { credentials: "same-origin" });
      const file = new File([await response.blob()], `${link?.slug ?? "coach"}-qr.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title, text: `${title}: ${pageUrl}`, url: pageUrl, files: [file] });
        return;
      }
      await navigator.share({ title, url: pageUrl });
    }
    catch (caught) {
      if ((caught as Error)?.name === "AbortError") return;
      await copy();
    }
  }

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <section className="panel" aria-labelledby="coachShareLinkHeading" data-testid="coach-share-link-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Find new athletes</p>
          <h3 id="coachShareLinkHeading">My share link and QR code</h3>
          <p className="muted">A public page with your name, business name, tagline and gyms. Post the link or the QR code anywhere - people who follow it sign up and ask you to coach them, and you choose who to invite.</p>
        </div>
      </div>

      {error ? <p className="field-error" role="alert">{error}</p> : null}

      {!loaded ? null : (
        <>
          <form className="inline-controls" onSubmit={(event) => { event.preventDefault(); void save(on); }}>
            <label className="field">
              <span>Your page address</span>
              <span className="share-link-address">
                <span className="muted">{`${window.location.host}/c/`}</span>
                <input type="text" maxLength={40} autoComplete="off" spellCheck={false} value={slug} onChange={(event) => setSlug(event.target.value)} aria-label="Page address" />
              </span>
            </label>
            {link && slug.trim().toLowerCase() !== link.slug ? (
              <button className="button secondary" type="submit" disabled={busy}>Save address</button>
            ) : null}
          </form>

          {on ? (
            <div className="share-link-on" data-testid="share-link-on">
              <p><a href={link?.path} target="_blank" rel="noopener">{pageUrl}</a></p>
              <img className="share-link-qr" src={`${link?.path}/qr.svg`} alt={`QR code for ${pageUrl}`} width={200} height={200} />
              <div className="inline-controls">
                {canShare ? <button className="button primary" type="button" onClick={() => void share()}>Share</button> : null}
                <button className="button secondary" type="button" onClick={() => void copy()}>Copy link</button>
                <a className="button secondary" href={`${qrPath}?download`} download>Download QR code</a>
                <button className="button secondary" type="button" disabled={busy} onClick={() => void save(false)}>Turn off</button>
              </div>
            </div>
          ) : (
            <div className="inline-controls">
              <button className="button primary" type="button" disabled={busy || !slug.trim()} onClick={() => void save(true)}>Turn on my link</button>
            </div>
          )}
          {notice ? <p className="muted small" role="status">{notice}</p> : null}
        </>
      )}
    </section>
  );
}
