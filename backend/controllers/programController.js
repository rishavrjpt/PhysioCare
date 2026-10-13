import crypto from "crypto";
import Program from "../models/Program.js";
import User from "../models/User.js";
import Video from "../models/Video.js";
import { deleteUploadedFile } from "../config/paths.js";
import { doctorHasPatient } from "../utils/relations.js";

// Random 6-character code, e.g. "A3F9B2"
const generateProgramCode = () => crypto.randomBytes(3).toString("hex").toUpperCase();

const serverError = (res, label, error) => {
    console.error(`${label}:`, error);
    res.status(500).json({ msg: "Server error" });
};

// Loads a program and checks the logged-in doctor owns it.
const loadOwnProgram = async (req, res) => {
    const program = await Program.findById(req.params.id);
    if (!program) {
        res.status(404).json({ msg: "Program not found" });
        return null;
    }
    if (req.user.role !== "admin" && program.doctorId.toString() !== req.user.id) {
        res.status(403).json({ msg: "This is not your program." });
        return null;
    }
    return program;
};

export const createProgram = async (req, res) => {
    try {
        const { title, description, specialty } = req.body;
        if (!title?.trim()) return res.status(400).json({ msg: "Program title is required." });

        // Retry on the (very rare) duplicate code instead of looping on findOne
        for (let attempt = 0; attempt < 5; attempt++) {
            try {
                const program = await Program.create({
                    doctorId: req.user.id, // always the logged-in doctor
                    title: title.trim(),
                    description,
                    specialty: specialty || "General",
                    programCode: generateProgramCode(),
                });
                return res.status(201).json(program);
            } catch (err) {
                if (err.code !== 11000) throw err;
            }
        }
        res.status(500).json({ msg: "Could not generate a unique code. Please try again." });
    } catch (error) {
        serverError(res, "Error creating program", error);
    }
};

export const getDoctorPrograms = async (req, res) => {
    try {
        const programs = await Program.find({ doctorId: req.params.doctorId })
            .select("doctorId title description programCode specialty createdAt")
            .sort({ createdAt: -1 })
            .lean();
        res.status(200).json(programs);
    } catch (error) {
        serverError(res, "Error getting programs", error);
    }
};

export const enrollInProgram = async (req, res) => {
    try {
        const programCode = String(req.body.programCode || "").trim().toUpperCase(); // codes are case-insensitive for users
        if (!programCode) return res.status(400).json({ msg: "Please enter a program code." });

        const program = await Program.findOne({ programCode });
        if (!program) return res.status(404).json({ msg: "Program not found. Invalid code." });

        const patient = await User.findById(req.user.id).select("enrolledPrograms");
        if (!patient) return res.status(404).json({ msg: "Patient not found." });
        if (patient.enrolledPrograms.some((p) => p.equals(program._id))) {
            return res.status(400).json({ msg: "You are already enrolled in this program." });
        }

        // $addToSet is atomic, so a double-click on "Enroll" still can't add the program twice
        await User.updateOne({ _id: req.user.id }, { $addToSet: { enrolledPrograms: program._id } });

        res.status(200).json({ msg: "Successfully enrolled!", program });
    } catch (error) {
        serverError(res, "Error enrolling in program", error);
    }
};

export const deleteProgram = async (req, res) => {
    try {
        const program = await loadOwnProgram(req, res);
        if (!program) return;
        const id = program._id;

        // 1. Delete all associated video files and records
        const videos = await Video.find({ programId: id });
        videos.forEach((vid) => deleteUploadedFile(vid.url));
        await Video.deleteMany({ programId: id });

        // 2. Remove program from enrolled users
        await User.updateMany({ enrolledPrograms: id }, { $pull: { enrolledPrograms: id } });

        // 3. Delete the program
        await Program.findByIdAndDelete(id);

        res.status(200).json({ msg: "Program and associated videos successfully deleted." });
    } catch (error) {
        serverError(res, "Error deleting program", error);
    }
};

// Patient sees their own programs; a doctor may see the programs of a patient they treat.
export const getPatientPrograms = async (req, res) => {
    try {
        const { patientId } = req.params;
        const me = req.user;
        const allowed =
            me.id === patientId ||
            me.role === "admin" ||
            (me.role === "doctor" && (await doctorHasPatient(me.id, patientId)));
        if (!allowed) return res.status(403).json({ msg: "You cannot view this patient's programs." });

        const patient = await User.findById(patientId)
            .populate("enrolledPrograms")
            .select("enrolledPrograms")
            .lean();
        if (!patient) return res.status(404).json({ msg: "Patient not found." });
        res.status(200).json(patient.enrolledPrograms.filter(Boolean));
    } catch (error) {
        serverError(res, "Error getting patient programs", error);
    }
};

export const getProgramPatients = async (req, res) => {
    try {
        const program = await loadOwnProgram(req, res);
        if (!program) return;
        const patients = await User.find({ enrolledPrograms: program._id })
            .select("name email role")
            .lean();
        res.status(200).json(patients);
    } catch (error) {
        serverError(res, "Error getting program patients", error);
    }
};

