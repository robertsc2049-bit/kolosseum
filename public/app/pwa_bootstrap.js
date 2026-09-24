// DEV NOTE: registers the installability-only service worker (see sw.js's
// own DEV NOTE). Kept as its own tiny module, mirroring route_bootstrap.js's
// role as a small, focused bootstrap file rather than folding this into
// app.js.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/app/sw.js").catch(() => {});
  });
}
