import crypto from "crypto";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { deleteUploadedFile } from "./paths.js";

// Backend only: this client uses the service role key, which must never reach the frontend.
export const BUCKETS = { videos: "videos", images: "images" };

let client;
const supabase = () => {
  if (!client) {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for file uploads");
    }
    client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
};

const randomName = (ext) => `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;

// Uploads a Buffer and returns its public URL.
export const uploadBuffer = async ({ bucket, folder, buffer, contentType, ext }) => {
  const objectPath = `${folder}/${randomName(ext)}`;
  const { error } = await supabase().storage.from(bucket).upload(objectPath, buffer, {
    contentType,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return supabase().storage.from(bucket).getPublicUrl(objectPath).data.publicUrl;
};

const MIME_EXT = {
  "image/jpeg": ".jpg", "image/jpg": ".jpg", "image/png": ".png", "image/gif": ".gif", "image/webp": ".webp",
};

// Turns "data:image/png;base64,...." into a Buffer; returns null if it is not a supported image.
export const parseImageDataUri = (value) => {
  const m = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(String(value || ""));
  if (!m) return null;
  const contentType = m[1].toLowerCase();
  const ext = MIME_EXT[contentType];
  if (!ext) return null;
  return { buffer: Buffer.from(m[2], "base64"), contentType, ext };
};

// If `value` is an inline image (data URI), store it in the images bucket and return its URL.
// http(s) links and empty values are returned unchanged.
export const storeImageIfInline = async (value, folder) => {
  if (typeof value !== "string" || !value.startsWith("data:image/")) return value;
  const img = parseImageDataUri(value);
  if (!img) return "";
  return uploadBuffer({ bucket: BUCKETS.images, folder, ...img });
};

// Splits a Supabase public URL into { bucket, objectPath }, or null for any other URL.
const parsePublicUrl = (url) => {
  const base = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const prefix = `${base}/storage/v1/object/public/`;
  if (!base || typeof url !== "string" || !url.startsWith(prefix)) return null;
  const rest = url.slice(prefix.length).split("?")[0];
  const slash = rest.indexOf("/");
  if (slash < 1) return null;
  return { bucket: rest.slice(0, slash), objectPath: decodeURIComponent(rest.slice(slash + 1)) };
};

// Deletes a stored file given the URL saved in the database. Handles Supabase URLs and
// legacy "/uploads/..." paths; anything else (YouTube links, data URIs) is ignored.
// Never throws - a failed file delete must not fail the API request.
export const deleteStoredFile = async (url) => {
  try {
    const parsed = parsePublicUrl(url);
    if (parsed) {
      const { error } = await supabase().storage.from(parsed.bucket).remove([parsed.objectPath]);
      if (error) console.error("Storage delete failed:", error.message);
      return;
    }
    deleteUploadedFile(url);
  } catch (err) {
    console.error("Storage delete failed:", err.message);
  }
};

export const fileExt = (originalName) => path.extname(originalName || "").toLowerCase();
