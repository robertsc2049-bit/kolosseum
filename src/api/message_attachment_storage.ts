// DEV NOTE: Part D.3 - photo/video attachments for messaging. Shared by
// both coach_athlete_messaging_service.ts and org_coach_messaging_service.ts
// (and their routes), so upload handling, content sniffing, storage paths,
// and best-effort video poster extraction exist exactly once. Files never
// live under an express.static webroot - every read goes through an
// authenticated route that re-runs the same relationship/membership check
// used to read the thread itself, so this module only ever deals with
// already-authorized reads/writes; it holds no access-control logic of
// its own.

import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import type { Response } from "express";
import multer from "multer";
import ffmpeg from "@ffmpeg-installer/ffmpeg";

const execFileAsync = promisify(execFile);

export const STORAGE_ROOT = path.resolve(process.cwd(), "var", "message-attachments");
const STAGING_DIR = path.join(STORAGE_ROOT, "tmp");

fs.mkdirSync(STAGING_DIR, { recursive: true });

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export class MessageAttachmentError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "MessageAttachmentError";
    this.status = status;
  }
}

// Single shared multer instance for every send route across both
// messaging slices - staged files always land in the same tmp dir,
// regardless of which route accepted the upload. The 50MB ceiling here
// is only the upper bound multer can enforce while streaming, before the
// actual file type is known; the tighter, type-specific 10MB image limit
// is enforced afterwards in validateStagedUpload, once the real type is
// known via content sniffing.
export const attachmentUpload = multer({
  storage: multer.diskStorage({
    destination: STAGING_DIR,
    filename: (_request, _file, callback) => callback(null, `${crypto.randomUUID()}.upload`)
  }),
  limits: { fileSize: MAX_VIDEO_BYTES, files: 1 }
});

type SniffResult = Readonly<{
  mediaType: "image" | "video";
  mimeType: string;
  extension: string;
}>;

// Deliberately zero-dependency (no `file-type` package): the claimed
// upload Content-Type (req.file.mimetype) is trivially spoofable and is
// never trusted - only the file's own leading bytes are.
async function sniffFile(filePath: string): Promise<SniffResult | null> {
  const handle = await fs.promises.open(filePath, "r");
  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, 12, 0);
    if (bytesRead < 12) return null;

    if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
      return { mediaType: "image", mimeType: "image/jpeg", extension: "jpg" };
    }
    if (
      header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47 &&
      header[4] === 0x0d && header[5] === 0x0a && header[6] === 0x1a && header[7] === 0x0a
    ) {
      return { mediaType: "image", mimeType: "image/png", extension: "png" };
    }
    if (header.toString("ascii", 0, 4) === "RIFF" && header.toString("ascii", 8, 12) === "WEBP") {
      return { mediaType: "image", mimeType: "image/webp", extension: "webp" };
    }
    // ISO-BMFF 'ftyp' box signature - covers MP4 and iOS-recorded MOV.
    if (header.toString("ascii", 4, 8) === "ftyp") {
      return { mediaType: "video", mimeType: "video/mp4", extension: "mp4" };
    }
    return null;
  }
  finally {
    await handle.close();
  }
}

export type PendingAttachmentUpload = Readonly<{
  stagedFilePath: string;
  mediaType: "image" | "video";
  mimeType: string;
  extension: string;
  byteSize: number;
}>;

