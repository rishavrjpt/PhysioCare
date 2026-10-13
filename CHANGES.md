# What was fixed

A summary of every fix made to PhysioCare, grouped by importance.

## 🔴 Critical — security

| Problem | Fix |
|---|---|
| `authMiddleware.js` was an empty file, so **no API route checked who was calling**. Anyone could read any patient's medical data or edit/delete anything. | Wrote the middleware (`protect`, `requireRole`, `requireSelf`, `optionalAuth`). Every private route now requires a valid token and checks ownership. |
| `GET /api/auth/:id` and `GET /api/doctors` returned the **OTP**, 2FA secret and verification token → anyone could reset anyone's password. | Sensitive fields are never returned (`utils/sanitize.js`). |
| Signup accepted `role: "admin"` from the request. | Only `patient` or `doctor` can be chosen. |
| IDs like `patientId` / `doctorId` were taken from the request body. | Always taken from the logged-in user's token. |
| JWT secret fell back to the string `"secret"`. | Server refuses to start without `JWT_SECRET`. |
| OTP used `Math.random()`, no attempt limit, no rate limit. | `crypto.randomInt`, 5 wrong tries max, rate limiting on auth routes. |
| EmailJS private key hardcoded in the code. | Moved to `.env` (`EMAILJS_*`). **Revoke the old key in EmailJS.** |
| CORS open to every website. | Only `FRONTEND_URL` and localhost are allowed. |
| Video upload accepted any file type (HTML, scripts). | Only video types; uploaded files are served safely. |
| Google token sent in the URL query (ends up in server logs). | Sent in the URL fragment (`#`) and removed from the address bar. |
| Google login could be linked to an unverified email account someone else registered. | The unverified account's password is removed when Google proves ownership. |
| `PATCH /articles/:id` let a doctor change any field (views, owner). | Only editable fields are accepted. |

## 🟠 Bugs that broke features

| Problem | Fix |
|---|---|
| Uploads failed on a fresh clone / new Render deploy (`uploads/` folder didn't exist). | Folders are created at startup, using absolute paths. |
| File delete / upload paths depended on the folder the server was started from. | Absolute paths everywhere (`config/paths.js`). |
| Server **crashed at startup** if Google OAuth keys were missing. | Google login is only enabled when configured. |
| Logging in to a Google-created account with a password → 500 error. | Clear message instead. |
| Missing email/password on login → 500 error. | 400 with a message. |
| Emails with capital letters broke login ("User not found"). | Emails stored lowercase; old accounts still match. |
| Program codes only worked in UPPERCASE. | Codes are case-insensitive. |
| Typing `(` or `*` in the city filter crashed the doctor search. | Input is escaped. |
| Invalid IDs in URLs gave 500 errors. | 400 "Invalid id". |
| The same doctor time slot could be booked twice; past dates allowed. | Both blocked. |
| Session number counted sessions with all doctors and changed if an appointment was completed twice. | Counts only this doctor, stays stable. |
| Any program code could be attached to a report. | Only the doctor's own programs. |
| A doctor could not clear a patient note (empty note rejected). | Allowed. |
| Article views were never counted. | Counted on each public view. |
| High-resolution video thumbnails could fail the upload ("Field value too long"). | Field limit raised to 5 MB. |
| Default port was 5001 but the docs and Google callback use 8080. | Default is 8080. |
| Frontend decoded tokens with `atob`, which can crash on some tokens (base64url). | `decodeToken()` in `utils/auth.js`. |
| Expired login (after 1 day) left dashboards silently empty. | Dashboards are protected; expired sessions go to login with a message. |
| `VerifyEmail` navigated to `/login`, a route that doesn't exist. | Goes to `/patient`. |
| Doctor Reports always showed "Doctor" instead of the name. | Reads the name from the right field. |
| Videos page and Home counted "adherence" differently. | Same rule on both. |
| Backend URL was hardcoded in `config.js`. | Reads `VITE_API_BASE_URL`. |
| Enter key did nothing on the login forms. | Enter submits. |
| Logout left cached dashboard data in the browser. | Cleared on logout. |
| Google login button code existed but was never shown. | Shown when `VITE_GOOGLE_AUTH_ENABLED=true`. |
| Unknown URLs showed a blank page. | They show the home page. |

## 🟡 Cleanup

- `backend/` and `frontend/` restored as real folders (they were broken submodules — the GitHub repo showed them empty).
- Removed `.gitnore` (typo), `.DS_Store`, `deletePrince.js`, a duplicate `doctorSignUp.CSS`, an unused PDF, and the default Vite README.
- Removed unused packages: `nodemailer`, `speakeasy`, `express-session`; root `leaflet`/`react-leaflet`.
- Root `package.json` now runs both apps with `npm run dev` (it had no `concurrently` before).
- Added `.env.example` files, a proper `.gitignore`, a `/api/health` endpoint, a central error handler and JSON 404s.
- Fixed all ESLint errors in the frontend.
- README rewritten to match the real code (removed the 2FA claim — it was never implemented).

## ✅ How it was tested

- **95 automated API checks** (signup → OTP → login → onboarding → booking → completing → reports → programs → videos → articles, plus every "someone else's data" case returning 401/403) — all pass.
- **15 browser checks** with a real Chromium on the built frontend (login, onboarding, dashboard, enrolling, doctor pages, expired-token redirect, Google callback) — all pass, no console errors.
- `npm run build` and `npm run dev` both work.
