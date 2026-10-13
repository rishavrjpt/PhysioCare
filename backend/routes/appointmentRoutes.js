import express from "express";
import {
  createAppointment, getDoctorAppointments, getPatientAppointments,
  updateAppointmentStatus, completeAppointment, reviewAppointment, sendAppointmentToPatient,
} from "../controllers/appointmentController.js";
import { protect, requireRole, requireSelf, validateObjectIds } from "../middleware/authMiddleware.js";

const router = express.Router();

// Every appointment route needs a logged-in user
router.use(protect);
router.param("id", (req, res, next) => validateObjectIds(req, res, next));

router.post("/", requireRole("patient"), createAppointment);
router.get("/doctor/:id", requireRole("doctor", "admin"), requireSelf("id"), getDoctorAppointments);
router.get("/patient/:id", requireRole("patient", "admin"), requireSelf("id"), getPatientAppointments);

// Ownership of the appointment is checked inside each controller
router.patch("/:id/status", updateAppointmentStatus);
router.post("/:id/complete", requireRole("doctor", "admin"), completeAppointment);
router.post("/:id/review", requireRole("patient", "admin"), reviewAppointment);
router.patch("/:id/send-to-patient", requireRole("doctor", "admin"), sendAppointmentToPatient);

export default router;
