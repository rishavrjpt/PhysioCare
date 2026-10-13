import express from "express";
import { getStatus, streamChat } from "../controllers/chatController.js";
import { optionalAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public endpoint to check if Cyan AI is enabled
router.get("/status", getStatus);

// Endpoint for SSE streaming chat (works for logged-in patients/doctors and visitors)
router.post("/stream", optionalAuth, streamChat);

export default router;
