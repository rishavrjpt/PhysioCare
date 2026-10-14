import { one, many } from "../config/pg.js";
import { camelize } from "../utils/rows.js";
import { insertRow } from "../utils/sql.js";
import { BUCKETS, uploadBuffer, deleteStoredFile, fileExt } from "../config/storage.js";

const clean = (v) => (typeof v === "string" ? v.trim() : v ?? null);

// POST /api/members - create a new team member (with optional photo upload)
export const createMember = async (req, res) => {
  try {
    const {
      name, rollNumber, year, degree, aboutProject, hobbies, certificate, internship, aboutYou,
    } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ msg: "Name is required." });
    }

    const photo = req.file
      ? await uploadBuffer({
          bucket: BUCKETS.images,
          folder: "team",
          buffer: req.file.buffer,
          contentType: req.file.mimetype,
          ext: fileExt(req.file.originalname),
        })
      : null;

    let row;
    try {
      row = await insertRow("team_members", {
      name: name.trim(),
      rollNumber: clean(rollNumber),
      year: clean(year),
      degree: clean(degree),
      aboutProject: clean(aboutProject),
      hobbies: clean(hobbies),
      certificate: clean(certificate),
      internship: clean(internship),
      aboutYou: clean(aboutYou),
      photo,
      });
    } catch (err) {
      await deleteStoredFile(photo); // don't leave an orphan file behind
      throw err;
    }

    res.status(201).json(camelize(row));
  } catch (error) {
    console.error("Error creating team member:", error);
    res.status(500).json({ msg: "Server error" });
  }
};

// GET /api/members - fetch all team members
export const getAllMembers = async (req, res) => {
  try {
    const rows = await many("select * from team_members order by created_at desc");
    res.status(200).json(rows.map(camelize));
  } catch (error) {
    console.error("Error fetching team members:", error);
    res.status(500).json({ msg: "Server error" });
  }
};

// GET /api/members/:id - fetch a single team member by ID
export const getMemberById = async (req, res) => {
  try {
    const member = await one("select * from team_members where id = $1", [req.params.id]);
    if (!member) return res.status(404).json({ msg: "Team member not found." });
    res.status(200).json(camelize(member));
  } catch (error) {
    console.error("Error fetching team member:", error);
    res.status(500).json({ msg: "Server error" });
  }
};

// DELETE /api/members/:id - delete a team member and their photo
export const deleteMember = async (req, res) => {
  try {
    const member = await one("delete from team_members where id = $1 returning photo", [req.params.id]);
    if (!member) return res.status(404).json({ msg: "Team member not found." });

    await deleteStoredFile(member.photo);
    res.status(200).json({ msg: "Team member deleted." });
  } catch (error) {
    console.error("Error deleting team member:", error);
    res.status(500).json({ msg: "Server error" });
  }
};
