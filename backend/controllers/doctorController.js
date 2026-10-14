import { one, many } from "../config/pg.js";
import { camelize } from "../utils/rows.js";
import { isUuid } from "../utils/rows.js";
import { updateBy } from "../utils/sql.js";
import { doctorHasPatient } from "../utils/relations.js";

// A doctor_profiles row in the old Mongoose shape: `user` is the doctor's id, or a
// { _id, name, email } object when the caller passes the populated user.
const profileOut = (row, user) => {
    const { userId, ...rest } = camelize(row);
    return { ...rest, user: user || userId };
};

const DEFAULT_PROFILE = {
    experience: "0 Years",
    patientsCount: "0+",
    rating: 0,
    fees: 0,
    about: "",
    specialization: "Physiotherapist",
    bio: "",
    licenceNumber: "",
    hospitalName: "",
    availableDays: [],
    availableTimeStart: "",
    availableTimeEnd: "",
    languages: [],
    isAvailable: false,
};

// Fetch all doctors (with optional city filter)
export const getAllDoctors = async (req, res) => {
    try {
        const { city } = req.query;

        // Substring match, case-insensitive. position() avoids LIKE wildcard escaping.
        const params = [];
        let cityFilter = "";
        if (city) {
            params.push(String(city).trim().toLowerCase());
            cityFilter = "and position($1 in lower(city)) > 0";
        }

        const doctors = camelizeRows(await many(
            `select id, name, email, city, phone, profile_photo from users
              where role = 'doctor' and is_verified ${cityFilter}`,
            params
        ));

        // Fetch only these doctors' profiles and index them by user id
        const profiles = doctors.length
            ? await many("select * from doctor_profiles where user_id = any($1::uuid[])", [doctors.map((d) => d._id)])
            : [];
        const profileByUser = new Map(profiles.map((p) => [p.user_id, p]));

        const merged = doctors.map((doc) => {
            const row = profileByUser.get(doc._id);
            return {
                _id: doc._id,
                name: doc.name,
                email: doc.email,
                city: doc.city || "",
                phone: doc.phone || "",
                profilePhoto: doc.profilePhoto || "",
                profile: row ? profileOut(row, { _id: doc._id, name: doc.name, email: doc.email }) : null,
            };
        });

        res.status(200).json(merged);
    } catch (error) {
        console.error("Error fetching doctors:", error);
        res.status(500).json({ msg: "Server error" });
    }
};

const camelizeRows = (rows) => rows.map(camelize);

// Fetch specific doctor details
export const getDoctorById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = camelize(await one(
            "select id, name, email, role, city, phone, profile_photo from users where id = $1", [id]
        ));
        if (!user || user.role !== "doctor") {
            return res.status(404).json({ msg: "Doctor not found" });
        }

        const row = await one("select * from doctor_profiles where user_id = $1", [id]);
        const userInfo = { _id: user._id, name: user.name, email: user.email };
        // If profile doesn't exist, return empty profile structure
        const profile = row ? profileOut(row, userInfo) : { user: userInfo, ...DEFAULT_PROFILE };

        res.status(200).json({
            ...profile,
            city: user.city || "",
            phone: user.phone || "",
            profilePhoto: user.profilePhoto || "",
        });
    } catch (error) {
        console.error("Error fetching doctor profile:", error);
        res.status(500).json({ msg: "Server error" });
    }
};

// Update or Create Doctor Profile
export const updateDoctorProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            experience, patientsCount, fees, about, specialization,
            bio, licenceNumber, hospitalName,
            availableDays, availableTimeStart, availableTimeEnd, languages
        } = req.body;

        const text = (v) => (v === undefined ? undefined : String(v ?? ""));
        const list = (v) => (v === undefined ? undefined : Array.isArray(v) ? v.map(String) : []);

        await one("insert into doctor_profiles (user_id) values ($1) on conflict (user_id) do nothing returning id", [id]);
        const row = await updateBy("doctor_profiles", "user_id", id, {
            experience: text(experience),
            patientsCount: text(patientsCount),
            fees: fees !== undefined && fees !== "" ? Number(fees) || 0 : undefined,
            about: text(about),
            specialization: specialization !== undefined && specialization !== "" ? String(specialization) : undefined,
            bio: text(bio),
            licenceNumber: text(licenceNumber),
            hospitalName: text(hospitalName),
            availableDays: list(availableDays),
            availableTimeStart: text(availableTimeStart),
            availableTimeEnd: text(availableTimeEnd),
            languages: list(languages),
        });

        res.status(200).json({ msg: "Profile updated successfully", profile: profileOut(row) });
    } catch (error) {
        console.error("Error updating doctor profile:", error);
        res.status(500).json({ msg: "Server error" });
    }
};

// Toggle Doctor Availability
export const toggleAvailability = async (req, res) => {
    try {
        const { id } = req.params;
        const row = await one(
            `insert into doctor_profiles (user_id, is_available) values ($1, true)
             on conflict (user_id) do update set is_available = not doctor_profiles.is_available
             returning is_available`,
            [id]
        );
        res.status(200).json({ msg: "Availability updated", isAvailable: row.is_available });
    } catch (error) {
        console.error("Error toggling availability:", error);
        res.status(500).json({ msg: "Server error" });
    }
};

// Get specific patient note for the logged-in doctor
export const getPatientNote = async (req, res) => {
    try {
        const { patientId } = req.params;
        const doctorId = req.user.id; // never trust the doctorId in the URL
        const note = await one("select * from patient_notes where doctor_id = $1 and patient_id = $2", [doctorId, patientId]);
        res.status(200).json(note ? camelize(note) : { note: "" });
    } catch (error) {
        console.error("Error fetching patient note:", error);
        res.status(500).json({ msg: "Server error" });
    }
};

// Save specific patient note for the logged-in doctor
export const savePatientNote = async (req, res) => {
    try {
        const { patientId, note } = req.body;
        const doctorId = req.user.id;

        if (!patientId || !isUuid(patientId)) {
            return res.status(400).json({ msg: "A valid patientId is required." });
        }
        if (!(await doctorHasPatient(doctorId, patientId))) {
            return res.status(403).json({ msg: "This patient is not under your care." });
        }

        // Atomic upsert. An empty note is allowed so a doctor can clear it.
        const row = await one(
            `insert into patient_notes (doctor_id, patient_id, note) values ($1, $2, $3)
             on conflict (doctor_id, patient_id) do update set note = excluded.note
             returning *`,
            [doctorId, patientId, typeof note === "string" ? note : ""]
        );

        res.status(200).json({ msg: "Note saved successfully", patientNote: camelize(row) });
    } catch (error) {
        console.error("Error saving patient note:", error);
        res.status(500).json({ msg: "Server error" });
    }
};
