import express from "express";
import multer from "multer";
import path from "path";
import {
  createVideo, getGeneralVideos, getProgramVideos, updateVideo,
  deleteVideo, getGeneralVideosByDoctor, logSession,
} from "../controllers/videoController.js";
import { protect, requireRole, validateObjectIds } from "../middleware/authMiddleware.js";

const router = express.Router();

const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".m4v", ".ogg"];

// Files are held in memory and streamed to Supabase Storage by the controller (nothing is written to disk).
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  // fieldSize: the auto-generated thumbnail is sent as a base64 text field; for high-resolution
  // videos it can exceed multer's 1 MB default and fail with "Field value too long".
  limits: { fileSize: 50 * 1024 * 1024, fieldSize: 5 * 1024 * 1024 }, // 50 MB video (Supabase free-tier limit)
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
const uploadVideoFile = (req, res, next) =>
  upload.single("videoFile")(req, res, (err) => {
    if (err?.code === "LIMIT_FILE_SIZE") return res.status(400).json({ msg: "Video must be under 50 MB" });
    next(err);
  });
router.post("/", protect, requireRole("doctor", "admin"), uploadVideoFile, createVideo);
router.put("/:id", validateObjectIds, protect, requireRole("doctor", "admin"), updateVideo);
router.delete("/:id", validateObjectIds, protect, requireRole("doctor", "admin"), deleteVideo);

export default router;
