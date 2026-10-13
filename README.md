# 🏥 PhysioCare — Digital Physiotherapy Management System

> A full-stack MERN application that connects patients with certified physiotherapists: appointment booking, rehabilitation programs, exercise video libraries, health articles and session reports.

> 📦 **Taking over this project?** Read [`HANDOFF.md`](HANDOFF.md) first — it lists what was tested, what was not, and the accounts you must set up.

---

## 🧾 Overview

PhysioCare is a role-based digital health platform with two user types — **Patients** and **Physiotherapists (Doctors)** — each with their own dashboard and permissions.

Patients can find doctors, book appointments, join rehabilitation programs with a code, watch exercise videos, log pain levels and read articles. Physiotherapists can manage appointments, write session reports, create programs, upload videos, publish articles and keep private notes on their patients.

---

## 🛠 Tech Stack

**Frontend:** React 19, Vite 7, React Router 7, Tailwind CSS 4, React Icons

**Backend:** Node.js 18+, Express 5, MongoDB + Mongoose 9, JSON Web Tokens, bcryptjs, Multer (uploads), Passport (Google OAuth, optional), EmailJS REST API (OTP emails), express-rate-limit

---

## ✨ Features

### 👤 Patient
- Signup / login with **email OTP verification**, forgot / reset password
- Google login (optional — enable it in the env files)
- Profile onboarding — personal info, medical history, emergency contact
- Browse doctors (filtered by your city), view profiles and availability
- Book, view and cancel appointments; read session reports sent by the doctor
- Review completed sessions (rating, feeling Better / Same / Worse, feedback)
- Enroll in rehabilitation programs with a 6-character code (not case-sensitive)
- Watch exercise videos, log pain level per session
- Read published health articles
- **Cyan AI Assistant** — Ask questions about recovery exercises, posture tips, and mobility with real-time streaming answers powered by Google Gemini or Anthropic Claude (whichever key you configure)

### 🩺 Physiotherapist
- Separate signup / login portal with email OTP verification
- Profile onboarding — specialization, licence number, hospital, schedule, languages
- Toggle availability on / off
- Confirm or cancel appointments; complete them with a session report (notes, medicine, suggestions, follow-up date, assigned program)
- Send the report to the patient
- Create rehabilitation programs (unique code auto-generated); deleting a program also deletes its videos
- Upload exercise videos (file or link) to a program or the general library
- Write articles (draft / published, categories, cover image)
- View patients, keep private notes per patient, analytics dashboard

---

## 📁 Project Structure

```
PhysioCare/
├── backend/
│   ├── config/
│   │   ├── db.js                  # MongoDB connection
│   │   ├── emailService.js        # EmailJS OTP emails (keys from .env)
│   │   ├── googleAuthConfig.js    # Google OAuth (only if configured)
│   │   └── paths.js               # Upload folders (created automatically)
│   ├── controllers/               # Route logic + ownership checks
│   ├── middleware/
│   │   └── authMiddleware.js      # JWT check, roles, ownership helpers
│   ├── models/                    # Mongoose schemas
│   ├── routes/                    # Express routers
│   ├── utils/                     # Sanitizing + doctor–patient relation helpers
│   ├── uploads/                   # Created at runtime (git-ignored)
│   ├── .env.example
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── components/            # Layouts, sidebars, modals, RequireAuth
│   │   ├── pages/                 # Patient pages + pages/doctor/*
│   │   ├── utils/auth.js          # Token decoding + adds token to API calls
│   │   ├── config.js              # Reads VITE_API_BASE_URL
│   │   └── App.jsx                # Routes (dashboards are login-protected)
│   ├── .env.example
│   └── vercel.json
├── .gitignore
└── package.json                   # Runs backend + frontend together
```

---

## 🚀 Getting Started (Local)

**You need:** Node.js 18 or newer, npm, and a MongoDB database (a free MongoDB Atlas cluster works).

### 1. Install everything
```bash
git clone https://github.com/rishavrjpt/PhysioCare.git
cd PhysioCare
npm run install:all
```

