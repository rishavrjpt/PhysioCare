import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import "../style/article.css";
import { API_BASE_URL } from "../config";

// Skeleton card shown while articles are loading
function SkeletonCard() {
    return (
        <div className="article-card" style={{ overflow: "hidden" }}>
            <div style={{
                width: "100%", height: "160px",
                background: "linear-gradient(90deg, #f0f4f8 25%, #e2e8f0 50%, #f0f4f8 75%)",
                backgroundSize: "200% 100%",
                animation: "shimmer 1.4s infinite",
                borderRadius: "12px 12px 0 0"
            }} />
            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ height: "12px", width: "60px", background: "#e2e8f0", borderRadius: "6px", animation: "shimmer 1.4s infinite" }} />
                <div style={{ height: "16px", width: "85%", background: "#e2e8f0", borderRadius: "6px", animation: "shimmer 1.4s infinite" }} />
                <div style={{ height: "12px", width: "70%", background: "#f1f5f9", borderRadius: "6px", animation: "shimmer 1.4s infinite" }} />
                <div style={{ height: "12px", width: "50%", background: "#f1f5f9", borderRadius: "6px", animation: "shimmer 1.4s infinite" }} />
            </div>
        </div>
    );
}

function Articles() {
    const navigate = useNavigate();
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("All");
    const [articles, setArticles] = useState([]);
    const [coverMap, setCoverMap] = useState({});  // { articleId: base64 }
    const [loading, setLoading] = useState(true);

    const CATEGORIES = ["All", "Rehabilitation", "Orthopedic", "Sports", "Wellness", "Neurological", "Nutrition"];

    useEffect(() => {
        // ── Phase 1: Load metadata fast (no images) ──────────────────────────
        const fetchArticles = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/articles/published`);
                const data = await res.json();
                setArticles(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error("Error fetching articles:", error);
            } finally {
                setLoading(false);
            }
        };

        // ── Phase 2: Load cover images in background (non-blocking) ──────────
        const fetchCovers = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/articles/covers`);
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    const map = {};
                    data.forEach(c => { if (c.coverImage) map[c._id] = c.coverImage; });
                    setCoverMap(map);
                }
            } catch (e) {
                // Images failed to load — UI degrades gracefully (shows gradient placeholder)
                console.warn("Cover images could not be loaded:", e);
            }
        };

        fetchArticles();   // fast — runs first, unblocks UI immediately
        fetchCovers();     // slow — runs in background, patches images when ready
    }, []);

    const filtered = articles
        .filter(a => filter === "All" || a.category === filter)
        .filter(a => a.title.toLowerCase().includes(search.toLowerCase()));

    const categoryColors = {
        Rehabilitation: { bg: "var(--primary-50)", color: "var(--primary)" },
        Orthopedic:     { bg: "#fef3c7", color: "#d97706" },
        Sports:         { bg: "#dcfce7", color: "#16a34a" },
        Wellness:       { bg: "#f3e8ff", color: "#7c3aed" },
        Neurological:   { bg: "#fce7f3", color: "#db2777" },
        Nutrition:      { bg: "#ecfdf5", color: "#059669" },
    };

    return (
        <Layout>
            {/* Shimmer keyframe injected once */}
            <style>{`
                @keyframes shimmer {
                    0%   { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
                .cover-img { animation: fadeIn 0.4s ease; }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            `}</style>

            <div className="articles-page">

                {/* HEADER */}
                <div className="articles-header">
                    <div>
                        <h1 className="articles-title">Articles</h1>
                        <p className="articles-subtitle">Discover expert advice on recovery and performance.</p>
                    </div>
                    <input
                        className="search-bar"
                        placeholder="Search for articles, guides..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                {/* FILTER BUTTONS */}
                <div className="articles-filters">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat}
                            className={filter === cat ? "active" : ""}
                            onClick={() => setFilter(cat)}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* ARTICLES GRID */}
                {loading ? (
                    /* Skeleton cards — show immediately while loading */
                    <div className="articles-grid">
                        {[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} />)}
                    </div>
                ) : filtered.length === 0 ? (
                    <p style={{ textAlign: "center", padding: "40px", color: "#9ca3af" }}>
                        No articles found. {articles.length === 0 ? "Doctors will publish articles here soon!" : "Try a different filter."}
                    </p>
                ) : (
                    <div className="articles-grid">
                        {filtered.map(article => {
                            const colorStyle = categoryColors[article.category] || { bg: "#f3f4f6", color: "#374151" };
                            const coverSrc = coverMap[article._id];  // populated after Phase 2
                            return (
                                <div
                                    className="article-card"
                                    key={article._id}
                                    onClick={() => navigate(`/article?id=${article._id}`)}
                                    style={{ cursor: "pointer" }}
                                >

                                    {/* Cover Image — shows gradient until Phase 2 patches in the real image */}
                                    {coverSrc ? (
                                        <img
                                            className="cover-img"
                                            src={coverSrc}
                                            alt={article.title}
                                            style={{ width: "100%", height: "180px", objectFit: "cover", borderRadius: "12px 12px 0 0" }}
                                        />
                                    ) : (
                                        <div style={{ width: "100%", height: "140px", background: "linear-gradient(135deg, var(--primary-50), var(--primary-100))", borderRadius: "12px 12px 0 0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--primary-300)" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                                        </div>
                                    )}

                                    <div className="article-content">
                                        <span
                                            className="tag"
                                            style={{ background: colorStyle.bg, color: colorStyle.color, padding: "3px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "600" }}
                                        >
                                            {article.category.toUpperCase()}
                                        </span>

                                        <h3 className="mainheading" style={{ margin: "10px 0 6px", fontSize: "15px" }}>
                                            {article.title}
                                        </h3>

                                        <p style={{ fontSize: "13px", color: "#6b7280", lineHeight: 1.5, margin: "0 0 12px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                                            {article.content?.slice(0, 150)}...
                                        </p>

                                        <div className="article-footer">
                                            <span>⏱ {article.readTime}</span>
                                            {article.doctorId?.name && (
                                                <span style={{ color: "#9ca3af" }}>{article.doctorId.name?.startsWith("Dr") ? article.doctorId.name : "Dr. " + article.doctorId.name}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

            </div>
        </Layout>
    );
}

export default Articles;