import { useState, useEffect, useRef } from "react";
import { decodeToken } from "../utils/auth";
import { API_BASE_URL } from "../config";
import Layout from "../components/Layout";
import "../style/videoDetail.css";

import ex1 from "../assets/ex1.jpg";
import ex2 from "../assets/ex2.jpg";

function VideoDetail() {

    const [completed, setCompleted] = useState(false);
    const [message, setMessage] = useState("");

    const videoRef = useRef(null);

    useEffect(() => {
        console.log("Video Detail Page Loaded");
    }, []);

    const [painLevel, setPainLevel] = useState(5);
    const [loading, setLoading] = useState(false);

    const handleLogSession = async () => {
        const token = localStorage.getItem("patientToken");
        if (!token) {
            setMessage("Please log in first");
            return;
        }
        const payload = decodeToken(token);

        setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/videos/log-session`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    patientId: payload.id,
                    painLevel
                })
            });
            const data = await response.json();
            if (response.ok) {
                setCompleted(true);
                setMessage("Session logged successfully! ✅");
            } else {
                setMessage(data.msg || "Error logging session ❌");
            }
        } catch {
            setMessage("Server error ❌");
        } finally {
            setLoading(false);
        }
    };

    return (

        <Layout>

            <div className="video-detail-layout">

                {/* LEFT SIDE */}

                <div className="video-main-detail">

                    <p className="breadcrumb">
                        Videos / Knee Mobility
                    </p>

                    <h1 className="video-heading">
                        Back Pain Relief
                    </h1>

                    <div className="video-player">

                        <img ref={videoRef} src={ex1} />

                        <div className="play-btn">
                            ▶
                        </div>

                    </div>

                    <div className="video-description">

                        <p className="video-duration">
                            15 minutes
                        </p>

                        <p className="video-text">
                            This gentle exercise routine is made to alleviate back pain and
                            improve flexibility. Follow along with certified instructor
                            Amelia Harper for a soothing and effective workout.
                        </p>

                        <div className="trainer">

                            <img src={ex2} />

                            <div>
                                <h4>Amelia Harper</h4>
                                <p>Certified Physiotherapist</p>
                            </div>

                        </div>

                    </div>

                </div>


                {/* RIGHT SIDE */}

                <div className="video-sidebar">

                    <div className="progress-box">

                        <h3>Log Your Progress</h3>

                        {!completed ? (
                            <div style={{ marginTop: "15px" }}>
                                <label style={{ display: "block", marginBottom: "5px", fontSize: "14px", color: "#64748b", fontWeight: "600" }}>
                                    Pain Level (1-10): {painLevel}
                                </label>
                                <input 
                                    type="range" 
                                    min="1" max="10" 
                                    value={painLevel} 
                                    onChange={(e) => setPainLevel(parseInt(e.target.value))}
                                    style={{ width: "100%", marginBottom: "15px" }}
                                />
                                <button 
                                    onClick={handleLogSession}
                                    disabled={loading}
                                    style={{
                                        width: "100%", padding: "10px", background: "var(--accent)",
                                        color: "white", border: "none", borderRadius: "8px",
                                        cursor: "pointer", fontWeight: "600"
                                    }}
                                >
                                    {loading ? "Logging..." : "Mark as Done"}
                                </button>
                            </div>
                        ) : (
                            <div style={{ marginTop: "15px", padding: "10px", background: "#dcfce7", color: "#16a34a", borderRadius: "8px", textAlign: "center", fontWeight: "600" }}>
                                Exercise Completed ✅
                            </div>
                        )}

                        <p style={{ color: "var(--primary)", marginTop: "10px", textAlign: "center", fontSize: "14px" }}>
                            {message}
                        </p>

                        <div className="trainer-mini">

                            <img src={ex2} />

                            <div>
                                <h4>Amelia Harper</h4>
                                <p>Certified Physiotherapist</p>
                            </div>

                        </div>

                    </div>


                    <div className="next-box">

                        <h3>Next Up</h3>

                        <div className="next-grid">

                            <div className="next-card">
                                <img src={ex1} />
                                <p>5 Stretches for Neck Pain</p>
                            </div>

                            <div className="next-card">
                                <img src={ex2} />
                                <p>5 Stretches for Neck Pain</p>
                            </div>

                        </div>

                        <button className="next-btn">
                            Continue to Next Exercise
                        </button>

                    </div>

                </div>

            </div>

        </Layout>

    )

}

export default VideoDetail