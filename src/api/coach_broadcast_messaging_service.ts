// DEV NOTE: Coach broadcast messaging. Sends the same message text into
// every one of a coach's currently-accepted individual athlete threads by
// calling sendCoachAthleteMessage once per athlete - there is no separate
// broadcast record type or delivery mechanism, only a fan-out over the
// same per-athlete send path (and its own accepted-relationship gate)
// that a coach's single-athlete message already goes through. The athlete
// list is resolved fresh from listConnectedCoachAthletes on every call,
// never client-supplied, so a coach can only ever broadcast to athletes
// who are accepted right now.

import { listConnectedCoachAthletes } from "./beta19_coach_workspace_service.js";
import { sendCoachAthleteMessage } from "./coach_athlete_messaging_service.js";

type JsonRecord = Record<string, unknown>;

export class CoachBroadcastMessagingError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "CoachBroadcastMessagingError";
    this.status = status;
  }
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function sendCoachBroadcastMessage(
  coachUserIdInput: string,
  bodyTextInput: unknown
): Promise<Readonly<JsonRecord>> {
  const coachUserId = cleanString(coachUserIdInput);
  if (!coachUserId) {
    throw new CoachBroadcastMessagingError("coach_broadcast_messaging_coach_required");
  }

  const bodyText = cleanString(bodyTextInput);
  if (!bodyText) {
    throw new CoachBroadcastMessagingError("coach_broadcast_messaging_body_text_invalid");
  }
  if (bodyText.length > 4000) {
    throw new CoachBroadcastMessagingError("coach_broadcast_messaging_body_text_invalid");
  }

  const athletes = await listConnectedCoachAthletes(coachUserId);

  const results: JsonRecord[] = [];
  for (const athlete of athletes) {
    const athleteUserId = cleanString(athlete.athlete_user_id);
    const sent = await sendCoachAthleteMessage("coach", coachUserId, athleteUserId, bodyText, undefined, null);
    results.push({
      athlete_user_id: athleteUserId,
      thread_id: sent.thread.thread_id,
      message_id: sent.message.message_id
    });
  }

  return Object.freeze({
    sent_count: results.length,
    athlete_user_ids: results.map((entry) => entry.athlete_user_id),
    results: Object.freeze(results)
  });
}