### 2. Create the env files
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```
Open `backend/.env` and set at least **`MONGO_URI`** and **`JWT_SECRET`**. Generate a secret with:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

> 💡 If you leave the EmailJS keys empty, the OTP is **printed in the backend terminal** so you can still sign up and test locally.

### 3. Run
```bash
npm run dev
```
- Backend: http://localhost:8080 (health check: http://localhost:8080/api/health)
- Frontend: http://localhost:5173

---

## 🔐 Environment Variables

### `backend/.env`
| Variable | Required | Description |
|---|---|---|
| `MONGO_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | Long random string used to sign login tokens. The server will not start without it. |
| `PORT` | | Default `8080` |
| `FRONTEND_URL` | ✅ in production | Frontend URL(s), comma-separated. Only these can call the API (CORS). |
| `BACKEND_URL` | For Google login | Public backend URL, used for the OAuth callback |
| `NODE_ENV` | | `production` on Render |
| `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID`, `EMAILJS_PUBLIC_KEY`, `EMAILJS_PRIVATE_KEY` | ✅ in production | EmailJS keys for OTP emails. Template variables: `{{to_name}}`, `{{to_email}}`, `{{otp}}` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | | Leave empty to disable Google login |
| `GEMINI_API_KEY` | | Enables the Cyan AI assistant with Google Gemini (checked first) |
| `ANTHROPIC_API_KEY` | | Enables Cyan AI with Claude if no Gemini key is set |
| `CHAT_MODEL` | | Optional model name override for the active AI provider |

### `frontend/.env`
| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Backend URL ending in `/api`, e.g. `https://your-backend.onrender.com/api` |
| `VITE_GOOGLE_AUTH_ENABLED` | `true` to show the "Continue with Google" button |

> ⚠️ Never commit `.env` files. They are already in `.gitignore`.

### MongoDB Atlas setup
1. Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. **Database Access** → add a database user with the **Read and write to any database** role (or `readWrite` on `physiocare` only). Avoid the "Atlas Admin" role.
3. **Network Access** → add your current IP for local work. For Render/Vercel hosting add `0.0.0.0/0` (and rely on a strong DB password).
4. **Database → Connect → Drivers** → copy the connection string and paste it into `MONGO_URI` in `backend/.env`, replacing `<db_password>` with the real password and adding `/physiocare` as the database name. URL-encode special characters in the password (`@` → `%40`).

### JWT secret
`JWT_SECRET` signs login tokens. Use a unique random value per environment (command above) and never reuse it between projects.

### EmailJS setup
1. Create a free account at emailjs.com, add an email service (e.g. Gmail) and a template that uses `{{to_name}}`, `{{to_email}}` and `{{otp}}`. Set the template's "To Email" to `{{to_email}}`.
2. Copy the **Service ID** (Email Services) and **Template ID** (Email Templates).
3. Account → **API keys**: copy the Public Key and Private Key.
4. Account → **Security**: enable **"Allow EmailJS API for non-browser applications"** (required, because emails are sent from the backend).

> The backend reads a single `EMAILJS_TEMPLATE_ID` and uses it for every OTP email (signup verification and password reset).

