// Set VITE_API_BASE_URL in frontend/.env (local) or in Vercel → Project → Settings → Environment Variables.
// Example: VITE_API_BASE_URL=https://your-backend.onrender.com/api
// Fallback when the variable is unset: the Render backend in production builds, localhost in dev.
const DEFAULT_API_BASE_URL = import.meta.env.PROD
  ? "https://physiocare-20zq.onrender.com/api"
  : "http://localhost:8080/api";

// VITE_API_BASE_URL is the documented name; VITE_API_URL is accepted too because it is the name
// many hosting dashboards use. Vite inlines these at BUILD time, so changing one on Vercel only
// takes effect after a new deployment.
const rawApiUrl = (
  import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || DEFAULT_API_BASE_URL
).trim().replace(/\/+$/, "");

// Accept both ".../api" and the bare backend origin, without ever producing ".../api/api".
export const API_BASE_URL = /\/api$/.test(rawApiUrl) ? rawApiUrl : `${rawApiUrl}/api`;

// Backend origin without /api — used to build links to uploaded files (/uploads/...).
export const BACKEND_URL = API_BASE_URL.replace(/\/api$/, "");

// Show "Continue with Google" only when Google OAuth is configured on the backend.
export const GOOGLE_AUTH_ENABLED = import.meta.env.VITE_GOOGLE_AUTH_ENABLED === "true";
