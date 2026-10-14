import { one, many } from "../config/pg.js";
import { camelize } from "../utils/rows.js";
import { insertRow, updateBy } from "../utils/sql.js";
import { storeImageIfInline, deleteStoredFile } from "../config/storage.js";

const CATEGORIES = ["Rehabilitation", "Orthopedic", "Sports", "Wellness", "Neurological", "Nutrition"];
const EDITABLE_FIELDS = ["title", "subtitle", "content", "category", "tags", "coverImage", "status"];
const NO_COVER = "id, doctor_id, title, subtitle, content, category, tags, status, read_time, views, likes, created_at, updated_at";

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

        // Inline (base64) cover images go to Supabase Storage; the column keeps just the URL
        const cover = await storeImageIfInline(safeCover(coverImage || ""), "covers");

        const row = await insertRow("articles", {
            doctorId: req.user.id, // always the logged-in doctor
            title: title.trim(),
            subtitle: subtitle ? String(subtitle) : "",
            content: String(content),
            category: CATEGORIES.includes(category) ? category : "Wellness",
            tags: cleanTags(tags),
            coverImage: cover,
            status: status === "published" ? "published" : "draft",
            readTime: calcReadTime(content),
        });

        res.status(201).json({ msg: "Article created successfully", article: camelize(row) });
    } catch (error) {
        serverError(res, "Error creating article", error);
    }
};

// Get all published articles (for patients) - fast, no images
export const getPublishedArticles = async (req, res) => {
    try {
        const rows = await many(
            `select ${NO_COVER.split(", ").map((c) => "a." + c).join(", ")}, u.name as doctor_name
               from articles a left join users u on u.id = a.doctor_id
              where a.status = 'published' order by a.created_at desc`
        );
        res.status(200).json(rows.map((r) => {
            const { doctorName, ...article } = camelize(r);
            return { ...article, doctorId: { _id: article.doctorId, name: doctorName || "Unknown" } };
        }));
    } catch (error) {
        console.error("Error fetching articles:", error);
        res.status(500).json({ msg: "Server error" });
    }
};

// Cover images for published articles - background lazy loading
export const getArticleCovers = async (req, res) => {
    try {
        const rows = await many(
            "select id, cover_image from articles where status = 'published' and cover_image <> ''"
        );
        res.status(200).json(rows.map(camelize));
    } catch (error) {
        console.error("Error fetching article covers:", error);
        res.status(200).json([]); // UI degrades gracefully
    }
};

// Single article. Drafts are only visible to the doctor who wrote them.
// Also counts a view.
export const getArticleById = async (req, res) => {
    try {
        const article = camelize(await one("select * from articles where id = $1", [req.params.id]));
        if (!article) return res.status(404).json({ msg: "Article not found" });

        const isOwner = req.user && (req.user.role === "admin" || article.doctorId === req.user.id);
        if (article.status !== "published" && !isOwner) {
            return res.status(404).json({ msg: "Article not found" });
        }

        if (article.status === "published" && !isOwner) {
            const bumped = await one("update articles set views = views + 1 where id = $1 returning views", [article._id]);
            article.views = bumped.views;
        }

        const doctor = await one("select id, name from users where id = $1", [article.doctorId]);
        res.status(200).json({ ...article, doctorId: doctor ? { _id: doctor.id, name: doctor.name } : article.doctorId });
    } catch (error) {
        serverError(res, "Error fetching article", error);
    }
};

// Articles by the logged-in doctor (includes drafts)
export const getDoctorArticles = async (req, res) => {
    try {
        const rows = await many(
            `select ${NO_COVER} from articles where doctor_id = $1 order by created_at desc`,
            [req.params.id]
        );
        res.status(200).json(rows.map(camelize));
    } catch (error) {
        serverError(res, "Error fetching doctor articles", error);
    }
};

const loadOwnArticle = async (req, res) => {
    const article = camelize(await one("select * from articles where id = $1", [req.params.id]));
    if (!article) {
        res.status(404).json({ msg: "Article not found" });
        return null;
    }
    if (req.user.role !== "admin" && article.doctorId !== req.user.id) {
        res.status(403).json({ msg: "This is not your article." });
        return null;
    }
    return article;
};

export const deleteArticle = async (req, res) => {
    try {
        const article = await loadOwnArticle(req, res);
        if (!article) return;
        await one("delete from articles where id = $1 returning id", [article._id]);
        await deleteStoredFile(article.coverImage);
        res.status(200).json({ msg: "Article deleted successfully" });
    } catch (error) {
        serverError(res, "Error deleting article", error);
    }
};

// Update article - only whitelisted fields (doctorId, views, likes can't be changed)
export const updateArticle = async (req, res) => {
    try {
        const article = await loadOwnArticle(req, res);
        if (!article) return;

        const changes = {};
        for (const field of EDITABLE_FIELDS) {
            if (req.body[field] === undefined) continue;
            if (field === "category" && !CATEGORIES.includes(req.body.category)) continue;
            if (field === "status" && !["draft", "published"].includes(req.body.status)) continue;
            if (field === "tags") changes.tags = cleanTags(req.body.tags);
            else if (field === "coverImage") changes.coverImage = await storeImageIfInline(safeCover(req.body.coverImage), "covers");
            else changes[field] = String(req.body[field] ?? "");
        }
        const merged = { ...article, ...changes };
        if (!merged.title?.trim() || !merged.content?.trim()) {
            return res.status(400).json({ msg: "Title and content cannot be empty." });
        }
        changes.readTime = calcReadTime(merged.content);

        const row = await updateBy("articles", "id", article._id, changes);
        if (changes.coverImage !== undefined && changes.coverImage !== article.coverImage) {
            await deleteStoredFile(article.coverImage); // old cover is no longer referenced
        }
        res.status(200).json({ msg: "Article updated", article: camelize(row) });
    } catch (error) {
        serverError(res, "Error updating article", error);
    }
};
