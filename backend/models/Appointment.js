import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema({
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true }, // Format: YYYY-MM-DD or specific format
    time: { type: String, required: true }, // Format: HH:MM AM/PM
    status: { type: String, enum: ["Pending", "Confirmed", "Completed", "Cancelled", "Rescheduled"], default: "Pending" },
    notes: { type: String, default: "" },
    
    // Doctor's Completion Note Fields
    sessionNumber: { type: Number },
    problemDescription: { type: String },
    medicine: { type: String },
    suggestion: { type: String },
    followUpNeeded: { type: Boolean, default: false },
    followUpDate: { type: String },
    programCode: { type: String },
    programTitle: { type: String },
    
    // Patient's Review Fields
    patientRating: { type: Number, min: 1, max: 5 },
    patientFeeling: { type: String, enum: ["Better", "Same", "Worse"] },
    patientReview: { type: String },

    // Report sharing
    sentToPatient: { type: Boolean, default: false }
}, { timestamps: true });

appointmentSchema.index({ doctorId: 1, createdAt: -1 });
appointmentSchema.index({ patientId: 1, createdAt: -1 });
appointmentSchema.index({ doctorId: 1, date: 1, time: 1 });

export default mongoose.model("Appointment", appointmentSchema);
