import crypto from "crypto";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "../models/User.js";
import DoctorProfile from "../models/DoctorProfile.js";
import { sendOtpEmail } from "../config/emailService.js";
import { signToken } from "../middleware/authMiddleware.js";
import { toSafeUser, SAFE_USER_SELECT, escapeRegex } from "../utils/sanitize.js";
import { doctorHasPatient } from "../utils/relations.js";

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_OTP_ATTEMPTS = 5;
const SELF_SIGNUP_ROLES = ["patient", "doctor"]; // "admin" can never be chosen by a client

// ── Helpers ──────────────────────────────────────────────────────────────────
const generateOtp = () => String(crypto.randomInt(100000, 1000000)); // cryptographically secure
const normalizeEmail = (email) => (typeof email === "string" ? email.toLowerCase().trim() : "");
// Emails are now stored lowercase, but accounts created before this fix may have
// capital letters, so fall back to a case-insensitive exact match.
const findUserByEmail = async (email) => {
  if (!email) return null;
  return (
    (await User.findOne({ email })) ||
    (await User.findOne({ email: { $regex: `^${escapeRegex(email)}$`, $options: "i" } }))
  );
};
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
  const otp = generateOtp();
  user.otp = otp;
  user.otpExpiry = Date.now() + OTP_TTL_MS;
  user.otpAttempts = 0;
  user.otpLastSentAt = new Date();
  await user.save();

  try {
    await sendOtpEmail(user.email, user.name, otp);
  } catch (err) {
    if (process.env.NODE_ENV === "production") {
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
    await user.save();
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

    const user = new User({
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
      devOtp: process.env.NODE_ENV !== "production" ? user.otp : undefined,
    });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ msg: "User already exists" });
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

    user.isVerified = true;
    user.otp = null;
    user.otpExpiry = null;
    user.otpAttempts = 0;
    await user.save();

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
      devOtp: process.env.NODE_ENV !== "production" ? user.otp : undefined,
    });
  } catch (error) {
    serverError(res, "Resend OTP error", error);
  }
};

// ── VERIFY EMAIL (legacy token link — kept for old links) ─────────────────────
export const verifyEmail = async (req, res) => {
  try {
    const user = await User.findOne({
      verificationToken: req.params.token,
      verificationTokenExpiry: { $gt: Date.now() },
    });
    if (!user) return res.status(400).json({ msg: "Invalid or expired verification token." });
    user.isVerified = true;
    user.verificationToken = null;
    user.verificationTokenExpiry = null;
    await user.save();
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
        devOtp: process.env.NODE_ENV !== "production" ? user.otp : undefined,
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

    const user = await User.findById(id).select(SAFE_USER_SELECT).lean();
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
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    const {
      profilePhoto, phone, city,
      dateOfBirth, gender, bloodGroup,
      currentCondition, existingConditions, pastSurgeries,
      emergencyContactName, emergencyContactNumber,
      bio, experience, specialization, licenceNumber, hospitalName,
      fees, availableDays, availableTimeStart, availableTimeEnd, languages,
    } = req.body;

    if (profilePhoto !== undefined) {
      if (typeof profilePhoto === "string" && Buffer.byteLength(profilePhoto, "utf8") > 400 * 1024) {
        return res.status(400).json({ msg: "Profile photo must be under 400 KB." });
      }
      user.profilePhoto = profilePhoto;
    }
    if (phone !== undefined) user.phone = phone;
    if (city !== undefined) user.city = city;

    if (user.role === "patient") {
      if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth;
      if (gender !== undefined) user.gender = gender;
      if (bloodGroup !== undefined) user.bloodGroup = bloodGroup;
      if (currentCondition !== undefined) user.currentCondition = currentCondition;
      if (existingConditions !== undefined) user.existingConditions = existingConditions;
      if (pastSurgeries !== undefined) user.pastSurgeries = pastSurgeries;
      if (emergencyContactName !== undefined) user.emergencyContactName = emergencyContactName;
      if (emergencyContactNumber !== undefined) user.emergencyContactNumber = emergencyContactNumber;
    }

    if (user.role === "doctor") {
      let profile = await DoctorProfile.findOne({ user: id });
      if (!profile) profile = new DoctorProfile({ user: id });
      if (bio !== undefined) profile.bio = bio;
      if (experience !== undefined) profile.experience = experience;
      if (specialization !== undefined) profile.specialization = specialization;
      if (licenceNumber !== undefined) profile.licenceNumber = licenceNumber;
      if (hospitalName !== undefined) profile.hospitalName = hospitalName;
      if (fees !== undefined && fees !== "") profile.fees = Number(fees) || 0;
      if (availableDays !== undefined) profile.availableDays = availableDays;
      if (availableTimeStart !== undefined) profile.availableTimeStart = availableTimeStart;
      if (availableTimeEnd !== undefined) profile.availableTimeEnd = availableTimeEnd;
      if (languages !== undefined) profile.languages = languages;
      profile.isAvailable = true;
      await profile.save();
    }

    user.profileCompleted = true;
    await user.save();

    res.status(200).json({ msg: "Profile completed successfully", user: toSafeUser(user) });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({ msg: error.message });
    }
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
      devOtp: process.env.NODE_ENV !== "production" ? user.otp : undefined,
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

    user.password = await bcrypt.hash(String(newPassword), 10);
    user.otp = null;
    user.otpExpiry = null;
    user.otpAttempts = 0;
    user.isVerified = true; // they proved they own the email
    await user.save();

    res.status(200).json({ msg: "Password reset successfully. You can now log in." });
  } catch (error) {
    serverError(res, "Reset password error", error);
  }
};
