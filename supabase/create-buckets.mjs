// Creates the public Storage buckets used by the backend (idempotent).
// Usage (from backend/):  node --env-file=.env ../supabase/create-buckets.mjs
// Uses SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY; never prints them.
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const here = path.dirname(fileURLToPath(import.meta.url));
const { createClient } = createRequire(path.join(here, "../backend/package.json"))("@supabase/supabase-js");

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const BUCKETS = [
  { name: "videos", allowedMimeTypes: ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v", "video/ogg"] },
  { name: "images", allowedMimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"] },
];

const { data: existing, error: listError } = await supabase.storage.listBuckets();
if (listError) {
  console.error("Could not list buckets:", listError.message);
  process.exit(1);
}
const have = new Set(existing.map((b) => b.name));

for (const b of BUCKETS) {
  if (have.has(b.name)) {
    const { error } = await supabase.storage.updateBucket(b.name, { public: true, allowedMimeTypes: b.allowedMimeTypes });
    console.log(b.name, error ? `update failed: ${error.message}` : "exists (settings refreshed)");
    continue;
  }
  const { error } = await supabase.storage.createBucket(b.name, { public: true, allowedMimeTypes: b.allowedMimeTypes });
  console.log(b.name, error ? `create failed: ${error.message}` : "created");
}
