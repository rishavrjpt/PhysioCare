import express from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import {
  createVideo, getGeneralVideos, getProgramVideos, updateVideo,
  deleteVideo, getGeneralVideosByDoctor, logSession,
} from "../controllers/videoController.js";
import { VIDEOS_DIR } from "../config/paths.js";
import { protect, requireRole, validateObjectIds } from "../middleware/authMiddleware.js";

const router = express.Router();

const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".m4v", ".ogg"];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, VIDEOS_DIR), // absolute path, folder created at startup
  filename: (req, file, cb) => {
    // Random name: Date.now() alone can collide when two uploads land in the same millisecond
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`);
  },
});

const upload = multer({
  storage,
  // fieldSize: the auto-generated thumbnail is sent as a base64 text field; for high-resolution
  // videos it can exceed multer's 1 MB default and fail with "Field value too long".
  limits: { fileSize: 100 * 1024 * 1024, fieldSize: 5 * 1024 * 1024 }, // 100 MB video
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (VIDEO_EXTENSIONS.includes(ext) && file.mimetype.startsWith("video/")) return cb(null, true);
    const err = new Error("Only video files (mp4, webm, mov, m4v, ogg) are allowed.");
    err.status = 400;
    cb(err);
  },
});

// Public video library
router.get("/general", getGeneralVideos);
router.get("/general/doctor/:doctorId", validateObjectIds, getGeneralVideosByDoctor);

// Logged-in routes
router.get("/program/:programId", validateObjectIds, protect, getProgramVideos);
router.post("/log-session", protect, requireRole("patient"), logSession);
// protect runs before multer so anonymous uploads are rejected before any file is written
router.post("/", protect, requireRole("doctor", "admin"), upload.single("videoFile"), createVideo);
router.put("/:id", validateObjectIds, protect, requireRole("doctor", "admin"), updateVideo);
router.delete("/:id", validateObjectIds, protect, requireRole("doctor", "admin"), deleteVideo);

export default router;
