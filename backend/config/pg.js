import pg from "pg";

// numeric (rating, fees) and int8 (counts) come back as strings by default.
pg.types.setTypeParser(1700, (v) => parseFloat(v));
pg.types.setTypeParser(20, (v) => parseInt(v, 10));

export const UNIQUE_VIOLATION = "23505";
export const FOREIGN_KEY_VIOLATION = "23503";

// Never log the URL itself - it contains the database password.
const safeMessage = (err) =>
  String(err?.message || err).replace(/postgres(ql)?:\/\/\S+/gi, "<database-url>");

// Created on first use, so import order relative to dotenv does not matter.
let pool;
export const getPool = () => {
  if (!pool) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // Supabase pooler uses TLS
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    pool.on("error", (err) => console.error("[Postgres] idle client error:", safeMessage(err)));
  }
  return pool;
};

export const query = (text, params) => getPool().query(text, params);
export const many = async (text, params) => (await query(text, params)).rows;
export const one = async (text, params) => (await query(text, params)).rows[0] || null;

// Runs fn(client) inside BEGIN/COMMIT, rolling back if it throws.
export const withTransaction = async (fn) => {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
};

export const connectDB = async () => {
  try {
    await getPool().query("select 1");
    console.log("Postgres connected (Supabase)");
  } catch (error) {
    console.error("Postgres connection failed:", safeMessage(error));
    if (process.env.NODE_ENV === "production") {
      console.error("[Postgres] Exiting. Check DATABASE_URL.");
      process.exit(1);
    }
    console.warn("Server will continue running. Check DATABASE_URL in backend/.env.");
  }
};

export { safeMessage };
