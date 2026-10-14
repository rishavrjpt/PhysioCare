import { one } from "../config/pg.js";
import { camelize } from "../utils/rows.js";
import { insertRow, updateBy } from "../utils/sql.js";
import { SAFE_USER_SELECT } from "../utils/sanitize.js";

export const findById = async (id) => camelize(await one("select * from users where id = $1", [id]));
export const findByEmail = async (email) => camelize(await one("select * from users where email = $1", [email]));
export const findByGoogleId = async (googleId) =>
  camelize(await one("select * from users where google_id = $1", [googleId]));
export const findByVerificationToken = async (token) =>
  camelize(await one(
    "select * from users where verification_token = $1 and verification_token_expiry > now()",
    [token]
  ));

// Same as findById but with secrets removed and enrolledPrograms attached.
export const findSafeById = async (id) =>
  camelize(await one(`select ${SAFE_USER_SELECT} from users where id = $1`, [id]));

export const createUser = async (data) => camelize(await insertRow("users", data));
export const updateUser = async (id, data, db) => camelize(await updateBy("users", "id", id, data, db));
