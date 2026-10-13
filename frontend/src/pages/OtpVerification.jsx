import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "../config";

function OtpVerification() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const email = searchParams.get("email") || "";
    const role  = searchParams.get("role")  || "patient";
    const [devOtp, setDevOtp] = useState(() => searchParams.get("devOtp") || "");

    const [otp, setOtp]       = useState(["", "", "", "", "", ""]);
    const [error, setError]   = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [expiresIn, setExpiresIn] = useState(600); // 10 minutes OTP validity
    const [cooldown, setCooldown]   = useState(60);  // 60-second resend cooldown

    const inputs = useRef([]);

    // 10-minute expiry countdown
    useEffect(() => {
        if (expiresIn <= 0) return;
        const id = setInterval(() => setExpiresIn(t => Math.max(0, t - 1)), 1000);
        return () => clearInterval(id);
    }, [expiresIn]);

    // 60-second resend cooldown timer
    useEffect(() => {
        if (cooldown <= 0) return;
        const id = setInterval(() => setCooldown(c => Math.max(0, c - 1)), 1000);
        return () => clearInterval(id);
    }, [cooldown]);

    const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2,"0")}:${String(s % 60).padStart(2,"0")}`;

    // Handle digit input
    const handleChange = (val, idx) => {
        if (!/^\d?$/.test(val)) return;
        const next = [...otp];
        next[idx] = val;
        setOtp(next);
        if (val && idx < 5) inputs.current[idx + 1]?.focus();
    };

    const handleKeyDown = (e, idx) => {
        if (e.key === "Backspace" && !otp[idx] && idx > 0) {
            inputs.current[idx - 1]?.focus();
        }
    };

    const handlePaste = (e) => {
        const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
        if (text.length === 6) {
            setOtp(text.split(""));
            inputs.current[5]?.focus();
        }
    };

    const handleVerify = async () => {
        const code = otp.join("");
        if (code.length < 6) { setError("Please enter the 6-digit OTP."); return; }
        setError(""); setLoading(true);
        try {
            const res  = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({ email, otp: code }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.msg || "Verification failed."); return; }

            // Store token and redirect to correct dashboard
            if (role === "doctor") {
                localStorage.setItem("doctorToken", data.token);
                navigate(data.profileCompleted ? "/doctor/dashboard" : "/doctor/onboarding");
            } else {
                localStorage.setItem("patientToken", data.token);
                navigate(data.profileCompleted ? "/dashboard" : "/patient/onboarding");
            }
        } catch {
            setError("Server error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (cooldown > 0 || resending) return;
        setResending(true); setError(""); setSuccess("");
        try {
            const res  = await fetch(`${API_BASE_URL}/auth/resend-otp`, {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({ email }),
            });
            const data = await res.json();
            if (!res.ok) {
                if (res.status === 429 && data.retryAfter) {
                    setCooldown(data.retryAfter);
                }
                setError(data.msg || "Failed to resend OTP.");
                return;
            }
            if (data.devOtp) {
                setDevOtp(data.devOtp);
            }
            setSuccess("New OTP sent! Valid for 10 minutes.");
            setCooldown(60);
            setExpiresIn(600);
            setOtp(["","","","","",""]);
            inputs.current[0]?.focus();
        } catch {
            setError("Server error.");
        } finally {
            setResending(false);
        }
    };

    return (
        <div style={{
            minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
            background: "linear-gradient(135deg, var(--primary-100) 0%, var(--primary-50) 100%)",
            fontFamily: "'Inter', sans-serif", padding: "20px"
        }}>
            <div style={{
                background: "white", borderRadius: "24px", padding: "48px 40px",
                boxShadow: "0 20px 60px rgba(15, 118, 110,0.15)", maxWidth: "440px", width: "100%",
                textAlign: "center"
            }}>
                {/* Icon */}
                <div style={{
                    width: "72px", height: "72px", borderRadius: "50%",
                    background: "linear-gradient(135deg, var(--primary), var(--primary-hover))",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 24px", boxShadow: "0 8px 24px rgba(15, 118, 110,0.3)"
                }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                        <polyline points="22,6 12,13 2,6"/>
                    </svg>
                </div>

                <h1 style={{ fontSize: "26px", fontWeight: "800", color: "#0f172a", margin: "0 0 8px" }}>
                    Verify Your Email
                </h1>
                <p style={{ fontSize: "14px", color: "#64748b", margin: "0 0 8px", lineHeight: 1.6 }}>
                    We sent a 6-digit OTP to
                </p>
                <p style={{ fontSize: "15px", fontWeight: "700", color: "var(--primary)", margin: "0 0 24px" }}>
                    {email}
                </p>

                {devOtp && (
                    <div
                        onClick={() => {
                            setOtp(devOtp.slice(0, 6).split(""));
                            inputs.current[5]?.focus();
                        }}
                        style={{
                            background: "#f0fdfa",
                            border: "1px solid #99f6e4",
                            borderRadius: "12px",
                            padding: "10px 16px",
                            marginBottom: "24px",
                            cursor: "pointer",
                            fontSize: "13px",
                            color: "#0f766e",
                            fontWeight: "600",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between"
                        }}
                    >
                        <span>🔑 Dev OTP: <strong style={{ letterSpacing: "2px", fontSize: "16px", color: "#0d9488" }}>{devOtp}</strong></span>
                        <span style={{ fontSize: "11px", background: "#ccfbf1", color: "#0f766e", padding: "3px 8px", borderRadius: "6px" }}>Click to fill</span>
                    </div>
                )}

                {/* OTP Boxes */}
                <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginBottom: "24px" }} onPaste={handlePaste}>
                    {otp.map((digit, i) => (
                        <input
                            key={i}
                            ref={el => inputs.current[i] = el}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={e => handleChange(e.target.value, i)}
                            onKeyDown={e => handleKeyDown(e, i)}
                            style={{
                                width: "52px", height: "60px", textAlign: "center",
                                fontSize: "24px", fontWeight: "800", color: "#0f172a",
                                border: `2px solid ${digit ? "var(--primary)" : "#e2e8f0"}`,
                                borderRadius: "12px", outline: "none",
                                background: digit ? "var(--primary-50)" : "#f8fafc",
                                transition: "all 0.15s ease",
                                caretColor: "var(--primary)"
                            }}
                            onFocus={e => e.target.style.borderColor = "var(--primary)"}
                            onBlur={e => e.target.style.borderColor = digit ? "var(--primary)" : "#e2e8f0"}
                        />
                    ))}
                </div>

                {/* Timer */}
                <p style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "20px" }}>
                    {expiresIn > 0
                        ? <>OTP is valid for 10 minutes (expires in <strong style={{ color: expiresIn < 60 ? "#ef4444" : "var(--primary)" }}>{formatTime(expiresIn)}</strong>)</>
                        : <span style={{ color: "#ef4444" }}>OTP expired. Please request a new one.</span>
                    }
                </p>

                {/* Error / Success */}
                {error   && <p style={{ color: "#ef4444", fontSize: "14px", fontWeight: "600", marginBottom: "16px" }}>❌ {error}</p>}
                {success && <p style={{ color: "#10b981", fontSize: "14px", fontWeight: "600", marginBottom: "16px" }}>✅ {success}</p>}

                {/* Verify Button */}
                <button
                    onClick={handleVerify}
                    disabled={loading}
                    style={{
                        width: "100%", padding: "16px", borderRadius: "12px", border: "none",
                        background: loading ? "var(--primary-300)" : "linear-gradient(135deg, var(--primary), var(--primary-hover))",
                        color: "white", fontSize: "16px", fontWeight: "700", cursor: loading ? "not-allowed" : "pointer",
                        boxShadow: "0 4px 16px rgba(15, 118, 110,0.3)", transition: "all 0.2s ease",
                        marginBottom: "16px"
                    }}
                >
                    {loading ? "Verifying..." : "Verify OTP"}
                </button>

                {/* Resend */}
                <p style={{ fontSize: "14px", color: "#64748b" }}>
                    Didn't receive it?{" "}
                    <button
                        type="button"
                        onClick={handleResend}
                        disabled={cooldown > 0 || resending}
                        style={{
                            background: "none", border: "none", cursor: cooldown > 0 || resending ? "not-allowed" : "pointer",
                            color: cooldown > 0 || resending ? "#94a3b8" : "var(--primary)",
                            fontWeight: "700", fontSize: "14px", padding: 0
                        }}
                    >
                        {resending ? "Sending..." : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend OTP"}
                    </button>
                </p>

                {/* Back link */}
                <p style={{ marginTop: "20px", fontSize: "13px", color: "#94a3b8" }}>
                    <span
                        onClick={() => navigate(role === "doctor" ? "/doctor/login" : "/patient")}
                        style={{ cursor: "pointer", color: "#64748b", textDecoration: "underline" }}
                    >
                        ← Back to Login
                    </span>
                </p>
            </div>
        </div>
    );
}

export default OtpVerification;
