import crypto from "crypto";
import bcrypt from "bcryptjs";
import { UNIQUE_VIOLATION, withTransaction } from "../config/pg.js";
import { updateBy } from "../utils/sql.js";
import * as users from "../repos/userRepo.js";
import { sendOtpEmail } from "../config/emailService.js";
import { isProduction, exposeDevOtp } from "../config/env.js";
import { signToken } from "../middleware/authMiddleware.js";
import { toSafeUser } from "../utils/sanitize.js";
import { doctorHasPatient } from "../utils/relations.js";

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_OTP_ATTEMPTS = 5;
const SELF_SIGNUP_ROLES = ["patient", "doctor"]; // "admin" can never be chosen by a client

// ── Helpers ──────────────────────────────────────────────────────────────────
const generateOtp = () => String(crypto.randomInt(100000, 1000000)); // cryptographically secure
const normalizeEmail = (email) => (typeof email === "string" ? email.toLowerCase().trim() : "");
// Emails are stored lowercase (enforced by a CHECK constraint), so one exact match is enough.
const findUserByEmail = async (email) => (email ? users.findByEmail(email) : null);
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const checkOtpCooldown = (user) => {
  if (!user.otpLastSentAt) return null;
  const elapsed = Date.now() - new Date(user.otpLastSentAt).getTime();
  if (elapsed < 60000) {
    const retryAfter = Math.ceil((60000 - elapsed) / 1000);
    return {
      msg: "Please wait 60 seconds before requesting another code.",
      retryAfter
    };
  }
  return null;
};

const issueOtp = async (user) => {
  const fields = {
    otp: generateOtp(),
    otpExpiry: new Date(Date.now() + OTP_TTL_MS),
    otpAttempts: 0,
    otpLastSentAt: new Date(),
  };
  await users.updateUser(user._id, fields);
  Object.assign(user, fields);

  try {
    await sendOtpEmail(user.email, user.name, user.otp);
  } catch (err) {
    if (isProduction()) {
      console.error("EmailJS delivery failed in production:", err.message);
      const deliveryError = new Error("Email delivery failed. Please check your email address or try again in a few minutes.");
      deliveryError.status = 502;
      throw deliveryError;
    } else {
      console.warn(`[DEV] EmailJS OTP send notice: ${err.message}`);
    }
  }
};

// Returns an error message, or null if the OTP is correct.
const checkOtp = async (user, otp) => {
  if (!user.otp || !user.otpExpiry) return "No OTP found. Please request a new one.";
  if (Date.now() > new Date(user.otpExpiry).getTime()) return "OTP has expired. Please request a new one.";
  if ((user.otpAttempts || 0) >= MAX_OTP_ATTEMPTS) {
    return "Too many wrong attempts. Please request a new OTP.";
  }
  const given = Buffer.from(String(otp ?? ""));
  const expected = Buffer.from(String(user.otp));
  const ok = given.length === expected.length && crypto.timingSafeEqual(given, expected);
  if (!ok) {
    user.otpAttempts = (user.otpAttempts || 0) + 1;
    await users.updateUser(user._id, { otpAttempts: user.otpAttempts });
    return "Invalid OTP. Please try again.";
  }
  return null;
};

const serverError = (res, label, error) => {
  console.error(`${label}:`, error);
  res.status(500).json({ msg: "Server error" });
};

// ── SIGNUP ────────────────────────────────────────────────────────────────────
export const signup = async (req, res) => {
  try {
    const { name, password } = req.body;
    const email = normalizeEmail(req.body.email);
    const role = req.body.role || "patient";

    if (!name?.trim() || !email || !password) {
      return res.status(400).json({ msg: "Name, email and password are required." });
    }
    if (!isValidEmail(email)) return res.status(400).json({ msg: "Please enter a valid email address." });
    if (String(password).length < 6) {
      return res.status(400).json({ msg: "Password must be at least 6 characters." });
    }
    if (!SELF_SIGNUP_ROLES.includes(role)) return res.status(400).json({ msg: "Invalid account type." });

    const existingUser = await findUserByEmail(email);
    if (existingUser) return res.status(400).json({ msg: "User already exists" });

    const user = await users.createUser({
      name: name.trim(),
      email,
      password: await bcrypt.hash(String(password), 10),
      role,
      isVerified: false,
      profileCompleted: false,
    });
    try {
      await issueOtp(user);
    } catch (err) {
      if (err.status === 502) {
        return res.status(502).json({ msg: err.message });
      }
      throw err;
    }

    res.status(201).json({
      msg: "Account created! Please verify your email with the OTP sent.",
      userId: user._id,
      email,
      role: user.role,
      devOtp: exposeDevOtp(user.otp),
    });
  } catch (error) {
    if (error.code === UNIQUE_VIOLATION) return res.status(400).json({ msg: "User already exists" });
    serverError(res, "Signup error", error);
  }
};

