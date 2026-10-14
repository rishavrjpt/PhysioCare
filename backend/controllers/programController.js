import crypto from "crypto";
import { one, many, withTransaction, UNIQUE_VIOLATION } from "../config/pg.js";
import { camelize } from "../utils/rows.js";
import { insertRow } from "../utils/sql.js";
import { deleteStoredFile } from "../config/storage.js";
import { doctorHasPatient } from "../utils/relations.js";

// Random 6-character code, e.g. "A3F9B2"
const generateProgramCode = () => crypto.randomBytes(3).toString("hex").toUpperCase();

const serverError = (res, label, error) => {
    console.error(`${label}:`, error);
    res.status(500).json({ msg: "Server error" });
};

// Loads a program and checks the logged-in doctor owns it.
const loadOwnProgram = async (req, res) => {
    const program = camelize(await one("select * from programs where id = $1", [req.params.id]));
    if (!program) {
        res.status(404).json({ msg: "Program not found" });
        return null;
    }
    if (req.user.role !== "admin" && program.doctorId !== req.user.id) {
        res.status(403).json({ msg: "This is not your program." });
        return null;
    }
    return program;
};

export const createProgram = async (req, res) => {
    try {
        const { title, description, specialty } = req.body;
        if (!title?.trim()) return res.status(400).json({ msg: "Program title is required." });

        // Retry on the (very rare) duplicate code
        for (let attempt = 0; attempt < 5; attempt++) {
            try {
                const row = await insertRow("programs", {
                    doctorId: req.user.id, // always the logged-in doctor
                    title: title.trim(),
                    description: description ?? null,
                    specialty: specialty || "General",
                    programCode: generateProgramCode(),
                });
                return res.status(201).json(camelize(row));
            } catch (err) {
                if (err.code !== UNIQUE_VIOLATION) throw err;
            }
        }
        res.status(500).json({ msg: "Could not generate a unique code. Please try again." });
    } catch (error) {
        serverError(res, "Error creating program", error);
    }
};

export const getDoctorPrograms = async (req, res) => {
    try {
        const rows = await many(
            `select id, doctor_id, title, description, program_code, specialty, created_at
               from programs where doctor_id = $1 order by created_at desc`,
            [req.params.doctorId]
        );
        res.status(200).json(rows.map(camelize));
    } catch (error) {
        serverError(res, "Error getting programs", error);
    }
};

export const enrollInProgram = async (req, res) => {
    try {
        const programCode = String(req.body.programCode || "").trim().toUpperCase(); // codes are case-insensitive for users
        if (!programCode) return res.status(400).json({ msg: "Please enter a program code." });

        const program = camelize(await one("select * from programs where program_code = $1", [programCode]));
        if (!program) return res.status(404).json({ msg: "Program not found. Invalid code." });

        const patient = await one("select id from users where id = $1", [req.user.id]);
        if (!patient) return res.status(404).json({ msg: "Patient not found." });

        // ON CONFLICT DO NOTHING is atomic, so a double-click on "Enroll" can't add it twice
        const inserted = await one(
            `insert into program_enrollments (patient_id, program_id) values ($1, $2)
             on conflict do nothing returning program_id`,
            [req.user.id, program._id]
        );
        if (!inserted) return res.status(400).json({ msg: "You are already enrolled in this program." });

        res.status(200).json({ msg: "Successfully enrolled!", program });
    } catch (error) {
        serverError(res, "Error enrolling in program", error);
    }
};

export const deleteProgram = async (req, res) => {
    try {
        const program = await loadOwnProgram(req, res);
        if (!program) return;

        // Remember the video files so they can be removed from storage after the rows are gone
        const videos = await many("select url, thumbnail from videos where program_id = $1", [program._id]);

        // Videos and enrollments are removed by ON DELETE CASCADE
        await withTransaction((db) => db.query("delete from programs where id = $1", [program._id]));
        await Promise.all(videos.flatMap((vid) => [deleteStoredFile(vid.url), deleteStoredFile(vid.thumbnail)]));

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

        const patient = await one("select id from users where id = $1", [patientId]);
        if (!patient) return res.status(404).json({ msg: "Patient not found." });

        const rows = await many(
            `select p.* from program_enrollments pe join programs p on p.id = pe.program_id
              where pe.patient_id = $1 order by pe.enrolled_at`,
            [patientId]
        );
        res.status(200).json(rows.map(camelize));
    } catch (error) {
        serverError(res, "Error getting patient programs", error);
    }
};

export const getProgramPatients = async (req, res) => {
    try {
        const program = await loadOwnProgram(req, res);
        if (!program) return;
        const rows = await many(
            `select u.id, u.name, u.email, u.role from program_enrollments pe
               join users u on u.id = pe.patient_id where pe.program_id = $1`,
            [program._id]
        );
        res.status(200).json(rows.map(camelize));
    } catch (error) {
        serverError(res, "Error getting program patients", error);
    }
};
