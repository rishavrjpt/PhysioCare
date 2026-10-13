import TeamMember from "../models/TeamMember.js";
import { deleteUploadedFile } from "../config/paths.js";

// POST /api/members — create a new team member (with optional photo upload)
export const createMember = async (req, res) => {
  try {
    const {
      name,
      rollNumber,
      year,
      degree,
      aboutProject,
      hobbies,
      certificate,
      internship,
      aboutYou,
    } = req.body;

    if (!name?.trim()) {
      if (req.file) deleteUploadedFile(`/uploads/team/${req.file.filename}`);
      return res.status(400).json({ msg: "Name is required." });
    }

    let photo = null;
    if (req.file) {
      photo = `/uploads/team/${req.file.filename}`;
    }

    const member = await TeamMember.create({
      name,
      rollNumber,
      year,
      degree,
      aboutProject,
      hobbies,
      certificate,
      internship,
      aboutYou,
      photo,
    });

    res.status(201).json(member);
  } catch (error) {
    console.error("Error creating team member:", error);
    res.status(500).json({ msg: "Server error" });
  }
};

// GET /api/members — fetch all team members
export const getAllMembers = async (req, res) => {
  try {
    const members = await TeamMember.find().sort({ createdAt: -1 });
    res.status(200).json(members);
  } catch (error) {
    console.error("Error fetching team members:", error);
    res.status(500).json({ msg: "Server error" });
  }
};

// GET /api/members/:id — fetch a single team member by ID
export const getMemberById = async (req, res) => {
  try {
    const member = await TeamMember.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ msg: "Team member not found." });
    }
    res.status(200).json(member);
  } catch (error) {
    console.error("Error fetching team member:", error);
    res.status(500).json({ msg: "Server error" });
  }
};

// DELETE /api/members/:id — delete a team member and their photo
export const deleteMember = async (req, res) => {
  try {
    const member = await TeamMember.findById(req.params.id);
    if (!member) return res.status(404).json({ msg: "Team member not found." });

    // Remove photo from disk if it exists
    deleteUploadedFile(member.photo);

    await TeamMember.findByIdAndDelete(req.params.id);
    res.status(200).json({ msg: "Team member deleted." });
  } catch (error) {
    console.error("Error deleting team member:", error);
    res.status(500).json({ msg: "Server error" });
  }
};
