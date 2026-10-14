import "dotenv/config"; // must be first so every module sees updated env vars
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { connectDB } from "./config/pg.js";
import { corsOrigin } from "./config/env.js";
import { UPLOADS_DIR } from "./config/paths.js";
import authRoutes from "./routes/authRoutes.js";
import doctorRoutes from "./routes/doctorRoutes.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";
import articleRoutes from "./routes/articleRoutes.js";
import programRoutes from "./routes/programRoutes.js";
import videoRoutes from "./routes/videoRoutes.js";
import teamRoutes from "./routes/teamRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import passport from "./config/googleAuthConfig.js";
import compression from "compression";
import { isEmailConfigured } from "./config/emailService.js";
import { isProduction, validateFrontendOrigins } from "./config/env.js";

// ── Fail fast on missing configuration ───────────────────────────────────────
const missing = ["DATABASE_URL", "JWT_SECRET"].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  console.error("Copy backend/.env.example to backend/.env and fill it in.");
  process.exit(1);
}

// In production a missing/invalid FRONTEND_URL is not fatal (the API stays up for non-browser
// clients) but it means NO browser origin is allowed, so say so loudly.
if (isProduction()) {
  const { valid, invalid } = validateFrontendOrigins();
  if (valid.length === 0) {
    console.error("[CORS] FRONTEND_URL has no valid origin: browsers will be blocked. Set it to your exact frontend origin, e.g. https://your-app.vercel.app");
  }
  if (invalid.length) {
    console.error(`[CORS] Ignoring ${invalid.length} invalid FRONTEND_URL entr${invalid.length === 1 ? "y" : "ies"} (must be scheme://host[:port], no path, no wildcard).`);
  }
  console.log(`Mode: production (${valid.length} allowed frontend origin${valid.length === 1 ? "" : "s"})`);
} else {
  console.log("Mode: development (local origins and development OTPs enabled)");
}

connectDB();

const app = express();
app.set("trust proxy", 1); // Render/Vercel sit behind a proxy (needed for rate limiting by IP)

// ── Compression: skip text/event-stream for SSE chat ────────────────────────
app.use(compression({
  filter: (req, res) => {
    if (req.url?.includes("/chat/stream") || req.originalUrl?.includes("/chat/stream")) {
      return false;
    }
    const contentType = res.getHeader("Content-Type");
    if (contentType && String(contentType).includes("text/event-stream")) {
      return false;
    }
    if (req.headers.accept && req.headers.accept.includes("text/event-stream")) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// ── CORS ─────────────────────────────────────────────────────────────────────
// Production (NODE_ENV=production or running on Render): only the origins listed in FRONTEND_URL.
// Development: FRONTEND_URL plus any localhost / 127.0.0.1 port (Vite moves to 5174, 5175, ...).
// Rules live in config/env.js so they are unit tested.
app.use(cors({ origin: corsOrigin() }));

app.use(express.json({ limit: "10mb" }));

// Uploaded files. nosniff + attachment for non-media stops uploaded HTML from running as a page.
app.use("/uploads", express.static(UPLOADS_DIR, {
  setHeaders: (res, filePath) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (!/\.(mp4|webm|mov|m4v|ogg|jpe?g|png|gif|webp)$/i.test(filePath)) {
      res.setHeader("Content-Disposition", "attachment");
    }
  },
}));

app.use(passport.initialize());

// Request logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// ── Rate limiting on auth endpoints (stops OTP / password brute force) ───────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { msg: "Too many attempts. Please wait a few minutes and try again." },
});
for (const p of ["login", "signup", "verify-otp", "resend-otp", "forgot-password", "reset-password"]) {
  app.use(`/api/auth/${p}`, authLimiter);
}

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/articles", articleRoutes);
app.use("/api/programs", programRoutes);
app.use("/api/videos", videoRoutes);
app.use("/api/members", teamRoutes);
app.use("/api/chat", chatRoutes);

// 404 for unknown API routes
app.use("/api", (req, res) => res.status(404).json({ msg: "Route not found" }));

// Central error handler (multer errors, bad JSON, anything thrown)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === "LIMIT_FILE_SIZE" ? "File is too large." : err.message;
    return res.status(400).json({ msg });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ msg: "Upload is too large. Please use a smaller image." });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ msg: "Invalid JSON in request body." });
  }
  if (err.status === 400) return res.status(400).json({ msg: err.message });
  console.error("Unhandled error:", err);
  res.status(500).json({ msg: "Server error" });
});

const PORT = process.env.PORT || 8080;
// Express 5 passes listen errors (e.g. EADDRINUSE) to this callback. Without checking it the
// server used to print "Server running" and then silently exit.
app.listen(PORT, (err) => {
  if (err) {
    if (err.code === "EADDRINUSE") {
      console.error(`Port ${PORT} is already in use - another backend is probably still running.`);
      console.error(`Stop it (macOS: lsof -nP -iTCP:${PORT} -sTCP:LISTEN, then kill <PID>) or set a different PORT.`);
    } else {
      console.error("Server failed to start:", err.message);
    }
    process.exit(1);
  }
  console.log(`Server running on port ${PORT}`);
  if (isEmailConfigured()) {
    console.log("Email: EmailJS configured");
  } else {
    console.log("Email: EmailJS NOT configured — OTPs will print in this console (dev only)");
  }
});
