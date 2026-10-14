#!/usr/bin/env node
/*
 * One-time copy of PhysioCare data from MongoDB into Supabase (Postgres + Storage).
 *
 * Run from the repo root:
 *   node --env-file=backend/.env scripts/migrate-mongo-to-supabase.js --dry-run   # reads Mongo, writes nothing
 *   node --env-file=backend/.env scripts/migrate-mongo-to-supabase.js             # real copy
 *
 * Flags:
 *   --dry-run     read + validate everything, print the report, write nothing (no DB rows, no files)
 *   --skip-files  keep legacy "/uploads/..." paths and base64 images as they are (do not upload to Storage)
 *
 * Environment (from backend/.env): MONGO_URI, DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * None of these values are ever printed.
 *
 * Safe to re-run: every row is matched on legacy_mongo_id, rows that are already copied are
 * left alone, and files of already-copied rows are not uploaded again.
 *
 * What it does NOT do: delete anything from MongoDB or from backend/uploads.
 * Old login tokens stop working after the move (ids change from ObjectId to UUID); passwords
 * are copied as bcrypt hashes, so users can log in with the same password.
 */
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");
const { pathToFileURL } = require("url");

const ROOT = path.resolve(__dirname, "..");
const BACKEND = path.join(ROOT, "backend");
const requireFromBackend = createRequire(path.join(BACKEND, "package.json"));
const { MongoClient } = requireFromBackend("mongodb");
const { Client } = requireFromBackend("pg");

const DRY_RUN = process.argv.includes("--dry-run");
const SKIP_FILES = process.argv.includes("--skip-files");

// ── helpers ──────────────────────────────────────────────────────────────────
const id = (v) => (v == null ? null : String(v));
const str = (v, fallback = "") => (v == null ? fallback : String(v));
const strOrNull = (v) => (v == null ? null : String(v));
const arr = (v) => (Array.isArray(v) ? v.map(String) : []);
const date = (v, fallback = new Date()) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : fallback;
};
const oneOf = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback);
const intIn = (v, min, max) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

const ROLES = ["patient", "doctor", "user", "admin"];
const APPT_STATUS = ["Pending", "Confirmed", "Completed", "Cancelled", "Rescheduled"];
const FEELINGS = ["Better", "Same", "Worse"];
const CATEGORIES = ["Rehabilitation", "Orthopedic", "Sports", "Wellness", "Neurological", "Nutrition"];

const report = {}; // table -> { read, inserted, existing, skipped: [{id, reason}] }
const warnings = [];
const section = (name) => (report[name] ||= { read: 0, inserted: 0, existing: 0, skipped: [] });
const warn = (msg) => warnings.push(msg);
// In a dry run, rows that "would be inserted" get a placeholder id; never send those to Postgres.
const isReal = (v) => v != null && !String(v).startsWith("dry-run:");

// Inserts one row; returns { id, status: "inserted" | "existing" | "skipped" }.
// "existing" = this legacy_mongo_id was already copied. "skipped" = blocked by another unique
// constraint (duplicate email, duplicate slot, ...), reported at the end.
async function insertRow(db, table, row, legacyId, natural) {
  const found = await db.query(`select id from ${table} where legacy_mongo_id = $1`, [legacyId]);
  if (found.rows[0]) return { id: found.rows[0].id, status: "existing" };
  if (DRY_RUN) {
    // Preview conflicts with rows that already exist in Supabase (e.g. same email signed up there)
    if (natural) {
      const owner = await db.query(`select id from ${table} where ${natural.column} = $1`, [natural.value]);
      if (owner.rows[0]) return { id: owner.rows[0].id, status: "skipped", mappedTo: owner.rows[0].id };
    }
    return { id: `dry-run:${legacyId}`, status: "inserted" };
  }

  const cols = Object.keys(row);
  const sql =
    `insert into ${table} (legacy_mongo_id, ${cols.join(", ")}) ` +
    `values ($1, ${cols.map((_, i) => `$${i + 2}`).join(", ")}) on conflict do nothing returning id`;
  const res = await db.query(sql, [legacyId, ...cols.map((c) => row[c])]);
  if (res.rows[0]) return { id: res.rows[0].id, status: "inserted" };

  // Blocked by a different unique constraint. If a natural key was given, map to the row that owns it.
  if (natural) {
    const owner = await db.query(`select id from ${table} where ${natural.column} = $1`, [natural.value]);
    if (owner.rows[0]) return { id: owner.rows[0].id, status: "skipped", mappedTo: owner.rows[0].id };
  }
  return { id: null, status: "skipped" };
}