// Validates a multer-staged file and either returns a descriptor ready to
// be persisted by the messaging service, or throws (deleting the staged
// file first) - the caller never has to remember to clean up on a
// validation failure. Returns null for the common no-attachment case.
export async function validateStagedUpload(
  file: { path: string } | undefined
): Promise<PendingAttachmentUpload | null> {
  if (!file) return null;

  const sniffed = await sniffFile(file.path);
  if (!sniffed) {
    await fs.promises.rm(file.path, { force: true }).catch(() => {});
    throw new MessageAttachmentError("message_attachment_type_unsupported", 400);
  }

  const stat = await fs.promises.stat(file.path);
  const limit = sniffed.mediaType === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (stat.size > limit) {
    await fs.promises.rm(file.path, { force: true }).catch(() => {});
    throw new MessageAttachmentError(
      sniffed.mediaType === "image" ? "message_attachment_image_too_large" : "message_attachment_video_too_large",
      400
    );
  }

  return Object.freeze({
    stagedFilePath: file.path,
    mediaType: sniffed.mediaType,
    mimeType: sniffed.mimeType,
    extension: sniffed.extension,
    byteSize: stat.size
  });
}

export function attachmentDirFor(messageId: string): string {
  return path.join(STORAGE_ROOT, messageId);
}

// Best-effort - mirrors pushToUser's "a missed push is never a
// correctness problem" pattern (realtime_hub.ts): a failed poster
// extraction must never fail the primary send. Retries once at the very
// first frame, which meaningfully improves poster coverage for very
// short coaching clips where a 1-second seek lands past EOF.
async function tryGenerateVideoPoster(inputPath: string, messageId: string): Promise<string | null> {
  const relativeKey = `${messageId}/poster.jpg`;
  const outputPath = path.join(STORAGE_ROOT, relativeKey);

  for (const seek of ["00:00:01", "00:00:00"]) {
    try {
      await execFileAsync(
        ffmpeg.path,
        ["-y", "-ss", seek, "-i", inputPath, "-vframes", "1", "-vf", "scale=640:-2", outputPath],
        { timeout: 10_000 }
      );
      // A zero-exit-code does NOT guarantee a frame was actually written -
      // seeking past the last frame (e.g. -ss 00:00:01 on a clip only
      // ~1 second long) exits 0 with "nothing was encoded" and no output
      // file at all. The file's own existence/size is the only reliable
      // success signal, which is exactly why the 00:00:00 retry exists.
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

// Moves a validated staged upload into its permanent, message_id-keyed
// home and (for video) attempts a poster frame. Must only be called once
// the caller is committed to persisting a message row referencing the
// returned keys - see cleanupAttachmentFiles for the corresponding
// rollback path when that commitment doesn't pan out (a thrown error, or
// an idempotent-replay insert that turns out to be a no-op).
export async function finalizeAttachment(
  pending: PendingAttachmentUpload,
  messageId: string
): Promise<Readonly<{ storageKey: string; thumbnailStorageKey: string | null }>> {
  const dir = attachmentDirFor(messageId);
  await fs.promises.mkdir(dir, { recursive: true });

  const thumbnailStorageKey =
    pending.mediaType === "video"
      ? await tryGenerateVideoPoster(pending.stagedFilePath, messageId)
      : null;

  const storageKey = `${messageId}/original.${pending.extension}`;
  await fs.promises.rename(pending.stagedFilePath, path.join(STORAGE_ROOT, storageKey));

  return Object.freeze({ storageKey, thumbnailStorageKey });
}

export async function cleanupAttachmentFiles(messageId: string): Promise<void> {
  await fs.promises.rm(attachmentDirFor(messageId), { recursive: true, force: true }).catch(() => {});
}

// Defense in depth against a corrupted/foreign storage key ever reaching
// fs access, even though every key is server-generated and never
// client-writable. Returns null (never throws) so callers can map
// straight to a 404 rather than a 500.
export function resolveAttachmentPath(storageKey: string): string | null {
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
// check to only the relative key, which is what every call site actually
// wants. Every route with a ResolvedMessageAttachmentFile/
// ResolvedOrgMessageAttachmentFile should call this instead of
// response.sendFile directly.
export function sendAttachmentFile(
  response: Response,
  file: Readonly<{ absolutePath: string; mimeType: string }>
): void {
  response.status(200).contentType(file.mimeType).sendFile(path.relative(STORAGE_ROOT, file.absolutePath), { root: STORAGE_ROOT });
}
