// DEV NOTE: the first screen's reads, asked for together as soon as the page
// starts (GET /account/opening, src/api/opening.routes.ts) and handed to
// whoever asks for each: app.js, the route gates, the guided tours and the
// React panels' shared reads (app-src/api/transport.ts). Each answer is used
// for the opening only: for a moment after it's first taken, never after a
// change, and never once the page has been open a while.
(function () {
  var REUSE_MS = 1500;
  var WAIT_MS = 6000;
  var OPEN_FOR_MS = 15000;
  var started = Date.now();
  var spent = false;
  var firstUsed = {};

  var reads = Promise.race([
    fetch("/account/opening", { credentials: "same-origin", headers: { accept: "application/json" } })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (body) { return body && body.reads && typeof body.reads === "object" ? body.reads : null; })
      .catch(function () { return null; }),
    new Promise(function (resolve) { setTimeout(function () { resolve(null); }, WAIT_MS); })
  ]);

  function usable(key) {
    return !spent && Date.now() - started < OPEN_FOR_MS && (firstUsed[key] === undefined || Date.now() - firstUsed[key] < REUSE_MS);
  }

  // { status, payload } for this read, or null: ask for it in the ordinary way.
  window.kolosseumOpeningRead = function (key) {
    if (!usable(key)) return Promise.resolve(null);
    return reads.then(function (all) {
      if (!all || !Object.prototype.hasOwnProperty.call(all, key) || !usable(key)) return null;
      if (firstUsed[key] === undefined) firstUsed[key] = Date.now();
      return JSON.parse(JSON.stringify(all[key]));
    });
  };
  // Anything changed: what was read at the start is out of date.
  window.kolosseumOpeningSpent = function () { spent = true; };
  document.addEventListener("kolosseum:data-changed", window.kolosseumOpeningSpent);
})();
