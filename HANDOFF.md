# PhysioCare — Handoff Notes for Rishav Raj

This file explains what you are receiving, how to run it, what was tested, and what
**you must set up with your own accounts**. It contains no secrets.

> Replace the `<contact-email>` placeholder with your contact address as you take ownership.

---

## 1. What you are getting

A full-stack MERN application (React + Vite frontend, Express + MongoDB backend).
Features: patient and physiotherapist portals, email-OTP signup, appointments,
rehabilitation programs, exercise videos, articles, and the optional "Cyan AI" assistant.
See `README.md` for features, structure and the API reference.

**No real credentials are included.** The previous owner's `.env` files were never
committed. You must create your own keys (section 4).

---

## 2. Run it locally

Requirements: Node.js 18+, npm, and a MongoDB database (Atlas free tier or local).

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
| `MONGO_URI` | ✅ | Atlas string; keep `/physiocare` as the database name |
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
- In `NODE_ENV=production` the backend **exits** if it cannot reach MongoDB (no silent fallback).
- In development, a failed Atlas connection falls back to `mongodb://127.0.0.1:27017/physiocare`.
- In development, OTPs are also returned in API responses (`devOtp`) and printed in the
  terminal when EmailJS is not configured. This is disabled when `NODE_ENV=production`.

---

## 4. Set up your own services

### MongoDB Atlas
1. https://cloud.mongodb.com → create a project and a free **M0** cluster.
2. **Security → Database Access → Add New Database User**: password authentication, a long
   random password, role **Read and write to any database** (or `readWrite` on `physiocare`). Avoid *Atlas Admin*.
3. **Security → Network Access → Add IP Address**:
   - Local work: **Add Current IP Address**.
   - Render: Atlas free tier cannot restrict to Render's changing IPs, so you will
     need `0.0.0.0/0` ("Allow access from anywhere"). This is safe only with a strong
     database password. Upgrade to a paid Render plan with static outbound IPs to restrict further.
4. **Database → Connect → Drivers** → copy the string, put the password in, add `/physiocare`
   before `?`. URL-encode special characters in the password.

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

**Tested and passing (local MongoDB, throwaway database, EmailJS/AI disabled):**
- Frontend lint and production build; backend syntax and import check
- `npm audit`: 0 vulnerabilities in frontend and in backend production dependencies
- Health endpoint, CORS allow/deny
- Signup, OTP verify, login (incl. wrong password / unverified / wrong portal), forgot + reset password
- Doctor onboarding and listing; appointment booking, double-booking and past-date blocks,
  confirm, complete, send report, patient review
- Programs (enroll by code), articles, role and ownership access checks
- Production safety: backend exits when MongoDB is unreachable

**NOT tested — verify these yourself:**
| Area | Why | How to check |
|---|---|---|
| **MongoDB Atlas** | Connection from the previous owner's machine failed because the IP was not in Network Access | Set up Atlas (above), start the backend, look for `MongoDB Connected` |
| **EmailJS delivery** | Real emails were not sent (quota and privacy) | Sign up with a real address; the OTP email should arrive |
| **Gemini / Cyan AI** | No key was exercised | Log in as a patient and ask the assistant a question |
| **Browser UI** | Only the API was tested, not the screens | Click through patient and doctor flows in the browser |
| **Google login** | Not configured | Optional |
| **Deployment** | Not deployed | Follow section 6 |

There is **no automated test suite** in this repository.

---

## 6. Deployment summary (Render + Vercel + Atlas)

1. **Render (backend)**: Web Service, Root Directory `backend`, Build `npm install`, Start `node server.js`.
   Set `NODE_ENV=production`, `MONGO_URI`, `JWT_SECRET`, EmailJS keys, optional AI keys, `FRONTEND_URL`.
2. **Vercel (frontend)**: Root Directory `frontend`, set `VITE_API_BASE_URL=https://<render-service>.onrender.com/api`.
3. Put the Vercel URL into Render's `FRONTEND_URL`, redeploy, then check `/api/health`.

Notes: Render's free disk is wiped on restart, so uploaded videos and team photos disappear.
Free instances sleep after inactivity (see the UptimeRobot note in `README.md`).

---

## 7. Security checklist for the new owner

- [ ] Created **new** Atlas user/password, EmailJS keys, Gemini key and JWT secret (none reused from before)
- [ ] `backend/.env` and `frontend/.env` are not tracked by Git (`git ls-files | grep .env` shows only `*.example`)
- [ ] `NODE_ENV=production` on the server
- [ ] Atlas user is not *Atlas Admin*
- [ ] Rotated any key that was ever shown in a screenshot or chat
- [ ] Decided on a license (none is included yet)

---

## 8. Contact

Owner: Rishav Raj · GitHub: `rishavrjpt` · Email: `<contact-email>`
