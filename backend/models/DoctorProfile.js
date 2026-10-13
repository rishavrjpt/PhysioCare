import mongoose from "mongoose";

const doctorProfileSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    experience: { type: String, default: "0 Years" },
    patientsCount: { type: String, default: "0+" },
    rating: { type: Number, default: 0 },
    fees: { type: Number, default: 0 },
    about: { type: String, default: "" },
    specialization: { type: String, default: "Physiotherapist" },

    // ── New onboarding fields ──
    bio: { type: String, default: "" },
    licenceNumber: { type: String, default: "" },
    hospitalName: { type: String, default: "" },
    availableDays: { type: [String], default: [] },
    availableTimeStart: { type: String, default: "" },
    availableTimeEnd: { type: String, default: "" },
    languages: { type: [String], default: [] },
    isAvailable: { type: Boolean, default: false }
}, { timestamps: true });

doctorProfileSchema.index({ user: 1 }, { unique: true });

export default mongoose.model("DoctorProfile", doctorProfileSchema);
