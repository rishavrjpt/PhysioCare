import Article from "../models/Article.js";
import User from "../models/User.js";

const CATEGORIES = ["Rehabilitation", "Orthopedic", "Sports", "Wellness", "Neurological", "Nutrition"];
const EDITABLE_FIELDS = ["title", "subtitle", "content", "category", "tags", "coverImage", "status"];

const serverError = (res, label, error) => {
    console.error(`${label}:`, error);
    res.status(500).json({ msg: "Server error" });
};

// ~200 words per minute; strips HTML tags from the rich-text editor before counting
const calcReadTime = (content) => {
    const text = String(content).replace(/<[^>]*>/g, " ").trim();
    const wordCount = text ? text.split(/\s+/).length : 0;
    return `${Math.max(1, Math.ceil(wordCount / 200))} min read`;
};

const cleanTags = (tags) => {
    if (Array.isArray(tags)) return tags.map(String).map((t) => t.trim()).filter(Boolean).slice(0, 20);
    if (typeof tags === "string") return tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 20);
    return [];
};

const safeCover = (value) =>
    typeof value === "string" && (value === "" || /^https?:\/\//i.test(value) || value.startsWith("data:image/"))
        ? value
        : "";

// Create Article (doctor)
export const createArticle = async (req, res) => {
    try {
        const { title, subtitle, content, category, tags, coverImage, status } = req.body;
        if (!title?.trim() || !content?.trim()) {
            return res.status(400).json({ msg: "Title and content are required." });
        }

        const article = await Article.create({
            doctorId: req.user.id, // always the logged-in doctor
            title: title.trim(),
            subtitle: subtitle || "",
            content,
            category: CATEGORIES.includes(category) ? category : "Wellness",
            tags: cleanTags(tags),
            coverImage: safeCover(coverImage || ""),
            status: status === "published" ? "published" : "draft",
            readTime: calcReadTime(content),
        });

        res.status(201).json({ msg: "Article created successfully", article });
    } catch (error) {
        serverError(res, "Error creating article", error);
    }
};

// Get all published articles (for patients) — fast, no images
export const getPublishedArticles = async (req, res) => {
    try {
        const articles = await Article.find({ status: "published" })
            .select("-coverImage") // images fetched separately
            .sort({ createdAt: -1 })
            .lean()
            .maxTimeMS(8000);

        const doctorIds = [...new Set(articles.map(a => a.doctorId?.toString()).filter(Boolean))];
        const doctorMap = {};
        if (doctorIds.length > 0) {
            const doctors = await User.find({ _id: { $in: doctorIds } }).select("name").lean().maxTimeMS(3000);
            doctors.forEach(d => { doctorMap[d._id.toString()] = d.name; });
        }

        res.status(200).json(articles.map(a => ({
            ...a,
            doctorId: { _id: a.doctorId, name: doctorMap[a.doctorId?.toString()] || "Unknown" },
        })));
    } catch (error) {
        console.error("Error fetching articles:", error);
        if (error.codeName === "MaxTimeMSExpired" || error.code === 50) return res.status(200).json([]);
        res.status(500).json({ msg: "Server error" });
    }
};

// Cover images for published articles — background lazy loading
export const getArticleCovers = async (req, res) => {
    try {
        const covers = await Article.find({ status: "published", coverImage: { $ne: "" } })
            .select("_id coverImage")
            .lean()
            .maxTimeMS(15000);
        res.status(200).json(covers);
    } catch (error) {
        console.error("Error fetching article covers:", error);
        res.status(200).json([]); // UI degrades gracefully
    }
};

// Single article. Drafts are only visible to the doctor who wrote them.
// Also counts a view (views were never incremented before).
export const getArticleById = async (req, res) => {
    try {
        const article = await Article.findById(req.params.id).lean().maxTimeMS(8000);
        if (!article) return res.status(404).json({ msg: "Article not found" });

        const isOwner = req.user && (req.user.role === "admin" || article.doctorId.toString() === req.user.id);
        if (article.status !== "published" && !isOwner) {
            return res.status(404).json({ msg: "Article not found" });
        }

        if (article.status === "published" && !isOwner) {
            await Article.updateOne({ _id: article._id }, { $inc: { views: 1 } });
            article.views = (article.views || 0) + 1;
        }

        const doctor = await User.findById(article.doctorId).select("name").lean();
        res.status(200).json({ ...article, doctorId: doctor ? { _id: doctor._id, name: doctor.name } : article.doctorId });
    } catch (error) {
        serverError(res, "Error fetching article", error);
    }
};

// Articles by the logged-in doctor (includes drafts)
export const getDoctorArticles = async (req, res) => {
    try {
        const articles = await Article.find({ doctorId: req.params.id })
            .select("-coverImage")
            .sort({ createdAt: -1 })
            .lean();
        res.status(200).json(articles);
    } catch (error) {
        serverError(res, "Error fetching doctor articles", error);
    }
};

const loadOwnArticle = async (req, res) => {
    const article = await Article.findById(req.params.id);
    if (!article) {
        res.status(404).json({ msg: "Article not found" });
        return null;
    }
    if (req.user.role !== "admin" && article.doctorId.toString() !== req.user.id) {
        res.status(403).json({ msg: "This is not your article." });
        return null;
    }
    return article;
};

export const deleteArticle = async (req, res) => {
    try {
        const article = await loadOwnArticle(req, res);
        if (!article) return;
        await Article.findByIdAndDelete(article._id);
        res.status(200).json({ msg: "Article deleted successfully" });
    } catch (error) {
        serverError(res, "Error deleting article", error);
    }
};

// Update article — only whitelisted fields (doctorId, views, likes can't be changed)
export const updateArticle = async (req, res) => {
    try {
        const article = await loadOwnArticle(req, res);
        if (!article) return;

        for (const field of EDITABLE_FIELDS) {
            if (req.body[field] === undefined) continue;
            if (field === "category" && !CATEGORIES.includes(req.body.category)) continue;
            if (field === "status" && !["draft", "published"].includes(req.body.status)) continue;
            if (field === "tags") article.tags = cleanTags(req.body.tags);
            else if (field === "coverImage") article.coverImage = safeCover(req.body.coverImage);
            else article[field] = req.body[field];
        }
        if (!article.title?.trim() || !article.content?.trim()) {
            return res.status(400).json({ msg: "Title and content cannot be empty." });
        }
        article.readTime = calcReadTime(article.content);
        await article.save();

        res.status(200).json({ msg: "Article updated", article });
    } catch (error) {
        serverError(res, "Error updating article", error);
    }
};
