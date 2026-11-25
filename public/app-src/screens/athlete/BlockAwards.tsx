import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { loadBlockAwards } from "../../api/athleteOnboardingClient";
import { accountMayBeAthlete } from "../../api/client";
import { EMBLEM_HEIGHT, EMBLEM_K, EMBLEM_K_PLACE, EMBLEM_PILLARS, EMBLEM_WIDTH, HouseEmblem } from "../../components/HouseEmblem";
import { ENTRY_AUTH_SUCCEEDED_EVENT } from "../entry/useEntryAuth";

// Block complete: the award an athlete earns by finishing a block of their
// programme (src/api/block_award_service.ts). Today shows a new one until
// it's closed; My programme keeps them all. Each can be printed as a
// certificate or saved and shared as a picture. It says what was finished
// and nothing about how strong anyone is.
export type BlockAward = {
  award_id: string; block_name: string; programme_name: string; coach_name: string; source: string;
  weeks: number; sessions_done: number; sessions_total: number; finished_at: string;
};

const CHANGED_EVENTS = ["kolosseum:today-changed", "kolosseum:history-changed", ENTRY_AUTH_SUCCEEDED_EVENT];
const CLOSED_KEY = "kolosseum.blockAwardClosed";
const NEW_FOR_DAYS = 14;
export const AWARD_PRINT_ROOT_ID = "award-print-root";
export const AWARD_PRINTING_CLASS = "printing-award";

export const awardDate = (award: BlockAward): string =>
  new Date(award.finished_at).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
export const awardLine = (award: BlockAward): string =>
  `${award.weeks} weeks · ${award.sessions_done} of ${award.sessions_total} sessions`;

function useBlockAwards() {
  const [awards, setAwards] = useState<BlockAward[]>([]);
  const [athleteName, setAthleteName] = useState("");
  const refresh = useCallback(async () => {
    try {
      if (!(await accountMayBeAthlete())) { setAwards([]); return; }
      const data = await loadBlockAwards();
      setAwards(Array.isArray(data.awards) ? (data.awards as BlockAward[]) : []);
      setAthleteName(String(data.athlete_name ?? ""));
    }
    catch {
      // Offline or signed out: whatever is already showing stays.
    }
  }, []);
  useEffect(() => {
    void refresh();
    for (const name of CHANGED_EVENTS) document.addEventListener(name, refresh);
    return () => { for (const name of CHANGED_EVENTS) document.removeEventListener(name, refresh); };
  }, [refresh]);
  return { awards, athleteName };
}

// The shared picture, 1080 square: Iron, the house, what was finished.
function fitText(ctx: CanvasRenderingContext2D, value: string, size: number, weight: number, family: string, max: number): void {
  let px = size;
  do { ctx.font = `${weight} ${px}px ${family}`; px -= 4; } while (ctx.measureText(value).width > max && px > 24);
}

export async function awardPicture(award: BlockAward): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  // The app's own fonts, if they haven't been drawn with yet.
  await Promise.all([document.fonts?.load("700 96px Rajdhani"), document.fonts?.load("500 40px Inter")]).catch(() => undefined);
  ctx.fillStyle = "#1B2026";
  ctx.fillRect(0, 0, 1080, 1080);
  const scale = 2.7;
  ctx.save();
  ctx.translate((1080 - EMBLEM_WIDTH * scale) / 2, 130);
  ctx.scale(scale, scale);
  ctx.fillStyle = "#F1F4F6";
  ctx.fill(new Path2D(EMBLEM_PILLARS));
  ctx.translate(EMBLEM_K_PLACE.x, EMBLEM_K_PLACE.y);
  ctx.scale(EMBLEM_K_PLACE.scale, EMBLEM_K_PLACE.scale);
  ctx.fillStyle = "#9AD600";
  ctx.fill(new Path2D(EMBLEM_K));
  ctx.restore();
  const top = 130 + EMBLEM_HEIGHT * scale;
  ctx.textAlign = "center";
  ctx.fillStyle = "#F1F4F6";
  fitText(ctx, "Block complete", 120, 700, "Rajdhani, Arial, sans-serif", 960);
  ctx.fillText("Block complete", 540, top + 150);
  fitText(ctx, award.block_name, 56, 600, "Rajdhani, Arial, sans-serif", 960);
  ctx.fillText(award.block_name, 540, top + 235);
  ctx.fillStyle = "#BAC4CD";
  fitText(ctx, awardLine(award), 36, 500, "Inter, Arial, sans-serif", 960);
  ctx.fillText(awardLine(award), 540, top + 305);
  ctx.fillText(awardDate(award), 540, top + 355);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

