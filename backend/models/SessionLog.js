import mongoose from "mongoose";

const sessionLogSchema = new mongoose.Schema({
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    videoId: { type: mongoose.Schema.Types.ObjectId, ref: "Video" }, // Optional
    painLevel: { type: Number, min: 1, max: 10, required: true },
    date: { type: Date, default: Date.now }
}, { timestamps: true });

sessionLogSchema.index({ patientId: 1, date: -1 });

export default mongoose.model("SessionLog", sessionLogSchema);
