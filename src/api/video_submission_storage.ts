// DEV NOTE: FULL-UI-32 video feedback. Deliberately not a shared refactor
// of message_attachment_storage.ts (Part D.3) - this module is video-only
// (no image branch, no MAX_IMAGE_BYTES) and lives under its own storage
// root, so the already-shipped messaging attachment path is never touched
// by this feature. Files never live under an express.static webroot -
// every read goes through an authenticated route that re-runs the same
// relationship check used to read the parent submission, so this module
// only ever deals with already-authorized reads/writes; it holds no
// access-control logic of its own.

import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import type { Response } from "express";
import multer from "multer";
import ffmpeg from "@ffmpeg-installer/ffmpeg";

const execFileAsync = promisify(execFile);

export const STORAGE_ROOT = path.resolve(process.cwd(), "var", "video-submissions");
const STAGING_DIR = path.join(STORAGE_ROOT, "tmp");

fs.mkdirSync(STAGING_DIR, { recursive: true });

const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export class VideoSubmissionError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "VideoSubmissionError";
    this.status = status;
  }
}

// Single shared multer instance for the upload route - staged files
// always land in the same tmp dir. The byte ceiling here is only the
// upper bound multer can enforce while streaming, before the actual file
// type is known; validateStagedVideoUpload re-checks size once content
// sniffing has confirmed it's actually a video.
export const videoSubmissionUpload = multer({
  storage: multer.diskStorage({
    destination: STAGING_DIR,
    filename: (_request, _file, callback) => callback(null, `${crypto.randomUUID()}.upload`)
  }),
  limits: { fileSize: MAX_VIDEO_BYTES, files: 1 }
});

type SniffResult = Readonly<{
  mimeType: string;
  extension: string;
}>;

// Deliberately zero-dependency (no `file-type` package): the claimed
// upload Content-Type (req.file.mimetype) is trivially spoofable and is
// never trusted - only the file's own leading bytes are. Same ISO-BMFF
// 'ftyp' box signature used by message_attachment_storage.ts - covers
// MP4 and iOS-recorded MOV, the two formats a phone camera actually
// produces.
async function sniffVideoFile(filePath: string): Promise<SniffResult | null> {
  const handle = await fs.promises.open(filePath, "r");
  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, 12, 0);
    if (bytesRead < 12) return null;

    if (header.toString("ascii", 4, 8) === "ftyp") {
      return { mimeType: "video/mp4", extension: "mp4" };
    }
    return null;
  }
  finally {
    await handle.close();
  }
}

export type PendingVideoSubmissionUpload = Readonly<{
  stagedFilePath: string;
  mimeType: string;
  extension: string;
  byteSize: number;
}>;

// Validates a multer-staged file and either returns a descriptor ready to
// be persisted by video_feedback_service.ts, or throws (deleting the
// staged file first) - the caller never has to remember to clean up on a
// validation failure.
export async function validateStagedVideoUpload(
  file: { path: string } | undefined
): Promise<PendingVideoSubmissionUpload> {
  if (!file) {
    throw new VideoSubmissionError("video_submission_file_required", 400);
  }

  const sniffed = await sniffVideoFile(file.path);
  if (!sniffed) {
    await fs.promises.rm(file.path, { force: true }).catch(() => {});
    throw new VideoSubmissionError("video_submission_type_unsupported", 400);
  }

  const stat = await fs.promises.stat(file.path);
  if (stat.size > MAX_VIDEO_BYTES) {
    await fs.promises.rm(file.path, { force: true }).catch(() => {});
    throw new VideoSubmissionError("video_submission_too_large", 400);
  }

  return Object.freeze({
    stagedFilePath: file.path,
    mimeType: sniffed.mimeType,
    extension: sniffed.extension,
    byteSize: stat.size
  });
}

export function videoSubmissionDirFor(submissionId: string): string {
  return path.join(STORAGE_ROOT, submissionId);
}

