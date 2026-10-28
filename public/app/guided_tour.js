// Guided tour engine, shared by the main app (guided_tours.js) and the
// organisation app (public/org/org_tours.js).
//
// A tour is a list of steps. Each step can switch screen first (`before`),
// then spotlights its `target` (a selector, or a function returning an
// element) with a card explaining it; a step without a target, or whose target
// isn't on screen, shows the card in the middle - unless it's `optional`, when
// it's skipped (a card only some accounts have). The page underneath can't be
// clicked while the tour is open - Next/Back/Skip and the keyboard drive it.
// On a phone the card sits at the bottom of the screen above the tab bar.
//
// Whether a tour has been seen is kept per account in this browser's
// localStorage; every read and write tolerates storage being unavailable.

const SEEN_PREFIX = "kolosseum.tour.v1";
const TARGET_WAIT_MS = 2500;

let activeTour = null;

function seenKey(tourId, userId) {
  return `${SEEN_PREFIX}.${tourId}.${userId}`;
}

export function tourSeen(tourId, userId) {
  try { return window.localStorage.getItem(seenKey(tourId, userId)) === "1"; }
  catch { return false; }
}

export function markTourSeen(tourId, userId) {
  try { window.localStorage.setItem(seenKey(tourId, userId), "1"); }
  catch { /* storage unavailable: the tour may show again, nothing else breaks */ }
}

