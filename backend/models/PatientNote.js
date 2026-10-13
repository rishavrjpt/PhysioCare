import mongoose from "mongoose";

const patientNoteSchema = new mongoose.Schema({
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    note: { type: String, default: "" }
}, { timestamps: true });

// Ensure one note per doctor-patient pair
patientNoteSchema.index({ doctorId: 1, patientId: 1 }, { unique: true });

export default mongoose.model("PatientNote", patientNoteSchema);
