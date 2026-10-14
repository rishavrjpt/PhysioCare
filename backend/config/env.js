// One place that decides "are we in production?" so CORS, OTP exposure, email fallback and
// database-failure handling can never disagree with each other.
//
// Production = NODE_ENV is "production" (case/whitespace-insensitive) OR the process is running
// on Render (Render always sets RENDER=true). The Render check means a missing or mistyped
// NODE_ENV in the dashboard can no longer silently put a public server into development mode.
// Local development is unaffected: neither condition is true on a laptop.

const isTrue = (value, expected) => String(value ?? "").trim().toLowerCase() === expected;

export const isProduction = (env = process.env) =>
  isTrue(env.NODE_ENV, "production") || isTrue(env.RENDER, "true");

// "https://a.com/, https://b.com" -> ["https://a.com", "https://b.com"]
export const parseOrigins = (value) =>
  String(value ?? "")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);

// A browser Origin is scheme://host[:port] only. Anything else in FRONTEND_URL (a path, "*", a
// missing scheme) can never match and is reported by validateFrontendOrigins().
const isValidOrigin = (value) => {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && url.origin === value;
  } catch {
    return false;
  }
};

export const validateFrontendOrigins = (env = process.env) => {
  const origins = parseOrigins(env.FRONTEND_URL);
  return {
    valid: origins.filter(isValidOrigin),
    invalid: origins.filter((o) => !isValidOrigin(o)),
  };
};

const LOCAL_ORIGIN_RE = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

// Origins that are always accepted when NOT in production (the Vite dev server).
const DEV_DEFAULTS = ["http://localhost:5173", "http://127.0.0.1:5173"];

export const isOriginAllowed = (origin, env = process.env) => {
  if (!origin) return true; // non-browser clients (curl, server-to-server) send no Origin header
  if (validateFrontendOrigins(env).valid.includes(origin)) return true;
  if (isProduction(env)) return false; // production: only the explicitly configured frontend(s)
  return DEV_DEFAULTS.includes(origin) || LOCAL_ORIGIN_RE.test(origin); // dev: Vite may use 5174, 5175...
};

// Plug into cors({ origin: corsOrigin() }).
export const corsOrigin = (env = process.env) => (origin, cb) => cb(null, isOriginAllowed(origin, env));

// Development-only OTP echo for the API response. Always undefined in production.
export const exposeDevOtp = (otp, env = process.env) => (isProduction(env) ? undefined : otp);
