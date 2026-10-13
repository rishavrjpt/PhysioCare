import express from "express";
import {
  getAllDoctors, getDoctorById, updateDoctorProfile, toggleAvailability,
  getPatientNote, savePatientNote,
} from "../controllers/doctorController.js";
import { protect, requireRole, requireSelf, validateObjectIds } from "../middleware/authMiddleware.js";

const router = express.Router();

// Private doctor notes (doctor only, always scoped to the logged-in doctor)
router.get("/patient-note/:doctorId/:patientId", validateObjectIds, protect, requireRole("doctor", "admin"), getPatientNote);
router.post("/patient-note", protect, requireRole("doctor", "admin"), savePatientNote);

// Public doctor directory
router.get("/", getAllDoctors);
router.get("/:id", validateObjectIds, getDoctorById);

// A doctor can only change their own profile / availability
router.put("/:id/profile", validateObjectIds, protect, requireRole("doctor", "admin"), requireSelf("id"), updateDoctorProfile);
router.patch("/:id/availability", validateObjectIds, protect, requireRole("doctor", "admin"), requireSelf("id"), toggleAvailability);

export default router;
