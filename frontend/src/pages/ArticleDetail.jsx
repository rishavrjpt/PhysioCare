import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import "../style/articleDetail.css";
import { API_BASE_URL } from "../config";

function ArticleDetail() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const articleId = searchParams.get("id");

    const [article, setArticle] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!articleId) { navigate("/articles"); return; }

        const fetchArticle = async () => {
            setLoading(true);
            try {
                const res = await fetch(`${API_BASE_URL}/articles/${articleId}`);
                if (res.ok) {
                    const data = await res.json();
                    setArticle(data);
                } else {
                    navigate("/articles");
                }
            } catch (err) {
                console.error("Error fetching article:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchArticle();
    }, [articleId, navigate]);

    const formatDate = (d) => d ? new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";

    const categoryColors = {
        Rehabilitation: "var(--primary)",
        Orthopedic:     "#d97706",
        Sports:         "#16a34a",
        Wellness:       "#7c3aed",
        Neurological:   "#db2777",
        Nutrition:      "#059669",
    };

    return (
        <Layout>
            <div className="article-detail-layout">

                {/* LEFT ARTICLE */}
                <div className="article-main">

                    <p className="back" onClick={() => navigate("/articles")} style={{ cursor: "pointer" }}>
                        ← Back to Articles
                    </p>

                    {loading ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "20px" }}>
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} style={{ height: i === 3 ? "200px" : "24px", background: "#f1f5f9", borderRadius: "8px", animation: "shimmer 1.4s infinite",
                                    backgroundImage: "linear-gradient(90deg, #f0f4f8 25%, #e2e8f0 50%, #f0f4f8 75%)", backgroundSize: "200% 100%" }} />
                            ))}
                            <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
                        </div>
                    ) : article ? (
                        <>
                            <h2
                                className="article-category"
                                style={{ color: categoryColors[article.category] || "var(--primary)" }}
                            >
                                {article.category}
                            </h2>

                            {article.coverImage && (
                                <img
                                    className="article-image"
                                    src={article.coverImage}
                                    alt={article.title}
                                    style={{ width: "100%", borderRadius: "12px", marginBottom: "20px", objectFit: "cover", maxHeight: "380px" }}
                                />
                            )}

                            <h1 className="article-title">{article.title}</h1>

                            <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px", fontSize: "13px", color: "#6b7280" }}>
                                {article.doctorId?.name && (
                                    <span>✍️ {article.doctorId.name?.startsWith("Dr") ? article.doctorId.name : "Dr. " + article.doctorId.name}</span>
                                )}
                                {article.readTime && <span>⏱ {article.readTime}</span>}
                                {article.createdAt && <span>📅 {formatDate(article.createdAt)}</span>}
                            </div>

                            {/* Render content — split by newlines into paragraphs */}
                            {article.content?.split("\n").filter(p => p.trim()).map((para, i) => (
                                <p key={i} className="article-text">{para}</p>
                            ))}
                        </>
                    ) : null}
                </div>



            </div>
        </Layout>
    );
}

export default ArticleDetail;