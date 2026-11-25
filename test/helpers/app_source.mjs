// What the app does outside its React panels, as one text: app.js and the
// files it's made of (public/app/core, and public/app/coach for coaches).
import fs from "node:fs";

const APP = new URL("../../public/app/", import.meta.url);
const FIRST = ["core/state.js", "core/elements.js", "core/format.js", "core/notices.js", "core/api.js", "core/sessions.js", "core/shell.js", "core/account.js", "core/messaging.js", "core/sections.js",
  "coach/index.js", "coach/athletes.js", "coach/draft.js", "coach/programmes.js", "coach/eventPlan.js", "coach/validation.js", "coach/builder.js", "coach/builderEdits.js", "coach/builderControls.js"];

export function appFiles() {
  const all = ["core", "coach"].flatMap((dir) => fs.readdirSync(new URL(`${dir}/`, APP)).map((name) => `${dir}/${name}`));
  return [...FIRST, ...all.filter((name) => !FIRST.includes(name)).sort(), "app.js"];
}

export function appSource() {
  return appFiles()
    .map((name) => fs.readFileSync(new URL(name, APP), "utf8").replaceAll("\r\n", "\n").replace(/^export (?=(?:async )?function |const |let )/gmu, ""))
    .join("\n");
}