### Cyan AI (optional)
Create a free key at [Google AI Studio](https://aistudio.google.com/app/apikey) and set `GEMINI_API_KEY`, or use an Anthropic key in `ANTHROPIC_API_KEY`. Leave both empty to disable the assistant.

### Security notes
- Real secrets live only in `backend/.env` (git-ignored). Never paste them in code, issues, chat or screenshots.
- If a key or password was ever shared or committed, **rotate it** in the provider's dashboard (EmailJS → Refresh Keys, Atlas → Database Access → edit password, Google AI Studio → delete/create key).

---

## ☁️ Deployment

### Backend → Render
1. New **Web Service** → connect the repo
2. **Root Directory:** `backend` · **Build:** `npm install` · **Start:** `node server.js`
3. Add all variables from `backend/.env` (with `NODE_ENV=production`)
4. Deploy, then open `https://<your-backend>.onrender.com/api/health` — it should return `{"ok":true}`

> ⚠️ Render's free disk is wiped on every redeploy/restart, so **uploaded videos and team photos will disappear**. For a real deployment, store files on Cloudinary or S3, or use video links (YouTube etc.).

### Frontend → Vercel
1. New Project → import the repo, **Root Directory:** `frontend`
2. Environment variable: `VITE_API_BASE_URL=https://<your-backend>.onrender.com/api`
3. Deploy
4. Back on Render, set `FRONTEND_URL=https://<your-app>.vercel.app` and redeploy

### Google OAuth (optional)
In Google Cloud Console:
- Authorized JavaScript origin: `https://<your-app>.vercel.app`
- Authorized redirect URI: `https://<your-backend>.onrender.com/api/auth/google/callback`

Then set the Google keys on Render and `VITE_GOOGLE_AUTH_ENABLED=true` on Vercel.

---

## 📡 API Reference

Private routes need the header `Authorization: Bearer <token>`. The frontend adds it automatically.
**Access:** 🌐 public · 🔑 any logged-in user · 🧑 patient · 🩺 doctor · 👑 admin. "Own" means the logged-in user must own the data.

### Auth — `/api/auth`
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/signup` | 🌐 | Register (`role`: `patient` or `doctor` only) |
| POST | `/verify-otp` | 🌐 | Verify email with OTP → returns token |
| POST | `/resend-otp` | 🌐 | Send a new OTP |
| POST | `/login` | 🌐 | Login (`expectedRole` blocks the wrong portal) |
| POST | `/forgot-password` | 🌐 | Email a reset OTP |
| POST | `/reset-password` | 🌐 | Reset password with OTP |
| GET | `/:id` | 🔑 own / treating doctor | Get user profile (no secrets) |
| PATCH | `/:id/complete-profile` | 🔑 own | Save onboarding profile |
| GET | `/google/patient`, `/google/doctor` | 🌐 | Start Google login |

Auth routes are rate-limited (30 requests / 15 min per IP). An OTP expires after 10 minutes or 5 wrong tries.

### Doctors — `/api/doctors`
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/?city=` | 🌐 | List verified doctors |
| GET | `/:id` | 🌐 | Doctor profile |
| PUT | `/:id/profile` | 🩺 own | Update profile |
| PATCH | `/:id/availability` | 🩺 own | Toggle availability |
| GET | `/patient-note/:doctorId/:patientId` | 🩺 | Get your note on a patient |
| POST | `/patient-note` | 🩺 | Save note (patient must be under your care) |

### Appointments — `/api/appointments` (all 🔑)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/` | 🧑 | Book (blocks past dates and double-booking) |
| GET | `/doctor/:id` | 🩺 own | Doctor's appointments |
| GET | `/patient/:id` | 🧑 own | Patient's appointments |
| PATCH | `/:id/status` | 🩺 own · 🧑 cancel only | Update status |
| POST | `/:id/complete` | 🩺 own | Complete with session report |
| POST | `/:id/review` | 🧑 own | Review a completed session |
| PATCH | `/:id/send-to-patient` | 🩺 own | Share the report |

### Programs — `/api/programs` (all 🔑)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/` | 🩺 | Create (code auto-generated) |
| GET | `/doctor/:doctorId` | 🩺 own | Your programs |
| POST | `/enroll` | 🧑 | Enroll with a code |
| GET | `/patient/:patientId` | 🧑 own / treating doctor | Enrolled programs |
| DELETE | `/:id` | 🩺 own | Delete program + its videos |
| GET | `/:id/patients` | 🩺 own | Enrolled patients |

### Videos — `/api/videos`
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/general` | 🌐 | General video library |
| GET | `/general/doctor/:doctorId` | 🌐 | A doctor's general videos |
| GET | `/program/:programId` | 🔑 program's doctor / enrolled patient | Program videos |
| POST | `/` | 🩺 | Upload (mp4/webm/mov/m4v/ogg, max 100 MB) or add an http(s) link |
| PUT | `/:id` | 🩺 own | Edit title/description/duration |
| DELETE | `/:id` | 🩺 own | Delete video and file |
| POST | `/log-session` | 🧑 | Log pain level (1–10) |

### Articles — `/api/articles`
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/published` | 🌐 | Published articles (no images) |
| GET | `/covers` | 🌐 | Cover images (lazy-loaded) |
| GET | `/:id` | 🌐 published · 🩺 own drafts | Single article (counts a view) |
| POST | `/` | 🩺 | Create |
| GET | `/doctor/:id` | 🩺 own | Your articles incl. drafts |
| PATCH | `/:id` | 🩺 own | Update |
| DELETE | `/:id` | 🩺 own | Delete |

### Team — `/api/members`
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/`, `/:id` | 🌐 | Team members |
| POST | `/` | 🔑 | Add member (image upload) |
| DELETE | `/:id` | 👑 | Delete member |

### Cyan AI Assistant — `/api/chat`
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/status` | 🌐 | Checks if Cyan AI is configured (`{ enabled: Boolean }`) |
| POST | `/stream` | 🧑 (patient) | SSE streaming recovery Q&A with emergency symptom detection |

> **⚠️ Medical Disclaimer:** Cyan AI provides general wellness, posture, and exercise information. It does not provide medical diagnoses or prescribe medications. In case of emergency or severe symptoms, seek urgent medical care immediately.

---

## 🗄 Database Models

- **User** — name, email (lowercase, unique), password (bcrypt), role (`patient` / `doctor` / `admin`), enrolledPrograms, Google fields, verification + OTP fields, profile + patient medical fields, timestamps
- **DoctorProfile** — user, experience, fees, bio, specialization, licenceNumber, hospitalName, availableDays, time range, languages, isAvailable
- **Appointment** — patientId, doctorId, date, time, status, notes, session report fields, programCode/Title, review fields, sentToPatient
- **Program** — doctorId, title, description, programCode (unique), specialty
- **Video** — doctorId, programId (null = general), title, description, url, thumbnail, duration
- **Article** — doctorId, title, subtitle, content, category, tags, coverImage, status, readTime, views, likes
- **SessionLog** — patientId, videoId, painLevel (1–10), date
- **PatientNote** — doctorId, patientId, note (unique per doctor + patient)
- **TeamMember** — name, roll number, year, degree, about, hobbies, photo

### Creating an admin
Admins can't sign up through the app. Create a normal account, then in MongoDB Atlas change that user's `role` to `"admin"`.

---

## ⚡ Keep the Server Awake (Free-plan deployment)

Free-tier hosting providers (such as Render) put instances to sleep after 15 minutes of inactivity, causing cold starts that can take up to a minute.

To keep your backend awake 24/7 without delays:
1. Create a free account at [UptimeRobot](https://uptimerobot.com).
2. Add a new **HTTP(s)** monitor for:
   ```
   https://<your-backend-domain>/api/health
   ```
3. Set the monitoring interval to **every 10 minutes**.

---

## 🛠 Troubleshooting

| Problem | Likely cause / fix |
|---|---|
| Backend exits: `JWT_SECRET` missing | Set `JWT_SECRET` in `backend/.env` |
| `MongooseServerSelectionError` / cannot connect | Wrong `MONGO_URI`, password not URL-encoded, or your IP is not in Atlas **Network Access** |
| `bad auth : authentication failed` | Wrong DB username/password; reset it in Atlas → Database Access |
| Browser shows CORS error | `FRONTEND_URL` in `backend/.env` must match the frontend URL exactly (no trailing slash); restart the backend |
| Frontend calls the wrong server / 404 on `/api` | Check `VITE_API_BASE_URL` in `frontend/.env` (must end in `/api`); restart `npm run dev` |
| OTP email never arrives | Check EmailJS IDs/keys, that "Allow EmailJS API for non-browser applications" is on, and the monthly request quota. In development with empty keys, the OTP prints in the backend terminal |
| Cyan AI shows as unavailable | Neither `GEMINI_API_KEY` nor `ANTHROPIC_API_KEY` is set |
| Port already in use | Change `PORT` in `backend/.env` (and `VITE_API_BASE_URL`) or stop the other process |

---

## 👤 Ownership & Contact

**Owner / maintainer:** Rishav Raj
**GitHub:** `rishavrjpt`
**Contact:** `<contact-email>`

## 📄 License

A license has not been selected yet. Until one is added, all rights are reserved by the project owner.