function Certificate({ award, athleteName }: { award: BlockAward; athleteName: string }) {
  return (
    <div id={AWARD_PRINT_ROOT_ID}>
      <article className="award-certificate">
        <HouseEmblem width={330} pillars="#1B2026" mark="#1B2026" />
        <h1>Block complete</h1>
        {athleteName ? <p className="award-certificate-name">{athleteName}</p> : null}
        <p className="award-certificate-block">{award.block_name}</p>
        {award.programme_name ? <p>{award.programme_name}</p> : null}
        <p>{awardLine(award)}</p>
        <p>{awardDate(award)}</p>
        {award.coach_name ? <p>{`Coach: ${award.coach_name}`}</p> : null}
      </article>
    </div>
  );
}

function AwardActions({ award, athleteName }: { award: BlockAward; athleteName: string }) {
  const [printing, setPrinting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!printing) return;
    document.body.classList.add(AWARD_PRINTING_CLASS);
    const done = () => { document.body.classList.remove(AWARD_PRINTING_CLASS); setPrinting(false); };
    window.addEventListener("afterprint", done, { once: true });
    window.print();
    return () => {
      window.removeEventListener("afterprint", done);
      document.body.classList.remove(AWARD_PRINTING_CLASS);
    };
  }, [printing]);

  async function share() {
    setNotice(null);
    try {
      const blob = await awardPicture(award);
      if (!blob) throw new Error("picture_unavailable");
      const file = new File([blob], "kolosseum-block-complete.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = file.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
      setNotice("Picture saved.");
    }
    catch (caught) {
      if ((caught as Error)?.name !== "AbortError") setNotice("The picture could not be made. Try again in a moment.");
    }
  }

  return (
    <>
      <div className="award-actions">
        <button type="button" className="button secondary small-button" onClick={() => void share()}>Share picture</button>
        <button type="button" className="button secondary small-button" onClick={() => setPrinting(true)}>Print certificate</button>
      </div>
      {notice ? <p className="muted small" role="status">{notice}</p> : null}
      {printing ? createPortal(<Certificate award={award} athleteName={athleteName} />, document.body) : null}
    </>
  );
}

function readClosed(): string {
  try { return window.localStorage.getItem(CLOSED_KEY) ?? ""; }
  catch { return ""; }
}

// Today: the newest award, for a fortnight or until it's closed.
export function TodayBlockAward() {
  const { awards, athleteName } = useBlockAwards();
  const [closed, setClosed] = useState(readClosed);
  const award = awards[0];
  if (!award || award.award_id === closed) return null;
  if (Date.now() - Date.parse(award.finished_at) > NEW_FOR_DAYS * 86_400_000) return null;
  const close = () => {
    try { window.localStorage.setItem(CLOSED_KEY, award.award_id); }
    catch { /* Private window: closed until the page is opened again. */ }
    setClosed(award.award_id);
  };
  return (
    <section className="award-card" data-testid="today-block-award" aria-labelledby="todayBlockAwardHeading">
      <HouseEmblem width={150} />
      <div className="award-card-words">
        <h3 id="todayBlockAwardHeading">Block complete</h3>
        <p className="award-card-block">{award.block_name}</p>
        <p>{`${awardLine(award)} · ${awardDate(award)}`}</p>
        <AwardActions award={award} athleteName={athleteName} />
      </div>
      <button type="button" className="award-close" aria-label="Close block complete" onClick={close}>×</button>
    </section>
  );
}

// My programme: every block finished, newest first.
export function BlockAwardsList() {
  const { awards, athleteName } = useBlockAwards();
  const [openId, setOpenId] = useState<string | null>(null);
  if (!awards.length) return null;
  return (
    <section className="award-list" data-testid="block-awards" aria-labelledby="blockAwardsHeading">
      <h3 id="blockAwardsHeading">Blocks finished</h3>
      <ul>
        {awards.map((award) => (
          <li key={award.award_id}>
            <button type="button" className="award-row" aria-expanded={openId === award.award_id} onClick={() => setOpenId(openId === award.award_id ? null : award.award_id)}>
              <span className="award-row-emblem"><HouseEmblem width={52} /></span>
              <span className="award-row-words">
                <strong>{`Block complete: ${award.block_name}`}</strong>
                <span className="muted">{`${awardLine(award)} · ${awardDate(award)}`}</span>
              </span>
            </button>
            {openId === award.award_id ? <AwardActions award={award} athleteName={athleteName} /> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
