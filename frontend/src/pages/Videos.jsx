import { useState, useEffect, useRef } from "react";
import { decodeToken } from "../utils/auth";
import Layout from "../components/Layout";
import "../style/video.css";
import { Link } from "react-router-dom";
import { API_BASE_URL, BACKEND_URL } from "../config";
import { cachedFetch } from "../utils/dataStore";

// Returns the best available thumbnail URL for a given video object
const getVideoThumbnail = (video) => {
    // 1. Already stored thumbnail (could be YouTube HQ or base64 frame)
    if (video.thumbnail && video.thumbnail.startsWith('http')) return video.thumbnail;
    if (video.thumbnail && video.thumbnail.startsWith('data:')) return video.thumbnail;

    // 2. Try to derive YouTube thumbnail from the URL on the fly
    if (video.url) {
        const ytMatch = video.url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
        if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
    }

    // 3. Gradient placeholder (unique per title so each card looks different)
    const colors = [
        ['#667eea', '#764ba2'], ['#f093fb', '#f5576c'],
        ['#4facfe', '#00f2fe'], ['#43e97b', '#38f9d7'],
        ['#fa709a', '#fee140'], ['#a18cd1', '#fbc2eb'],
        ['#fccb90', '#d57eeb'], ['#a1c4fd', '#c2e9fb'],
    ];
    const idx = (video.title || '').charCodeAt(0) % colors.length;
    const [c1, c2] = colors[idx];
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='225'><defs><linearGradient id='g' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='${c1}'/><stop offset='100%' stop-color='${c2}'/></linearGradient></defs><rect width='400' height='225' fill='url(#g)'/><text x='50%' y='50%' font-family='sans-serif' font-size='18' fill='white' text-anchor='middle' dominant-baseline='middle' opacity='0.9'>▶</text></svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

const renderThumbnail = (video) => {
    // If it's a locally uploaded video, let the browser fetch the first frame automatically
    if (video.url && video.url.startsWith('/uploads')) {
        return (
            <video 
                src={`${BACKEND_URL}${video.url}#t=0.1`} 
                style={{ height: '180px', objectFit: 'cover', width: '100%', backgroundColor: '#000' }} 
                preload="metadata"
                muted
                playsInline
            />
        );
    }
    
    // Otherwise fallback to our thumbnail resolver (YouTube or DataURI)
    return <img src={getVideoThumbnail(video)} alt={video.title} style={{ height: '180px', objectFit: 'cover', width: '100%' }} />;
};

function Videos() {
    const [tab, setTab] = useState("general");
    const [code, setCode] = useState("");
    const [message, setMessage] = useState("");
    
    const [generalVideos, setGeneralVideos] = useState([]);
    const [programVideos, setProgramVideos] = useState([]);
    const [enrolledProgramsList, setEnrolledProgramsList] = useState([]);
    const [loading, setLoading] = useState(false);
    
    const [appointmentStats, setAppointmentStats] = useState({ done: 0, pending: 0, adherence: 0 });

    const inputRef = useRef(null);

    // Fetch General Videos — cached with dataStore
    const fetchGeneralVideos = async () => {
        setLoading(true);
        try {
            const data = await cachedFetch("videoCache_general", `${API_BASE_URL}/videos/general`, { ttl: 30000 });
            setGeneralVideos(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Error fetching general videos:", err);
        } finally {
            setLoading(false);
        }
    };

    // Fetch Program Videos — ALWAYS fresh (no cache — must reflect real-time enrollment)
    const fetchProgramVideos = async () => {
        const token = localStorage.getItem("patientToken");
        if (!token) return;
        const payload = decodeToken(token);
        const patientId = payload.id;

        setLoading(true);
        try {
            const progsRes = await fetch(`${API_BASE_URL}/programs/patient/${patientId}`);
            if (!progsRes.ok) throw new Error("Failed to fetch programs");
            const programs = await progsRes.json();
            setEnrolledProgramsList(Array.isArray(programs) ? programs : []);

            let allProgVideos = [];
            if (Array.isArray(programs) && programs.length > 0) {
                // Fetch all program videos in PARALLEL
                const videoResults = await Promise.all(
                    programs.map(prog =>
                        fetch(`${API_BASE_URL}/videos/program/${prog._id}`)
                            .then(r => r.ok ? r.json() : [])
                            .then(vids => Array.isArray(vids)
                                ? vids.map(v => ({ ...v, programTitle: prog.title, programId: prog._id }))
                                : []
                            )
                    )
                );
                allProgVideos = videoResults.flat();
            }
            setProgramVideos(allProgVideos);
        } catch (err) {
            console.error("Error fetching program videos:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (tab === "general") {
            fetchGeneralVideos();
        } else {
            fetchProgramVideos();
        }
    }, [tab]);

    useEffect(() => {
        const fetchAppointments = async () => {
            const token = localStorage.getItem("patientToken");
            if (!token) return;
            const payload = decodeToken(token);

            try {
                const response = await fetch(`${API_BASE_URL}/appointments/patient/${payload.id}`);
                if (response.ok) {
                    const data = await response.json();
                    let done = 0, pending = 0;
                    data.forEach(app => {
                        if (app.status === "Confirmed" || app.status === "Completed") done++; // same rule as the Home dashboard
                        if (app.status === "Pending") pending++;
                    });
                    const total = done + pending;
                    const adherence = total > 0 ? Math.round((done / total) * 100) : 0;
                    const stats = { done, pending, adherence };
                    setAppointmentStats(stats);
                }
            } catch (error) {
                console.error("Error fetching appointments:", error);
            }
        };
        fetchAppointments();
    }, []);

    const [enrolling, setEnrolling] = useState(false);

    const verifyProgram = async () => {
        if (!code) {
            setMessage("Please enter a code");
            return;
        }
        
        const token = localStorage.getItem("patientToken");
        if (!token) {
            setMessage("Please log in first");
            return;
        }
        const payload = decodeToken(token);
        const enteredCode = code.trim().toUpperCase();

        setEnrolling(true);
        setMessage(`Unlocking program ${enteredCode}...`);

        try {
            const response = await fetch(`${API_BASE_URL}/programs/enroll`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ patientId: payload.id, programCode: enteredCode })
            });
            const data = await response.json();
            
            if (response.ok) {
                setMessage(`Program unlocked successfully ✅ - ${data.program?.title}`);
                setCode("");
                setTab("myprogram"); // switch to My Program tab
                fetchProgramVideos();
            } else {
                setMessage(`Error ❌: ${data.msg}`);
            }
        } catch (error) {
            console.error("Error verifying code:", error);
            setMessage("Server error ❌");
        } finally {
            setEnrolling(false);
        }
    };

    return (
        <Layout>
            <div className="video-layout">
                <div className="video-main">
                    <h1 className="video-title">Video Library</h1>
                    <p className="video-subtitle">
                        Curated exercises by our medical professionals for your specific needs.
                    </p>

                    {/* Tabs */}
                    <div className="video-tabs">
                        <button
                            className={tab === "general" ? "active" : ""}
                            onClick={() => setTab("general")}
                        >
                            General Program
                        </button>
                        <button
                            className={tab === "myprogram" ? "active" : ""}
                            onClick={() => setTab("myprogram")}
                        >
                            My Program
                        </button>
                    </div>

                    {/* GENERAL PROGRAM */}
                    {tab === "general" && (
                        <div className="video-grid">
                            {loading ? (
                                [1, 2, 3, 4].map(n => (
                                    <div key={n} className="skeleton" style={{ height: "200px", borderRadius: "16px" }} />
                                ))
                            ) : generalVideos.length === 0 ? <p>No general videos available.</p> :
                            generalVideos.map(video => (
                                <div className="video-card" key={video._id} onClick={() => window.open(video.url.startsWith('/') ? `${BACKEND_URL}${video.url}` : video.url, "_blank")} style={{ cursor: 'pointer' }}>
                                    {renderThumbnail(video)}
                                    <div className="video-info">
                                        <h3>{video.title}</h3>
                                        <p style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{video.description || "No description provided."}</p>
                                        <p style={{ fontSize: '12px', color: '#64748b', marginTop: '8px', fontWeight: 'bold' }}>By {video.doctorId?.name?.startsWith("Dr") ? video.doctorId?.name : "Dr. " + (video.doctorId?.name || "Unknown")}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* MY PROGRAM */}
                    {tab === "myprogram" && (
                        <div>
                            <div className="program-box" style={{ marginBottom: '30px' }}>
                                <h2 className="program">Enter your program code</h2>
                                <p className="programtitle">Unlock your personalized video program from your doctor.</p>
                                <div className="code-box">
                                    <input
                                        placeholder="Enter your code"
                                        value={code}
                                        ref={inputRef}
                                        onChange={(e) => setCode(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && verifyProgram()}
                                    />
                                    <button className="verify-btn" onClick={verifyProgram} disabled={enrolling} style={{ opacity: enrolling ? 0.7 : 1, cursor: enrolling ? "not-allowed" : "pointer" }}>
                                        {enrolling ? "Verifying..." : "Verify"}
                                    </button>
                                </div>
                                <p style={{ marginTop: "15px", color: message.includes("❌") ? "#ef4444" : "#10b981", fontWeight: "600" }}>
                                    {message}
                                </p>
                            </div>

                            <h3 style={{ marginBottom: '16px', color: '#1e293b' }}>Enrolled Programs</h3>
                            
                            {loading ? (
                                [1, 2].map(n => (
                                    <div key={n} className="skeleton" style={{ height: "140px", borderRadius: "16px", marginBottom: "20px" }} />
                                ))
                            ) : enrolledProgramsList.length === 0 ? <p>No programs available. Make sure you enroll using a code.</p> :
                            
                            // Render all enrolled programs, even if they have no videos
                            enrolledProgramsList.map(prog => {
                                const progVids = programVideos.filter(v => v.programId === prog._id);
                                return (
                                    <div key={prog._id} style={{ marginBottom: '40px' }}>
                                        <div style={{ marginBottom: '16px', borderBottom: '2px solid #e2e8f0', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <h4 style={{ margin: '0 0 4px 0', color: 'var(--primary)', fontSize: '20px' }}>{prog.title}</h4>
                                                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                                                    Program Code: <span style={{ fontWeight: '700', color: '#0f172a', letterSpacing: '0.05em' }}>{prog.programCode}</span>
                                                </p>
                                            </div>
                                            <span style={{ fontSize: '12px', background: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: '12px', fontWeight: '600' }}>
                                                {progVids.length} Videos
                                            </span>
                                        </div>

                                        {progVids.length === 0 ? (
                                            <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
                                                <p style={{ color: '#94a3b8', margin: 0, fontSize: '14px' }}>No videos have been uploaded to this program yet.</p>
                                            </div>
                                        ) : (
                                            <div className="video-grid">
                                                {progVids.map(video => (
                                                    <div className="video-card" key={video._id} onClick={() => window.open(video.url.startsWith('/') ? `${BACKEND_URL}${video.url}` : video.url, "_blank")} style={{ cursor: 'pointer' }}>
                                                        {renderThumbnail(video)}
                                                        <div className="video-info" style={{ position: 'relative' }}>
                                                            <h3>{video.title}</h3>
                                                            <p style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{video.description || "No description provided."}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                </div>

                {/* RIGHT SIDE */}
                <div className="video-side">
                    <div className="tracker-card">
                        <h3>Progress Tracker</h3>
                        <div className="progress-circle" style={{ position: 'relative', width: '120px', height: '120px', margin: '20px auto' }}>
                            <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
                                <circle cx="60" cy="60" r="50" fill="none" stroke="#e2e8f0" strokeWidth="12" />
                                <circle 
                                    cx="60" cy="60" r="50" 
                                    fill="none" 
                                    stroke="var(--primary)" 
                                    strokeWidth="12" 
                                    strokeDasharray="314" 
                                    strokeDashoffset={314 - (314 * (appointmentStats.adherence / 100))} 
                                    strokeLinecap="round" 
                                    style={{ transition: "stroke-dashoffset 0.5s ease" }}
                                />
                            </svg>
                            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: '800', color: '#1e293b' }}>
                                {appointmentStats.adherence}%
                            </div>
                        </div>
                        <p className="weeklyinfo">Weekly Adherence</p>
                        <div className="weeks">
                            <span className="active">Week 1</span>
                            <span>Week 2</span>
                            <span>Week 3</span>
                            <span>Week 4</span>
                        </div>
                        <div className="session-box" style={{ display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center' }}>
                            <span>{appointmentStats.done} Sessions Done</span>
                            <span style={{ color: '#94a3b8' }}>•</span>
                            <span>{appointmentStats.pending} Pending</span>
                        </div>
                    </div>
                </div>

            </div>
        </Layout>
    );
}

export default Videos;