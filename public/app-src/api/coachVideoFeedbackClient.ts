import { type JsonRecord, request } from "./transport";

export async function loadCoachVideoFeedbackQueue(): Promise<JsonRecord[]> {
  const response = await request("GET", "/coach-workspace/video-feedback/queue");
  return Array.isArray(response.submissions) ? (response.submissions as JsonRecord[]) : [];
}

export async function submitCoachVideoFeedback(
  submissionId: string,
  feedbackText: string,
  csrfToken: string
): Promise<JsonRecord> {
  const response = await request(
    "POST",
    `/coach-workspace/video-feedback/submissions/${encodeURIComponent(submissionId)}/feedback`,
    { feedback_text: feedbackText },
    csrfToken
  );
  return response.submission as JsonRecord;
}
