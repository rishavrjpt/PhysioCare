import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, required: true, lowercase: true, trim: true },
  password: String,
  role: { type: String, enum: ["patient", "doctor", "user", "admin"], default: "patient" },
  enrolledPrograms: [{ type: mongoose.Schema.Types.ObjectId, ref: "Program" }],
  // Google OAuth fields
  googleId: { type: String, default: null },
  authProvider: { type: String, enum: ["local", "google"], default: "local" },
  // Two-factor authentication fields
  twoFactorCode: { type: String, default: null },
  twoFactorExpiry: { type: Date, default: null },
  isVerified: { type: Boolean, default: false },
  verificationToken: { type: String, default: null },
  verificationTokenExpiry: { type: Date, default: null },
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String, default: null },
  // OTP fields for EmailJS flow
  otp: { type: String, default: null },
  otpExpiry: { type: Date, default: null },
  otpAttempts: { type: Number, default: 0 },
  otpLastSentAt: { type: Date, default: null },

  // ── Onboarding / Profile fields ──
  profileCompleted: { type: Boolean, default: false },
  profilePhoto: { type: String, default: "" },
  phone: { type: String, default: "" },
  city: { type: String, default: "" },

  // Patient-specific fields
  dateOfBirth: { type: String, default: "" },
  gender: { type: String, default: "" },
  bloodGroup: { type: String, default: "" },
  currentCondition: { type: String, default: "" },
  existingConditions: { type: String, default: "" },
  pastSurgeries: { type: String, default: "" },
  emergencyContactName: { type: String, default: "" },
  emergencyContactNumber: { type: String, default: "" }
}, { timestamps: true });

userSchema.index({ role: 1, isVerified: 1, city: 1 });
userSchema.index({ enrolledPrograms: 1 });

export default mongoose.model("User", userSchema);