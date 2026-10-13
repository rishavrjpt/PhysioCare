import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Absolute paths, so uploads work no matter which folder the server is started from.
export const BACKEND_ROOT = path.resolve(__dirname, "..");
export const UPLOADS_DIR = path.join(BACKEND_ROOT, "uploads");
export const VIDEOS_DIR = path.join(UPLOADS_DIR, "videos");
export const TEAM_DIR = path.join(UPLOADS_DIR, "team");

// uploads/ is git-ignored, so on a fresh clone or a new Render deploy it does not exist.
// Multer does not create it when the destination is a function, so create it here.
for (const dir of [VIDEOS_DIR, TEAM_DIR]) fs.mkdirSync(dir, { recursive: true });

// Turns a stored URL like "/uploads/videos/123.mp4" into a safe absolute path, or null.
export const resolveUploadPath = (storedUrl) => {
  if (!storedUrl || !storedUrl.startsWith("/uploads/")) return null;
  const full = path.resolve(BACKEND_ROOT, "." + storedUrl);
  return full.startsWith(UPLOADS_DIR + path.sep) ? full : null;
};

export const deleteUploadedFile = (storedUrl) => {
  const full = resolveUploadPath(storedUrl);
  if (full && fs.existsSync(full)) {
    try { fs.unlinkSync(full); } catch (err) { console.error("File delete failed:", err.message); }
  }
};