// Best-effort - mirrors message_attachment_storage.ts's identical
// tryGenerateVideoPoster: a failed poster extraction must never fail the
// primary upload. Retries once at the very first frame, which
// meaningfully improves poster coverage for very short form-check clips
// where a 1-second seek lands past EOF.
async function tryGenerateVideoPoster(inputPath: string, submissionId: string): Promise<string | null> {
  const relativeKey = `${submissionId}/poster.jpg`;
  const outputPath = path.join(STORAGE_ROOT, relativeKey);

  for (const seek of ["00:00:01", "00:00:00"]) {
    try {
      await execFileAsync(
        ffmpeg.path,
        ["-y", "-ss", seek, "-i", inputPath, "-vframes", "1", "-vf", "scale=640:-2", outputPath],
        { timeout: 10_000 }
      );
      // A zero-exit-code does NOT guarantee a frame was actually written -
      // seeking past the last frame exits 0 with "nothing was encoded"
      // and no output file at all. The file's own existence/size is the
      // only reliable success signal, which is exactly why the
      // 00:00:00 retry exists.
      const stat = await fs.promises.stat(outputPath).catch(() => null);
      if (stat && stat.size > 0) return relativeKey;
    }
    catch {
      // Try the next seek point; falls through to the cleanup below once
      // every attempt has failed.
    }
  }

  await fs.promises.rm(outputPath, { force: true }).catch(() => {});
  return null;
}

// Moves a validated staged upload into its permanent, submission_id-keyed
// home and attempts a poster frame. Must only be called once the caller
// is committed to persisting a submission row referencing the returned
// keys - see cleanupVideoSubmissionFiles for the corresponding rollback
// path when that commitment doesn't pan out (a thrown error, or an
// idempotent-replay insert that turns out to be a no-op).
export async function finalizeVideoSubmission(
  pending: PendingVideoSubmissionUpload,
  submissionId: string
): Promise<Readonly<{ storageKey: string; thumbnailStorageKey: string | null }>> {
  const dir = videoSubmissionDirFor(submissionId);
  await fs.promises.mkdir(dir, { recursive: true });

  const thumbnailStorageKey = await tryGenerateVideoPoster(pending.stagedFilePath, submissionId);

  const storageKey = `${submissionId}/original.${pending.extension}`;
  await fs.promises.rename(pending.stagedFilePath, path.join(STORAGE_ROOT, storageKey));

  return Object.freeze({ storageKey, thumbnailStorageKey });
}

export async function cleanupVideoSubmissionFiles(submissionId: string): Promise<void> {
  await fs.promises.rm(videoSubmissionDirFor(submissionId), { recursive: true, force: true }).catch(() => {});
}

// Defense in depth against a corrupted/foreign storage key ever reaching
// fs access, even though every key is server-generated and never
// client-writable. Returns null (never throws) so callers can map
// straight to a 404 rather than a 500.
export function resolveVideoSubmissionPath(storageKey: string): string | null {
  const resolved = path.resolve(STORAGE_ROOT, storageKey);
  if (resolved !== STORAGE_ROOT && !resolved.startsWith(STORAGE_ROOT + path.sep)) return null;
  return resolved;
}

// Express's res.sendFile(absolutePath) with no `root` option makes the
// `send` package run its dotfile/traversal check against every segment of
// the FULL absolute path, not just the part under STORAGE_ROOT - in a
// worktree checkout living under a dotted directory (e.g.
// .claude/worktrees/...), that incorrectly - and confusingly - reports a
// perfectly real file as 404 "Not Found". Passing `root` scopes that
// check to only the relative key, matching message_attachment_storage.ts's
// identical sendAttachmentFile.
export function sendVideoSubmissionFile(
  response: Response,
  file: Readonly<{ absolutePath: string; mimeType: string }>
): void {
  response.status(200).contentType(file.mimeType).sendFile(path.relative(STORAGE_ROOT, file.absolutePath), { root: STORAGE_ROOT });
}
