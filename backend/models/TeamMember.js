import mongoose from "mongoose";

const teamMemberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    rollNumber: { type: String, trim: true },
    year: { type: String, trim: true },
    degree: { type: String, trim: true },
    aboutProject: { type: String, trim: true },
    hobbies: { type: String, trim: true }, // comma-separated
    certificate: { type: String, trim: true },
    internship: { type: String, trim: true },
    aboutYou: { type: String, trim: true },
    photo: { type: String, default: null }, // stored filename under /uploads/team/
  },
  { timestamps: true }
);

export default mongoose.model("TeamMember", teamMemberSchema);
