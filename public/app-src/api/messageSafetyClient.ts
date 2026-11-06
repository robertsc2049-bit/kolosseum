import { loadAccountDetail } from "./client";
import { type JsonRecord, request } from "./transport";

// Message safety (src/api/message_safety_service.ts): report a message you
// received, and block or unblock a person who has messaged you.

export const REPORT_REASONS: ReadonlyArray<[string, string]> = [
  ["abuse", "Abuse or harassment"],
  ["threat", "Threats or violence"],
  ["sexual", "Sexual content"],
  ["spam", "Spam or scam"],
  ["illegal", "Something illegal"],
  ["other", "Something else"]
];

async function csrf(): Promise<string> {
  const account = await loadAccountDetail();
  return typeof account.csrf_token === "string" ? account.csrf_token : "";
}

export async function reportMessage(messageId: string, reason: string, note: string): Promise<JsonRecord> {
  return request("POST", "/messages/safety/reports", { message_id: messageId, reason, ...(note.trim() ? { note: note.trim() } : {}) }, await csrf());
}

export function loadBlocks(): Promise<JsonRecord> {
  return request("GET", "/messages/safety/blocks");
}

// A block or unblock anywhere tells the Blocked people panel to refresh.
export const BLOCKS_CHANGED_EVENT = "kolosseum:message-blocks-changed";
function blocksChanged(): void {
  document.dispatchEvent(new CustomEvent("kolosseum:data-changed"));
  document.dispatchEvent(new CustomEvent(BLOCKS_CHANGED_EVENT));
}

export async function blockUser(userId: string): Promise<JsonRecord> {
  const result = await request("POST", "/messages/safety/blocks", { user_id: userId }, await csrf());
  blocksChanged();
  return result;
}

export async function unblockUser(userId: string): Promise<JsonRecord> {
  const result = await request("POST", `/messages/safety/blocks/${encodeURIComponent(userId)}/remove`, {}, await csrf());
  blocksChanged();
  return result;
}
