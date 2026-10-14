// Turns a Postgres row (snake_case, "id") into the shape the old Mongoose API returned
// (camelCase, "_id"), so the frontend keeps working unchanged.
const camelKey = (k) => k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

export const camelize = (row) => {
  if (!row) return row;
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === "legacy_mongo_id") continue; // migration bookkeeping, not part of the API
    out[key === "id" ? "_id" : camelKey(key)] = value;
  }
  return out;
};

export const camelizeAll = (rows) => rows.map(camelize);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value) => typeof value === "string" && UUID_RE.test(value);
