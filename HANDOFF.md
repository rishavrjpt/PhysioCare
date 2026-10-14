# PhysioCare — Handoff Notes for Rishav Raj

This file explains what you are receiving, how to run it, what was tested, and what
**you must set up with your own accounts**. It contains no secrets.

> Replace the `<contact-email>` placeholder with your contact address as you take ownership.

---

## 1. What you are getting

A full-stack MERN application (React + Vite frontend, Express backend, Supabase Postgres + Storage).
Features: patient and physiotherapist portals, email-OTP signup, appointments,
rehabilitation programs, exercise videos, articles, and the optional "Cyan AI" assistant.
See `README.md` for features, structure and the API reference.

**No real credentials are included.** The previous owner's `.env` files were never
committed. You must create your own keys (section 4).

---

## 2. Run it locally

Requirements: Node.js 18+, npm, and a Supabase project (free tier works).

```bash
npm run install:all                   # installs root, backend and frontend deps
cp backend/.env.example  backend/.env
cp frontend/.env.example frontend/.env
# edit backend/.env — see section 3
npm run dev                           # backend :8080 + frontend :5173
```

Check: http://localhost:8080/api/health should return `{"ok":true}`.

Useful commands:

| Command | Where | Purpose |
|---|---|---|
| `npm run lint` | `frontend/` | ESLint |
| `npm run build` | root | Production build of the frontend |
| `npm start` | `backend/` | Start the API without nodemon |

---

## 3. Environment variables

### `backend/.env`
| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | Supabase **Session pooler** connection string (Dashboard → Connect) |
| `SUPABASE_URL` | ✅ | `https://<project-ref>.supabase.co` (used for Storage) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Backend only. Bypasses Row Level Security, never put it in the frontend |
| `JWT_SECRET` | ✅ | Long random string (generate command below) |
| `PORT` | | Default `8080`. Render sets it automatically. |
| `FRONTEND_URL` | ✅ in prod | Exact frontend origin(s), comma-separated, no trailing slash. Used for CORS. |
| `BACKEND_URL` | Google login | Public backend URL |
| `NODE_ENV` | ✅ in prod | Set to `production` when deployed |
| `EMAILJS_SERVICE_ID` / `EMAILJS_TEMPLATE_ID` / `EMAILJS_PUBLIC_KEY` / `EMAILJS_PRIVATE_KEY` | ✅ in prod | OTP emails |
| `GEMINI_API_KEY` or `ANTHROPIC_API_KEY` | optional | Enables Cyan AI. Leave both empty to disable. |
| `CHAT_MODEL` | optional | Model override for the active provider |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional | Google login. Leave empty to disable. |

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### `frontend/.env`
| Variable | Notes |
|---|---|
| `VITE_API_BASE_URL` | Backend URL **ending in `/api`**, e.g. `http://localhost:8080/api` |
| `VITE_GOOGLE_AUTH_ENABLED` | `true` only after Google OAuth is configured |

⚠️ `VITE_*` values are baked into the public JavaScript bundle. **Never put a secret there.**

### Behaviour worth knowing
- In `NODE_ENV=production` the backend **exits** if it cannot reach Postgres. In development it
  logs the failure and keeps running (database requests will then return 500).
- In development, OTPs are also returned in API responses (`devOtp`) and printed in the
  terminal when EmailJS is not configured. This is disabled when `NODE_ENV=production`.

---

## 4. Set up your own services

### Supabase
1. https://supabase.com → create a project. Note the database password.
2. **SQL Editor**: paste and run `supabase/migrations/20261014000000_init_physiocare.sql`
   (creates all tables, enums, indexes, `updated_at` triggers and enables Row Level Security with no
   policies; the backend uses the service role / postgres connection, which bypasses RLS).
3. **Project Settings → API**: copy the project URL (`SUPABASE_URL`) and the `service_role` key
   (`SUPABASE_SERVICE_ROLE_KEY`). **Connect → Session pooler**: copy the connection string
   (`DATABASE_URL`) and URL-encode special characters in the password.
