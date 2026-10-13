// Set VITE_API_BASE_URL in frontend/.env (local) or in Vercel → Project → Settings → Environment Variables.
// Example: VITE_API_BASE_URL=https://your-backend.onrender.com/api
export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api"
).replace(/\/$/, "");

// Backend origin without /api — used to build links to uploaded files (/uploads/...).
export const BACKEND_URL = API_BASE_URL.replace(/\/api$/, "");

// Show "Continue with Google" only when Google OAuth is configured on the backend.
export const GOOGLE_AUTH_ENABLED = import.meta.env.VITE_GOOGLE_AUTH_ENABLED === "true";
