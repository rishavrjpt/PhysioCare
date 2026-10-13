import mongoose from "mongoose";
import Appointment from "../models/Appointment.js";
import User from "../models/User.js";
import Program from "../models/Program.js";

const STATUSES = ["Pending", "Confirmed", "Completed", "Cancelled", "Rescheduled"];

const serverError = (res, label, error) => {
    console.error(`${label}:`, error);
    res.status(500).json({ msg: "Server error" });
};

// Loads the appointment and checks the logged-in user is its doctor / patient.
// Returns the appointment, or sends an error response and returns null.
const loadOwnAppointment = async (req, res, side) => {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
        res.status(404).json({ msg: "Appointment not found" });
        return null;
    }
    const me = req.user;
    const isDoctor = appointment.doctorId.toString() === me.id;
    const isPatient = appointment.patientId.toString() === me.id;
    const ok = me.role === "admin"
        || (side === "doctor" && isDoctor)
        || (side === "patient" && isPatient)
        || (side === "either" && (isDoctor || isPatient));
    if (!ok) {
        res.status(403).json({ msg: "This is not your appointment." });
        return null;
    }
    return appointment;
};

// Create Appointment (patient books with a doctor)
export const createAppointment = async (req, res) => {
    try {
        const { doctorId, date, time, notes } = req.body;
        const patientId = req.user.id; // always the logged-in patient, never from the body

        if (!doctorId || !mongoose.isValidObjectId(doctorId)) {
            return res.status(400).json({ msg: "A valid doctor is required." });
        }
        if (!date || !time) {
            return res.status(400).json({ msg: "Please select both date and time." });
        }
        // Compare against "yesterday" in UTC so users in any timezone can still book today.
        const earliest = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(date) && date < earliest) {
            return res.status(400).json({ msg: "You cannot book an appointment in the past." });
        }

        const doctor = await User.findById(doctorId).select("role").lean();
        if (!doctor || doctor.role !== "doctor") {
            return res.status(404).json({ msg: "Doctor not found" });
        }

        // Stop double-booking the same doctor at the same slot
        const clash = await Appointment.exists({
            doctorId, date, time, status: { $in: ["Pending", "Confirmed"] },
        });
        if (clash) {
            return res.status(409).json({ msg: "This time slot is already booked. Please choose another time." });
        }

        const appointment = await Appointment.create({
            patientId,
            doctorId,
            date,
            time,
            notes: notes || "",
            status: "Pending",
        });

        res.status(201).json({ msg: "Appointment created successfully", appointment });
    } catch (error) {
        serverError(res, "Error creating appointment", error);
    }
};

// Get Doctor Appointments (route ensures :id is the logged-in doctor)
export const getDoctorAppointments = async (req, res) => {
    try {
        const appointments = await Appointment.find({ doctorId: req.params.id })
            .populate("patientId", "name email")
            .sort({ createdAt: -1 })
            .lean();
        res.status(200).json(appointments);
    } catch (error) {
        serverError(res, "Error fetching doctor appointments", error);
    }
};

// Get Patient Appointments (route ensures :id is the logged-in patient)
export const getPatientAppointments = async (req, res) => {
    try {
        const appointments = await Appointment.find({ patientId: req.params.id })
            .populate("doctorId", "name email")
            .sort({ createdAt: -1 })
            .lean();
        res.status(200).json(appointments);
    } catch (error) {
        serverError(res, "Error fetching patient appointments", error);
    }
};

