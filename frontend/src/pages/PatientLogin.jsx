import { useNavigate } from "react-router-dom";
import { useState } from "react";
import "../style/patientLogin.css";
import { API_BASE_URL, GOOGLE_AUTH_ENABLED } from "../config";

import physio from "../assets/patient.jpg"; // Using existing asset

function PatientLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(() =>
    new URLSearchParams(window.location.search).get("expired") ? "Your session expired. Please log in again." : ""
  );

  const handleLogin = async () => {
    setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, expectedRole: "patient" })
      });

      const data = await res.json();

      if (res.status === 403) {
        setError("⚠️ This is a Physiotherapist account. Please use the Physiotherapist login instead.");
        return;
      }

      // Unverified — redirect to OTP page (backend already resent OTP)
      if (res.status === 401 && data.needsVerification) {
        const devOtpQuery = data.devOtp ? `&devOtp=${encodeURIComponent(data.devOtp)}` : "";
        navigate(`/verify-otp?email=${encodeURIComponent(email)}&role=${data.role || "patient"}${devOtpQuery}`);
        return;
      }

      if (!res.ok) {
        setError(data.msg || "Login failed");
        return;
      }

      // ✅ Save token and redirect
      localStorage.setItem("patientToken", data.token);
      if (data.profileCompleted === false) {
        navigate("/patient/onboarding");
      } else {
        navigate("/dashboard");
      }

    } catch (err) {
      console.error(err);
      setError("Server error");
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${API_BASE_URL}/auth/google/patient`;
  };

  return (
    <div className="login-page-wrapper">

      {/* NAVBAR */}
      <nav className="login-top-nav">
        <div className="nav-logo-box" onClick={() => navigate('/')}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="6" width="18" height="15" rx="2" ry="2" fill="var(--primary-100)" />
            <path d="M8 6V4c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2v2" />
            <line x1="12" y1="10" x2="12" y2="16" />
            <line x1="9" y1="13" x2="15" y2="13" />
          </svg>
          <span className="logo-brand-text">PhysioCare</span>
        </div>
        <div className="nav-actions-box">
          <button className="nav-help-btn">
            ?
          </button>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <div className="login-content-grid">

        {/* LEFT CARD */}
        <div className="login-info-card">
          <div className="info-image-wrap">
            <img src={physio} alt="Physiotherapist" />
          </div>

          <div className="info-text-wrap">
            <h2>Welcome Back!</h2>
            <h3>Ready to continue your <span>recovery?</span></h3>
            <p>Log in to access your personalized physiotherapy plans and track your progress.</p>
          </div>

          <div className="info-features-wrap">

            <div className="feature-item-clean">
              <div className="clean-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary-500)" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg></div>
              <div className="clean-text">
                <strong>Secure</strong>
                <span>& Confidential</span>
              </div>
            </div>

            <div className="feature-item-clean">
              <div className="clean-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary-500)" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg></div>
              <div className="clean-text">
                <strong>Access Video</strong>
                <span>Exercises</span>
              </div>
            </div>

            <div className="feature-item-clean">
              <div className="clean-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary-500)" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg></div>
              <div className="clean-text">
                <strong>Track</strong>
                <span>Your Progress</span>
              </div>
            </div>

          </div>
        </div>

        {/* RIGHT CARD */}
        <div className="login-form-wrapper">
          <form className="login-action-card" onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
            <h2 className="login-title"><span>Log In</span> Your Account</h2>

            <div className="form-group-box">
              <label>Email Address</label>
              <div className="input-field-wrap">
                <svg className="field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                <input
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="off"
                  readOnly
                  onFocus={(e) => e.target.removeAttribute('readonly')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group-box">
              <div className="input-field-wrap">
                <svg className="field-icon password-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                <input
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  readOnly
                  onFocus={(e) => e.target.removeAttribute('readonly')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                />
              </div>
            </div>

            <div style={{ textAlign: "right", marginTop: "4px", marginBottom: "8px" }}>
              <span
                onClick={() => navigate("/forgot-password?role=patient")}
                style={{ fontSize: "13px", color: "var(--primary)", fontWeight: "600", cursor: "pointer" }}
              >
                Forgot password?
              </span>
            </div>

            {error && <p style={{ color: "#dc2626", fontSize: "14px", marginTop: "10px", background: "#fef2f2", padding: "8px", borderRadius: "6px", border: "1px solid #fecaca" }}>{error}</p>}
            
            <button type="submit" className="submit-login-btn">Log In</button>

            {GOOGLE_AUTH_ENABLED && (
              <button
                type="button"
                onClick={handleGoogleLogin}
                style={{ width: "100%", marginTop: "10px", padding: "11px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#fff", fontWeight: 600, cursor: "pointer" }}
              >
                Continue with Google
              </button>
            )}

            <div className="signup-link-wrap">
              New here? <span onClick={() => navigate('/patient/signup')}>Sign up</span>
            </div>
          </form>

          <div className="footer-links-row">
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
            <span>Help Center</span>
          </div>
        </div>

      </div>

    </div>
  );
}

export default PatientLogin;