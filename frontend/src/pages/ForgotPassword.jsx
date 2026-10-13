import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "../config";

// Steps: 1 = enter email, 2 = enter OTP + new password, 3 = success
function ForgotPassword() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const role = searchParams.get("role") || "patient";

    const [step, setStep]           = useState(1);
    const [email, setEmail]         = useState("");
    const [otp, setOtp]             = useState(["", "", "", "", "", ""]);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPass, setConfirmPass] = useState("");
    const [error, setError]         = useState("");
    const [loading, setLoading]     = useState(false);
    const [resending, setResending] = useState(false);
    const [expiresIn, setExpiresIn] = useState(600); // 10 minutes
    const [cooldown, setCooldown]   = useState(60);  // 60-second cooldown
    const inputs = useRef([]);

    // 10-minute expiry countdown
    useEffect(() => {
        if (step !== 2 || expiresIn <= 0) return;
        const id = setInterval(() => setExpiresIn(t => Math.max(0, t - 1)), 1000);
        return () => clearInterval(id);
    }, [step, expiresIn]);

    // 60-second cooldown timer
    useEffect(() => {
        if (step !== 2 || cooldown <= 0) return;
        const id = setInterval(() => setCooldown(c => Math.max(0, c - 1)), 1000);
        return () => clearInterval(id);
    }, [step, cooldown]);

    const fmt = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

    // ── Step 1: Send OTP ──────────────────────────────────────────────────────
    const handleSendOtp = async () => {
        if (!email) { setError("Please enter your email."); return; }
        setError(""); setLoading(true);
        try {
            const res  = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });
            const data = await res.json();
            if (!res.ok) {
                if (res.status === 429 && data.retryAfter) {
                    setCooldown(data.retryAfter);
                }
                setError(data.msg || "Failed to send OTP.");
                return;
            }
            setStep(2);
            setExpiresIn(600);
            setCooldown(60);
        } catch { setError("Server error. Try again."); }
        finally { setLoading(false); }
    };

    const handleResendOtp = async () => {
        if (cooldown > 0 || resending) return;
        setResending(true); setError("");
        try {
            const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });
            const data = await res.json();
            if (!res.ok) {
                if (res.status === 429 && data.retryAfter) {
                    setCooldown(data.retryAfter);
                }
                setError(data.msg || "Failed to resend OTP.");
                return;
            }
            setCooldown(60);
            setExpiresIn(600);
            setOtp(["", "", "", "", "", ""]);
            inputs.current[0]?.focus();
        } catch {
            setError("Server error. Try again.");
        } finally {
            setResending(false);
        }
    };

    // ── OTP box handlers ──────────────────────────────────────────────────────
    const handleOtpChange = (val, idx) => {
        if (!/^\d?$/.test(val)) return;
        const next = [...otp]; next[idx] = val; setOtp(next);
        if (val && idx < 5) inputs.current[idx + 1]?.focus();
    };
    const handleOtpKey = (e, idx) => {
        if (e.key === "Backspace" && !otp[idx] && idx > 0) inputs.current[idx - 1]?.focus();
    };
    const handlePaste = e => {
        const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
        if (text.length === 6) { setOtp(text.split("")); inputs.current[5]?.focus(); }
    };

    // ── Step 2: Reset Password ────────────────────────────────────────────────
    const handleReset = async () => {
        const code = otp.join("");
        if (code.length < 6) { setError("Enter the 6-digit OTP."); return; }
        if (!newPassword)    { setError("Enter your new password."); return; }
        if (newPassword !== confirmPass) { setError("Passwords do not match."); return; }
        if (newPassword.length < 6) { setError("Password must be at least 6 characters."); return; }
        setError(""); setLoading(true);
        try {
            const res  = await fetch(`${API_BASE_URL}/auth/reset-password`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, otp: code, newPassword }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.msg || "Reset failed."); return; }
            setStep(3);
        } catch { setError("Server error. Try again."); }
        finally { setLoading(false); }
    };

    const loginPath = role === "doctor" ? "/doctor/login" : "/patient";

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
                    background: step === 3 ? "linear-gradient(135deg,#10b981,#059669)" : "linear-gradient(135deg,var(--primary),var(--primary-hover))",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 24px", boxShadow: step === 3 ? "0 8px 24px rgba(16,185,129,0.3)" : "0 8px 24px rgba(15, 118, 110,0.3)"
                }}>
                    {step === 3
                        ? <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        : <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    }
                </div>

                {/* ── STEP 1: Email ── */}
                {step === 1 && (<>
                    <h1 style={{ fontSize: "24px", fontWeight: "800", color: "#0f172a", margin: "0 0 8px" }}>Forgot Password?</h1>
                    <p style={{ fontSize: "14px", color: "#64748b", margin: "0 0 32px", lineHeight: 1.6 }}>
                        Enter your registered email and we'll send you a 6-digit OTP to reset your password.
                    </p>

                    <input
                        type="email" placeholder="your@email.com" value={email}
                        onChange={e => setEmail(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleSendOtp()}
                        style={{
                            width: "100%", padding: "14px 16px", borderRadius: "12px",
                            border: "2px solid #e2e8f0", fontSize: "15px", outline: "none",
                            boxSizing: "border-box", marginBottom: "16px", color: "#0f172a"
                        }}
                        onFocus={e => e.target.style.borderColor = "var(--primary)"}
                        onBlur={e => e.target.style.borderColor = "#e2e8f0"}
                    />

                    {error && <p style={{ color: "#ef4444", fontSize: "14px", fontWeight: "600", marginBottom: "16px" }}>❌ {error}</p>}

                    <button onClick={handleSendOtp} disabled={loading} style={{
                        width: "100%", padding: "16px", borderRadius: "12px", border: "none",
                        background: loading ? "var(--primary-300)" : "linear-gradient(135deg,var(--primary),var(--primary-hover))",
                        color: "white", fontSize: "16px", fontWeight: "700", cursor: loading ? "not-allowed" : "pointer",
                        boxShadow: "0 4px 16px rgba(15, 118, 110,0.3)", marginBottom: "16px"
                    }}>
                        {loading ? "Sending OTP..." : "Send OTP"}
                    </button>

                    <p style={{ fontSize: "14px", color: "#64748b" }}>
                        Remember it?{" "}
                        <span onClick={() => navigate(loginPath)} style={{ color: "var(--primary)", fontWeight: "700", cursor: "pointer" }}>
                            Back to Login
                        </span>
                    </p>
                </>)}

                {/* ── STEP 2: OTP + New Password ── */}
                {step === 2 && (<>
                    <h1 style={{ fontSize: "24px", fontWeight: "800", color: "#0f172a", margin: "0 0 8px" }}>Reset Password</h1>
                    <p style={{ fontSize: "14px", color: "#64748b", margin: "0 0 4px" }}>OTP sent to</p>
                    <p style={{ fontSize: "15px", fontWeight: "700", color: "var(--primary)", margin: "0 0 24px" }}>{email}</p>

                    {/* OTP Boxes */}
                    <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginBottom: "12px" }} onPaste={handlePaste}>
                        {otp.map((d, i) => (
                            <input key={i} ref={el => inputs.current[i] = el}
                                type="text" inputMode="numeric" maxLength={1} value={d}
                                onChange={e => handleOtpChange(e.target.value, i)}
                                onKeyDown={e => handleOtpKey(e, i)}
                                style={{
                                    width: "46px", height: "54px", textAlign: "center",
                                    fontSize: "22px", fontWeight: "800", color: "#0f172a",
                                    border: `2px solid ${d ? "var(--primary)" : "#e2e8f0"}`,
                                    borderRadius: "10px", outline: "none",
                                    background: d ? "var(--primary-50)" : "#f8fafc"
                                }}
                            />
                        ))}
                    </div>

                    <p style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "20px" }}>
                        {expiresIn > 0
                            ? <>OTP is valid for 10 minutes (expires in <strong style={{ color: expiresIn < 60 ? "#ef4444" : "var(--primary)" }}>{fmt(expiresIn)}</strong>)</>
                            : <span style={{ color: "#ef4444" }}>OTP expired. Please request a new one.</span>
                        }
                    </p>

                    {/* New Password */}
                    <input type="password" placeholder="New Password" value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        style={{
                            width: "100%", padding: "14px 16px", borderRadius: "12px",
                            border: "2px solid #e2e8f0", fontSize: "15px", outline: "none",
                            boxSizing: "border-box", marginBottom: "10px", color: "#0f172a"
                        }}
                        onFocus={e => e.target.style.borderColor = "var(--primary)"}
                        onBlur={e => e.target.style.borderColor = "#e2e8f0"}
                    />
                    <input type="password" placeholder="Confirm New Password" value={confirmPass}
                        onChange={e => setConfirmPass(e.target.value)}
                        style={{
                            width: "100%", padding: "14px 16px", borderRadius: "12px",
                            border: "2px solid #e2e8f0", fontSize: "15px", outline: "none",
                            boxSizing: "border-box", marginBottom: "16px", color: "#0f172a"
                        }}
                        onFocus={e => e.target.style.borderColor = "var(--primary)"}
                        onBlur={e => e.target.style.borderColor = "#e2e8f0"}
                    />

                    {error && <p style={{ color: "#ef4444", fontSize: "14px", fontWeight: "600", marginBottom: "16px" }}>❌ {error}</p>}

                    <button onClick={handleReset} disabled={loading} style={{
                        width: "100%", padding: "16px", borderRadius: "12px", border: "none",
                        background: loading ? "var(--primary-300)" : "linear-gradient(135deg,var(--primary),var(--primary-hover))",
                        color: "white", fontSize: "16px", fontWeight: "700", cursor: loading ? "not-allowed" : "pointer",
                        boxShadow: "0 4px 16px rgba(15, 118, 110,0.3)", marginBottom: "16px"
                    }}>
                        {loading ? "Resetting..." : "Reset Password"}
                    </button>

                    <p style={{ fontSize: "13px", color: "#64748b" }}>
                        Didn't receive it?{" "}
                        <button
                            type="button"
                            onClick={handleResendOtp}
                            disabled={cooldown > 0 || resending}
                            style={{
                                background: "none",
                                border: "none",
                                color: cooldown > 0 || resending ? "#94a3b8" : "var(--primary)",
                                fontWeight: "700",
                                cursor: cooldown > 0 || resending ? "not-allowed" : "pointer",
                                fontSize: "13px",
                                padding: 0
                            }}
                        >
                            {resending ? "Sending..." : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend OTP"}
                        </button>
                    </p>
                </>)}

                {/* ── STEP 3: Success ── */}
                {step === 3 && (<>
                    <h1 style={{ fontSize: "24px", fontWeight: "800", color: "#0f172a", margin: "0 0 12px" }}>Password Reset!</h1>
                    <p style={{ fontSize: "14px", color: "#64748b", marginBottom: "32px", lineHeight: 1.6 }}>
                        Your password has been reset successfully. You can now log in with your new password.
                    </p>
                    <button onClick={() => navigate(loginPath)} style={{
                        width: "100%", padding: "16px", borderRadius: "12px", border: "none",
                        background: "linear-gradient(135deg,#10b981,#059669)",
                        color: "white", fontSize: "16px", fontWeight: "700", cursor: "pointer",
                        boxShadow: "0 4px 16px rgba(16,185,129,0.3)"
                    }}>
                        Go to Login
                    </button>
                </>)}
            </div>
        </div>
    );
}

export default ForgotPassword;
