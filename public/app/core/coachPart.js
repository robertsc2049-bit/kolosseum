// The coach's part of the app (../coach/), fetched only for a coach. Until
// it has arrived - or for anyone else - coachPart() is null.
let part = null;

export async function loadCoachPart() {
  part ??= await import("../coach/index.js");
  return part;
}

export function coachPart() {
  return part;
}
