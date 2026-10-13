// DEV NOTE: Exercise demo video uploads - a coach's own clip of an exercise
// (exercise_demo_video_service.ts). Mirrors video_submission_storage.ts: its
// own storage root outside any express.static webroot, the file's leading
// bytes (never the claimed Content-Type) decide whether it's a video, a
// best-effort poster frame, and every read goes through an authenticated
// route that has already resolved this viewer to this demo - this module
// holds no access-control logic of its own.

import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import type { Response } from "express";
import multer from "multer";
import ffmpeg from "@ffmpeg-installer/ffmpeg";

const execFileAsync = promisify(execFile);

export const STORAGE_ROOT = path.resolve(process.cwd(), "var", "exercise-demo-videos");
const STAGING_DIR = path.join(STORAGE_ROOT, "tmp");

fs.mkdirSync(STAGING_DIR, { recursive: true });

// A demo is a short clip of one exercise - a phone's 1080p minute is ~100MB,
// so 75MB covers a 30-45 second demo comfortably.
const MAX_VIDEO_BYTES = 75 * 1024 * 1024;

export class ExerciseDemoUploadError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ExerciseDemoUploadError";
    this.status = status;
  }
}

export const exerciseDemoUpload = multer({
  storage: multer.diskStorage({
    destination: STAGING_DIR,
    filename: (_request, _file, callback) => callback(null, `${crypto.randomUUID()}.upload`)
  }),
  limits: { fileSize: MAX_VIDEO_BYTES, files: 1 }
});

// MP4 and iPhone MOV both start with an ISO-BMFF 'ftyp' box.
async function isVideoFile(filePath: string): Promise<boolean> {
  const handle = await fs.promises.open(filePath, "r");
  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, 12, 0);
    return bytesRead >= 12 && header.toString("ascii", 4, 8) === "ftyp";
  }
  finally {
    await handle.close();
  }
}

export type PendingDemoUpload = Readonly<{ stagedFilePath: string; byteSize: number }>;

export async function validateStagedDemoUpload(file: { path: string } | undefined): Promise<PendingDemoUpload> {
  if (!file) throw new ExerciseDemoUploadError("demo_video_file_required");
  if (!(await isVideoFile(file.path))) {
    await fs.promises.rm(file.path, { force: true }).catch(() => {});
    throw new ExerciseDemoUploadError("demo_video_type_unsupported");
  }
  const stat = await fs.promises.stat(file.path);
  if (stat.size > MAX_VIDEO_BYTES) {
    await fs.promises.rm(file.path, { force: true }).catch(() => {});
    throw new ExerciseDemoUploadError("demo_video_too_large");
  }
  return Object.freeze({ stagedFilePath: file.path, byteSize: stat.size });
}

export async function discardStagedDemoUpload(pending: PendingDemoUpload | null | undefined): Promise<void> {
  if (pending) await fs.promises.rm(pending.stagedFilePath, { force: true }).catch(() => {});
}

// Best-effort poster frame; a failed extraction never fails the upload.
async function tryPoster(inputPath: string, uploadId: string): Promise<string | null> {
  const key = `${uploadId}/poster.jpg`;
  const output = path.join(STORAGE_ROOT, key);
  for (const seek of ["00:00:01", "00:00:00"]) {
    try {
      await execFileAsync(ffmpeg.path, ["-y", "-ss", seek, "-i", inputPath, "-vframes", "1", "-vf", "scale=640:-2", output], { timeout: 10_000 });
      const stat = await fs.promises.stat(output).catch(() => null);
      if (stat && stat.size > 0) return key;
    }
    catch {
      // Try the next seek point.
    }
  }
  await fs.promises.rm(output, { force: true }).catch(() => {});
  return null;
}

// Move a validated upload to its permanent home (a fresh id per upload, so
// a replaced demo's old file can be removed independently).
export async function finalizeDemoUpload(pending: PendingDemoUpload): Promise<Readonly<{ uploadId: string; storageKey: string; posterKey: string | null }>> {
  const uploadId = crypto.randomUUID();
  await fs.promises.mkdir(path.join(STORAGE_ROOT, uploadId), { recursive: true });
  const posterKey = await tryPoster(pending.stagedFilePath, uploadId);
  const storageKey = `${uploadId}/original.mp4`;
  await fs.promises.rename(pending.stagedFilePath, path.join(STORAGE_ROOT, storageKey));
  return Object.freeze({ uploadId, storageKey, posterKey });
}

export async function removeDemoUploadFiles(storageKey: string | null | undefined): Promise<void> {
  const uploadId = typeof storageKey === "string" ? storageKey.split("/")[0] : "";
  if (!/^[0-9a-f-]{36}$/u.test(uploadId)) return;
  await fs.promises.rm(path.join(STORAGE_ROOT, uploadId), { recursive: true, force: true }).catch(() => {});
}

// Never lets a stored key reach outside the storage root.
export function resolveDemoUploadPath(storageKey: string): string | null {
  const resolved = path.resolve(STORAGE_ROOT, storageKey);
  if (!resolved.startsWith(STORAGE_ROOT + path.sep)) return null;
  return fs.existsSync(resolved) ? resolved : null;
}

// Express's sendFile (via `send`) answers Range requests with 206 partial
// content - iOS Safari won't play a video without it. `root` scopes its
// dotfile check to the key (see video_submission_storage.ts).
export function sendDemoUploadFile(response: Response, absolutePath: string, mimeType: string): void {
  response.setHeader("Cache-Control", "private, max-age=3600");
  response.contentType(mimeType).sendFile(path.relative(STORAGE_ROOT, absolutePath), { root: STORAGE_ROOT });
}
