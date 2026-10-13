import express from "express";
import {
  createArticle, getPublishedArticles, getArticleCovers, getDoctorArticles,
  getArticleById, deleteArticle, updateArticle,
} from "../controllers/articleController.js";
import { protect, optionalAuth, requireRole, requireSelf, validateObjectIds } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public
router.get("/published", getPublishedArticles);
router.get("/covers", getArticleCovers);

// Doctor only
router.post("/", protect, requireRole("doctor", "admin"), createArticle);
router.get("/doctor/:id", validateObjectIds, protect, requireRole("doctor", "admin"), requireSelf("id"), getDoctorArticles);
router.patch("/:id", validateObjectIds, protect, requireRole("doctor", "admin"), updateArticle);
router.delete("/:id", validateObjectIds, protect, requireRole("doctor", "admin"), deleteArticle);

// Published articles are public; drafts only for their author
router.get("/:id", validateObjectIds, optionalAuth, getArticleById);

export default router;