function record(table, result, legacyId, reason) {
  const r = section(table);
  r.read += 1;
  if (result.status === "inserted") r.inserted += 1;
  else if (result.status === "existing") r.existing += 1;
  else r.skipped.push({ id: legacyId, reason: reason || "blocked by a unique constraint" });
}

// ── file handling ────────────────────────────────────────────────────────────
let storage; // backend/config/storage.js, loaded lazily (it is an ES module)
async function loadStorage() {
  if (!storage) storage = await import(pathToFileURL(path.join(BACKEND, "config", "storage.js")).href);
  return storage;
}

const MIME_BY_EXT = {
  ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime", ".m4v": "video/x-m4v", ".ogg": "video/ogg",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp",
};

// "/uploads/videos/abc.mp4" -> Storage URL (or the original value if the file is missing / skipped).
async function moveLocalUpload(value, bucket, folder, label) {
  if (SKIP_FILES || typeof value !== "string" || !value.startsWith("/uploads/")) return value;
  const full = path.resolve(BACKEND, "." + value);
  if (!full.startsWith(path.join(BACKEND, "uploads") + path.sep) || !fs.existsSync(full)) {
    warn(`${label}: local file not found, kept original path (${value})`);
    return value;
  }
  if (DRY_RUN) return value;
  const ext = path.extname(full).toLowerCase();
  const contentType = MIME_BY_EXT[ext];
  if (!contentType) {
    warn(`${label}: unsupported file type ${ext}, kept original path`);
    return value;
  }
  const s = await loadStorage();
  return s.uploadBuffer({ bucket, folder, buffer: fs.readFileSync(full), contentType, ext });
}

// base64 data URI -> Storage URL. http(s) links and empty values pass through.
async function moveInlineImage(value, folder, label) {
  if (SKIP_FILES || typeof value !== "string" || !value.startsWith("data:image/")) return value || "";
  if (DRY_RUN) return value;
  const s = await loadStorage();
  const url = await s.storeImageIfInline(value, folder);
  if (!url) warn(`${label}: unsupported inline image, stored empty`);
  return url;
}