// ── VERIFY OTP ────────────────────────────────────────────────────────────────
export const verifyOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const user = await findUserByEmail(email);
    if (!user) return res.status(404).json({ msg: "User not found." });

    const otpError = await checkOtp(user, req.body.otp);
    if (otpError) return res.status(400).json({ msg: otpError });

    await users.updateUser(user._id, { isVerified: true, otp: null, otpExpiry: null, otpAttempts: 0 });

    res.status(200).json({
      msg: "Email verified successfully!",
      token: signToken(user),
      role: user.role,
      userId: user._id,
      profileCompleted: user.profileCompleted,
    });
  } catch (error) {
    serverError(res, "Verify OTP error", error);
  }
};

// ── RESEND OTP ────────────────────────────────────────────────────────────────
export const resendOtp = async (req, res) => {
  try {
    const user = await findUserByEmail(normalizeEmail(req.body.email));
    if (!user) return res.status(404).json({ msg: "User not found." });
    if (user.isVerified) return res.status(400).json({ msg: "Account is already verified." });

    const cooldown = checkOtpCooldown(user);
    if (cooldown) {
      return res.status(429).json({ msg: cooldown.msg, retryAfter: cooldown.retryAfter });
    }

    try {
      await issueOtp(user);
    } catch (err) {
      if (err.status === 502) {
        return res.status(502).json({ msg: err.message });
      }
      throw err;
    }

    res.status(200).json({
      msg: "New OTP sent to your email.",
      devOtp: exposeDevOtp(user.otp),
    });
  } catch (error) {
    serverError(res, "Resend OTP error", error);
  }
};

// ── VERIFY EMAIL (legacy token link — kept for old links) ─────────────────────
export const verifyEmail = async (req, res) => {
  try {
    const user = await users.findByVerificationToken(req.params.token);
    if (!user) return res.status(400).json({ msg: "Invalid or expired verification token." });
    await users.updateUser(user._id, { isVerified: true, verificationToken: null, verificationTokenExpiry: null });
    res.status(200).json({ msg: "Email verified successfully. You can now log in." });
  } catch (error) {
    serverError(res, "Verify email error", error);
  }
};

// ── LOGIN ─────────────────────────────────────────────────────────────────────
export const login = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password, expectedRole } = req.body;
    if (!email || !password) return res.status(400).json({ msg: "Email and password are required." });

    const user = await findUserByEmail(email);
    if (!user) return res.status(400).json({ msg: "User not found" });

    // Accounts created with Google have no password — bcrypt.compare would throw.
    if (!user.password) {
      return res.status(400).json({
        msg: "This account uses Google sign-in. Use 'Continue with Google' or reset your password.",
      });
    }

    const isMatch = await bcrypt.compare(String(password), user.password);
    if (!isMatch) return res.status(400).json({ msg: "Wrong password" });

    // Role guard — checked before the OTP branch so we never email an OTP for the wrong portal
    if (expectedRole) {
      const allowedRoles = expectedRole === "doctor" ? ["doctor", "admin"] : ["patient"];
      if (!allowedRoles.includes(user.role)) {
        const correctPortal = expectedRole === "doctor" ? "Patient" : "Physiotherapist";
        return res.status(403).json({
          msg: `This is not a ${expectedRole === "doctor" ? "Physiotherapist" : "Patient"} account. Please use the ${correctPortal} login instead.`,
        });
      }
    }

    // Not verified — resend OTP and prompt user to verify
    if (!user.isVerified) {
      const cooldown = checkOtpCooldown(user);
      if (!cooldown) {
        try {
          await issueOtp(user);
        } catch (err) {
          if (err.status === 502) {
            return res.status(502).json({ msg: err.message });
          }
          throw err;
        }
      }
      return res.status(401).json({
        msg: "Email not verified.",
        needsVerification: true,
        email,
        role: user.role,
        devOtp: exposeDevOtp(user.otp),
      });
    }

    res.status(200).json({
      token: signToken(user),
      role: user.role,
      userId: user._id,
      profileCompleted: user.profileCompleted,
      msg: "Login successful",
    });
  } catch (error) {
    serverError(res, "Login error", error);
  }
};

// ── GET USER ──────────────────────────────────────────────────────────────────
// Allowed: yourself, an admin, or a doctor who is treating this patient.
export const getUser = async (req, res) => {
  try {
    const { id } = req.params;
    const me = req.user;
    const allowed =
      me.id === id ||
      me.role === "admin" ||
      (me.role === "doctor" && (await doctorHasPatient(me.id, id)));
    if (!allowed) return res.status(403).json({ msg: "You can only view your own profile." });

    const user = await users.findSafeById(id);
    if (!user) return res.status(404).json({ msg: "User not found" });
    res.status(200).json(user);
  } catch (error) {
    serverError(res, "Get user error", error);
  }
};

