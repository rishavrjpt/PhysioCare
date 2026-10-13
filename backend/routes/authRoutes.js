import express from "express";
import {
  signup, login, getUser, verifyEmail, completeProfile,
  verifyOtp, resendOtp, forgotPassword, resetPassword,
} from "../controllers/authController.js";
import passport, { isGoogleConfigured } from "../config/googleAuthConfig.js";
import { protect, requireSelf, signToken, validateObjectIds } from "../middleware/authMiddleware.js";

const router = express.Router();
const FRONTEND = () => (process.env.FRONTEND_URL || "http://localhost:5173").split(",")[0].trim().replace(/\/$/, "");

// ── Google OAuth (registered before "/:id" so "/google/..." is never treated as an id) ──
const googleNotConfigured = (req, res) =>
  res.redirect(`${FRONTEND()}/auth/google/error?msg=${encodeURIComponent("Google login is not set up on this server.")}`);

const startGoogle = (role) =>
  isGoogleConfigured
    ? passport.authenticate("google", { scope: ["profile", "email"], state: role, session: false })
    : googleNotConfigured;

router.get("/google/patient", startGoogle("patient"));
router.get("/google/doctor", startGoogle("doctor"));

// Google callback — sign JWT and redirect back to the frontend
router.get("/google/callback", (req, res, next) => {
  if (!isGoogleConfigured) return googleNotConfigured(req, res);

  passport.authenticate("google", { session: false }, (err, user, info) => {
    if (err) {
      console.error("Google OAuth error:", err);
      return res.redirect(`${FRONTEND()}/auth/google/error?msg=${encodeURIComponent("Server error during Google login.")}`);
    }
    if (!user) {
      const msg = info?.message || "Google login failed.";
      const role = info?.role || "";
      return res.redirect(`${FRONTEND()}/auth/google/error?msg=${encodeURIComponent(msg)}&role=${encodeURIComponent(role)}`);
    }

    // Token goes in the URL fragment (#), which browsers never send to servers or put in logs.
    const params = new URLSearchParams({
      token: signToken(user),
      role: user.role,
      profileCompleted: String(user.profileCompleted),
    });
    res.redirect(`${FRONTEND()}/auth/google/success#${params.toString()}`);
  })(req, res, next);
});

// ── Email/password routes (public) ───────────────────────────────────────────
router.post("/signup", signup);
router.post("/login", login);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/verify-email/:token", verifyEmail); // legacy link support

// ── Logged-in routes ─────────────────────────────────────────────────────────
router.patch("/:id/complete-profile", validateObjectIds, protect, requireSelf("id"), completeProfile);
router.get("/:id", validateObjectIds, protect, getUser);

export default router;