// Update Appointment Status
// Doctor: any status except "Completed" (that goes through /complete with the session report).
// Patient: may only cancel their own Pending/Confirmed appointment.
export const updateAppointmentStatus = async (req, res) => {
    try {
        const { status } = req.body;
        if (!STATUSES.includes(status)) return res.status(400).json({ msg: "Invalid status" });

        const appointment = await loadOwnAppointment(req, res, "either");
        if (!appointment) return;

        const isDoctor = req.user.role === "admin" || appointment.doctorId.toString() === req.user.id;

        if (!isDoctor) {
            if (status !== "Cancelled") {
                return res.status(403).json({ msg: "Patients can only cancel appointments." });
            }
            if (!["Pending", "Confirmed"].includes(appointment.status)) {
                return res.status(400).json({ msg: `A ${appointment.status.toLowerCase()} appointment cannot be cancelled.` });
            }
        } else if (status === "Completed") {
            return res.status(400).json({ msg: "Use 'Complete appointment' to add the session report." });
        }

        if (appointment.status === "Completed") {
            return res.status(400).json({ msg: "This appointment is already completed." });
        }

        appointment.status = status;
        await appointment.save();
        res.status(200).json({ msg: "Appointment status updated", appointment });
    } catch (error) {
        serverError(res, "Error updating appointment status", error);
    }
};

// Complete Appointment (Doctor side)
export const completeAppointment = async (req, res) => {
    try {
        const appointment = await loadOwnAppointment(req, res, "doctor");
        if (!appointment) return;

        if (appointment.status === "Cancelled") {
            return res.status(400).json({ msg: "A cancelled appointment cannot be completed." });
        }

        const { problemDescription, medicine, suggestion, followUpNeeded, followUpDate } = req.body;
        const programCode = req.body.programCode ? String(req.body.programCode).trim().toUpperCase() : "";

        let programTitle = "";
        if (programCode) {
            // Only allow assigning one of this doctor's own programs
            const program = await Program.findOne({ programCode, doctorId: appointment.doctorId });
            if (!program) return res.status(400).json({ msg: "Program code not found in your programs." });
            programTitle = program.title;
        }

        // Session number = completed sessions this patient already had with this doctor + 1.
        // (Excludes this appointment, so completing it twice doesn't skip a number.)
        if (appointment.status !== "Completed" || !appointment.sessionNumber) {
            const pastSessions = await Appointment.countDocuments({
                _id: { $ne: appointment._id },
                patientId: appointment.patientId,
                doctorId: appointment.doctorId,
                status: "Completed",
            });
            appointment.sessionNumber = pastSessions + 1;
        }

        appointment.status = "Completed";
        appointment.problemDescription = problemDescription;
        appointment.medicine = medicine;
        appointment.suggestion = suggestion;
        appointment.followUpNeeded = Boolean(followUpNeeded);
        appointment.followUpDate = followUpNeeded ? followUpDate : "";
        if (programCode) {
            appointment.programCode = programCode;
            appointment.programTitle = programTitle;
        }

        await appointment.save();
        res.status(200).json({ msg: "Appointment marked as completed", appointment });
    } catch (error) {
        serverError(res, "Error completing appointment", error);
    }
};

// Review Appointment (Patient side)
export const reviewAppointment = async (req, res) => {
    try {
        const appointment = await loadOwnAppointment(req, res, "patient");
        if (!appointment) return;

        if (appointment.status !== "Completed") {
            return res.status(400).json({ msg: "Can only review completed appointments" });
        }

        const { patientRating, patientFeeling, patientReview } = req.body;
        const rating = Number(patientRating);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            return res.status(400).json({ msg: "Rating must be between 1 and 5." });
        }
        if (patientFeeling && !["Better", "Same", "Worse"].includes(patientFeeling)) {
            return res.status(400).json({ msg: "Invalid feeling value." });
        }

        appointment.patientRating = rating;
        appointment.patientFeeling = patientFeeling || undefined;
        appointment.patientReview = patientReview;
        await appointment.save();

        res.status(200).json({ msg: "Review submitted successfully", appointment });
    } catch (error) {
        serverError(res, "Error submitting review", error);
    }
};

// Send appointment report to patient (Doctor side)
export const sendAppointmentToPatient = async (req, res) => {
    try {
        const appointment = await loadOwnAppointment(req, res, "doctor");
        if (!appointment) return;

        if (appointment.status !== "Completed") {
            return res.status(400).json({ msg: "Can only send report for completed appointments" });
        }
        appointment.sentToPatient = true;
        await appointment.save();
        res.status(200).json({ msg: "Report sent to patient successfully", appointment });
    } catch (error) {
        serverError(res, "Error sending report to patient", error);
    }
};
