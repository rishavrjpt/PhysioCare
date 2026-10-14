import express from "express";
import multer from "multer";
import path from "path";
import { createMember, getAllMembers, getMemberById, deleteMember } from "../controllers/teamController.js";
import { protect, requireRole, validateObjectIds } from "../middleware/authMiddleware.js";

const router = express.Router();

const IMAGE_EXTENSIONS = [".jpeg", ".jpg", ".png", ".gif", ".webp"];

// Held in memory and uploaded to Supabase Storage by the controller.
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    // Check the exact extension and MIME type (the old regex only checked that "png" etc. appeared somewhere).
    const ext = path.extname(file.originalname).toLowerCase();
    if (IMAGE_EXTENSIONS.includes(ext) && file.mimetype.startsWith("image/")) return cb(null, true);
    const err = new Error("Only image files are allowed.");
    err.status = 400;
    cb(err);
  },
});

router.get("/", getAllMembers);
router.get("/:id", validateObjectIds, getMemberById);
router.post("/", protect, upload.single("photo"), createMember);       // any logged-in user
router.delete("/:id", validateObjectIds, protect, requireRole("admin"), deleteMember);

export default router;