// ── COMPLETE PROFILE (Onboarding) ─────────────────────────────────────────────
export const completeProfile = async (req, res) => {
  try {
    const { id } = req.params; // requireSelf() already checked this is the logged-in user
    const user = await users.findById(id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    const {
      profilePhoto, phone, city,
      dateOfBirth, gender, bloodGroup,
      currentCondition, existingConditions, pastSurgeries,
      emergencyContactName, emergencyContactNumber,
      bio, experience, specialization, licenceNumber, hospitalName,
      fees, availableDays, availableTimeStart, availableTimeEnd, languages,
    } = req.body;

    // Text columns are NOT NULL, so coerce whatever the client sent to a string.
    const text = (v) => (v === undefined ? undefined : String(v ?? ""));
    const list = (v) => (v === undefined ? undefined : Array.isArray(v) ? v.map(String) : []);

    if (profilePhoto !== undefined && typeof profilePhoto === "string" &&
        Buffer.byteLength(profilePhoto, "utf8") > 400 * 1024) {
      return res.status(400).json({ msg: "Profile photo must be under 400 KB." });
    }

    const userFields = {
      profilePhoto: text(profilePhoto),
      phone: text(phone),
      city: text(city),
      profileCompleted: true,
    };
    if (user.role === "patient") {
      Object.assign(userFields, {
        dateOfBirth: text(dateOfBirth),
        gender: text(gender),
        bloodGroup: text(bloodGroup),
        currentCondition: text(currentCondition),
        existingConditions: text(existingConditions),
        pastSurgeries: text(pastSurgeries),
        emergencyContactName: text(emergencyContactName),
        emergencyContactNumber: text(emergencyContactNumber),
      });
    }

    await withTransaction(async (db) => {
      if (user.role === "doctor") {
        await db.query("insert into doctor_profiles (user_id) values ($1) on conflict (user_id) do nothing", [id]);
        await updateBy("doctor_profiles", "user_id", id, {
          bio: text(bio),
          experience: text(experience),
          specialization: text(specialization),
          licenceNumber: text(licenceNumber),
          hospitalName: text(hospitalName),
          fees: fees !== undefined && fees !== "" ? Number(fees) || 0 : undefined,
          availableDays: list(availableDays),
          availableTimeStart: text(availableTimeStart),
          availableTimeEnd: text(availableTimeEnd),
          languages: list(languages),
          isAvailable: true,
        }, db);
      }
      await users.updateUser(id, userFields, db);
    });

    const updated = await users.findSafeById(id);
    res.status(200).json({ msg: "Profile completed successfully", user: toSafeUser(updated) });
  } catch (error) {
    serverError(res, "Complete profile error", error);
  }
};

// ── FORGOT PASSWORD ───────────────────────────────────────────────────────────
export const forgotPassword = async (req, res) => {
  try {
    const user = await findUserByEmail(normalizeEmail(req.body.email));
    if (!user) return res.status(404).json({ msg: "No account found with that email." });

    const cooldown = checkOtpCooldown(user);
    if (cooldown) {
      return res.status(429).json({ msg: cooldown.msg, retryAfter: cooldown.retryAfter });
    }

    try {
      await issueOtp(user);
    } catch (err) {
      if (err.status === 502) {
        return res.status(502).json({ msg: err.message });
      }
      throw err;
    }

    res.status(200).json({
      msg: "OTP sent to your email.",
      devOtp: exposeDevOtp(user.otp),
    });
  } catch (error) {
    serverError(res, "Forgot password error", error);
  }
};

// ── RESET PASSWORD ────────────────────────────────────────────────────────────
export const resetPassword = async (req, res) => {
  try {
    const { otp, newPassword } = req.body;
    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ msg: "New password must be at least 6 characters." });
    }

    const user = await findUserByEmail(normalizeEmail(req.body.email));
    if (!user) return res.status(404).json({ msg: "User not found." });

    const otpError = await checkOtp(user, otp);
    if (otpError) return res.status(400).json({ msg: otpError });

    await users.updateUser(user._id, {
      password: await bcrypt.hash(String(newPassword), 10),
      otp: null,
      otpExpiry: null,
      otpAttempts: 0,
      isVerified: true, // they proved they own the email
    });

    res.status(200).json({ msg: "Password reset successfully. You can now log in." });
  } catch (error) {
    serverError(res, "Reset password error", error);
  }
};
