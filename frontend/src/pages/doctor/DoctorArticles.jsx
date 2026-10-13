import { useState, useEffect } from "react";
import { decodeToken } from "../../utils/auth";
import { useNavigate } from "react-router-dom";
import DoctorSidebar from "../../components/DoctorSidebar";
import "../../style/doctor/doctorArticles.css";
import { API_BASE_URL } from "../../config";

const CATEGORIES = ["All", "Rehabilitation", "Orthopedic", "Sports", "Wellness", "Neurological", "Nutrition"];

function DoctorArticles() {
    const navigate = useNavigate();
    const [articles, setArticles] = useState([]);
    const [tab, setTab] = useState("published"); // "published" | "draft"
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("All");
    const [loading, setLoading] = useState(true);

    const getDoctorId = () => {
        const token = localStorage.getItem("doctorToken");
        if (!token) return null;
        try {
            const payload = decodeToken(token);
            return payload.id;
        } catch { return null; }
    };

    const fetchArticles = async () => {
        const doctorId = getDoctorId();
        if (!doctorId) { setLoading(false); return; }
        try {
            const res = await fetch(`${API_BASE_URL}/articles/doctor/${doctorId}`);
            const data = await res.json();
            setArticles(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching articles:", error);
        } finally {
            setLoading(false);
        }
    };

    const [pendingIds, setPendingIds] = useState(new Set());

    // Load once when the page opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { fetchArticles(); }, []);

    const handleToggleStatus = async (article) => {
        if (pendingIds.has(article._id)) return;
        const newStatus = article.status === "published" ? "draft" : "published";
        const prevArticles = articles;

        // Optimistic UI update
        setArticles(prev => prev.map(a => a._id === article._id ? { ...a, status: newStatus } : a));
        setPendingIds(p => new Set(p).add(article._id));

        try {
            const res = await fetch(`${API_BASE_URL}/articles/${article._id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus })
            });
            if (!res.ok) {
                setArticles(prevArticles);
                alert("Failed to update article status. Please try again.");
            }
        } catch (err) {
            console.error("Error toggling article status:", err);
            setArticles(prevArticles);
            alert("Network error updating article status.");
        } finally {
            setPendingIds(p => {
                const next = new Set(p);
                next.delete(article._id);
                return next;
            });
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this article?")) return;
        try {
            await fetch(`${API_BASE_URL}/articles/${id}`, { method: "DELETE" });
            setArticles(prev => prev.filter(a => a._id !== id));
        } catch (error) {
            console.error("Error deleting article:", error);
        }
    };

    const filtered = articles
        .filter(a => a.status === tab)
        .filter(a => category === "All" || a.category === category)
        .filter(a => a.title.toLowerCase().includes(search.toLowerCase()));

    const publishedCount = articles.filter(a => a.status === "published").length;
    const draftCount = articles.filter(a => a.status === "draft").length;
    const totalViews = articles.reduce((acc, a) => acc + (a.views || 0), 0);
    const totalLikes = articles.reduce((acc, a) => acc + (a.likes || 0), 0);

    const formatDate = (dateString) => {
        const d = new Date(dateString);
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    };

    return (
        <div className="doctor-articles-page">
            <DoctorSidebar />

            <div className="main">
                <div className="content">

                    {/* TOPBAR */}
                    <div className="topbar">
                        <div className="top-right">
                            <div className="location">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                <span>Chennai</span>
                            </div>
                            <div className="divider"></div>
                            <div className="icon-btn notification">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                                <span className="badge">1</span>
                            </div>
                        </div>
                    </div>

                    {/* HEADER */}
                    <div className="articles-page-header">
                        <div>
                            <h2>Article Library</h2>
                            <p>Write and publish physiotherapy articles for your patients.</p>
                        </div>
                        <button className="write-article-btn" onClick={() => navigate("/doctor/articles/new")}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            Write Article
                        </button>
                    </div>

                    {/* STATS */}
                    <div className="article-stats-row">
                        <div className="article-stat-card">
                            <p className="stat-num">{publishedCount}</p>
                            <p className="stat-label">Published</p>
                        </div>
                        <div className="article-stat-card">
                            <p className="stat-num">{draftCount}</p>
                            <p className="stat-label">Drafts</p>
                        </div>
                        <div className="article-stat-card">
                            <p className="stat-num">{totalViews.toLocaleString()}</p>
                            <p className="stat-label">Total Views</p>
                        </div>
                        <div className="article-stat-card">
                            <p className="stat-num">{totalLikes}</p>
                            <p className="stat-label">Total Likes</p>
                        </div>
                    </div>

                    {/* SEARCH */}
                    <div className="articles-search-bar">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        <input
                            type="text"
                            placeholder="Search articles..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>

                    {/* TABS + CATEGORY FILTER */}
                    <div className="articles-tabs-row">
                        <div className="articles-tabs">
                            <button className={`articles-tab-btn ${tab === "published" ? "active" : ""}`} onClick={() => setTab("published")}>Published</button>
                            <button className={`articles-tab-btn ${tab === "draft" ? "active" : ""}`} onClick={() => setTab("draft")}>Drafts</button>
                        </div>
                        <div className="article-category-pills">
                            {CATEGORIES.map(c => (
                                <button
                                    key={c}
                                    className={`cat-pill ${category === c ? "active" : ""}`}
                                    onClick={() => setCategory(c)}
                                >
                                    {c}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ARTICLE LIST */}
                    {loading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px 0' }}>
                            {[1, 2, 3].map(n => (
                                <div key={n} style={{ height: '140px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', position: 'relative', overflow: 'hidden' }}>
                                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)', animation: 'shimmer 1.5s infinite' }}></div>
                                </div>
                            ))}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="empty-articles">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                            <p>No {tab} articles found. {tab === "published" ? "Write and publish your first article!" : "Save a draft to see it here."}</p>
                        </div>
                    ) : (
                        filtered.map(article => (
                            <div className="article-list-item" key={article._id}>
                                <div className="article-list-top">
                                    <span className={`article-category-badge ${article.category}`}>{article.category}</span>
                                    <span className="article-date">{formatDate(article.createdAt)}</span>
                                </div>
                                <h3 className="article-list-title">{article.title}</h3>
                                <p className="article-list-excerpt">{article.content?.slice(0, 180)}...</p>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div className="article-list-meta">
                                        <span>⏱ {article.readTime}</span>
                                        <span>👁 {article.views?.toLocaleString() || 0} views</span>
                                        <span>♥ {article.likes || 0}</span>
                                    </div>
                                    <div style={{ display: "flex", gap: "8px" }}>
                                        <button
                                            style={{
                                                padding: "6px 12px",
                                                borderRadius: "6px",
                                                border: "1px solid var(--border)",
                                                background: article.status === "published" ? "#fef3c7" : "var(--primary-50)",
                                                color: article.status === "published" ? "#92400e" : "var(--primary)",
                                                fontWeight: "600",
                                                fontSize: "12px",
                                                cursor: pendingIds.has(article._id) ? "not-allowed" : "pointer",
                                                opacity: pendingIds.has(article._id) ? 0.6 : 1
                                            }}
                                            onClick={() => handleToggleStatus(article)}
                                            disabled={pendingIds.has(article._id)}
                                        >
                                            {pendingIds.has(article._id)
                                                ? "Updating..."
                                                : (article.status === "published" ? "Unpublish" : "Publish")}
                                        </button>
                                        <button className="delete-article-btn" onClick={() => handleDelete(article._id)}>Delete</button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}

                </div>
            </div>
        </div>
    );
}

export default DoctorArticles;
