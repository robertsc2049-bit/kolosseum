// DEV NOTE: light and dark. Loaded in <head> before any styles paint, by every
// page (app, gym console, admin, legal). The choice is this device's own
// ("system" follows the device's setting); nothing is sent to the server.
(function () {
  var KEY = "kolosseum.theme";
  var CHOICES = [["system", "Match device"], ["light", "Light"], ["dark", "Dark"]];
  var CANVAS = { light: "#F0F1F1", dark: "#1B2026" };
  var media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;

  function choice() {
    try {
      var saved = window.localStorage.getItem(KEY);
      return saved === "light" || saved === "dark" ? saved : "system";
    }
    catch (error) {
      return "system";
    }
  }

  function apply() {
    var chosen = choice();
    var theme = chosen === "system" ? (media && media.matches ? "light" : "dark") : chosen;
    document.documentElement.setAttribute("data-theme", theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", CANVAS[theme]);
    var inputs = document.querySelectorAll(".theme-choice input");
    for (var i = 0; i < inputs.length; i += 1) inputs[i].checked = inputs[i].value === chosen;
  }

  function set(value) {
    try {
      if (value === "system") window.localStorage.removeItem(KEY);
      else window.localStorage.setItem(KEY, value);
    }
    catch (error) {
      // Private window: the choice lasts as long as the page.
      document.documentElement.setAttribute("data-theme", value === "system" ? (media && media.matches ? "light" : "dark") : value);
      return;
    }
    apply();
  }

  function build(host, index) {
    var field = document.createElement("fieldset");
    field.className = "theme-choice";
    var legend = document.createElement("legend");
    legend.textContent = "Appearance";
    field.appendChild(legend);
    CHOICES.forEach(function (entry) {
      var label = document.createElement("label");
      var input = document.createElement("input");
      input.type = "radio";
      input.name = "kolosseum-theme-" + index;
      input.value = entry[0];
      input.addEventListener("change", function () { if (input.checked) set(input.value); });
      label.appendChild(input);
      label.appendChild(document.createTextNode(entry[1]));
      field.appendChild(label);
    });
    host.appendChild(field);
  }

  function buildAll() {
    var hosts = document.querySelectorAll("[data-theme-choice]");
    for (var i = 0; i < hosts.length; i += 1) if (!hosts[i].firstChild) build(hosts[i], i);
    apply();
  }

  apply();
  if (media && media.addEventListener) media.addEventListener("change", apply);
  window.addEventListener("storage", function (event) { if (event.key === KEY) apply(); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", buildAll);
  else buildAll();
})();
