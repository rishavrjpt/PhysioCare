import { getPool } from "../config/pg.js";

// camelCase -> snake_case. Column names only ever come from code, never from request bodies.
const column = (key) => {
  const name = key.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
  if (!/^[a-z][a-z0-9_]*$/.test(name)) throw new Error(`Bad column name: ${key}`);
  return name;
};

const defined = (data) => Object.entries(data).filter(([, v]) => v !== undefined);

export const insertRow = async (table, data, db = getPool()) => {
  const entries = defined(data);
  if (!entries.length) return (await db.query(`insert into ${table} default values returning *`)).rows[0];
  const cols = entries.map(([k]) => column(k)).join(", ");
  const marks = entries.map((_, i) => `$${i + 1}`).join(", ");
  const sql = `insert into ${table} (${cols}) values (${marks}) returning *`;
  return (await db.query(sql, entries.map(([, v]) => v))).rows[0];
};

// Updates the given fields (undefined values are skipped). Returns the row, or null if none matched.
export const updateBy = async (table, whereColumn, value, data, db = getPool()) => {
  const entries = defined(data);
  if (!entries.length) {
    return (await db.query(`select * from ${table} where ${whereColumn} = $1`, [value])).rows[0] || null;
  }
  const sets = entries.map(([k], i) => `${column(k)} = $${i + 1}`).join(", ");
  const sql = `update ${table} set ${sets} where ${whereColumn} = $${entries.length + 1} returning *`;
  return (await db.query(sql, [...entries.map(([, v]) => v), value])).rows[0] || null;
};
