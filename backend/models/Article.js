import mongoose from "mongoose";

const articleSchema = new mongoose.Schema({
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    subtitle: { type: String, default: "" },
    content: { type: String, required: true },
    category: { type: String, enum: ["Rehabilitation", "Orthopedic", "Sports", "Wellness", "Neurological", "Nutrition"], default: "Wellness" },
    tags: [{ type: String }],
    coverImage: { type: String, default: "" }, // base64 or URL
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    readTime: { type: String, default: "1 min read" },
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
}, { timestamps: true });

articleSchema.index({ status: 1, createdAt: -1 });
articleSchema.index({ doctorId: 1, createdAt: -1 });

export default mongoose.model("Article", articleSchema);
