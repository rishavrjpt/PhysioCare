import { useState, useRef } from "react";
import { decodeToken } from "../../utils/auth";
import { useNavigate } from "react-router-dom";
import DoctorSidebar from "../../components/DoctorSidebar";
import "../../style/doctor/doctorArticles.css";
import { API_BASE_URL } from "../../config";
import { resizeImage } from "../../utils/imageUtils";

const CATEGORIES = ["Rehabilitation", "Orthopedic", "Sports", "Wellness", "Neurological", "Nutrition"];

function DoctorNewArticle() {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);

    const [title, setTitle] = useState("");
    const [subtitle, setSubtitle] = useState("");
    const [content, setContent] = useState("");
    const [category, setCategory] = useState("Rehabilitation");
    const [coverImage, setCoverImage] = useState(""); // base64
    const [coverPreview, setCoverPreview] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
    const charCount = content.length;
    const readTime = Math.max(1, Math.ceil(wordCount / 200));

    const getDoctorId = () => {
        const token = localStorage.getItem("doctorToken");
        if (!token) return null;
        try {
            const payload = decodeToken(token);
            return payload.id;
        } catch { return null; }
    };

    const handleImageChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const compressed = await resizeImage(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.8, format: "image/webp" });
            setCoverImage(compressed);
            setCoverPreview(compressed);
        } catch (err) {
            console.error("Cover image compression error:", err);
        }
    };

    const submitArticle = async (status) => {
        if (!title.trim() || !content.trim()) {
            alert("Please add a title and content before " + (status === "published" ? "publishing." : "saving draft."));
            return;
        }
        const doctorId = getDoctorId();
        if (!doctorId) { alert("Please log in again."); return; }

        setSubmitting(true);
        try {
            const res = await fetch(`${API_BASE_URL}/articles`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("doctorToken")}`
                },
                body: JSON.stringify({ doctorId, title, subtitle, content, category, coverImage, status })
            });
            if (res.ok) {
                setSuccess(true);
                setTimeout(() => navigate("/doctor/articles"), 1200);
            } else {
                const data = await res.json();
                alert(data.msg || "Failed to save article.");
            }
        } catch (error) {
            console.error("Error saving article:", error);
            alert("Network error. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    const applyFormat = (format) => {
        const textarea = document.getElementById("article-body");
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selected = content.substring(start, end);
        let newContent = content;

        if (format === "bold") {
            newContent = content.substring(0, start) + `**${selected}**` + content.substring(end);
        } else if (format === "italic") {
            newContent = content.substring(0, start) + `*${selected}*` + content.substring(end);
        } else if (format === "heading") {
            newContent = content.substring(0, start) + `\n## ${selected}` + content.substring(end);
        } else if (format === "ul") {
            newContent = content.substring(0, start) + `\n- ${selected}` + content.substring(end);
        } else if (format === "ol") {
            newContent = content.substring(0, start) + `\n1. ${selected}` + content.substring(end);
        } else if (format === "quote") {
            newContent = content.substring(0, start) + `\n> ${selected}` + content.substring(end);
        }
        setContent(newContent);
        setTimeout(() => textarea.focus(), 0);
    };

    return (
        <div className="new-article-page">
            <DoctorSidebar />

            <div className="main">
                <div className="content">

                    {/* TOPBAR */}
                    <div className="editor-topbar">
                        <div className="editor-topbar-left">
                            <button className="back-btn" onClick={() => navigate("/doctor/articles")}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
                                Back
                            </button>
                            <span className="editor-title-label">New Article</span>
                        </div>
                        <div className="editor-topbar-right">
                            <button className="save-draft-btn" onClick={() => submitArticle("draft")} disabled={submitting}>
                                Save Draft
                            </button>
                            <button className="publish-btn" onClick={() => submitArticle("published")} disabled={submitting}>
                                {submitting ? "Saving..." : "Publish"}
                            </button>
                        </div>
                    </div>

                    <div className="editor-layout">

                        {/* LEFT: MAIN EDITOR */}
                        <div className="editor-main-area">

                            {/* Cover Image */}
                            <div className="cover-image-upload" onClick={() => fileInputRef.current.click()}>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpg,image/jpeg,image/png,image/webp"
                                    style={{ display: "none" }}
                                    onChange={handleImageChange}
                                />
                                {coverPreview ? (
                                    <img src={coverPreview} alt="Cover" />
                                ) : (
                                    <div className="cover-image-upload-label">
                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                        <span>Click to upload a cover image</span>
                                        <span className="cover-image-upload-hint">JPG, PNG, WEBP — recommended 1200×600px</span>
                                    </div>
                                )}
                            </div>

                            {/* Title */}
                            <textarea
                                className="editor-title-input"
                                placeholder="Article title..."
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                rows={1}
                            />

                            {/* Subtitle */}
                            <textarea
                                className="editor-subtitle-input"
                                placeholder="Add a subtitle..."
                                value={subtitle}
                                onChange={e => setSubtitle(e.target.value)}
                                rows={1}
                            />

                            {/* Toolbar */}
                            <div className="editor-toolbar">
                                <select className="toolbar-select">
                                    <option>Paragraph</option>
                                    <option>Heading</option>
                                </select>
                                <div className="toolbar-separator"></div>
                                <button className="toolbar-btn" title="Bold" onClick={() => applyFormat("bold")}><b>B</b></button>
                                <button className="toolbar-btn" title="Italic" onClick={() => applyFormat("italic")}><em>I</em></button>
                                <button className="toolbar-btn" title="Heading" onClick={() => applyFormat("heading")}>H2</button>
                                <div className="toolbar-separator"></div>
                                <button className="toolbar-btn" title="Bullet list" onClick={() => applyFormat("ul")}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                                </button>
                                <button className="toolbar-btn" title="Numbered list" onClick={() => applyFormat("ol")}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="6" x2="21" y2="6"></line><line x1="10" y1="12" x2="21" y2="12"></line><line x1="10" y1="18" x2="21" y2="18"></line><path d="M4 6h1v4"></path><path d="M4 10h2"></path><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"></path></svg>
                                </button>
                                <button className="toolbar-btn" title="Quote" onClick={() => applyFormat("quote")}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h3c1 5-2 8-3 8zm14 0c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h3c1 5-2 8-3 8z"></path></svg>
                                </button>
                            </div>

                            {/* Content */}
                            <textarea
                                id="article-body"
                                className="editor-body"
                                placeholder="Start writing your article..."
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                rows={16}
                            />

                            <div className="editor-word-count">
                                <span>{wordCount} words</span>
                                <span style={{ color: "var(--primary)" }}>~{readTime} min read</span>
                                <span>{charCount} characters</span>
                            </div>
                        </div>

                        {/* RIGHT: SIDEBAR */}
                        <div className="editor-sidebar">

                            {/* Category */}
                            <div className="editor-panel">
                                <h4>Category</h4>
                                <div className="category-pills">
                                    {CATEGORIES.map(c => (
                                        <button
                                            key={c}
                                            className={`category-pill ${c} ${category === c ? "selected" : ""}`}
                                            onClick={() => setCategory(c)}
                                        >
                                            {c}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Article Info */}
                            <div className="editor-panel">
                                <h4>Article Info</h4>
                                <div className="article-info-row">
                                    <span>Est. read time</span>
                                    <span>~{readTime} min</span>
                                </div>
                                <div className="article-info-row">
                                    <span>Word count</span>
                                    <span>{wordCount}</span>
                                </div>
                                <div className="article-info-row">
                                    <span>Status</span>
                                    <span className="status-draft">Draft</span>
                                </div>
                            </div>

                            {/* Publish Panel */}
                            <div className="editor-panel">
                                {success && (
                                    <div className="publish-success-banner">✅ Article saved!</div>
                                )}
                                <div className="publish-panel-info">
                                    Ready to share your knowledge with patients? Publish your article now.
                                </div>
                                <button
                                    className="publish-panel-btn"
                                    onClick={() => submitArticle("published")}
                                    disabled={submitting}
                                >
                                    {submitting ? "Publishing..." : "Publish Article"}
                                </button>
                                <button
                                    className="save-draft-panel-btn"
                                    onClick={() => submitArticle("draft")}
                                    disabled={submitting}
                                >
                                    Save as Draft
                                </button>
                            </div>

                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

export default DoctorNewArticle;
