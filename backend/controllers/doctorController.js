import mongoose from "mongoose";
import DoctorProfile from "../models/DoctorProfile.js";
import User from "../models/User.js";
import PatientNote from "../models/PatientNote.js";
import { escapeRegex, SAFE_USER_SELECT } from "../utils/sanitize.js";
import { doctorHasPatient } from "../utils/relations.js";

// Fetch all doctors (with optional city filter)
export const getAllDoctors = async (req, res) => {
    try {
        const { city } = req.query;

        // Build query filter
        const filter = { role: "doctor", isVerified: true };
        if (city) {
            // Escape user input: "(" or "*" in the city used to crash the query (invalid regex)
            filter.city = { $regex: escapeRegex(String(city).trim()), $options: "i" };
        }

        // Find all users with role 'doctor'
        const doctors = await User.find(filter).select("name email city phone profilePhoto").lean();

        // Fetch only these doctors' profiles and index them by user id (was O(n²) over every profile)
        const profiles = await DoctorProfile.find({ user: { $in: doctors.map(d => d._id) } })
            .populate("user", "name email").lean();
        const profileByUser = new Map(profiles.filter(p => p.user).map(p => [p.user._id.toString(), p]));

        // Merge user info with profile info
        const mergedDoctors = doctors.map(doc => {
            const profile = profileByUser.get(doc._id.toString());
            return {
                _id: doc._id,
                name: doc.name,
                email: doc.email,
                city: doc.city || "",
                phone: doc.phone || "",
                profilePhoto: doc.profilePhoto || "",
                profile: profile || null
            };
        });

        res.status(200).json(mergedDoctors);
    } catch (error) {
        console.error("Error fetching doctors:", error);
        res.status(500).json({ msg: "Server error" });
    }
};

// Fetch specific doctor details
export const getDoctorById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id).select(SAFE_USER_SELECT).lean();
        if (!user || user.role !== "doctor") {
            return res.status(404).json({ msg: "Doctor not found" });
        }

        let profile = await DoctorProfile.findOne({ user: id }).populate("user", "name email").lean();

        if (!profile) {
            // If profile doesn't exist, return empty profile structure
            profile = {
                user: { _id: user._id, name: user.name, email: user.email },
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
                isAvailable: false
            };
        }

        res.status(200).json({
            ...profile.toObject ? profile.toObject() : profile,
            city: user.city || "",
            phone: user.phone || "",
            profilePhoto: user.profilePhoto || ""
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

        let profile = await DoctorProfile.findOne({ user: id });

        if (profile) {
            if (experience !== undefined) profile.experience = experience;
            if (patientsCount !== undefined) profile.patientsCount = patientsCount;
            if (fees !== undefined && fees !== "") profile.fees = Number(fees) || 0;
            if (about !== undefined) profile.about = about;
            if (specialization !== undefined && specialization !== "") profile.specialization = specialization;
            if (bio !== undefined) profile.bio = bio;
            if (licenceNumber !== undefined) profile.licenceNumber = licenceNumber;
            if (hospitalName !== undefined) profile.hospitalName = hospitalName;
            if (availableDays !== undefined) profile.availableDays = availableDays;
            if (availableTimeStart !== undefined) profile.availableTimeStart = availableTimeStart;
            if (availableTimeEnd !== undefined) profile.availableTimeEnd = availableTimeEnd;
            if (languages !== undefined) profile.languages = languages;
            await profile.save();
        } else {
            profile = await DoctorProfile.create({
                user: id,
                experience, patientsCount, fees: Number(fees) || 0, about, specialization,
                bio, licenceNumber, hospitalName,
                availableDays, availableTimeStart, availableTimeEnd, languages
            });
        }

        res.status(200).json({ msg: "Profile updated successfully", profile });
    } catch (error) {
        console.error("Error updating doctor profile:", error);
        res.status(500).json({ msg: "Server error" });
    }
};

// Toggle Doctor Availability
export const toggleAvailability = async (req, res) => {
    try {
        const { id } = req.params;
        let profile = await DoctorProfile.findOne({ user: id });

        if (!profile) {
            profile = await DoctorProfile.create({ user: id, isAvailable: true });
        } else {
            profile.isAvailable = !profile.isAvailable;
            await profile.save();
        }

        res.status(200).json({ msg: "Availability updated", isAvailable: profile.isAvailable });
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
        const note = await PatientNote.findOne({ doctorId, patientId }).lean();
        res.status(200).json(note || { note: "" });
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

        if (!patientId || !mongoose.isValidObjectId(patientId)) {
            return res.status(400).json({ msg: "A valid patientId is required." });
        }
        if (!(await doctorHasPatient(doctorId, patientId))) {
            return res.status(403).json({ msg: "This patient is not under your care." });
        }

        // Upsert in one atomic step (avoids the duplicate-key race of find-then-create).
        // An empty note is allowed so a doctor can clear it (schema used to reject "").
        const patientNote = await PatientNote.findOneAndUpdate(
            { doctorId, patientId },
            { note: typeof note === "string" ? note : "" },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        res.status(200).json({ msg: "Note saved successfully", patientNote });
    } catch (error) {
        console.error("Error saving patient note:", error);
        res.status(500).json({ msg: "Server error" });
    }
};