4. Create the Storage buckets: from `backend/`, run `node --env-file=.env ../supabase/create-buckets.mjs`
   (creates public `videos` and `images` buckets).
5. The free tier limits uploads to 50 MB, which is why video uploads are capped at 50 MB.
6. Free projects pause after about a week of inactivity - restore from the dashboard if connections time out.

### EmailJS
1. https://dashboard.emailjs.com → **Email Services → Add New Service** (e.g. Gmail) → copy the **Service ID**.
2. **Email Templates → Create** a template using `{{to_name}}`, `{{to_email}}`, `{{otp}}`;
   set **To Email** to `{{to_email}}`. Copy the **Template ID**.
3. **Account → General → API keys**: copy **Public Key** and **Private Key**.
4. **Account → Security**: enable **Allow EmailJS API for non-browser applications**.

The code uses **one** template for every OTP email (signup and password reset).

### Gemini (Cyan AI, optional)
https://aistudio.google.com/app/apikey → **Create API key** → `GEMINI_API_KEY`.

---

## 5. What was tested (and what was not)

**Tested against the previous MongoDB version (before the Supabase migration; re-test on Supabase):**
- Frontend lint and production build; backend syntax and import check
- `npm audit`: 0 vulnerabilities in frontend and in backend production dependencies
- Health endpoint, CORS allow/deny
- Signup, OTP verify, login (incl. wrong password / unverified / wrong portal), forgot + reset password
- Doctor onboarding and listing; appointment booking, double-booking and past-date blocks,
  confirm, complete, send report, patient review
- Programs (enroll by code), articles, role and ownership access checks
- Production safety: backend exits when the database is unreachable

**NOT tested — verify these yourself:**
| Area | Why | How to check |
|---|---|---|
| **Supabase (Postgres + Storage)** | The migration was written without a live database connection | Follow the Supabase setup above, start the backend, look for `Postgres connected (Supabase)`, then upload a video and an article cover |
| **EmailJS delivery** | Real emails were not sent (quota and privacy) | Sign up with a real address; the OTP email should arrive |
| **Gemini / Cyan AI** | No key was exercised | Log in as a patient and ask the assistant a question |
| **Browser UI** | Only the API was tested, not the screens | Click through patient and doctor flows in the browser |
| **Google login** | Not configured | Optional |
| **Deployment** | Not deployed | Follow section 6 |

There is **no automated test suite** in this repository.

---

## 6. Deployment summary (Render + Vercel + Supabase)

1. **Render (backend)**: deploy via the root `render.yaml` Blueprint (Root Directory `backend`, Build `npm install`, Start `npm start`, health check `/api/health`).
   Set `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, EmailJS keys, optional AI keys, `FRONTEND_URL` and `BACKEND_URL` in the Render dashboard (`NODE_ENV=production` is set by the Blueprint).
   `DATABASE_URL` format (enter the real password only in Render, URL-encoding special characters, e.g. `@` → `%40`):
   `postgresql://postgres.<project-ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres`
2. **Vercel (frontend)**: Root Directory `frontend`, set `VITE_API_BASE_URL=https://<render-service>.onrender.com/api`.
3. Put the Vercel URL into Render's `FRONTEND_URL`, redeploy, then check `/api/health`.

Notes: uploaded videos, covers and team photos live in Supabase Storage, so they survive Render restarts.
Free instances sleep after inactivity (see the UptimeRobot note in `README.md`).

---

## 7. Security checklist for the new owner

- [ ] Created **new** Supabase database password, service role key, EmailJS keys, Gemini key and JWT secret (none reused from before)
- [ ] `backend/.env` and `frontend/.env` are not tracked by Git (`git ls-files | grep .env` shows only `*.example`)
- [ ] `NODE_ENV=production` on the server
- [ ] `SUPABASE_SERVICE_ROLE_KEY` exists only in backend env (never in `VITE_*` or committed files)
- [ ] Rotated any key that was ever shown in a screenshot or chat
- [ ] Decided on a license (none is included yet)

---

## 8. Contact

Owner: Rishav Raj · GitHub: `rishavrjpt` · Email: `<contact-email>`