export function tourOpen() {
  return activeTour !== null;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function visible(element) {
  if (!element || !element.isConnected) return false;
  const rect = element.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return false;
  for (let node = element; node; node = node.parentElement) {
    if (node.hidden) return false;
    const style = getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") return false;
  }
  return true;
}

// A target is a selector, a list of selectors tried in order (the first one
// on screen wins - e.g. the first athlete, else the empty roster), or a
// function returning an element.
function resolveTarget(target) {
  if (!target) return null;
  if (typeof target === "function") return target();
  if (Array.isArray(target)) {
    for (const selector of target) {
      const element = document.querySelector(selector);
      if (visible(element)) return element;
    }
    return null;
  }
  return document.querySelector(target);
}

async function findTarget(target) {
  if (!target) return null;
  const started = Date.now();
  while (Date.now() - started < TARGET_WAIT_MS) {
    const element = resolveTarget(target);
    if (visible(element)) return element;
    await wait(100);
  }
  return null;
}

function phoneLayout() {
  return window.matchMedia("(max-width: 620px)").matches;
}

function buildOverlay(label) {
  const root = document.createElement("div");
  root.className = "guided-tour";
  root.innerHTML = `
    <div class="guided-tour-blocker"></div>
    <div class="guided-tour-spotlight" hidden></div>
    <section class="guided-tour-card" role="dialog" aria-modal="true" aria-labelledby="guidedTourTitle" aria-describedby="guidedTourBody" tabindex="-1">
      <p class="guided-tour-progress eyebrow"></p>
      <h2 id="guidedTourTitle" class="guided-tour-title"></h2>
      <p id="guidedTourBody" class="guided-tour-body"></p>
      <div class="guided-tour-actions">
        <button type="button" class="text-button guided-tour-skip">Skip tour</button>
        <span class="guided-tour-nav">
          <button type="button" class="button secondary guided-tour-back">Back</button>
          <button type="button" class="button primary guided-tour-next">Next</button>
        </span>
      </div>
    </section>`;
  root.querySelector(".guided-tour-card").setAttribute("aria-label", label);
  document.body.appendChild(root);
  return root;
}

function place(root, element) {
  const spotlight = root.querySelector(".guided-tour-spotlight");
  const card = root.querySelector(".guided-tour-card");
  const phone = phoneLayout();
  card.classList.toggle("guided-tour-card-docked", phone);
  card.style.top = "";
  card.style.left = "";

  if (!element || !visible(element)) {
    spotlight.hidden = true;
    card.classList.toggle("guided-tour-card-centred", !phone);
    return;
  }

  const pad = 6;
  const rect = element.getBoundingClientRect();
  const top = Math.max(rect.top - pad, 4);
  const left = Math.max(rect.left - pad, 4);
  const right = Math.min(rect.right + pad, window.innerWidth - 4);
  card.classList.remove("guided-tour-card-centred");
  const gap = 12;
  const cardRect = card.getBoundingClientRect();
  let bottom = Math.min(rect.bottom + pad, window.innerHeight - 4);
  let cardTop = null;
  if (phone) {
    // The card is docked at the bottom: the spotlight stops above it.
    bottom = Math.min(bottom, cardRect.top - 8);
  }
  else if (bottom + gap + cardRect.height <= window.innerHeight - 8) {
    cardTop = bottom + gap;
  }
  else if (top - gap - cardRect.height >= 8) {
    cardTop = top - gap - cardRect.height;
  }
  else {
    // Too tall for the card to sit above or below: the spotlight shows the
    // top of it and the card sits underneath, rather than covering it.
    bottom = window.innerHeight - 8 - cardRect.height - gap;
    cardTop = bottom + gap;
  }
  bottom = Math.max(bottom, top + 24);
  spotlight.hidden = false;
  Object.assign(spotlight.style, { top: `${top}px`, left: `${left}px`, width: `${Math.max(right - left, 0)}px`, height: `${Math.max(bottom - top, 0)}px` });
  if (cardTop === null) return;
  card.style.top = `${Math.max(cardTop, 8)}px`;
  card.style.left = `${Math.min(Math.max(left, 8), window.innerWidth - cardRect.width - 8)}px`;
}

function scrollIntoPlace(element) {
  const rect = element.getBoundingClientRect();
  const phone = phoneLayout();
  // On a phone the card covers the bottom of the screen, so the target sits
  // in the top half; on a wider screen it only needs to be in view.
  const roomBottom = phone ? window.innerHeight * 0.5 : window.innerHeight - 40;
  if (rect.top < 70 || rect.top > roomBottom || (rect.bottom > roomBottom && rect.height < roomBottom - 80)) {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollBy({ top: rect.top - (phone ? 90 : Math.max(90, (window.innerHeight - rect.height) / 3)), behavior: reduced ? "auto" : "smooth" });
  }
}

// Starts a tour. Resolves when it ends (finished or skipped); `onEnd` gets
// { finished: boolean }. A second call while a tour is open is ignored.
export function startTour({ steps, label = "Guided tour", onEnd }) {
  if (activeTour || !Array.isArray(steps) || steps.length === 0) return Promise.resolve({ finished: false, started: false });

  return new Promise((resolve) => {
    const root = buildOverlay(label);
    const card = root.querySelector(".guided-tour-card");
    const back = root.querySelector(".guided-tour-back");
    const next = root.querySelector(".guided-tour-next");
    const skip = root.querySelector(".guided-tour-skip");
    const previousFocus = document.activeElement;
    let index = 0;
    let element = null;
    let showing = 0;
    const skipped = new Set();

    const reposition = () => place(root, element);

    const end = (finished) => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      document.removeEventListener("keydown", onKey, true);
      root.remove();
      activeTour = null;
      if (previousFocus && typeof previousFocus.focus === "function" && previousFocus.isConnected) previousFocus.focus();
      const result = { finished, started: true };
      if (typeof onEnd === "function") onEnd(result);
      resolve(result);
    };

    const show = async (nextIndex, direction = 1) => {
      const run = ++showing;
      index = nextIndex;
      const step = steps[index];
      root.classList.add("guided-tour-busy");
      next.disabled = true;
      back.disabled = true;
      try { if (typeof step.before === "function") await step.before(); }
      catch { /* a screen that won't open still gets its card */ }
      const found = await findTarget(step.target);
      if (run !== showing) return;
      if (!found && step.optional) {
        skipped.add(index);
        const skipTo = index + direction;
        if (skipTo >= 0 && skipTo < steps.length) { void show(skipTo, direction); return; }
      }
      element = found;
      if (element) {
        scrollIntoPlace(element);
        await wait(window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 320);
        if (run !== showing) return;
      }
      // Skipped optional steps drop out of the count.
      const skippedBefore = [...skipped].filter((skippedIndex) => skippedIndex < index).length;
      root.querySelector(".guided-tour-progress").textContent = `${index + 1 - skippedBefore} of ${steps.length - skipped.size}`;
      root.querySelector(".guided-tour-title").textContent = step.title;
      root.querySelector(".guided-tour-body").textContent = step.body;
      back.hidden = index === 0;
      back.disabled = false;
      next.disabled = false;
      next.textContent = index === steps.length - 1 ? (step.doneLabel || "Done") : "Next";
      skip.hidden = index === steps.length - 1;
      root.classList.remove("guided-tour-busy");
      reposition();
      card.focus({ preventScroll: true });
    };

    const forward = () => {
      if (next.disabled) return;
      if (index >= steps.length - 1) end(true);
      else void show(index + 1, 1);
    };
    const backward = () => {
      if (back.disabled || index === 0) return;
      void show(index - 1, -1);
    };

    function onKey(event) {
      if (event.key === "Escape") { event.preventDefault(); end(false); return; }
      if (event.key === "ArrowRight") { event.preventDefault(); forward(); return; }
      if (event.key === "ArrowLeft") { event.preventDefault(); backward(); return; }
      if (event.key === "Tab") {
        // Keep focus inside the card while the tour is open.
        const focusable = [...card.querySelectorAll("button")].filter((button) => !button.hidden && !button.disabled);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === card)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }

    next.addEventListener("click", forward);
    back.addEventListener("click", backward);
    skip.addEventListener("click", () => end(false));
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    document.addEventListener("keydown", onKey, true);
    activeTour = { end };
    void show(0);
  });
}

// Closes an open tour without finishing it (e.g. on sign-out).
export function closeTour() {
  if (activeTour) activeTour.end(false);
}
