import express from "express";
import {
  createProgram, getDoctorPrograms, enrollInProgram,
  getPatientPrograms, deleteProgram, getProgramPatients,
} from "../controllers/programController.js";
import { protect, requireRole, requireSelf, validateObjectIds } from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(protect);

router.post("/", requireRole("doctor", "admin"), createProgram);
router.get("/doctor/:doctorId", validateObjectIds, requireRole("doctor", "admin"), requireSelf("doctorId"), getDoctorPrograms);
router.post("/enroll", requireRole("patient"), enrollInProgram);
router.get("/patient/:patientId", validateObjectIds, getPatientPrograms);
router.delete("/:id", validateObjectIds, requireRole("doctor", "admin"), deleteProgram);
router.get("/:id/patients", validateObjectIds, requireRole("doctor", "admin"), getProgramPatients);

export default router;
