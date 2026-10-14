import { one, many, UNIQUE_VIOLATION } from "../config/pg.js";
import { camelize } from "../utils/rows.js";
import { isUuid } from "../utils/rows.js";
import { insertRow, updateBy } from "../utils/sql.js";

const STATUSES = ["Pending", "Confirmed", "Completed", "Cancelled", "Rescheduled"];
const SLOT_TAKEN_MSG = "This time slot is already booked. Please choose another time.";

const serverError = (res, label, error) => {
    console.error(`${label}:`, error);
    res.status(500).json({ msg: "Server error" });
};

// The partial unique index appointments_no_double_booking fires when two active
// bookings share a doctor/date/time (including when a cancelled slot is re-activated).
const isSlotClash = (error) => error?.code === UNIQUE_VIOLATION && /double_booking/.test(error.constraint || "");

// Loads the appointment and checks the logged-in user is its doctor / patient.
// Returns the appointment, or sends an error response and returns null.
const loadOwnAppointment = async (req, res, side) => {
    const appointment = camelize(await one("select * from appointments where id = $1", [req.params.id]));
    if (!appointment) {
        res.status(404).json({ msg: "Appointment not found" });
        return null;
    }
    const me = req.user;
    const isDoctor = appointment.doctorId === me.id;
    const isPatient = appointment.patientId === me.id;
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

        if (!doctorId || !isUuid(doctorId)) {
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

        const doctor = await one("select role from users where id = $1", [doctorId]);
        if (!doctor || doctor.role !== "doctor") {
            return res.status(404).json({ msg: "Doctor not found" });
        }

        // Stop double-booking the same doctor at the same slot
        const clash = await one(
            "select 1 from appointments where doctor_id = $1 and date = $2 and time = $3 and status in ('Pending','Confirmed')",
            [doctorId, String(date), String(time)]
        );
        if (clash) return res.status(409).json({ msg: SLOT_TAKEN_MSG });

        let row;
        try {
            row = await insertRow("appointments", {
                patientId,
                doctorId,
                date: String(date),
                time: String(time),
                notes: notes ? String(notes) : "",
                status: "Pending",
            });
        } catch (err) {
            // Two requests passed the check above at the same moment - the index stops the second.
            if (isSlotClash(err)) return res.status(409).json({ msg: SLOT_TAKEN_MSG });
            throw err;
        }

        res.status(201).json({ msg: "Appointment created successfully", appointment: camelize(row) });
    } catch (error) {
        serverError(res, "Error creating appointment", error);
    }
};

// Get Doctor Appointments (route ensures :id is the logged-in doctor)
export const getDoctorAppointments = async (req, res) => {
    try {
        const rows = await many(
            `select a.*, u.name as other_name, u.email as other_email
               from appointments a join users u on u.id = a.patient_id
              where a.doctor_id = $1 order by a.created_at desc`,
            [req.params.id]
        );
        res.status(200).json(rows.map((r) => {
            const { otherName, otherEmail, ...appt } = camelize(r);
            return { ...appt, patientId: { _id: appt.patientId, name: otherName, email: otherEmail } };
        }));
    } catch (error) {
        serverError(res, "Error fetching doctor appointments", error);
    }
};

// Get Patient Appointments (route ensures :id is the logged-in patient)
export const getPatientAppointments = async (req, res) => {
    try {
        const rows = await many(
            `select a.*, u.name as other_name, u.email as other_email
               from appointments a join users u on u.id = a.doctor_id
              where a.patient_id = $1 order by a.created_at desc`,
            [req.params.id]
        );
        res.status(200).json(rows.map((r) => {
            const { otherName, otherEmail, ...appt } = camelize(r);
            return { ...appt, doctorId: { _id: appt.doctorId, name: otherName, email: otherEmail } };
        }));
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

        const isDoctor = req.user.role === "admin" || appointment.doctorId === req.user.id;

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

        let row;
        try {
            row = await updateBy("appointments", "id", appointment._id, { status });
        } catch (err) {
            if (isSlotClash(err)) return res.status(409).json({ msg: SLOT_TAKEN_MSG });
            throw err;
        }
        res.status(200).json({ msg: "Appointment status updated", appointment: camelize(row) });
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
            const program = await one(
                "select title from programs where program_code = $1 and doctor_id = $2",
                [programCode, appointment.doctorId]
            );
            if (!program) return res.status(400).json({ msg: "Program code not found in your programs." });
            programTitle = program.title;
        }

        // Session number = completed sessions this patient already had with this doctor + 1.
        // (Excludes this appointment, so completing it twice doesn't skip a number.)
        let sessionNumber = appointment.sessionNumber;
        if (appointment.status !== "Completed" || !sessionNumber) {
            const past = await one(
                `select count(*)::int as n from appointments
                  where id <> $1 and patient_id = $2 and doctor_id = $3 and status = 'Completed'`,
                [appointment._id, appointment.patientId, appointment.doctorId]
            );
            sessionNumber = past.n + 1;
        }

        const row = await updateBy("appointments", "id", appointment._id, {
            status: "Completed",
            sessionNumber,
            problemDescription: problemDescription ?? null,
            medicine: medicine ?? null,
            suggestion: suggestion ?? null,
            followUpNeeded: Boolean(followUpNeeded),
            followUpDate: followUpNeeded ? (followUpDate ?? null) : "",
            programCode: programCode || undefined,
            programTitle: programCode ? programTitle : undefined,
        });
        res.status(200).json({ msg: "Appointment marked as completed", appointment: camelize(row) });
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

        const row = await updateBy("appointments", "id", appointment._id, {
            patientRating: rating,
            patientFeeling: patientFeeling || null,
            patientReview: patientReview ?? null,
        });
        res.status(200).json({ msg: "Review submitted successfully", appointment: camelize(row) });
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
        const row = await updateBy("appointments", "id", appointment._id, { sentToPatient: true });
        res.status(200).json({ msg: "Report sent to patient successfully", appointment: camelize(row) });
    } catch (error) {
        serverError(res, "Error sending report to patient", error);
    }
};
