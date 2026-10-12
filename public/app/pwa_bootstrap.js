// DEV NOTE: registers the installability-only service worker (see sw.js's
// own DEV NOTE). Kept as its own tiny module, mirroring route_bootstrap.js's
// role as a small, focused bootstrap file rather than folding this into
// app.js.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/app/sw.js").catch(() => {});
  });
}

// Chrome/Android's one-tap install: keep the browser's prompt (it fires once,
// usually before the React app mounts) for the Today card's Install button.
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  window.kolosseumInstallPrompt = event;
  document.dispatchEvent(new CustomEvent("kolosseum:install-available"));
});
