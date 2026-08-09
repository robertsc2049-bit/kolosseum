// DEV NOTE: FULL-UI-28 - athlete progress photos. Structurally mirrors
// message_attachment_storage.ts (multer staging, magic-byte content
// sniffing, path-traversal-guarded reads) but is image-only: no video, no
// ffmpeg poster extraction, no server-side thumbnail generation. Files
// never live under an express.static webroot - every read goes through an
// authenticated route that re-runs the athlete/coach relationship check, so
// this module only ever deals with already-authorized reads/writes; it
// holds no access-control logic of its own.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { Response } from "express";
import multer from "multer";

export const STORAGE_ROOT = path.resolve(process.cwd(), "var", "progress-photos");
const STAGING_DIR = path.join(STORAGE_ROOT, "tmp");

fs.mkdirSync(STAGING_DIR, { recursive: true });

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
// multer's own ceiling here is deliberately larger than MAX_IMAGE_BYTES -
// mirrors message_attachment_storage.ts's rationale: this lets a
// moderately-oversized upload reach validateStagedProgressPhotoUpload's own
// type-specific check (progress_photo_too_large) rather than being caught
// by multer's blunter, less specific LIMIT_FILE_SIZE error first.
const MULTER_CEILING_BYTES = MAX_IMAGE_BYTES * 3;

export class ProgressPhotoStorageError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ProgressPhotoStorageError";
    this.status = status;
  }
}

// Single shared multer instance for the upload route - staged files always
// land in the same tmp dir. The ceiling here is only the upper bound multer
// can enforce while streaming, before the real file type is known; the
// tighter image-only limit is enforced afterwards in validateStagedUpload,
// once the real type is known via content sniffing.
export const progressPhotoUpload = multer({
  storage: multer.diskStorage({
    destination: STAGING_DIR,
    filename: (_request, _file, callback) => callback(null, `${crypto.randomUUID()}.upload`)
  }),
  limits: { fileSize: MULTER_CEILING_BYTES, files: 1 }
});

type SniffResult = Readonly<{
  mimeType: string;
  extension: string;
}>;

// Deliberately zero-dependency (no `file-type` package): the claimed
// upload Content-Type (req.file.mimetype) is trivially spoofable and is
// never trusted - only the file's own leading bytes are. Image-only -
// no ISO-BMFF/mp4 branch, since this feature has no video component.
async function sniffFile(filePath: string): Promise<SniffResult | null> {
  const handle = await fs.promises.open(filePath, "r");
  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, 12, 0);
    if (bytesRead < 12) return null;

    if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
      return { mimeType: "image/jpeg", extension: "jpg" };
    }
    if (
      header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47 &&
      header[4] === 0x0d && header[5] === 0x0a && header[6] === 0x1a && header[7] === 0x0a
    ) {
      return { mimeType: "image/png", extension: "png" };
    }
    if (header.toString("ascii", 0, 4) === "RIFF" && header.toString("ascii", 8, 12) === "WEBP") {
      return { mimeType: "image/webp", extension: "webp" };
    }
    return null;
  }
  finally {
    await handle.close();
  }
}

export type PendingProgressPhotoUpload = Readonly<{
  stagedFilePath: string;
  mimeType: string;
  extension: string;
  byteSize: number;
}>;

// Validates a multer-staged file and either returns a descriptor ready to
// be persisted by the service, or throws (deleting the staged file first) -
// the caller never has to remember to clean up on a validation failure.
// Returns null for the (invalid, since this route requires a file) missing
// case - callers must treat that as a request error, not a no-op.
export async function validateStagedProgressPhotoUpload(
  file: { path: string } | undefined
): Promise<PendingProgressPhotoUpload | null> {
  if (!file) return null;

  const sniffed = await sniffFile(file.path);
  if (!sniffed) {
    await fs.promises.rm(file.path, { force: true }).catch(() => {});
    throw new ProgressPhotoStorageError("progress_photo_type_unsupported", 400);
  }

  const stat = await fs.promises.stat(file.path);
  if (stat.size > MAX_IMAGE_BYTES) {
    await fs.promises.rm(file.path, { force: true }).catch(() => {});
    throw new ProgressPhotoStorageError("progress_photo_too_large", 400);
  }

  return Object.freeze({
    stagedFilePath: file.path,
    mimeType: sniffed.mimeType,
    extension: sniffed.extension,
    byteSize: stat.size
  });
}

export function progressPhotoDirFor(athleteUserId: string, photoId: string): string {
  return path.join(STORAGE_ROOT, athleteUserId, photoId);
}

// Moves a validated staged upload into its permanent, athlete+photo-keyed
// home. Must only be called once the caller is committed to persisting a
// beta_progress_photo record referencing the returned key - see
// cleanupProgressPhotoFiles for the corresponding rollback path.
export async function finalizeProgressPhoto(
  pending: PendingProgressPhotoUpload,
  athleteUserId: string,
  photoId: string
): Promise<Readonly<{ storageKey: string }>> {
  const dir = progressPhotoDirFor(athleteUserId, photoId);
  await fs.promises.mkdir(dir, { recursive: true });

  const storageKey = `${athleteUserId}/${photoId}/original.${pending.extension}`;
  await fs.promises.rename(pending.stagedFilePath, path.join(STORAGE_ROOT, storageKey));

  return Object.freeze({ storageKey });
}

export async function cleanupProgressPhotoFiles(athleteUserId: string, photoId: string): Promise<void> {
  await fs.promises.rm(progressPhotoDirFor(athleteUserId, photoId), { recursive: true, force: true }).catch(() => {});
}

// Defense in depth against a corrupted/foreign storage key ever reaching fs
// access, even though every key is server-generated and never
// client-writable. Returns null (never throws) so callers can map straight
// to a 404 rather than a 500.
export function resolveProgressPhotoPath(storageKey: string): string | null {
  const resolved = path.resolve(STORAGE_ROOT, storageKey);
  if (resolved !== STORAGE_ROOT && !resolved.startsWith(STORAGE_ROOT + path.sep)) return null;
  return resolved;
}

// See message_attachment_storage.ts's sendAttachmentFile for why `root`
// matters: without it, res.sendFile's traversal check runs against the
// FULL absolute path, which incorrectly 404s inside a dotted worktree
// directory (e.g. .claude/worktrees/...).
export function sendProgressPhotoFile(
  response: Response,
  file: Readonly<{ absolutePath: string; mimeType: string }>
): void {
  response.status(200).contentType(file.mimeType).sendFile(path.relative(STORAGE_ROOT, file.absolutePath), { root: STORAGE_ROOT });
}
