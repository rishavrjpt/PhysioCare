import jwt from "jsonwebtoken";
import { one } from "../config/pg.js";
import { isUuid } from "../utils/rows.js";

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return secret;
};

export const signToken = (user) =>
  jwt.sign({ id: String(user._id ?? user.id), role: user.role }, getJwtSecret(), { expiresIn: "1d" });

const readBearer = (req) => {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : null;
};

const loadUserFromToken = async (token) => {
  const decoded = jwt.verify(token, getJwtSecret());
  if (!isUuid(decoded.id)) return null; // old MongoDB-era tokens are rejected, user logs in again
  const user = await one("select id, role, name, email from users where id = $1", [decoded.id]);
  if (!user) return null;
  return { id: user.id, role: user.role, name: user.name, email: user.email };
};

// Requires a valid JWT. Sets req.user = { id, role, name, email }.
export const protect = async (req, res, next) => {
  const token = readBearer(req);
  if (!token) return res.status(401).json({ msg: "Not logged in. Please log in again." });
  try {
    const user = await loadUserFromToken(token);
    if (!user) return res.status(401).json({ msg: "Account not found. Please log in again." });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ msg: "Session expired. Please log in again." });
  }
};

// Sets req.user if a valid token is present, but never blocks the request.
export const optionalAuth = async (req, res, next) => {
  const token = readBearer(req);
  if (token) {
    try {
      req.user = (await loadUserFromToken(token)) || undefined;
    } catch {
      req.user = undefined;
    }
  }
  next();
};

// Use after protect: requireRole("doctor"), requireRole("patient", "admin") ...
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ msg: "You do not have permission to do this." });
  }
  next();
};

// Use after protect on routes with an :id-style param that must be the logged-in user.
export const requireSelf = (param = "id") => (req, res, next) => {
  if (req.user.role === "admin" || req.params[param] === req.user.id) return next();
  return res.status(403).json({ msg: "You can only access your own data." });
};

// Rejects malformed IDs (must be UUIDs) in route params with 400 instead of a 500.
export const validateObjectIds = (req, res, next) => {
  for (const [key, value] of Object.entries(req.params || {})) {
    if (/id$/i.test(key) && !isUuid(value)) {
      return res.status(400).json({ msg: `Invalid ${key}.` });
    }
  }
  next();
};
