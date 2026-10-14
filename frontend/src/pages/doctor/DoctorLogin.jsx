import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../style/doctorSignUp.css";
import { API_BASE_URL, GOOGLE_AUTH_ENABLED } from "../../config";

import { describeRequestError } from "../../utils/apiError";
import physio from "../../assets/patient.jpg"; // Using existing asset

function DoctorLogin() {
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
        body: JSON.stringify({ email, password, expectedRole: "doctor" })
      });

      const data = await res.json();

      if (res.status === 403) {
        setError("⚠️ This is a Patient account. Please use the Patient login instead.");
        return;
      }

      // Unverified — redirect to OTP page (backend already resent OTP)
      if (res.status === 401 && data.needsVerification) {
        navigate(`/verify-otp?email=${encodeURIComponent(email)}&role=${data.role || "doctor"}`);
        return;
      }

      if (!res.ok) {
        setError(data.msg || "Login failed");
        return;
      }

      // ✅ Doctor/Admin login only
      localStorage.setItem("doctorToken", data.token);
      if (data.profileCompleted === false) {
        navigate("/doctor/onboarding");
      } else {
        navigate("/doctor/dashboard");
      }
    } catch (err) {
      console.error(err);
      setError(describeRequestError(err));
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${API_BASE_URL}/auth/google/doctor`;
  };

  return (
    <div className="doc-signup-page-wrapper">

      {/* NAVBAR */}
      <nav className="doc-signup-top-nav">
        <div className="nav-logo-box" onClick={() => navigate('/')}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="6" width="18" height="15" rx="2" ry="2" fill="var(--primary-100)" />
            <path d="M8 6V4c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2v2" />
            <line x1="12" y1="10" x2="12" y2="16" />
            <line x1="9" y1="13" x2="15" y2="13" />
          </svg>
          <span className="logo-brand-text">PhysioCare</span>
        </div>
        <div className="nav-actions-box"></div>
      </nav>

      {/* MAIN CONTENT */}
      <div className="doc-signup-content-grid">

        {/* LEFT COLUMN */}
        <div className="doc-signup-left-col">

          <div className="doc-signup-text">
            <h2>Welcome Back to <br /><span>PhysioCare</span></h2>
            <p>
              Log in to manage your appointments, review patient records, <br />
              and provide expert feedback remotely.
            </p>
          </div>

          <div className="doc-signup-image-card">
            <img src={physio} alt="Physiotherapist" />
          </div>

        </div>

        {/* RIGHT COLUMN */}
        <div className="doc-signup-form-wrapper">
          <div className="doc-signup-action-card">
            <h2 className="signup-title">Log In</h2>

            <div className="form-group-box">
              <div className="input-field-wrap">
                <svg className="field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                <input
                  type="email"
                  placeholder="Email address"
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
                  placeholder="Password"
                  autoComplete="new-password"
                  readOnly
                  onFocus={(e) => e.target.removeAttribute('readonly')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                />
              </div>
            </div>

            {error && <p style={{ color: "#dc2626", fontSize: "14px", marginTop: "10px", background: "#fef2f2", padding: "8px", borderRadius: "6px", border: "1px solid #fecaca" }}>{error}</p>}

            <div style={{ textAlign: "right", marginBottom: "24px", marginTop: "8px" }}>
              <span
                onClick={() => navigate("/forgot-password?role=doctor")}
                style={{ color: "var(--primary)", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}
              >
                Forgot password?
              </span>
            </div>

            <button className="submit-action-btn" onClick={handleLogin}>Log In</button>

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
              New here? <span onClick={() => navigate('/doctor/signup')}>Sign up</span>
            </div>

            <div className="footer-links-row">
              <span>Privacy Policy</span>
              <span>Terms of Service</span>
              <span>Help Center</span>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}

export default DoctorLogin;