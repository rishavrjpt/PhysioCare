import mongoose from "mongoose";

const videoSchema = new mongoose.Schema({
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    programId: { type: mongoose.Schema.Types.ObjectId, ref: "Program", default: null }, // Null means General
    title: { type: String, required: true },
    description: { type: String },
    url: { type: String, required: true },
    thumbnail: { type: String },
    duration: { type: String, default: "0:00" },
}, { timestamps: true });

videoSchema.index({ programId: 1, createdAt: -1 });
videoSchema.index({ doctorId: 1, programId: 1 });

export default mongoose.model("Video", videoSchema);