// ── per-table migration ──────────────────────────────────────────────────────
async function main() {
  for (const key of ["MONGO_URI", "DATABASE_URL"]) {
    if (!process.env[key]) throw new Error(`${key} is not set (run with --env-file=backend/.env)`);
  }
  if (!SKIP_FILES && !DRY_RUN) {
    for (const key of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
      if (!process.env[key]) throw new Error(`${key} is not set (needed to upload files; use --skip-files to skip)`);
    }
  }
  if (/YOUR_DB_PASSWORD|<NEW_PASSWORD>/.test(process.env.MONGO_URI)) {
    throw new Error("MONGO_URI still contains a placeholder password");
  }

  console.log(DRY_RUN ? "DRY RUN - nothing will be written." : "LIVE RUN - writing to Supabase.");
  if (SKIP_FILES) console.log("--skip-files: legacy upload paths and base64 images are copied as-is.");

  const mongo = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  const pg = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
  await mongo.connect();
  await pg.connect();
  const mdb = mongo.db(); // database name comes from MONGO_URI
  const read = (name) => mdb.collection(name).find({}).toArray();

  // old ObjectId string -> new UUID
  const userMap = new Map();
  const programMap = new Map();
  const videoMap = new Map();

  // Each table runs in one transaction: if anything throws, that table is rolled back.
  const inTransaction = async (fn) => {
    await pg.query("begin");
    try {
      await fn(pg);
      await pg.query(DRY_RUN ? "rollback" : "commit");
    } catch (err) {
      await pg.query("rollback");
      throw err;
    }
  };

  // ── users ──
  await inTransaction(async (db) => {
    const docs = await read("users");
    const seenEmail = new Map(); // lowercase email -> first old id (collision guard)
    for (const u of docs) {
      const legacy = id(u._id);
      const email = str(u.email).toLowerCase().trim();
      if (!email) {
        record("users", { status: "skipped" }, legacy, "no email");
        continue;
      }
      if (seenEmail.has(email) && seenEmail.get(email) !== legacy) {
        // two Mongo accounts differ only by letter case: keep the first, point the second at it
        record("users", { status: "skipped" }, legacy, "duplicate email (differs only by case)");
        userMap.set(legacy, userMap.get(seenEmail.get(email)) ?? null);
        continue;
      }
      seenEmail.set(email, legacy);

      const role = oneOf(u.role, ROLES, null);
      if (!role) warn(`users ${legacy}: unknown role "${u.role}", using "patient"`);
      const row = {
        name: strOrNull(u.name),
        email,
        password: strOrNull(u.password),
        role: role || "patient",
        google_id: strOrNull(u.googleId),
        auth_provider: oneOf(u.authProvider, ["local", "google"], "local"),
        is_verified: Boolean(u.isVerified),
        profile_completed: Boolean(u.profileCompleted),
        profile_photo: str(u.profilePhoto),
        phone: str(u.phone),
        city: str(u.city),
        date_of_birth: str(u.dateOfBirth),
        gender: str(u.gender),
        blood_group: str(u.bloodGroup),
        current_condition: str(u.currentCondition),
        existing_conditions: str(u.existingConditions),
        past_surgeries: str(u.pastSurgeries),
        emergency_contact_name: str(u.emergencyContactName),
        emergency_contact_number: str(u.emergencyContactNumber),
        otp: strOrNull(u.otp),
        otp_expiry: u.otpExpiry ? date(u.otpExpiry) : null,
        otp_attempts: Number.isInteger(u.otpAttempts) ? u.otpAttempts : 0,
        otp_last_sent_at: u.otpLastSentAt ? date(u.otpLastSentAt) : null,
        verification_token: strOrNull(u.verificationToken),
        verification_token_expiry: u.verificationTokenExpiry ? date(u.verificationTokenExpiry) : null,
        created_at: date(u.createdAt),
        updated_at: date(u.updatedAt),
      };
      // google_id has its own unique index; email is the natural key we can map to
      const res = await insertRow(db, "users", row, legacy, { column: "email", value: email });
      userMap.set(legacy, res.id);
      record("users", res, legacy, res.mappedTo ? "email already exists in Supabase (mapped to it)" : undefined);
    }
  });

  // ── doctor_profiles ──
  await inTransaction(async (db) => {
    for (const p of await read("doctorprofiles")) {
      const legacy = id(p._id);
      const userId = userMap.get(id(p.user));
      if (!userId) {
        record("doctor_profiles", { status: "skipped" }, legacy, "user was not migrated");
        continue;
      }
      const row = {
        user_id: userId,
        experience: str(p.experience, "0 Years"),
        patients_count: str(p.patientsCount, "0+"),
        rating: Number(p.rating) || 0,
        fees: Number(p.fees) || 0,
        about: str(p.about),
        specialization: str(p.specialization, "Physiotherapist"),
        bio: str(p.bio),
        licence_number: str(p.licenceNumber),
        hospital_name: str(p.hospitalName),
        available_days: arr(p.availableDays),
        available_time_start: str(p.availableTimeStart),
        available_time_end: str(p.availableTimeEnd),
        languages: arr(p.languages),
        is_available: Boolean(p.isAvailable),
        created_at: date(p.createdAt),
        updated_at: date(p.updatedAt),
      };
      // doctor_profiles has no legacy_mongo_id column: match on its unique user_id instead
      const existing = isReal(userId)
        ? await db.query("select id from doctor_profiles where user_id = $1", [userId])
        : { rows: [] };
      if (existing.rows[0]) {
        record("doctor_profiles", { status: "existing" }, legacy);
        continue;
      }
      if (!DRY_RUN) {
        const cols = Object.keys(row);
        await db.query(
          `insert into doctor_profiles (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")})
           on conflict (user_id) do nothing`,
          cols.map((c) => row[c])
        );
      }
      record("doctor_profiles", { status: "inserted" }, legacy);
    }
  });

  // ── programs ──
  await inTransaction(async (db) => {
    for (const p of await read("programs")) {
      const legacy = id(p._id);
      const doctorId = userMap.get(id(p.doctorId));
      if (!doctorId) {
        record("programs", { status: "skipped" }, legacy, "doctor was not migrated");
        continue;
      }
      const code = str(p.programCode).toUpperCase().trim();
      const row = {
        doctor_id: doctorId,
        title: str(p.title, "Untitled program"),
        description: strOrNull(p.description),
        program_code: code,
        specialty: str(p.specialty, "General"),
        created_at: date(p.createdAt),
        updated_at: date(p.updatedAt),
      };
      const res = await insertRow(db, "programs", row, legacy, { column: "program_code", value: code });
      programMap.set(legacy, res.id);
      record("programs", res, legacy, res.mappedTo ? "program code already exists in Supabase (mapped to it)" : undefined);
    }
  });

  // ── program_enrollments (from users.enrolledPrograms[]) ──
  await inTransaction(async (db) => {
    const r = section("program_enrollments");
    for (const u of await read("users")) {
      const patientId = userMap.get(id(u._id));
      for (const oldProgram of u.enrolledPrograms || []) {
        r.read += 1;
        const programId = programMap.get(id(oldProgram));
        if (!patientId || !programId) {
          r.skipped.push({ id: `${id(u._id)}->${id(oldProgram)}`, reason: "user or program not migrated" });
          continue;
        }
        if (DRY_RUN) {
          r.inserted += 1;
          continue;
        }
        const res = await db.query(
          `insert into program_enrollments (patient_id, program_id) values ($1, $2)
           on conflict do nothing returning patient_id`,
          [patientId, programId]
        );
        if (res.rows[0]) r.inserted += 1;
        else r.existing += 1;
      }
    }
  });

  // ── appointments ──
  await inTransaction(async (db) => {
    for (const a of await read("appointments")) {
      const legacy = id(a._id);
      const patientId = userMap.get(id(a.patientId));
      const doctorId = userMap.get(id(a.doctorId));
      if (!patientId || !doctorId) {
        record("appointments", { status: "skipped" }, legacy, "patient or doctor was not migrated");
        continue;
      }
      const row = {
        patient_id: patientId,
        doctor_id: doctorId,
        date: str(a.date),
        time: str(a.time),
        status: oneOf(a.status, APPT_STATUS, "Pending"),
        notes: str(a.notes),
        session_number: intIn(a.sessionNumber, 0, 100000),
        problem_description: strOrNull(a.problemDescription),
        medicine: strOrNull(a.medicine),
        suggestion: strOrNull(a.suggestion),
        follow_up_needed: Boolean(a.followUpNeeded),
        follow_up_date: strOrNull(a.followUpDate),
        program_code: strOrNull(a.programCode),
        program_title: strOrNull(a.programTitle),
        patient_rating: intIn(a.patientRating, 1, 5),
        patient_feeling: oneOf(a.patientFeeling, FEELINGS, null),
        patient_review: strOrNull(a.patientReview),
        sent_to_patient: Boolean(a.sentToPatient),
        created_at: date(a.createdAt),
        updated_at: date(a.updatedAt),
      };
      const res = await insertRow(db, "appointments", row, legacy);
      record("appointments", res, legacy, "two active bookings for the same doctor/date/time");
    }
  });

  // ── videos (files -> Storage) ──
  await inTransaction(async (db) => {
    for (const v of await read("videos")) {
      const legacy = id(v._id);
      const doctorId = userMap.get(id(v.doctorId));
      if (!doctorId) {
        record("videos", { status: "skipped" }, legacy, "doctor was not migrated");
        continue;
      }
      const programId = v.programId ? programMap.get(id(v.programId)) : null;
      if (v.programId && !programId) {
        record("videos", { status: "skipped" }, legacy, "program was not migrated");
        continue;
      }
      // Only upload files for rows that are not already in Supabase
      const already = (await db.query("select 1 from videos where legacy_mongo_id = $1", [legacy])).rows[0];
      let url = str(v.url);
      let thumbnail = strOrNull(v.thumbnail);
      if (!already) {
        url = await moveLocalUpload(url, "videos", doctorId, `videos ${legacy}`);
        if (thumbnail) thumbnail = (await moveInlineImage(thumbnail, "thumbnails", `videos ${legacy} thumbnail`)) || null;
      }
      const row = {
        doctor_id: doctorId,
        program_id: programId,
        title: str(v.title, "Untitled video"),
        description: strOrNull(v.description),
        url,
        thumbnail,
        duration: str(v.duration, "0:00"),
        created_at: date(v.createdAt),
        updated_at: date(v.updatedAt),
      };
      const res = await insertRow(db, "videos", row, legacy);
      videoMap.set(legacy, res.id);
      record("videos", res, legacy);
    }
  });

  // ── session_logs ──
  await inTransaction(async (db) => {
    for (const s of await read("sessionlogs")) {
      const legacy = id(s._id);
      const patientId = userMap.get(id(s.patientId));
      if (!patientId) {
        record("session_logs", { status: "skipped" }, legacy, "patient was not migrated");
        continue;
      }
      const pain = intIn(s.painLevel, 1, 10);
      if (pain == null) {
        record("session_logs", { status: "skipped" }, legacy, `invalid painLevel ${s.painLevel}`);
        continue;
      }
      const row = {
        patient_id: patientId,
        video_id: s.videoId ? videoMap.get(id(s.videoId)) || null : null, // may be a dry-run placeholder
        pain_level: pain,
        date: date(s.date, date(s.createdAt)),
        created_at: date(s.createdAt),
        updated_at: date(s.updatedAt),
      };
      // session_logs has no legacy_mongo_id column in the schema, so de-duplicate on its content
      const dup = isReal(patientId) && (row.video_id == null || isReal(row.video_id))
        ? await db.query(
            "select 1 from session_logs where patient_id = $1 and date = $2 and pain_level = $3 and video_id is not distinct from $4",
            [patientId, row.date, pain, row.video_id]
          )
        : { rows: [] };
      if (dup.rows[0]) {
        record("session_logs", { status: "existing" }, legacy);
        continue;
      }
      if (!DRY_RUN) {
        const cols = Object.keys(row);
        await db.query(
          `insert into session_logs (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")})`,
          cols.map((c) => row[c])
        );
      }
      record("session_logs", { status: "inserted" }, legacy);
    }
  });

  // ── articles (base64 covers -> Storage) ──
  await inTransaction(async (db) => {
    for (const a of await read("articles")) {
      const legacy = id(a._id);
      const doctorId = userMap.get(id(a.doctorId));
      if (!doctorId) {
        record("articles", { status: "skipped" }, legacy, "doctor was not migrated");
        continue;
      }
      const already = (await db.query("select 1 from articles where legacy_mongo_id = $1", [legacy])).rows[0];
      const cover = already ? "" : await moveInlineImage(str(a.coverImage), "covers", `articles ${legacy} cover`);
      const row = {
        doctor_id: doctorId,
        title: str(a.title, "Untitled"),
        subtitle: str(a.subtitle),
        content: str(a.content),
        category: oneOf(a.category, CATEGORIES, "Wellness"),
        tags: arr(a.tags),
        cover_image: cover,
        status: oneOf(a.status, ["draft", "published"], "draft"),
        read_time: str(a.readTime, "1 min read"),
        views: Number.isInteger(a.views) ? a.views : 0,
        likes: Number.isInteger(a.likes) ? a.likes : 0,
        created_at: date(a.createdAt),
        updated_at: date(a.updatedAt),
      };
      const res = await insertRow(db, "articles", row, legacy);
      record("articles", res, legacy);
    }
  });

  // ── patient_notes ──
  await inTransaction(async (db) => {
    for (const n of await read("patientnotes")) {
      const legacy = id(n._id);
      const doctorId = userMap.get(id(n.doctorId));
      const patientId = userMap.get(id(n.patientId));
      if (!doctorId || !patientId) {
        record("patient_notes", { status: "skipped" }, legacy, "doctor or patient was not migrated");
        continue;
      }
      const existing = isReal(doctorId) && isReal(patientId)
        ? await db.query("select 1 from patient_notes where doctor_id = $1 and patient_id = $2", [doctorId, patientId])
        : { rows: [] };
      if (existing.rows[0]) {
        record("patient_notes", { status: "existing" }, legacy);
        continue;
      }
      if (!DRY_RUN) {
        await db.query(
          `insert into patient_notes (doctor_id, patient_id, note, created_at, updated_at)
           values ($1, $2, $3, $4, $5) on conflict (doctor_id, patient_id) do nothing`,
          [doctorId, patientId, str(n.note), date(n.createdAt), date(n.updatedAt)]
        );
      }
      record("patient_notes", { status: "inserted" }, legacy);
    }
  });

  // ── team_members (photos -> Storage) ──
  await inTransaction(async (db) => {
    for (const m of await read("teammembers")) {
      const legacy = id(m._id);
      if (!str(m.name).trim()) {
        record("team_members", { status: "skipped" }, legacy, "no name");
        continue;
      }
      const already = (await db.query("select 1 from team_members where legacy_mongo_id = $1", [legacy])).rows[0];
      let photo = strOrNull(m.photo);
      if (photo && !already) photo = await moveLocalUpload(photo, "images", "team", `team_members ${legacy} photo`);
      const row = {
        name: str(m.name).trim(),
        roll_number: strOrNull(m.rollNumber),
        year: strOrNull(m.year),
        degree: strOrNull(m.degree),
        about_project: strOrNull(m.aboutProject),
        hobbies: strOrNull(m.hobbies),
        certificate: strOrNull(m.certificate),
        internship: strOrNull(m.internship),
        about_you: strOrNull(m.aboutYou),
        photo,
        created_at: date(m.createdAt),
        updated_at: date(m.updatedAt),
      };
      const res = await insertRow(db, "team_members", row, legacy);
      record("team_members", res, legacy);
    }
  });

  await mongo.close();
  await pg.end();
}

function printReport() {
  console.log(`\n${DRY_RUN ? "Dry-run" : "Migration"} report`);
  console.log("table".padEnd(22) + "read".padStart(6) + "new".padStart(6) + "already".padStart(9) + "skipped".padStart(9));
  for (const [table, r] of Object.entries(report)) {
    console.log(
      table.padEnd(22) + String(r.read).padStart(6) + String(r.inserted).padStart(6) +
      String(r.existing).padStart(9) + String(r.skipped.length).padStart(9)
    );
  }
  for (const [table, r] of Object.entries(report)) {
    for (const s of r.skipped) console.log(`  skipped ${table} ${s.id}: ${s.reason}`);
  }
  if (warnings.length) {
    console.log(`\n${warnings.length} warning(s):`);
    for (const w of warnings) console.log("  - " + w);
  }
}

main()
  .then(() => {
    printReport();
    console.log(DRY_RUN ? "\nDry run finished. Nothing was written." : "\nMigration finished.");
  })
  .catch((err) => {
    // Never echo connection strings
    const msg = String(err?.message || err).replace(/(mongodb(\+srv)?|postgres(ql)?):\/\/\S+/gi, "<connection-string>");
    console.error("Migration failed:", msg);
    printReport();
    process.exit(1);
  });
